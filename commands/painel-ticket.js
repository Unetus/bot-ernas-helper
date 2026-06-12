const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel-ticket')
    .setDescription('Publica o painel para abertura de tickets.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('titulo')
        .setDescription('Titulo do painel.')
        .setRequired(false))
    .addStringOption((option) =>
      option
        .setName('descricao')
        .setDescription('Descricao do painel.')
        .setRequired(false)),

  async execute(interaction) {
    const title = interaction.options.getString('titulo') || 'Atendimento';
    const description = interaction.options.getString('descricao') || 'Abra um ticket para falar com a equipe.';

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x3b82f6);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:create')
        .setLabel('Abrir ticket')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Painel publicado.', ephemeral: true });
  }
};
