const { getGuildConfig } = require('./storage');
const { buildEmbed } = require('./branding');

async function appendLog(guild, options) {
  const config = getGuildConfig(guild.id);
  if (!config.logChannelId) return;

  const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = options.embed || buildEmbed({
    title: options.title,
    description: options.description,
    color: options.color,
    fields: options.fields,
    footer: options.footer || 'Ernas Helper · Logs'
  });

  await channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = { appendLog };
