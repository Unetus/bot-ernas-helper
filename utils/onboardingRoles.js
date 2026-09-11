const { GuildMemberFlags } = require('discord.js');

function uniqueRoleIds(values) {
  return [...new Set(values.filter(Boolean))];
}

function onboardingRoleIds(config) {
  return {
    playerRoleId: config.playerRoleId || null,
    seedRoleId: config.seedRoleId || null,
    outsiderRoleId: config.outsiderRoleId || null,
    legacyNoviceRoleId: config.noviceRoleId || null
  };
}

function transitionRoleIds(config) {
  const { seedRoleId, outsiderRoleId, legacyNoviceRoleId } = onboardingRoleIds(config);
  return uniqueRoleIds([seedRoleId, outsiderRoleId, legacyNoviceRoleId]);
}

async function fetchBotMember(guild) {
  return guild.members.me || guild.members.fetchMe();
}

async function validateRoleHierarchy(guild, roleIds) {
  await guild.roles.fetch();
  const botMember = await fetchBotMember(guild);
  const roles = uniqueRoleIds(roleIds)
    .map((roleId) => guild.roles.cache.get(roleId))
    .filter(Boolean);
  const blockedRoles = roles.filter((role) => botMember.roles.highest.comparePositionTo(role) <= 0);

  return {
    ok: blockedRoles.length === 0,
    botRole: botMember.roles.highest,
    blockedRoles
  };
}

function hierarchyMessage(result) {
  const names = result.blockedRoles.map((role) => role.name).join(', ');
  return [
    'O personagem foi encontrado, mas a hierarquia de cargos do Discord bloqueou a sincronização.',
    `Mova o cargo **${result.botRole.name}** para cima de: **${names}** em Configurações do servidor → Cargos.`
  ].join('\n');
}

async function promoteToPlayer(member, config) {
  const ids = onboardingRoleIds(config);
  if (!ids.playerRoleId) {
    return { ok: false, reason: 'missing-player-role' };
  }

  const hierarchy = await validateRoleHierarchy(member.guild, [
    ids.playerRoleId,
    ...transitionRoleIds(config)
  ]);
  if (!hierarchy.ok) {
    return { ok: false, reason: 'hierarchy', hierarchy };
  }

  if (!member.roles.cache.has(ids.playerRoleId)) {
    await member.roles.add(ids.playerRoleId, 'Personagem confirmado no onboarding');
  }

  const removable = transitionRoleIds(config).filter((roleId) => member.roles.cache.has(roleId));
  if (removable.length > 0) {
    await member.roles.remove(removable, 'Onboarding concluído');
  }

  return { ok: true, removedRoleIds: removable };
}

async function reconcileRoleTransition(oldMember, newMember, config) {
  if (newMember.user.bot) return;

  const ids = onboardingRoleIds(config);
  const added = (roleId) => Boolean(
    roleId &&
    !oldMember.roles.cache.has(roleId) &&
    newMember.roles.cache.has(roleId)
  );

  let removable = [];
  let reason = null;

  const hasPlayer = Boolean(ids.playerRoleId && newMember.roles.cache.has(ids.playerRoleId));
  const hasSeed = Boolean(ids.seedRoleId && newMember.roles.cache.has(ids.seedRoleId));
  const hasOutsider = Boolean(ids.outsiderRoleId && newMember.roles.cache.has(ids.outsiderRoleId));
  const completedOnboarding = newMember.flags.has(GuildMemberFlags.CompletedOnboarding);

  if (hasPlayer) {
    removable = transitionRoleIds(config).filter((roleId) => newMember.roles.cache.has(roleId));
    reason = 'Cargo Jogadores ativo; encerrando onboarding';
  } else if (added(ids.legacyNoviceRoleId) && ids.seedRoleId) {
    const hierarchy = await validateRoleHierarchy(newMember.guild, [
      ids.seedRoleId,
      ids.legacyNoviceRoleId
    ]);
    if (!hierarchy.ok) {
      console.error('[ONBOARDING] Hierarquia impede converter Novatos em Semente:', hierarchyMessage(hierarchy));
      return;
    }
    await newMember.roles.add(ids.seedRoleId, 'Escolha de jogatina confirmada no Onboarding');
    await newMember.roles.remove(ids.legacyNoviceRoleId, 'Cargo legado convertido em Semente de Ernas');
    return;
  } else if (added(ids.seedRoleId)) {
    removable = uniqueRoleIds([ids.outsiderRoleId, ids.legacyNoviceRoleId])
      .filter((roleId) => newMember.roles.cache.has(roleId));
    reason = 'Usuário decidiu jogar; removendo cargo de observador';
  } else if (added(ids.outsiderRoleId)) {
    removable = uniqueRoleIds([ids.seedRoleId, ids.legacyNoviceRoleId])
      .filter((roleId) => newMember.roles.cache.has(roleId));
    reason = 'Usuário decidiu conhecer o projeto antes de jogar';
  } else if (
    ids.outsiderRoleId &&
    completedOnboarding &&
    !hasSeed &&
    !hasOutsider &&
    (
      !oldMember.flags.has(GuildMemberFlags.CompletedOnboarding) ||
      Boolean(ids.seedRoleId && oldMember.roles.cache.has(ids.seedRoleId))
    )
  ) {
    const hierarchy = await validateRoleHierarchy(newMember.guild, [ids.outsiderRoleId]);
    if (!hierarchy.ok) {
      console.error('[ONBOARDING] Hierarquia impede atribuir Forasteiro:', hierarchyMessage(hierarchy));
      return;
    }
    await newMember.roles.add(ids.outsiderRoleId, 'Onboarding concluído sem opção de jogatina');
    return;
  }

  if (removable.length === 0) return;

  const hierarchy = await validateRoleHierarchy(newMember.guild, removable);
  if (!hierarchy.ok) {
    console.error('[ONBOARDING] Hierarquia impede transição:', hierarchyMessage(hierarchy));
    return;
  }

  await newMember.roles.remove(removable, reason);
}

module.exports = {
  hierarchyMessage,
  onboardingRoleIds,
  promoteToPlayer,
  reconcileRoleTransition,
  transitionRoleIds,
  validateRoleHierarchy
};
