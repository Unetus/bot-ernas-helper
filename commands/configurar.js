const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { updateGuildConfig, getGuildConfig } = require('../utils/storage');

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
            .setRequired(false))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'logs') {
      const channel = interaction.options.getChannel('canal', true);
      updateGuildConfig(interaction.guild.id, (config) => {
        config.logChannelId = channel.id;
      });
      await interaction.reply({ content: `Canal de logs configurado para ${channel}.`, ephemeral: true });
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
        content: [
          'Tickets configurados.',
          `Categoria: <#${config.ticketCategoryId}>`,
          `Suporte: <@&${config.supportRoleId}>`,
          `Transcripts: ${config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : 'nao definido'}`
        ].join('\n'),
        ephemeral: true
      });
    }
  }
};
