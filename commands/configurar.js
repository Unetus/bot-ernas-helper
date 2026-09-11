const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { updateGuildConfig, getGuildConfig } = require('../utils/storage');
const { Colors, Symbols, buildEmbed } = require('../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('configurar')
    .setDescription('Configura canais e cargos do Helper.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('logs')
        .setDescription('Define o canal de logs administrativos.')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal onde os logs serao enviados.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('tickets')
        .setDescription('Define categoria, cargo de suporte e canal de transcript.')
        .addChannelOption((option) =>
          option
            .setName('categoria')
            .setDescription('Categoria onde tickets serao criados.')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
        .addRoleOption((option) =>
          option
            .setName('cargo_suporte')
            .setDescription('Cargo que pode ver e gerenciar tickets.')
            .setRequired(true))
        .addChannelOption((option) =>
          option
            .setName('canal_transcripts')
            .setDescription('Canal para receber historicos dos tickets.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Mostra a configuração atual do bot.')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'logs') {
      const channel = interaction.options.getChannel('canal', true);
      updateGuildConfig(interaction.guild.id, (config) => {
        config.logChannelId = channel.id;
      });

      await interaction.reply({
        embeds: [buildEmbed({
          title: 'Logs configurados',
          description: `Canal de logs definido para ${channel}.`,
          color: Colors.SUCCESS
        })],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'tickets') {
      const category = interaction.options.getChannel('categoria', true);
      const supportRole = interaction.options.getRole('cargo_suporte', true);
      const transcriptChannel = interaction.options.getChannel('canal_transcripts');

      updateGuildConfig(interaction.guild.id, (config) => {
        config.ticketCategoryId = category.id;
        config.supportRoleId = supportRole.id;
        config.transcriptChannelId = transcriptChannel?.id || null;
      });

      const config = getGuildConfig(interaction.guild.id);

      await interaction.reply({
        embeds: [buildEmbed({
          title: 'Tickets configurados',
          color: Colors.SUCCESS,
          fields: [
            { name: 'Categoria', value: `<#${config.ticketCategoryId}>`, inline: true },
            { name: 'Cargo de suporte', value: `<@&${config.supportRoleId}>`, inline: true },
            { name: 'Transcripts', value: config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : 'Não definido', inline: true }
          ]
        })],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'status') {
      const config = getGuildConfig(interaction.guild.id);

      const openTickets = Object.values(config.tickets || {}).filter((t) => t.status === 'open').length;
      const closedTickets = Object.values(config.tickets || {}).filter((t) => t.status === 'closed').length;

      const check = Symbols.CHECK;
      const cross = Symbols.CROSS;

      const fields = [
        {
          name: 'Logs',
          value: config.logChannelId
            ? `${check} <#${config.logChannelId}>`
            : `${cross} Não configurado`,
          inline: true
        },
        {
          name: 'Categoria de tickets',
          value: config.ticketCategoryId
            ? `${check} <#${config.ticketCategoryId}>`
            : `${cross} Não configurado`,
          inline: true
        },
        {
          name: 'Cargo de suporte',
          value: config.supportRoleId
            ? `${check} <@&${config.supportRoleId}>`
            : `${cross} Não configurado`,
          inline: true
        },
        {
          name: 'Transcripts',
          value: config.transcriptChannelId
            ? `${check} <#${config.transcriptChannelId}>`
            : `${cross} Não configurado`,
          inline: true
        },
        {
          name: 'Tickets',
          value: `${Symbols.OPEN} ${openTickets} abertos ${Symbols.DOT} ${Symbols.FILLED} ${closedTickets} fechados`,
          inline: true
        },
        {
          name: 'Contador',
          value: `${Symbols.TICKET}${config.ticketCounter || 0}`,
          inline: true
        }
      ];

      await interaction.reply({
        embeds: [buildEmbed({
          title: 'Status da configuração',
          color: Colors.INFO,
          fields,
          footer: 'Ernas Helper · Configuração'
        })],
        ephemeral: true
      });
    }
  }
};
