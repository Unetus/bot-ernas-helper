const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../utils/storage');
const { Colors, buildEmbed } = require('../utils/branding');
const {
  hierarchyMessage,
  onboardingRoleIds,
  promoteToPlayer,
  transitionRoleIds,
  validateRoleHierarchy
} = require('../utils/onboardingRoles');

const SITE_URL = 'https://toe.ernas.com.br/criar-personagem';

function roleStatus(config, key, label) {
  return config[key] ? `✓ ${label}: <@&${config[key]}>` : `✕ ${label}: não configurado`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('Gerencia o fluxo de entrada de novos jogadores.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Mostra a configuração e a hierarquia do onboarding.')),

  async execute(interaction) {
    const config = getGuildConfig(interaction.guild.id);
    const roleIds = onboardingRoleIds(config);
    const hierarchy = await validateRoleHierarchy(interaction.guild, [
      roleIds.playerRoleId,
      ...transitionRoleIds(config)
    ]);

    await interaction.reply({
      embeds: [buildEmbed({
        title: 'Onboarding',
        description: [
          'Fluxo configurado para novos membros:',
          '',
          roleStatus(config, 'seedRoleId', 'Semente de Ernas'),
          roleStatus(config, 'outsiderRoleId', 'Forasteiro'),
          roleStatus(config, 'playerRoleId', 'Jogadores'),
          config.noviceChannelId ? `✓ Chat de iniciantes: <#${config.noviceChannelId}>` : '✕ Chat de iniciantes: não configurado',
          '',
          hierarchy.ok
            ? `✓ Hierarquia válida: **${hierarchy.botRole.name}** consegue gerenciar os cargos do fluxo.`
            : hierarchyMessage(hierarchy)
        ].join('\n'),
        color: hierarchy.ok ? Colors.SUCCESS : Colors.WARNING
      })],
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    const customId = interaction.customId;
    if (!['onboarding:sync', 'onboarding:progress'].includes(customId)) return false;

    if (!interaction.guild) {
      await interaction.reply({ content: 'Esta ação só pode ser usada dentro do servidor.', ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });
    const config = getGuildConfig(interaction.guild.id);
    const roles = onboardingRoleIds(config);
    const baseUrl = (process.env.ARKANDIA_API_URL || '').replace(/\/+$/, '');
    const apiKey = process.env.ARKANDIA_API_KEY;

    if (!roles.playerRoleId || !roles.seedRoleId || !roles.outsiderRoleId) {
      await interaction.editReply('O onboarding ainda não foi configurado pela equipe.');
      return true;
    }
    if (!baseUrl || !apiKey) {
      await interaction.editReply('A sincronização está temporariamente indisponível. Tente novamente mais tarde.');
      return true;
    }

    const endpoint = baseUrl + '/personagens/discord/' + encodeURIComponent(interaction.user.id);
    let response;
    try {
      response = await fetch(endpoint, {
        headers: { 'X-API-Key': apiKey, Accept: 'application/json' }
      });
    } catch (error) {
      console.error('[ONBOARDING] API request failed:', error.message);
      await interaction.editReply('Não foi possível consultar o site agora. Tente novamente em instantes.');
      return true;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.editReply('Não foi possível localizar seu perfil neste servidor.');
      return true;
    }

    const hasCharacter = response.ok;
    const hasPlayerRole = member.roles.cache.has(roles.playerRoleId);
    const hasSeedRole = member.roles.cache.has(roles.seedRoleId);
    const hasOutsiderRole = member.roles.cache.has(roles.outsiderRoleId);
    const hasTransitionRole = transitionRoleIds(config).some((roleId) => member.roles.cache.has(roleId));
    const synced = hasCharacter && hasPlayerRole && !hasTransitionRole;

    if (customId === 'onboarding:progress') {
      const mark = (value) => value ? '✅' : '⬜';
      const next = hasOutsiderRole && !hasSeedRole
        ? 'Abra **Canais e cargos** no Guia do Servidor e escolha uma opção de jogatina.'
        : !hasCharacter
          ? 'Abra #crie-seu-jogador e crie seu personagem.'
          : !synced
            ? 'Clique em **Já tenho um personagem** para concluir a sincronização.'
            : 'Tudo certo! Abra #tabletop para começar.';
      await interaction.editReply({
        embeds: [buildEmbed({
          title: 'Seu progresso',
          description: [
            'Acompanhe as etapas do onboarding:',
            '',
            mark(true) + ' Entrar no servidor',
            mark(hasSeedRole || hasPlayerRole) + ' Escolher participar da jogatina',
            mark(hasCharacter) + ' Criar um personagem ativo',
            mark(synced) + ' Sincronizar Discord e personagem',
            mark(synced) + ' Liberar acesso de jogador',
            '',
            '**Próximo passo:** ' + next
          ].join('\n'),
          color: synced ? Colors.SUCCESS : Colors.PRIMARY
        })]
      });
      return true;
    }

    if (hasOutsiderRole && !hasSeedRole && !hasPlayerRole) {
      await interaction.editReply([
        'Antes de sincronizar, abra **Canais e cargos** no Guia do Servidor e altere',
        '**Como você pretende vivenciar Ernas?** para uma das opções de jogatina.'
      ].join('\n'));
      return true;
    }

    if (response.status === 404) {
      await interaction.editReply({
        content: `Não encontramos um personagem ativo vinculado a este Discord. Crie ou autorize sua conta no site e tente novamente: ${SITE_URL}`
      });
      return true;
    }
    if (!response.ok) {
      console.error('[ONBOARDING] API returned status', response.status);
      await interaction.editReply('A consulta do personagem falhou. Tente novamente em instantes.');
      return true;
    }

    try {
      const result = await promoteToPlayer(member, config);
      if (!result.ok && result.reason === 'hierarchy') {
        await interaction.editReply(hierarchyMessage(result.hierarchy));
        return true;
      }
      if (!result.ok) {
        await interaction.editReply('O cargo Jogadores não está configurado. Avise a equipe pelo suporte.');
        return true;
      }

      await interaction.editReply({
        embeds: [buildEmbed({
          title: 'Sincronização concluída',
          description: [
            'Seu personagem foi confirmado e o cargo **Jogadores** foi liberado.',
            'Os cargos temporários do onboarding foram removidos e os canais da comunidade já estão disponíveis.'
          ].join('\n'),
          color: Colors.SUCCESS
        })]
      });
    } catch (error) {
      console.error('[ONBOARDING] Role update failed:', error.message);
      await interaction.editReply('O personagem foi encontrado, mas não foi possível atualizar seus cargos. Avise a equipe pelo suporte.');
    }
    return true;
  }
};
