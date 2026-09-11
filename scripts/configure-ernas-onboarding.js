const {
  Client,
  GatewayIntentBits
} = require('discord.js');
const { updateGuildConfig } = require('../utils/storage');
const { validateRoleHierarchy } = require('../utils/onboardingRoles');

require('dotenv').config({ quiet: true });

const IDS = {
  guild: '1514745357463195759',
  roles: {
    player: '1515505515260543006',
    legacyNovice: '1547708804114681906'
  },
  channels: {
    about: '1515507019958845441',
    supportCategory: '1516503470608355480',
    ticketPanel: '1516503523796455606',
    welcomeCategory: '1547725356339957811',
    faq: '1547708134506889246',
    noviceChat: '1547708814781059113',
    startHere: '1547724809482272788',
    createPlayer: '1547724811139031060',
    gameplayCategory: '1547242324885770261',
    platform: '1547242445463363655',
    tabletop: '1547242590758510592',
    token: '1547250392427925546',
    voiceGeneral: '1514745360071917591',
    generalChat: '1547838941011644518',
    funChat: '1547838985735372881',
    commands: '1547839069134917722'
  },
  restrictedCategories: [
    '1524528385253052638', // Mural
    '1547718495775752214', // Atividades
    '1547720267646771321', // Memória
    '1547723766191231117', // Comunidade
    '1529140345064128613', // Área do jogador
    '1514745360071917589'  // Canais de voz
  ]
};

const REASON = 'Ajuste do fluxo de onboarding de Tales of Ernas';

async function editOverwrite(channel, roleId, permissions) {
  await channel.permissionOverwrites.edit(roleId, permissions, { reason: REASON });
}

async function deleteOverwrite(channel, roleId) {
  if (!channel.permissionOverwrites.cache.has(roleId)) return;
  await channel.permissionOverwrites.delete(roleId, REASON);
}

async function configurePermissions(guild) {
  const c = IDS.channels;
  const r = IDS.roles;
  const everyone = guild.id;
  const fetchChannel = async (id) => guild.channels.cache.get(id) || guild.channels.fetch(id);

  const welcomeCategory = await fetchChannel(c.welcomeCategory);
  await editOverwrite(welcomeCategory, r.legacyNovice, {
    ViewChannel: true,
    ReadMessageHistory: true
  });
  // Jogadores já aprovados continuam podendo consultar o onboarding e o FAQ.
  await editOverwrite(welcomeCategory, r.player, {
    ViewChannel: true,
    ReadMessageHistory: true
  });

  for (const id of [c.startHere, c.faq, c.createPlayer]) {
    const channel = await fetchChannel(id);
    await editOverwrite(channel, everyone, { SendMessages: false });
    await editOverwrite(channel, r.legacyNovice, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true,
      UseApplicationCommands: true
    });
    await editOverwrite(channel, r.player, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true
    });
  }

  // Garante que qualquer canal novo criado dentro de Bem-vindo siga a mesma
  // regra: Novatos e Jogadores podem consultar o onboarding, sem permissão
  // de escrita para Jogadores.
  for (const channel of guild.channels.cache.values()) {
    if (channel.parentId !== welcomeCategory.id || !channel.permissionOverwrites?.cache) continue;
    await editOverwrite(channel, r.legacyNovice, {
      ViewChannel: true,
      ReadMessageHistory: true
    });
    await editOverwrite(channel, r.player, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true
    });
  }

  const noviceChat = await fetchChannel(c.noviceChat);
  await editOverwrite(noviceChat, everyone, { SendMessages: false });
  await editOverwrite(noviceChat, r.legacyNovice, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    EmbedLinks: true,
    AttachFiles: true,
    AddReactions: true,
    UseApplicationCommands: true
  });
  await editOverwrite(noviceChat, r.player, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  });

  for (const id of [c.supportCategory, c.ticketPanel]) {
    const channel = await fetchChannel(id);
    await editOverwrite(channel, r.player, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      UseApplicationCommands: true
    });
    await editOverwrite(channel, r.legacyNovice, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      UseApplicationCommands: true
    });
  }

  const gameplayCategory = await fetchChannel(c.gameplayCategory);
  await editOverwrite(gameplayCategory, r.legacyNovice, { ViewChannel: false });
  await editOverwrite(gameplayCategory, r.player, { ViewChannel: true });

  for (const id of [c.platform, c.tabletop, c.token]) {
    const channel = await fetchChannel(id);
    await editOverwrite(channel, r.legacyNovice, { ViewChannel: false });
    await editOverwrite(channel, r.player, { ViewChannel: true });
  }

  for (const id of [c.generalChat, c.funChat, c.commands]) {
    const channel = await fetchChannel(id);
    await deleteOverwrite(channel, everyone);
    await editOverwrite(channel, r.legacyNovice, { ViewChannel: false });
  }

  for (const id of IDS.restrictedCategories) {
    const category = await fetchChannel(id);
    await editOverwrite(category, r.legacyNovice, { ViewChannel: false });
  }

  const about = await fetchChannel(c.about);
  await editOverwrite(about, everyone, { ViewChannel: true, SendMessages: false });
  await editOverwrite(about, r.player, { ViewChannel: true, ReadMessageHistory: true });
}

function serializeOption(option) {
  return {
    id: option.id,
    title: option.title,
    description: option.description || null,
    emoji_id: option.emoji?.id || null,
    emoji_name: option.emoji?.name || null,
    emoji_animated: Boolean(option.emoji?.animated),
    role_ids: option.role_ids || [],
    channel_ids: option.channel_ids || []
  };
}

function serializePrompt(prompt) {
  return {
    id: prompt.id,
    type: prompt.type,
    title: prompt.title,
    single_select: prompt.single_select,
    required: prompt.required,
    in_onboarding: prompt.in_onboarding,
    options: prompt.options.map(serializeOption)
  };
}

async function inspectNativeOnboarding() {
  const endpoint = `https://discord.com/api/v10/guilds/${IDS.guild}/onboarding`;
  const headers = {
    Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Audit-Log-Reason': encodeURIComponent(REASON)
  };

  const currentResponse = await fetch(endpoint, { headers });
  if (!currentResponse.ok) {
    throw new Error(`Falha ao consultar onboarding: HTTP ${currentResponse.status}`);
  }
  const current = await currentResponse.json();
  const prompts = current.prompts.map(serializePrompt);
  const playPrompt = prompts.find((prompt) => prompt.title === 'Como você pretende vivenciar Ernas?');
  if (!playPrompt || playPrompt.options.length < 4) {
    throw new Error('Pergunta de intenção de jogo não encontrada no onboarding.');
  }

  return {
    enabled: current.enabled,
    firstThreeUseSeed: false,
    firstThreeUseLegacyNovice: playPrompt.options.slice(0, 3).every((option) => option.role_ids.includes(IDS.roles.legacyNovice)),
    observerHandledByBot: false
  };
}

async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não configurado.');

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  await client.login(process.env.DISCORD_TOKEN);
  try {
    const guild = await client.guilds.fetch(IDS.guild);
    await guild.roles.fetch();
    await guild.channels.fetch();

    await configurePermissions(guild);
    const onboarding = await inspectNativeOnboarding();
    updateGuildConfig(IDS.guild, (config) => {
      config.seedRoleId = null;
      config.noviceRoleId = IDS.roles.legacyNovice;
      config.outsiderRoleId = null;
      config.playerRoleId = IDS.roles.player;
      config.noviceChannelId = IDS.channels.noviceChat;
    });

    const hierarchy = await validateRoleHierarchy(guild, [
      IDS.roles.player,
      IDS.roles.legacyNovice
    ]);

    console.log(JSON.stringify({
      permissionsConfigured: true,
      onboardingEnabled: onboarding.enabled,
      firstThreeUseSeed: onboarding.firstThreeUseSeed,
      firstThreeUseLegacyNovice: onboarding.firstThreeUseLegacyNovice,
      observerHandledByBot: onboarding.observerHandledByBot,
      hierarchyOk: hierarchy.ok,
      botRole: hierarchy.botRole.name,
      blockedRoles: hierarchy.blockedRoles.map((role) => role.name)
    }, null, 2));
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
