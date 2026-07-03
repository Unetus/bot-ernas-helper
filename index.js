const path = require('path');
const fs = require('fs');
require('dotenv').config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
  ActivityType
} = require('discord.js');

const { appendLog } = require('./utils/logging');
const { Colors, Symbols, buildEmbed } = require('./utils/branding');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('[ERRO] DISCORD_TOKEN nao configurado. Crie um arquivo .env ou configure a variavel de ambiente.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

// ---------------------------------------------------------------------------
// Carregamento de comandos
// ---------------------------------------------------------------------------
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`[COMMANDS] ${Symbols.CHECK} ${command.data.name}`);
  } else {
    console.warn(`[COMMANDS] ${Symbols.CROSS} ${file} nao exporta data/execute.`);
  }
}

// ---------------------------------------------------------------------------
// Publicação de comandos e atividade
// ---------------------------------------------------------------------------
const commandPayload = client.commands.map((command) => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);

client.once(Events.ClientReady, async () => {
  console.log(`[BOT] Logado como ${client.user.tag}`);

  client.user.setActivity('tickets', { type: ActivityType.Watching });

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandPayload });
    console.log(`[BOT] ${commandPayload.length} comandos slash publicados.`);
  } catch (error) {
    console.error('[BOT] Erro ao publicar comandos slash:', error);
  }
});

// ---------------------------------------------------------------------------
// Interações
// ---------------------------------------------------------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      console.log(`[CMD] ${interaction.user.tag} usou /${interaction.commandName}`);
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      for (const command of client.commands.values()) {
        if (command.handleComponent && await command.handleComponent(interaction)) {
          return;
        }
      }
    }
  } catch (error) {
    console.error('[ERRO] Erro ao processar interacao:', error);
    const payload = {
      embeds: [buildEmbed({
        description: 'Houve um erro ao executar essa ação.',
        color: Colors.DANGER
      })],
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
});

// ---------------------------------------------------------------------------
// Logs de membros
// ---------------------------------------------------------------------------
client.on(Events.GuildMemberAdd, async (member) => {
  await appendLog(member.guild, {
    title: 'Membro entrou',
    color: Colors.SUCCESS,
    fields: [
      { name: 'Usuário', value: `${member.user.tag}`, inline: true },
      { name: 'ID', value: member.id, inline: true },
      { name: 'Conta criada em', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
    ]
  });
});

client.on(Events.GuildMemberRemove, async (member) => {
  await appendLog(member.guild, {
    title: 'Membro saiu',
    color: Colors.WARNING,
    fields: [
      { name: 'Usuário', value: `${member.user.tag}`, inline: true },
      { name: 'ID', value: member.id, inline: true }
    ]
  });
});

// ---------------------------------------------------------------------------
// Logs de mensagens
// ---------------------------------------------------------------------------
client.on(Events.MessageDelete, async (message) => {
  if (!message.guild || message.author?.bot) return;

  await appendLog(message.guild, {
    title: 'Mensagem apagada',
    color: Colors.DANGER,
    fields: [
      { name: 'Canal', value: `${message.channel}`, inline: true },
      { name: 'Autor', value: `${message.author?.tag || 'desconhecido'} (${message.author?.id || 'N/A'})`, inline: true },
      { name: 'Conteúdo', value: message.content ? message.content.slice(0, 1024) : 'Indisponível' }
    ]
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  await appendLog(newMessage.guild, {
    title: 'Mensagem editada',
    color: Colors.WARNING,
    fields: [
      { name: 'Canal', value: `${newMessage.channel}`, inline: true },
      { name: 'Autor', value: `${newMessage.author?.tag || 'desconhecido'} (${newMessage.author?.id || 'N/A'})`, inline: true },
      { name: 'Antes', value: (oldMessage.content || 'Indisponível').slice(0, 1024) },
      { name: 'Depois', value: (newMessage.content || 'Indisponível').slice(0, 1024) }
    ]
  });
});

// ---------------------------------------------------------------------------
// Tratamento de erros globais
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('[ERRO] Rejeicao nao tratada:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[ERRO] Excecao nao capturada:', error);
});

client.on(Events.Error, (error) => {
  console.error('[ERRO] Erro do cliente Discord:', error);
});

client.on(Events.ShardError, (error) => {
  console.error('[ERRO] Erro de shard:', error);
});

client.login(token);
