const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../utils/storage');
const { isStaff } = require('../utils/permissions');
const { appendLog } = require('../utils/logging');

function buildTicketActions(closed = false) {
  const row = new ActionRowBuilder();

  if (closed) {
    row.addComponents(
      new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reabrir').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:delete').setLabel('Excluir').setStyle(ButtonStyle.Danger)
    );
    return row;
  }

  row.addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Assumir').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Fechar').setStyle(ButtonStyle.Danger)
  );
  return row;
}

async function createTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  return messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => {
      const stamp = new Date(message.createdTimestamp).toISOString();
      const content = message.content || '[sem texto]';
      return `[${stamp}] ${message.author.tag}: ${content}`;
    })
    .join('\n')
    .slice(-180000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gerencia o ticket atual.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('adicionar')
        .setDescription('Adiciona um membro ao ticket atual.')
        .addUserOption((option) => option.setName('usuario').setDescription('Usuario').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remover')
        .setDescription('Remove um membro do ticket atual.')
        .addUserOption((option) => option.setName('usuario').setDescription('Usuario').setRequired(true))),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      await interaction.reply({ content: 'Apenas a equipe pode usar este comando.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('usuario', true);
    const subcommand = interaction.options.getSubcommand();
    const allow = subcommand === 'adicionar';

    await interaction.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: allow,
      SendMessages: allow,
      ReadMessageHistory: allow
    });

    await interaction.reply({ content: `${user} ${allow ? 'adicionado ao' : 'removido do'} ticket.`, ephemeral: true });
  },

  async handleComponent(interaction) {
    if (!interaction.customId.startsWith('ticket:')) return false;

    if (interaction.customId === 'ticket:create') {
      const modal = new ModalBuilder()
        .setCustomId('ticket:create-modal')
        .setTitle('Abrir ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Como a equipe pode ajudar?')
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(800)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId === 'ticket:create-modal') {
      const config = getGuildConfig(interaction.guild.id);
      if (!config.ticketCategoryId || !config.supportRoleId) {
        await interaction.reply({ content: 'Tickets ainda nao foram configurados.', ephemeral: true });
        return true;
      }

      const alreadyOpen = Object.values(config.tickets || {}).find(
        (ticket) => ticket.ownerId === interaction.user.id && ticket.status === 'open'
      );
      if (alreadyOpen) {
        await interaction.reply({ content: `Voce ja tem um ticket aberto: <#${alreadyOpen.channelId}>`, ephemeral: true });
        return true;
      }

      const reason = interaction.fields.getTextInputValue('reason');
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
        type: ChannelType.GuildText,
        parent: config.ticketCategoryId,
        topic: `Ticket de ${interaction.user.tag} (${interaction.user.id})`,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
        ]
      });

      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[channel.id] = {
          ownerId: interaction.user.id,
          status: 'open',
          reason,
          createdAt: new Date().toISOString(),
          claimedBy: null
        };
      });

      const embed = new EmbedBuilder()
        .setTitle('Ticket aberto')
        .setDescription(`Autor: ${interaction.user}\nMotivo: ${reason}`)
        .setColor(0x3b82f6)
        .setTimestamp();

      await channel.send({
        content: `${interaction.user} <@&${config.supportRoleId}>`,
        embeds: [embed],
        components: [buildTicketActions(false)]
      });

      await appendLog(interaction.guild, {
        title: 'Ticket aberto',
        description: `${interaction.user.tag} abriu ${channel}\nMotivo: ${reason}`,
        color: 0x3b82f6
      });

      await interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
      return true;
    }

    if (!isStaff(interaction.member)) {
      await interaction.reply({ content: 'Apenas a equipe pode usar esta acao.', ephemeral: true });
      return true;
    }

    const config = getGuildConfig(interaction.guild.id);
    const ticket = config.tickets?.[interaction.channel.id];
    if (!ticket) {
      await interaction.reply({ content: 'Este canal nao esta registrado como ticket.', ephemeral: true });
      return true;
    }

    if (interaction.customId === 'ticket:claim') {
      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[interaction.channel.id].claimedBy = interaction.user.id;
      });
      await interaction.reply({ content: `${interaction.user} assumiu este ticket.` });
      return true;
    }

    if (interaction.customId === 'ticket:close') {
      const transcript = await createTranscript(interaction.channel);
      const transcriptChannel = config.transcriptChannelId
        ? await interaction.guild.channels.fetch(config.transcriptChannelId).catch(() => null)
        : null;

      if (transcriptChannel?.isTextBased()) {
        await transcriptChannel.send({
          content: `Transcript de ${interaction.channel.name}`,
          files: [{ attachment: Buffer.from(transcript || 'Sem mensagens.', 'utf8'), name: `${interaction.channel.name}.txt` }]
        });
      }

      await interaction.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false, ViewChannel: true });
      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[interaction.channel.id].status = 'closed';
        guildConfig.tickets[interaction.channel.id].closedAt = new Date().toISOString();
      });

      await interaction.update({ components: [buildTicketActions(true)] });
      await interaction.followUp({ content: 'Ticket fechado.' });
      return true;
    }

    if (interaction.customId === 'ticket:reopen') {
      await interaction.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: true, ViewChannel: true });
      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[interaction.channel.id].status = 'open';
      });
      await interaction.update({ components: [buildTicketActions(false)] });
      await interaction.followUp({ content: 'Ticket reaberto.' });
      return true;
    }

    if (interaction.customId === 'ticket:delete') {
      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        delete guildConfig.tickets[interaction.channel.id];
      });
      await interaction.reply({ content: 'Canal sera excluido em 5 segundos.', ephemeral: true });
      setTimeout(() => interaction.channel.delete('Ticket excluido').catch(() => null), 5000);
      return true;
    }

    return true;
  }
};
