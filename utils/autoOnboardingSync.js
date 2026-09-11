const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const crypto = require('crypto');
const { getGuildConfig } = require('./storage');
const { onboardingRoleIds, promoteToPlayer } = require('./onboardingRoles');

const DEFAULT_POLL_MS = 5000;
const DEFAULT_RETRY_SECONDS = 60;

function appBaseUrl() {
  const configured = String(process.env.ARKANDIA_INTERNAL_URL || process.env.ARKANDIA_API_URL || '').trim();
  return configured.replace(/\/api\/public\/v1\/?$/, '').replace(/\/+$/, '');
}

function secret() {
  if (process.env.ONBOARDING_SYNC_SECRET) return process.env.ONBOARDING_SYNC_SECRET.trim();
  try {
    const base = fs.readFileSync('/var/tmp/ernas-activity-bot.secret', 'utf8').trim();
    return base ? crypto.createHmac('sha256', base).update('discord-onboarding-sync').digest('hex') : '';
  } catch { return ''; }
}

function activityChannelUrl(guildId) {
  const explicit = String(process.env.DISCORD_ACTIVITY_CHANNEL_URL || '').trim();
  if (/^https:\/\/discord\.com\/channels\/\d{15,22}\/\d{15,22}$/.test(explicit)) return explicit;
  const channelId = String(process.env.DISCORD_ACTIVITY_CHANNEL_ID || '').trim();
  return /^\d{15,22}$/.test(channelId) && /^\d{15,22}$/.test(guildId)
    ? `https://discord.com/channels/${guildId}/${channelId}`
    : null;
}

async function acknowledge(base, id, outcome, error, retryAfterSeconds) {
  const response = await fetch(`${base}/api/internal/onboarding/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-onboarding-sync-secret': secret() },
    body: JSON.stringify({ id, outcome, error: error ? String(error).slice(0, 500) : undefined, retryAfterSeconds }),
  });
  if (!response.ok) throw new Error(`ack HTTP ${response.status}`);
}

async function verifyCharacter(basePublic, apiKey, event) {
  if (!basePublic || !apiKey) return true;
  const response = await fetch(`${basePublic}/personagens/discord/${encodeURIComponent(event.discord_user_id)}`, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`consulta do personagem HTTP ${response.status}`);
  const payload = await response.json().catch(() => null);
  const characterId = payload && typeof payload.id === 'string' ? payload.id : null;
  return !characterId || characterId === event.personagem_id;
}

async function processEvent(client, event) {
  if (!/^\d{15,22}$/.test(String(event.guild_id || '')) || !/^\d{15,22}$/.test(String(event.discord_user_id || ''))) {
    return { outcome: 'failed', error: 'Evento com identificador inválido.' };
  }

  const guild = await client.guilds.fetch(event.guild_id).catch(() => null);
  if (!guild) return { outcome: 'retry', error: 'Servidor não disponível para o helper.', retryAfterSeconds: 300 };

  const config = getGuildConfig(guild.id);
  const roles = onboardingRoleIds(config);
  if (!roles.playerRoleId || (!roles.seedRoleId && !roles.legacyNoviceRoleId)) {
    return { outcome: 'retry', error: 'Cargos do onboarding ainda não configurados.', retryAfterSeconds: 300 };
  }

  const member = await guild.members.fetch(event.discord_user_id).catch(() => null);
  if (!member) return { outcome: 'retry', error: 'Usuário ainda não está no servidor.', retryAfterSeconds: 300 };

  // A criação no site não substitui a conclusão do onboarding nativo. Só
  // promovemos membros que já receberam um dos estados de entrada válidos.
  const hasEntryRole = [roles.seedRoleId, roles.legacyNoviceRoleId]
    .filter(Boolean)
    .some((roleId) => member.roles.cache.has(roleId));
  if (!hasEntryRole && !member.roles.cache.has(roles.playerRoleId)) {
    return { outcome: 'retry', error: 'Aguardando conclusão do onboarding do servidor.', retryAfterSeconds: 60 };
  }

  const basePublic = String(process.env.ARKANDIA_API_URL || '').replace(/\/+$/, '');
  const apiKey = String(process.env.ARKANDIA_API_KEY || '').trim();
  const verified = await verifyCharacter(basePublic, apiKey, event);
  if (!verified) return { outcome: 'retry', error: 'Personagem ainda não está disponível ou mudou.', retryAfterSeconds: 60 };

  const result = await promoteToPlayer(member, config);
  if (!result.ok) {
    if (result.reason === 'hierarchy') return { outcome: 'retry', error: 'Hierarquia do Discord impede a promoção.', retryAfterSeconds: 300 };
    return { outcome: 'retry', error: 'Cargo Jogadores ainda não pode ser aplicado.', retryAfterSeconds: 300 };
  }

  const components = [];
  const tabletopUrl = activityChannelUrl(guild.id);
  if (tabletopUrl) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Abrir Tabletop').setURL(tabletopUrl),
    ));
  }
  await member.user.send({
    content: [
      '✨ **Personagem identificado!**',
      `Encontramos o personagem **${String(event.personagem_nome || 'seu personagem').slice(0, 80)}** vinculado à sua conta Discord.`,
      'O cargo **Jogadores** foi liberado e os canais da comunidade já estão disponíveis.',
      'Quando quiser, abra o Tabletop para começar sua jornada em Tales of Ernas.',
    ].join('\n'),
    components,
  }).catch((error) => console.warn(`[ONBOARDING] DM não entregue para ${member.id}: ${error.code || error.message}`));

  return { outcome: 'completed' };
}

function startAutoOnboardingSync(client) {
  const base = appBaseUrl();
  if (!base || secret().length < 32) {
    console.warn('[ONBOARDING] sincronização automática desativada: ARKANDIA_INTERNAL_URL/ONBOARDING_SYNC_SECRET ausentes.');
    return null;
  }

  const worker = `helper-${process.pid}`;
  const pollMs = Math.max(3000, Math.min(60000, Number(process.env.ONBOARDING_SYNC_POLL_MS || DEFAULT_POLL_MS)));
  let running = false;
  let lastError = '';

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const response = await fetch(`${base}/api/internal/onboarding/sync?worker=${encodeURIComponent(worker)}&limit=5`, {
        headers: { 'x-onboarding-sync-secret': secret(), Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`claim HTTP ${response.status}`);
      const payload = await response.json();
      for (const event of Array.isArray(payload.events) ? payload.events : []) {
        try {
          const result = await processEvent(client, event);
          await acknowledge(base, event.id, result.outcome, result.error, result.retryAfterSeconds);
        } catch (error) {
          console.error('[ONBOARDING] falha ao processar sincronização:', error.message);
          await acknowledge(base, event.id, 'retry', error.message, DEFAULT_RETRY_SECONDS).catch((ackError) => {
            console.error('[ONBOARDING] falha ao devolver evento para retry:', ackError.message);
          });
        }
      }
      lastError = '';
    } catch (error) {
      if (lastError !== error.message) console.warn('[ONBOARDING] fila automática indisponível:', error.message);
      lastError = error.message;
    } finally {
      running = false;
    }
  };

  const timer = setInterval(poll, pollMs);
  timer.unref?.();
  poll();
  console.log(`[ONBOARDING] sincronização automática ativa (poll a cada ${pollMs}ms).`);
  return timer;
}

module.exports = { startAutoOnboardingSync };
