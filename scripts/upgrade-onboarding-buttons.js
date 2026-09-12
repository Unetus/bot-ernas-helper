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

const CHANNELS = [
  '1547724809482272788',
  '1547724811139031060',
];
const CREATE_CHARACTER_CUSTOM_ID = 'onboarding:create-character';
const SITE_URL = 'https://toe.ernas.com.br/criar-personagem';
const dryRun = process.argv.includes('--dry-run');

function replaceButtons(value, state) {
  if (Array.isArray(value)) return value.map((item) => replaceButtons(item, state));
  if (!value || typeof value !== 'object') return value;

  const next = { ...value };
  if (next.type === 2 && typeof next.url === 'string' && next.url === SITE_URL) {
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
    for (const channelId of CHANNELS) {
      const channel = await client.channels.fetch(channelId);
      const messages = await channel.messages.fetch({ limit: 20 });
      const target = messages.find((message) => message.components?.some((component) => JSON.stringify(component.toJSON()).includes(SITE_URL)));
      if (!target) {
        console.log(`[onboarding] ${channelId}: painel com link não encontrado.`);
        continue;
      }

      const state = { changed: 0 };
      const components = target.components.map((component) => replaceButtons(component.toJSON(), state));
      if (!state.changed) {
        console.log(`[onboarding] ${channelId}: nenhum botão elegível.`);
        continue;
      }
      if (!dryRun) await target.edit({ components });
      console.log(`[onboarding] ${channelId}: ${dryRun ? 'seria atualizado' : 'atualizado'} (${target.id}, ${state.changed} botão(ões)).`);
    }
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error('[onboarding] falha:', error.message);
  process.exitCode = 1;
});
