const { SlashCommandBuilder } = require('discord.js');
const { Colors, Symbols, BOT_NAME, buildEmbed } = require('../utils/branding');
const { getGuildConfig } = require('../utils/storage');
const { version } = require('../package.json');

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sobre')
    .setDescription('Informações sobre o bot.'),

  async execute(interaction) {
    const { client } = interaction;
    const config = getGuildConfig(interaction.guild.id);

    const openTickets = Object.values(config.tickets || {}).filter((t) => t.status === 'open').length;
    const closedTickets = Object.values(config.tickets || {}).filter((t) => t.status === 'closed').length;

    const embed = buildEmbed({
      title: BOT_NAME,
      description: 'Bot administrativo com sistema de tickets e logs.',
      color: Colors.PRIMARY,
      thumbnail: client.user.displayAvatarURL({ size: 256 }),
      fields: [
        { name: 'Versão', value: `v${version}`, inline: true },
        { name: 'Uptime', value: formatUptime(client.uptime), inline: true },
        { name: 'Servidores', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Tickets neste servidor', value: `${Symbols.OPEN} ${openTickets} abertos ${Symbols.DOT} ${Symbols.FILLED} ${closedTickets} fechados`, inline: false },
        { name: 'Repositório', value: '[GitHub](https://github.com/Unetus/bot-ernas-helper)', inline: true },
        { name: 'discord.js', value: `v${require('discord.js').version}`, inline: true }
      ]
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
