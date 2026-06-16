const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'config.json');

const defaultGuildConfig = {
  logChannelId: null,
  ticketCategoryId: null,
  supportRoleId: null,
  transcriptChannelId: null,
  ticketCounter: 0,
  tickets: {}
};

const defaultState = {
  guilds: {}
};

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(defaultState, null, 2));
}

function readState() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeState(state) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

function getGuildConfig(guildId) {
  const state = readState();
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = { ...defaultGuildConfig };
    writeState(state);
  }
  return state.guilds[guildId];
}

function updateGuildConfig(guildId, updater) {
  const state = readState();
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = { ...defaultGuildConfig };
  }
  updater(state.guilds[guildId]);
  writeState(state);
  return state.guilds[guildId];
}

module.exports = {
  getGuildConfig,
  updateGuildConfig
};
