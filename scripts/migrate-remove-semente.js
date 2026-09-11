const { Client, GatewayIntentBits } = require('discord.js');
const { updateGuildConfig } = require('../utils/storage');
const { validateRoleHierarchy } = require('../utils/onboardingRoles');

require('dotenv').config({ quiet: true });

const IDS = {
  guild: '1514745357463195759',
  roles: {
    player: '1515505515260543006',
    novice: '1547708804114681906',
    seed: '1547828303367249920'
  },
  channels: {
    about: '1515507019958845441',
    gameplayCategory: '1547242324885770261'
  }
};

const REASON = 'Consolidação do onboarding no cargo Novatos';

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
      options: prompt.options.map((option) => ({
        ...option,
        role_ids: [IDS.roles.novice],
        // Canais do onboarding precisam ser legíveis por @everyone.
        channel_ids: [IDS.channels.about]
      }))
    };
  });

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      enabled: current.enabled,
      mode: current.mode,
      default_channel_ids: current.default_channel_ids || [
        IDS.channels.about,
        IDS.channels.gameplayCategory,
        '1547720267646771321',
        '1514745360071917589',
        '1514745360071917591',
        '1548065487961858118',
        '1548065516935970906'
      ],
      prompts
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Falha ao atualizar onboarding: HTTP ${response.status} ${detail.slice(0, 300)}`);
  }
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

    const hierarchy = await validateRoleHierarchy(guild, [IDS.roles.player, IDS.roles.novice, IDS.roles.seed]);
    if (!hierarchy.ok) throw new Error(`Hierarquia impede a migração: ${hierarchy.blockedRoles.map((role) => role.name).join(', ')}`);

    const seed = guild.roles.cache.get(IDS.roles.seed);
    const novice = guild.roles.cache.get(IDS.roles.novice);
    if (!seed) throw new Error('Cargo Semente de Ernas não encontrado.');
    if (!novice) throw new Error('Cargo Novatos não encontrado.');

    const holders = [...guild.members.cache.values()]
      .filter((member) => !member.user.bot && member.roles.cache.has(seed.id));
    const migrated = [];
    for (const member of holders) {
      const hasPlayer = member.roles.cache.has(IDS.roles.player);
      if (!hasPlayer && !member.roles.cache.has(novice.id)) {
        await member.roles.add(novice.id, 'Migração da Semente de Ernas para Novatos');
      }
      await member.roles.remove(seed.id, 'Cargo Semente de Ernas descontinuado');
      migrated.push({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        destination: hasPlayer ? 'Jogadores' : 'Novatos'
      });
    }

    // Limpa overrides órfãos antes de apagar o cargo.
    for (const channel of guild.channels.cache.values()) {
      if (!channel.permissionOverwrites?.cache) continue;
      if (channel.permissionOverwrites.cache.has(seed.id)) {
        await channel.permissionOverwrites.delete(seed.id, REASON);
      }
    }

    await configureNativeOnboarding();
    await seed.delete(REASON);
    updateGuildConfig(IDS.guild, (config) => {
      config.seedRoleId = null;
      config.noviceRoleId = IDS.roles.novice;
      config.playerRoleId = IDS.roles.player;
      config.outsiderRoleId = null;
    });

    console.log(JSON.stringify({
      ok: true,
      migratedCount: migrated.length,
      migrated,
      deletedRole: { id: IDS.roles.seed, name: 'Semente de Ernas' },
      onboardingRole: 'Novatos'
    }, null, 2));
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
