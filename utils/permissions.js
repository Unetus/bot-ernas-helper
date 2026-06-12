const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('./storage');

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const config = getGuildConfig(member.guild.id);
  return Boolean(config.supportRoleId && member.roles.cache.has(config.supportRoleId));
}

module.exports = { isStaff };
