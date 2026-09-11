const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const { Colors, Symbols, buildEmbed } = require('../utils/branding');

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
    const title = interaction.options.getString('titulo') || 'Central de Atendimento';
    const description = interaction.options.getString('descricao') ||
      [
        'Precisa de ajuda ou quer falar com a equipe?',
        '',
        `${Symbols.ARROW} Clique no botão abaixo para abrir um ticket.`,
        `${Symbols.ARROW} Descreva sua solicitação e aguarde o atendimento.`,
        '',
        `${Symbols.DOT} Apenas um ticket por vez.`
      ].join('\n');

    const embed = buildEmbed({
      title,
      description,
      color: Colors.PRIMARY,
      thumbnail: interaction.client.user.displayAvatarURL({ size: 256 }),
      footer: 'Ernas Helper · Atendimento'
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket:select')
        .setPlaceholder('Selecione uma opção de atendimento...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Denúncias')
            .setDescription('Faça uma denúncia.')
            .setValue('denuncias'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Dúvidas')
            .setDescription('Retire dúvidas técnicas acerca do projeto.')
            .setValue('duvidas'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Token Aprimorado')
            .setDescription('Faça seu orçamento para um token aprimorado.')
            .setValue('token-aprimorado'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Outros')
            .setDescription('Informe outros assuntos pertinentes a um ticket.')
            .setValue('outros')
        )
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Painel publicado.', ephemeral: true });
  }
};
