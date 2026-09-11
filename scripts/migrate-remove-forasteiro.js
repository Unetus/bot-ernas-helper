const { Client, GatewayIntentBits } = require('discord.js');
const { updateGuildConfig } = require('../utils/storage');
const { validateRoleHierarchy } = require('../utils/onboardingRoles');

require('dotenv').config({ quiet: true });

const IDS = {
  guild: '1514745357463195759',
  roles: {
    player: '1515505515260543006',
    novice: '1547708804114681906',
    seed: '1547828303367249920',
    outsider: '1547982860701536276'
  },
  channels: {
    about: '1515507019958845441',
    welcomeCategory: '1547725356339957811',
    gameplayCategory: '1547242324885770261'
  }
};

const REASON = 'Remoção do cargo Forasteiro e consolidação do onboarding';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function editOverwrite(channel, roleId, permissions) {
  await channel.permissionOverwrites.edit(roleId, permissions, { reason: REASON });
}

async function removeOverwrite(channel, roleId) {
  if (channel.permissionOverwrites.cache.has(roleId)) {
    await channel.permissionOverwrites.delete(roleId, REASON);
  }
}

async function configureWelcomeAndGameplay(guild) {
  const r = IDS.roles;
  const welcome = guild.channels.cache.get(IDS.channels.welcomeCategory);
  const gameplay = guild.channels.cache.get(IDS.channels.gameplayCategory);
  if (!welcome || !gameplay) throw new Error('Categorias Bem-vindo ou Gameplay não encontradas.');

  await editOverwrite(welcome, r.seed, { ViewChannel: true, ReadMessageHistory: true });
  await editOverwrite(welcome, r.novice, { ViewChannel: true, ReadMessageHistory: true });
  await editOverwrite(welcome, r.player, { ViewChannel: false });
  await removeOverwrite(welcome, r.outsider);

  const welcomeChannels = guild.channels.cache.filter((channel) => channel.parentId === welcome.id);
  for (const channel of welcomeChannels.values()) {
    await editOverwrite(channel, r.seed, { ViewChannel: true, ReadMessageHistory: true });
    await editOverwrite(channel, r.novice, { ViewChannel: true, ReadMessageHistory: true });
    await editOverwrite(channel, r.player, { ViewChannel: false });
    await removeOverwrite(channel, r.outsider);
  }

  await editOverwrite(gameplay, r.seed, { ViewChannel: false });
  await editOverwrite(gameplay, r.novice, { ViewChannel: false });
  await editOverwrite(gameplay, r.player, { ViewChannel: true });
  await removeOverwrite(gameplay, r.outsider);

  const gameplayChannels = guild.channels.cache.filter((channel) => channel.parentId === gameplay.id);
  for (const channel of gameplayChannels.values()) {
    await editOverwrite(channel, r.seed, { ViewChannel: false });
    await editOverwrite(channel, r.novice, { ViewChannel: false });
    await editOverwrite(channel, r.player, { ViewChannel: true });
    await removeOverwrite(channel, r.outsider);
  }

  // O canal Sobre continua sendo o ponto de leitura para os dois estados de
  // entrada e não depende mais do cargo Forasteiro.
  const about = guild.channels.cache.get(IDS.channels.about);
  if (about) {
    await editOverwrite(about, r.seed, { ViewChannel: true, ReadMessageHistory: true });
    await editOverwrite(about, r.novice, { ViewChannel: true, ReadMessageHistory: true });
    await editOverwrite(about, r.player, { ViewChannel: true, ReadMessageHistory: true });
    await removeOverwrite(about, r.outsider);
  }
}

async function configureNativeOnboarding() {
  const endpoint = `https://discord.com/api/v10/guilds/${IDS.guild}/onboarding`;
  const headers = {
    Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Audit-Log-Reason': encodeURIComponent(REASON)
  };
  const currentResponse = await fetch(endpoint, { headers });
  if (!currentResponse.ok) throw new Error(`Falha ao consultar onboarding: HTTP ${currentResponse.status}`);
  const current = await currentResponse.json();
  const playPrompt = (current.prompts || []).find((prompt) => prompt.title === 'Como você pretende vivenciar Ernas?');
  if (!playPrompt) throw new Error('Pergunta de intenção de jogo não encontrada.');

  const prompts = current.prompts.map((prompt) => {
    if (prompt.id !== playPrompt.id) return prompt;
    return {
      ...prompt,
      options: prompt.options.map((option) => {
        const observer = option.title === 'Ainda estou conhecendo';
        const roleIds = observer ? [IDS.roles.novice] : [IDS.roles.seed];
        // Canais escolhidos no onboarding nativo precisam ser legíveis por
        // @everyone. A categoria Bem-vindo continua protegida por cargo e é
        // liberada assim que Novatos/Semente são atribuídos; o ponto público
        // de entrada é o canal Sobre.
        const channelIds = [IDS.channels.about];
        return { ...option, role_ids: roleIds, channel_ids: channelIds };
      })
    };
  });

  const payload = {
    enabled: current.enabled,
    mode: current.mode,
    // O Discord exige no mínimo sete canais/categorias padrão legíveis por
    // @everyone. Mantemos o Bem-vindo privado e usamos pontos públicos do
    // servidor para cumprir essa exigência sem expor o onboarding.
    default_channel_ids: [
      IDS.channels.about,
      IDS.channels.gameplayCategory,
      '1547720267646771321', // Memória
      '1514745360071917589', // Voz
      '1514745360071917591', // Portões
      '1548065487961858118', // Centro
      '1548065516935970906'  // Guilda
    ],
    prompts
  };
  const response = await fetch(endpoint, { method: 'PUT', headers, body: JSON.stringify(payload) });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Falha ao atualizar onboarding: HTTP ${response.status} ${detail.slice(0, 300)}`);
  }
  return { enabled: current.enabled, prompt: playPrompt.title };
}

async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não configurado.');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration] });
  await client.login(process.env.DISCORD_TOKEN);
  try {
    const guild = await client.guilds.fetch(IDS.guild);
    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.members.fetch();

    const hierarchy = await validateRoleHierarchy(guild, [IDS.roles.player, IDS.roles.seed, IDS.roles.novice, IDS.roles.outsider]);
    if (!hierarchy.ok) {
      throw new Error(`Hierarquia impede a migração: ${hierarchy.blockedRoles.map((role) => role.name).join(', ')}`);
    }

    const outsider = guild.roles.cache.get(IDS.roles.outsider);
    if (!outsider) throw new Error('Cargo Forasteiro não encontrado.');
    const novice = guild.roles.cache.get(IDS.roles.novice);
    if (!novice) throw new Error('Cargo Novatos não encontrado.');
    const holders = [...guild.members.cache.values()]
      .filter((member) => !member.user.bot && member.roles.cache.has(outsider.id));

    const migrated = [];
    for (const member of holders) {
      if (!member.roles.cache.has(novice.id)) {
        await member.roles.add(novice.id, 'Migração do Forasteiro para Novatos');
      }
      await member.roles.remove(outsider.id, 'Cargo Forasteiro descontinuado');
      migrated.push({ id: member.id, username: member.user.username, displayName: member.displayName });
    }

    await configureWelcomeAndGameplay(guild);
    const onboarding = await configureNativeOnboarding();
    await outsider.delete(REASON);

    updateGuildConfig(IDS.guild, (config) => {
      config.seedRoleId = IDS.roles.seed;
      config.noviceRoleId = IDS.roles.novice;
      config.playerRoleId = IDS.roles.player;
      config.outsiderRoleId = null;
    });

    console.log(JSON.stringify({
      ok: true,
      migratedCount: migrated.length,
      migrated,
      deletedRole: { id: IDS.roles.outsider, name: 'Forasteiro' },
      welcomeVisibleTo: ['Semente de Ernas', 'Novatos'],
      onboarding
    }, null, 2));
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
