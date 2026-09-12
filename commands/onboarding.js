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
const fs = require('fs');
const crypto = require('crypto');

const SITE_URL = 'https://toe.ernas.com.br/criar-personagem';
const CREATE_CHARACTER_CUSTOM_ID = 'onboarding:create-character';

function appBaseUrl() {
  const configured = String(process.env.ARKANDIA_INTERNAL_URL || process.env.ARKANDIA_API_URL || '').trim();
  return configured.replace(/\/api\/public\/v1\/?$/, '').replace(/\/+$/, '');
}

function onboardingSecret() {
  if (process.env.ONBOARDING_SYNC_SECRET) return process.env.ONBOARDING_SYNC_SECRET.trim();
  try {
    const base = fs.readFileSync('/var/tmp/ernas-activity-bot.secret', 'utf8').trim();
    return base ? crypto.createHmac('sha256', base).update('discord-onboarding-sync').digest('hex') : '';
  } catch { return ''; }
}

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
    if (![CREATE_CHARACTER_CUSTOM_ID, 'onboarding:sync', 'onboarding:progress'].includes(customId)) return false;

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

    if (customId === CREATE_CHARACTER_CUSTOM_ID) {
      const base = appBaseUrl();
      const secret = onboardingSecret();
      if (!base || secret.length < 32) {
        await interaction.editReply(privateEmbed({
          title: 'Criação temporariamente indisponível',
          description: 'Não foi possível preparar seu acesso ao site agora. Tente novamente em instantes.',
          color: Colors.WARNING
        }));
        return true;
      }

      let handoffResponse;
      try {
        handoffResponse = await fetch(`${base}/api/internal/onboarding/handoff`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-onboarding-sync-secret': secret },
          body: JSON.stringify({ discord_id: interaction.user.id }),
        });
      } catch (error) {
        console.error('[ONBOARDING] handoff request failed:', error.message);
        await interaction.editReply(privateEmbed({
          title: 'Não foi possível preparar seu acesso',
          description: 'O site demorou a responder. Tente novamente em alguns instantes; seu progresso não foi perdido.',
          color: Colors.WARNING
        }));
        return true;
      }

      const handoffPayload = await handoffResponse.json().catch(() => null);
      if (handoffResponse.ok && handoffPayload && typeof handoffPayload.url === 'string') {
        await interaction.editReply({
          ...privateEmbed({
            title: 'Conta Discord identificada',
            description: 'Preparamos um acesso temporário e seguro. Abra o site pelo botão abaixo para continuar a criação do personagem.',
            color: Colors.SUCCESS
          }),
          components: [linkButton('Abrir criação de personagem', handoffPayload.url)]
        });
        return true;
      }

      if (handoffResponse.status === 404 && handoffPayload?.code === 'account_required') {
        await interaction.editReply({
          ...privateEmbed({
            title: 'Primeiro acesso ao site',
            description: 'Esta conta Discord ainda não possui cadastro no site. Abra o botão abaixo para fazer o primeiro login e continuar a criação do personagem.',
            color: Colors.PRIMARY
          }),
          components: [linkButton('Criar personagem', SITE_URL)]
        });
        return true;
      }

      await interaction.editReply(privateEmbed({
        title: 'Não foi possível abrir a criação',
        description: 'Não conseguimos preparar seu acesso agora. Tente novamente em instantes.',
        color: Colors.WARNING
      }));
      return true;
    }

    const config = getGuildConfig(interaction.guild.id);
    const roles = onboardingRoleIds(config);
    const baseUrl = (process.env.ARKANDIA_API_URL || '').replace(/\/+$/, '');
    const apiKey = process.env.ARKANDIA_API_KEY;

    if (!roles.playerRoleId || !roles.legacyNoviceRoleId) {
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
    const hasNoviceRole = member.roles.cache.has(roles.legacyNoviceRoleId);
    if (!hasPlayerRole && !hasNoviceRole) {
      await interaction.editReply(privateEmbed({
        title: 'Conclua o onboarding do servidor',
        description: 'Escolha uma opção em **Como você pretende vivenciar Ernas?** para liberar a categoria Bem-vindo e continuar a criação do personagem.',
        color: Colors.INFO
      }));
      return true;
    }
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
            mark(hasNoviceRole || hasPlayerRole) + ' Entrar no fluxo de onboarding',
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
