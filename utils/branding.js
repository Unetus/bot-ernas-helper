const { EmbedBuilder } = require('discord.js');

// ---------------------------------------------------------------------------
// Paleta de cores
// ---------------------------------------------------------------------------
const Colors = {
  PRIMARY: 0xd4af37,   // dourado Tales of Ernas
  SUCCESS: 0x5dbb8c,   // verde suave
  WARNING: 0xe0aa45,   // dourado de alerta
  DANGER: 0xd95c6d,    // vermelho suave
  INFO: 0x80a9c4,      // azul acinzentado
  MUTED: 0x7f8793,     // cinza azulado
  ACCENT: 0x8c6fb6     // violeta
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
