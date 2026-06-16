const { EmbedBuilder } = require('discord.js');

// ---------------------------------------------------------------------------
// Paleta de cores
// ---------------------------------------------------------------------------
const Colors = {
  PRIMARY: 0x6366f1,   // indigo
  SUCCESS: 0x22c55e,   // green
  WARNING: 0xf59e0b,   // amber
  DANGER: 0xef4444,    // red
  INFO: 0x06b6d4,      // cyan
  MUTED: 0x6b7280,     // gray
  ACCENT: 0x8b5cf6     // violet
};

// ---------------------------------------------------------------------------
// Simbolos minimalistas (sem emojis)
// ---------------------------------------------------------------------------
const Symbols = {
  BULLET: '›',
  DOT: '·',
  ARROW: '▸',
  DASH: '—',
  CHECK: '✓',
  CROSS: '✕',
  OPEN: '○',
  FILLED: '●',
  DIVIDER: '─────────────────────────────',
  TICKET: '#',
  LOCK: '✕',
  UNLOCK: '○'
};

// ---------------------------------------------------------------------------
// Textos padrão
// ---------------------------------------------------------------------------
const BOT_NAME = 'Ernas Helper';
const FOOTER_TEXT = 'Ernas Helper';

// ---------------------------------------------------------------------------
// Helper para construir embeds padronizadas
// ---------------------------------------------------------------------------
function buildEmbed(options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || Colors.PRIMARY)
    .setTimestamp();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.fields) embed.addFields(options.fields);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.url) embed.setURL(options.url);

  embed.setFooter({ text: options.footer || FOOTER_TEXT });

  return embed;
}

module.exports = {
  Colors,
  Symbols,
  BOT_NAME,
  FOOTER_TEXT,
  buildEmbed
};
