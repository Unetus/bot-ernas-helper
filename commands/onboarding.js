const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
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

function linkButton(label, url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(label)
      .setStyle(ButtonStyle.Link)
      .setURL(url)
  );
}

function syncButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('onboarding:sync')
      .setLabel('Sincronizar personagem')
      .setStyle(ButtonStyle.Primary)
  );
}

function guideUrl(guildId) {
  return `https://discord.com/channels/${guildId}`;
}

function privateEmbed(options) {
  return { embeds: [buildEmbed(options)] };
}

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
          roleStatus(config, 'noviceRoleId', 'Novatos'),
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
      await interaction.reply({
        ...privateEmbed({
          title: 'Ação disponível no servidor',
          description: 'Este botão funciona dentro do servidor Tales of Ernas. Volte para lá e tente novamente.',
          color: Colors.WARNING
        }),
        ephemeral: true
      });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });
    const config = getGuildConfig(interaction.guild.id);
    const roles = onboardingRoleIds(config);
    const baseUrl = (process.env.ARKANDIA_API_URL || '').replace(/\/+$/, '');
    const apiKey = process.env.ARKANDIA_API_KEY;

    if (!roles.playerRoleId || (!roles.seedRoleId && !roles.legacyNoviceRoleId)) {
      await interaction.editReply(privateEmbed({
        title: 'Onboarding em preparação',
        description: 'A equipe ainda está finalizando esta etapa. Tente novamente em alguns instantes ou procure o suporte.',
        color: Colors.WARNING
      }));
      return true;
    }
    if (!baseUrl || !apiKey) {
      await interaction.editReply(privateEmbed({
        title: 'Sincronização indisponível',
        description: 'Não foi possível conectar ao serviço de personagens agora. Aguarde um pouco e tente novamente.',
        color: Colors.WARNING
      }));
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
      await interaction.editReply(privateEmbed({
        title: 'Não foi possível consultar seu personagem',
        description: 'O serviço demorou a responder. Tente novamente em instantes; seu progresso não foi perdido.',
        color: Colors.WARNING
      }));
      return true;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.editReply(privateEmbed({
        title: 'Perfil não encontrado',
        description: 'Não localizamos seu perfil neste servidor. Confirme se está usando a conta correta e tente novamente.',
        color: Colors.WARNING
      }));
      return true;
    }

    const hasCharacter = response.ok;
    const hasPlayerRole = member.roles.cache.has(roles.playerRoleId);
    const hasSeedRole = member.roles.cache.has(roles.seedRoleId);
    const hasNoviceRole = member.roles.cache.has(roles.legacyNoviceRoleId);
    const hasTransitionRole = transitionRoleIds(config).some((roleId) => member.roles.cache.has(roleId));
    const synced = hasCharacter && hasPlayerRole && !hasTransitionRole;

    if (customId === 'onboarding:progress') {
      const mark = (value) => value ? '✅' : '⬜';
      const next = !hasCharacter
        ? 'Abra #crie-seu-jogador e crie seu personagem.'
        : !synced
          ? 'A sincronização automática está em andamento. Se ela não concluir em alguns instantes, clique em **Sincronizar personagem**.'
          : 'Tudo certo! Abra #tabletop para começar.';
      const progressPayload = {
        embeds: [buildEmbed({
          title: 'Seu progresso',
          description: [
            'Acompanhe as etapas do onboarding:',
            '',
            mark(true) + ' Entrar no servidor',
            mark(hasSeedRole || hasNoviceRole || hasPlayerRole) + ' Entrar no fluxo de onboarding',
            mark(hasCharacter) + ' Criar um personagem ativo',
            mark(synced) + ' Sincronizar Discord e personagem',
            mark(synced) + ' Liberar acesso de jogador',
            '',
            '**Próximo passo:** ' + next
          ].join('\n'),
          color: synced ? Colors.SUCCESS : Colors.PRIMARY
        })]
      };
      if (!synced && !hasCharacter) progressPayload.components = [linkButton('Criar personagem', SITE_URL)];
      else if (!synced && hasCharacter) progressPayload.components = [syncButton()];
      await interaction.editReply(progressPayload);
      return true;
    }

    if (response.status === 404) {
      await interaction.editReply({
        ...privateEmbed({
          title: 'Personagem ainda não vinculado',
          description: 'Não encontramos um personagem ativo vinculado a este Discord. Crie seu personagem no site; ao concluir, a liberação será automática. Se necessário, volte aqui para verificar novamente.',
          color: Colors.PRIMARY
        }),
        components: [linkButton('Criar personagem', SITE_URL)]
      });
      return true;
    }
    if (!response.ok) {
      console.error('[ONBOARDING] API returned status', response.status);
      await interaction.editReply(privateEmbed({
        title: 'Consulta não concluída',
        description: 'Não conseguimos confirmar seu personagem agora. Tente novamente em instantes.',
        color: Colors.WARNING
      }));
      return true;
    }

    try {
      const result = await promoteToPlayer(member, config);
      if (!result.ok && result.reason === 'hierarchy') {
        await interaction.editReply(privateEmbed({
          title: 'Sincronização precisa de um ajuste',
          description: hierarchyMessage(result.hierarchy),
          color: Colors.WARNING
        }));
        return true;
      }
      if (!result.ok) {
        await interaction.editReply(privateEmbed({
          title: 'Sincronização indisponível',
          description: 'O cargo de jogador ainda não está configurado pela equipe. Avise o suporte para concluirmos seu acesso.',
          color: Colors.WARNING
        }));
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
      await interaction.editReply(privateEmbed({
        title: 'Personagem encontrado',
        description: 'Encontramos seu personagem, mas não conseguimos liberar o cargo agora. Avise o suporte; a equipe poderá concluir a sincronização para você.',
        color: Colors.WARNING
      }));
    }
    return true;
  }
};
