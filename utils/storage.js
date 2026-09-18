const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'config.json');
const tmpPath = `${dbPath}.tmp`;

const defaultGuildConfig = {
  logChannelId: null,
  memberLogChannelId: null,
  moderationLogChannelId: null,
  ticketLogChannelId: null,
  boostLogChannelId: null,
  botLogChannelId: null,
  ticketCategoryId: null,
  supportRoleId: null,
  transcriptChannelId: null,
  noviceRoleId: null,
  seedRoleId: null,
  outsiderRoleId: null,
  playerRoleId: null,
  noviceChannelId: null,
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

let cache = null;

function loadState() {
  if (cache) return cache;
  ensureDb();
  try {
    cache = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (error) {
    console.error('[ERRO] Falha ao ler config.json, recriando estado padrão:', error);
    cache = { ...defaultState };
    persist();
  }
  if (!cache.guilds) cache.guilds = {};
  return cache;
}

function persist() {
  ensureDb();
  fs.writeFileSync(tmpPath, JSON.stringify(cache, null, 2));
  try {
    fs.renameSync(tmpPath, dbPath);
  } catch (error) {
    console.error('[ERRO] Falha no rename atômico, escrevendo diretamente:', error);
    fs.writeFileSync(dbPath, JSON.stringify(cache, null, 2));
    try { fs.unlinkSync(tmpPath); } catch (_) { /* arquivo já movido ou ausente */ }
  }
}

function getGuildConfig(guildId) {
  const state = loadState();
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = { ...defaultGuildConfig };
    persist();
  }
  return { ...defaultGuildConfig, ...state.guilds[guildId] };
}

function updateGuildConfig(guildId, updater) {
  const state = loadState();
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = { ...defaultGuildConfig };
  }
  updater(state.guilds[guildId]);
  persist();
  return { ...defaultGuildConfig, ...state.guilds[guildId] };
}

module.exports = {
  getGuildConfig,
  updateGuildConfig
};
