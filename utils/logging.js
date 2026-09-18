const { getGuildConfig } = require('./storage');
const { buildEmbed } = require('./branding');

async function appendLog(guild, options) {
  try {
    const config = getGuildConfig(guild.id);
    const channelByCategory = {
      members: config.memberLogChannelId,
      moderation: config.moderationLogChannelId,
      tickets: config.ticketLogChannelId,
      boosts: config.boostLogChannelId,
      bot: config.botLogChannelId
    };
    // Mantém compatibilidade com o canal legado enquanto a migração é concluída.
    const channelId = options.channelId || channelByCategory[options.category] || config.logChannelId;
    if (!channelId) {
      console.warn(`[LOG] Nenhum canal configurado para ${options.category || 'evento'} na guild ${guild.id}.`);
      return false;
    }

    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`[LOG] Canal ${channelId} não é um canal de texto acessível na guild ${guild.id}.`);
      return false;
    }

    const embed = options.embed || buildEmbed({
      title: options.title,
      description: options.description,
      color: options.color,
      fields: options.fields,
      footer: options.footer || 'Ernas Helper · Logs'
    });

    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`[LOG] Falha ao enviar ${options.category || 'evento'} na guild ${guild.id}:`, error.code || error.message || error);
    return false;
  }
}

module.exports = { appendLog };
