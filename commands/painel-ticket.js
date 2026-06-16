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
            .setLabel('Dúvidas (Placeholder)')
            .setDescription('Selecione para tirar dúvidas em geral.')
            .setValue('duvidas'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Suporte (Placeholder)')
            .setDescription('Selecione para reportar problemas ou bugs.')
            .setValue('suporte'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Outros (Placeholder)')
            .setDescription('Selecione para outros assuntos.')
            .setValue('outros')
        )
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Painel publicado.', ephemeral: true });
  }
};
