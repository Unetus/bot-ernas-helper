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
  EmbedBuilder
} = require('discord.js');

const { appendLog } = require('./utils/logging');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('DISCORD_TOKEN nao configurado. Crie um arquivo .env ou configure a variavel de ambiente.');
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

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARNING] ${file} nao exporta data/execute.`);
  }
}

const commandPayload = client.commands.map((command) => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);

client.once(Events.ClientReady, async () => {
  console.log(`Bot logado como ${client.user.tag}`);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandPayload });
    console.log(`${commandPayload.length} comandos slash publicados.`);
  } catch (error) {
    console.error('Erro ao publicar comandos slash:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() || interaction.isModalSubmit()) {
      for (const command of client.commands.values()) {
        if (command.handleComponent && await command.handleComponent(interaction)) {
          return;
        }
      }
    }
  } catch (error) {
    console.error('Erro ao processar interacao:', error);
    const payload = { content: 'Houve um erro ao executar essa acao.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await appendLog(member.guild, {
    title: 'Membro entrou',
    description: `${member.user.tag} (${member.id})`,
    color: 0x2ecc71
  });
});

client.on(Events.GuildMemberRemove, async (member) => {
  await appendLog(member.guild, {
    title: 'Membro saiu',
    description: `${member.user.tag} (${member.id})`,
    color: 0xe67e22
  });
});

client.on(Events.MessageDelete, async (message) => {
  if (!message.guild || message.author?.bot) return;
  await appendLog(message.guild, {
    title: 'Mensagem apagada',
    description: [
      `Canal: ${message.channel}`,
      `Autor: ${message.author?.tag || 'desconhecido'} (${message.author?.id || 'sem id'})`,
      message.content ? `Conteudo: ${message.content.slice(0, 900)}` : 'Conteudo indisponivel'
    ].join('\n'),
    color: 0xe74c3c
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle('Mensagem editada')
    .setColor(0xf1c40f)
    .setDescription(`Canal: ${newMessage.channel}\nAutor: ${newMessage.author.tag} (${newMessage.author.id})`)
    .addFields(
      { name: 'Antes', value: (oldMessage.content || 'Indisponivel').slice(0, 1024) },
      { name: 'Depois', value: (newMessage.content || 'Indisponivel').slice(0, 1024) }
    );

  await appendLog(newMessage.guild, { embed });
});

client.login(token);
