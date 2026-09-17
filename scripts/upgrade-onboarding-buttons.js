/*
 * Troca os links estáticos de criação nos dois painéis do onboarding por um
 * botão de interação. O helper passa a gerar um handoff individual quando o
 * membro clica, sem expor o Discord ID no link.
 *
 * Uso na VPS:
 *   node scripts/upgrade-onboarding-buttons.js
 *   node scripts/upgrade-onboarding-buttons.js --dry-run
 */
require('dotenv').config({ quiet: true });

const { Client, GatewayIntentBits } = require('discord.js');

const WELCOME_CATEGORY_ID = '1547725356339957811';
const FALLBACK_CHANNELS = [
  '1547724809482272788',
  '1547724811139031060',
];
const CREATE_CHARACTER_CUSTOM_ID = 'onboarding:create-character';
const dryRun = process.argv.includes('--dry-run');

function isCharacterCreationUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'toe.ernas.com.br' && url.pathname === '/criar-personagem';
  } catch {
    return false;
  }
}

function replaceButtons(value, state) {
  if (Array.isArray(value)) return value.map((item) => replaceButtons(item, state));
  if (!value || typeof value !== 'object') return value;

  const next = { ...value };
  if (next.type === 2 && typeof next.url === 'string' && isCharacterCreationUrl(next.url)) {
    delete next.url;
    next.custom_id = CREATE_CHARACTER_CUSTOM_ID;
    next.style = 1;
    next.label = 'Criar personagem';
    state.changed += 1;
  }
  if (Array.isArray(next.components)) next.components = replaceButtons(next.components, state);
  return next;
}

async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não configurado.');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  await client.login(process.env.DISCORD_TOKEN);
  try {
    const category = await client.channels.fetch(WELCOME_CATEGORY_ID).catch(() => null);
    const channels = category?.children?.cache
      ? [...category.children.cache.values()].filter((channel) => channel.isTextBased?.() && channel.messages)
      : (await Promise.all(FALLBACK_CHANNELS.map((id) => client.channels.fetch(id).catch(() => null)))).filter(Boolean);

    if (!channels.length) throw new Error('Nenhum canal encontrado na categoria Bem-vindo.');

    for (const channel of channels) {
      const messages = await channel.messages.fetch({ limit: 100 });
      for (const target of messages.values()) {
        if (!target.components?.length) continue;
        const state = { changed: 0 };
        const components = target.components.map((component) => replaceButtons(component.toJSON(), state));
        if (!state.changed) continue;
        if (!dryRun) await target.edit({ components });
        console.log(`[onboarding] ${channel.id}: ${dryRun ? 'seria atualizado' : 'atualizado'} (${target.id}, ${state.changed} botão(ões)).`);
      }
    }
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error('[onboarding] falha:', error.message);
  process.exitCode = 1;
});
