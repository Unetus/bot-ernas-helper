const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('./storage');

async function appendLog(guild, options) {
  const config = getGuildConfig(guild.id);
  if (!config.logChannelId) return;

  const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = options.embed || new EmbedBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setColor(options.color || 0x3498db)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = { appendLog };
