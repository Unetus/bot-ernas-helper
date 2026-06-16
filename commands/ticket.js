const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../utils/storage');
const { isStaff } = require('../utils/permissions');
const { appendLog } = require('../utils/logging');
const { Colors, Symbols, buildEmbed } = require('../utils/branding');

// ---------------------------------------------------------------------------
// Botoes de acao do ticket
// ---------------------------------------------------------------------------
function buildTicketActions(closed = false) {
  const row = new ActionRowBuilder();

  if (closed) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:reopen')
        .setLabel('Reabrir')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ticket:delete')
        .setLabel('Excluir')
        .setStyle(ButtonStyle.Danger)
    );
    return row;
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel('Assumir')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Fechar')
      .setStyle(ButtonStyle.Danger)
  );
  return row;
}

function buildDeleteConfirmation() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:delete-confirm')
      .setLabel('Confirmar exclusão')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:delete-cancel')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
  );
}

// ---------------------------------------------------------------------------
// Transcript com header
// ---------------------------------------------------------------------------
async function createTranscript(channel, ticket) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const header = [
    Symbols.DIVIDER,
    `  TRANSCRIPT ${Symbols.DASH} ${channel.name}`,
    Symbols.DIVIDER,
    `  Autor     : ${ticket.ownerId}`,
    `  Motivo    : ${ticket.reason || 'Não informado'}`,
    `  Criado em : ${ticket.createdAt || 'N/A'}`,
    `  Fechado em: ${ticket.closedAt || 'N/A'}`,
    `  Assumido  : ${ticket.claimedBy || 'Ninguém'}`,
    Symbols.DIVIDER,
    ''
  ].join('\n');

  const body = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => {
      const stamp = new Date(message.createdTimestamp).toISOString();
      const content = message.content || '[sem texto]';
      return `[${stamp}] ${message.author.tag}: ${content}`;
    })
    .join('\n')
    .slice(-170000);

  return header + body;
}

// ---------------------------------------------------------------------------
// Formatar duracao
// ---------------------------------------------------------------------------
function formatDuration(startISO, endISO) {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date();
  const diff = Math.abs(end - start);

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
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
      await interaction.reply({
        embeds: [buildEmbed({
          description: 'Apenas a equipe pode usar este comando.',
          color: Colors.DANGER
        })],
        ephemeral: true
      });
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

    await interaction.reply({
      embeds: [buildEmbed({
        description: `${user} foi ${allow ? 'adicionado ao' : 'removido do'} ticket.`,
        color: allow ? Colors.SUCCESS : Colors.WARNING
      })],
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    if (!interaction.customId.startsWith('ticket:')) return false;

    // ----- Criar modal -----
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

    // ----- Criar ticket -----
    if (interaction.customId === 'ticket:create-modal') {
      const config = getGuildConfig(interaction.guild.id);
      if (!config.ticketCategoryId || !config.supportRoleId) {
        await interaction.reply({
          embeds: [buildEmbed({
            description: 'Tickets ainda não foram configurados. Use `/configurar tickets` primeiro.',
            color: Colors.DANGER
          })],
          ephemeral: true
        });
        return true;
      }

      const alreadyOpen = Object.values(config.tickets || {}).find(
        (ticket) => ticket.ownerId === interaction.user.id && ticket.status === 'open'
      );
      if (alreadyOpen) {
        await interaction.reply({
          embeds: [buildEmbed({
            description: `Você já tem um ticket aberto: <#${alreadyOpen.channelId}>`,
            color: Colors.WARNING
          })],
          ephemeral: true
        });
        return true;
      }

      const reason = interaction.fields.getTextInputValue('reason');

      // Gerar numero sequencial
      const ticketNumber = updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.ticketCounter = (guildConfig.ticketCounter || 0) + 1;
      }).ticketCounter;

      const paddedNumber = String(ticketNumber).padStart(4, '0');

      const channel = await interaction.guild.channels.create({
        name: `ticket-${paddedNumber}`,
        type: ChannelType.GuildText,
        parent: config.ticketCategoryId,
        topic: `Ticket ${Symbols.TICKET}${paddedNumber} ${Symbols.DASH} ${interaction.user.tag} (${interaction.user.id})`,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
        ]
      });

      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[channel.id] = {
          channelId: channel.id,
          ownerId: interaction.user.id,
          number: ticketNumber,
          status: 'open',
          reason,
          createdAt: new Date().toISOString(),
          claimedBy: null,
          closedAt: null
        };
      });

      // Embed principal do ticket
      const ticketEmbed = buildEmbed({
        title: `Ticket ${Symbols.TICKET}${paddedNumber}`,
        color: Colors.PRIMARY,
        fields: [
          { name: 'Autor', value: `${interaction.user}`, inline: true },
          { name: 'Status', value: `${Symbols.OPEN} Aberto`, inline: true },
          { name: 'Motivo', value: reason }
        ],
        footer: `Ernas Helper ${Symbols.DOT} Ticket ${Symbols.TICKET}${paddedNumber}`
      });

      await channel.send({
        content: `${interaction.user} <@&${config.supportRoleId}>`,
        embeds: [ticketEmbed],
        components: [buildTicketActions(false)]
      });

      // Mensagem de boas-vindas
      const welcomeEmbed = buildEmbed({
        description: [
          `Olá, ${interaction.user}!`,
          '',
          'Sua solicitação foi recebida. A equipe responderá em breve.',
          '',
          `${Symbols.ARROW} Enquanto aguarda, sinta-se à vontade para adicionar mais detalhes.`
        ].join('\n'),
        color: Colors.MUTED,
        footer: `Ernas Helper ${Symbols.DOT} Aguardando atendimento`
      });

      await channel.send({ embeds: [welcomeEmbed] });

      await appendLog(interaction.guild, {
        title: 'Ticket aberto',
        description: `${interaction.user.tag} abriu ${channel}\nMotivo: ${reason}`,
        color: Colors.PRIMARY
      });

      await interaction.reply({
        embeds: [buildEmbed({
          description: `Ticket criado: ${channel}`,
          color: Colors.SUCCESS
        })],
        ephemeral: true
      });
      return true;
    }

    // ----- Cancelar exclusão -----
    if (interaction.customId === 'ticket:delete-cancel') {
      await interaction.update({
        embeds: [buildEmbed({
          description: 'Exclusão cancelada.',
          color: Colors.MUTED
        })],
        components: []
      });
      return true;
    }

    // ----- Confirmar exclusão -----
    if (interaction.customId === 'ticket:delete-confirm') {
      const config = getGuildConfig(interaction.guild.id);
      const ticket = config.tickets?.[interaction.channel.id];

      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        delete guildConfig.tickets[interaction.channel.id];
      });

      await appendLog(interaction.guild, {
        title: 'Ticket excluído',
        description: [
          `Canal: ${interaction.channel.name}`,
          `Excluído por: ${interaction.user.tag}`,
          ticket ? `Autor original: <@${ticket.ownerId}>` : ''
        ].filter(Boolean).join('\n'),
        color: Colors.DANGER
      });

      await interaction.update({
        embeds: [buildEmbed({
          description: 'Canal será excluído em 5 segundos.',
          color: Colors.DANGER
        })],
        components: []
      });
      setTimeout(() => interaction.channel.delete('Ticket excluído').catch(() => null), 5000);
      return true;
    }

    // ----- Verificar staff para demais ações -----
    if (!isStaff(interaction.member)) {
      await interaction.reply({
        embeds: [buildEmbed({
          description: 'Apenas a equipe pode usar esta ação.',
          color: Colors.DANGER
        })],
        ephemeral: true
      });
      return true;
    }

    const config = getGuildConfig(interaction.guild.id);
    const ticket = config.tickets?.[interaction.channel.id];
    if (!ticket) {
      await interaction.reply({
        embeds: [buildEmbed({
          description: 'Este canal não está registrado como ticket.',
          color: Colors.WARNING
        })],
        ephemeral: true
      });
      return true;
    }

    const paddedNum = String(ticket.number || '?').padStart(4, '0');

    // ----- Assumir -----
    if (interaction.customId === 'ticket:claim') {
      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[interaction.channel.id].claimedBy = interaction.user.id;
      });

      await interaction.reply({
        embeds: [buildEmbed({
          title: `Ticket ${Symbols.TICKET}${paddedNum} ${Symbols.DASH} Assumido`,
          description: `${interaction.user} assumiu este ticket.`,
          color: Colors.INFO,
          footer: `Ernas Helper ${Symbols.DOT} Atendimento iniciado`
        })]
      });
      return true;
    }

    // ----- Fechar -----
    if (interaction.customId === 'ticket:close') {
      const transcript = await createTranscript(interaction.channel, ticket);
      const transcriptChannel = config.transcriptChannelId
        ? await interaction.guild.channels.fetch(config.transcriptChannelId).catch(() => null)
        : null;

      if (transcriptChannel?.isTextBased()) {
        await transcriptChannel.send({
          embeds: [buildEmbed({
            title: `Transcript ${Symbols.DASH} ticket-${paddedNum}`,
            fields: [
              { name: 'Autor', value: `<@${ticket.ownerId}>`, inline: true },
              { name: 'Fechado por', value: `${interaction.user}`, inline: true },
              { name: 'Duração', value: formatDuration(ticket.createdAt), inline: true }
            ],
            color: Colors.MUTED
          })],
          files: [{ attachment: Buffer.from(transcript || 'Sem mensagens.', 'utf8'), name: `ticket-${paddedNum}.txt` }]
        });
      }

      const closedAt = new Date().toISOString();
      await interaction.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false, ViewChannel: true });
      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[interaction.channel.id].status = 'closed';
        guildConfig.tickets[interaction.channel.id].closedAt = closedAt;
      });

      await interaction.update({ components: [buildTicketActions(true)] });

      await interaction.followUp({
        embeds: [buildEmbed({
          title: `Ticket ${Symbols.TICKET}${paddedNum} ${Symbols.DASH} Fechado`,
          fields: [
            { name: 'Fechado por', value: `${interaction.user}`, inline: true },
            { name: 'Duração', value: formatDuration(ticket.createdAt, closedAt), inline: true },
            { name: 'Assumido por', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Ninguém', inline: true }
          ],
          color: Colors.DANGER,
          footer: `Ernas Helper ${Symbols.DOT} Ticket encerrado`
        })]
      });

      await appendLog(interaction.guild, {
        title: 'Ticket fechado',
        description: `${interaction.channel.name} fechado por ${interaction.user.tag}`,
        color: Colors.DANGER
      });

      return true;
    }

    // ----- Reabrir -----
    if (interaction.customId === 'ticket:reopen') {
      await interaction.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: true, ViewChannel: true });
      updateGuildConfig(interaction.guild.id, (guildConfig) => {
        guildConfig.tickets[interaction.channel.id].status = 'open';
        guildConfig.tickets[interaction.channel.id].closedAt = null;
      });

      await interaction.update({ components: [buildTicketActions(false)] });

      await interaction.followUp({
        embeds: [buildEmbed({
          title: `Ticket ${Symbols.TICKET}${paddedNum} ${Symbols.DASH} Reaberto`,
          description: `${interaction.user} reabriu este ticket.`,
          color: Colors.SUCCESS,
          footer: `Ernas Helper ${Symbols.DOT} Atendimento retomado`
        })]
      });
      return true;
    }

    // ----- Excluir (pede confirmação) -----
    if (interaction.customId === 'ticket:delete') {
      await interaction.reply({
        embeds: [buildEmbed({
          title: 'Confirmar exclusão',
          description: [
            'Este ticket será excluído permanentemente.',
            '',
            `${Symbols.ARROW} Todas as mensagens serão perdidas.`,
            `${Symbols.ARROW} Esta ação não pode ser desfeita.`
          ].join('\n'),
          color: Colors.DANGER
        })],
        components: [buildDeleteConfirmation()],
        ephemeral: false
      });
      return true;
    }

    return true;
  }
};
