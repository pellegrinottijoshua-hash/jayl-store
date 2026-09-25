/**
 * Nomi colore dei capi (Gelato/Gildan e generici) → hex.
 *
 * Vive fuori da ProductPage perche' serve anche a Node: il plugin
 * storefront-products in vite.config.js lo usa per riconoscere il colore
 * dei mockup Gelato, che arrivano come "…-gelato-03.jpg" senza colore nel
 * nome (vedi scripts/mockup-colors.js). Usata anche per gli swatch quando
 * .hex manca o e' il segnaposto generico.
 */
export const APPAREL_COLOR_HEX = {
  // ── Blacks & near-blacks ──────────────────────────────────────────────────
  'black': '#1a1a1a', 'washed black': '#1a1a1a', 'jet black': '#111111',
  'solid black triblend': '#1a1a1a', 'solid-black-triblend': '#1a1a1a',
  'triblend black heather': '#2d2d2d', 'triblend-black-heather': '#2d2d2d',
  'black heather': '#2d2d2d', 'black-heather': '#2d2d2d',
  'vintage black': '#2a2a2a', 'faded black': '#333333',

  // ── Whites & off-whites ───────────────────────────────────────────────────
  'white': '#f5f5f5', 'off white': '#f0ece4', 'off-white': '#f0ece4',
  'solid white triblend': '#f0f0f0', 'solid-white-triblend': '#f0f0f0',
  'white heather': '#f2f2f2', 'natural white': '#f8f4ee',
  'ivory': '#fffff0', 'snow': '#fffafa',

  // ── Grays & charcoals ─────────────────────────────────────────────────────
  'gray': '#888888', 'grey': '#888888', 'light gray': '#c8c8c8', 'light grey': '#c8c8c8',
  'heather gray': '#aaaaaa', 'heather-gray': '#aaaaaa', 'heather grey': '#aaaaaa',
  'sport grey': '#a0a0a0', 'sport gray': '#a0a0a0',
  'charcoal': '#3d3d3d', 'dark heather': '#4a4a4a', 'graphite': '#555555',
  'smoke': '#707070', 'ash': '#b8b8b8', 'silver': '#c0c0c0',
  'carbon': '#3b3b3b', 'slate gray': '#708090', 'slate grey': '#708090',
  'deep heather': '#585858', 'tri blend charcoal': '#4a4a4a',

  // ── Reds & pinks ──────────────────────────────────────────────────────────
  'red': '#cc2200', 'true red': '#cc2200', 'fire red': '#bf0a0a',
  'cardinal': '#c41230', 'crimson': '#dc143c', 'cherry red': '#de3163',
  'maroon': '#800000', 'burgundy': '#6e0a1e', 'wine': '#722f37',
  'pink': '#f5a0c0', 'hot pink': '#e82a8a', 'light pink': '#ffb6c1',
  'neon pink': '#ff6eb4', 'coral': '#ff6b6b', 'salmon': '#fa8072',
  'dusty rose': '#dcb0b0', 'mauve': '#c5a0b0',
  'raspberry': '#e30b5c', 'rose': '#ff007f',

  // ── Blues & navys ─────────────────────────────────────────────────────────
  'blue': '#1a3c8c', 'navy': '#1f2d5c', 'navy blue': '#1f2d5c', 'dark navy': '#0f1a3a',
  'royal blue': '#4169e1', 'heather royal': '#4169e1', 'heather-royal': '#4169e1',
  'triblend navy': '#3a5280', 'triblend-navy': '#3a5280',
  'blue triblend': '#5272b0', 'blue-triblend': '#5272b0',
  'light blue': '#6ba4d4', 'light-blue': '#6ba4d4', 'sky blue': '#87ceeb',
  'carolina blue': '#56a0d3', 'columbia blue': '#9ecee1',
  'cobalt': '#0047ab', 'indigo': '#3f00ff', 'denim': '#1560bd',
  'steel blue': '#4682b4', 'slate': '#3a3f4a', 'slate blue': '#6a5acd',
  'midnight': '#191970', 'midnight navy': '#0a0f3c', 'ocean blue': '#006994',
  'teal': '#008080', 'dark teal': '#005f60', 'heather blue': '#4f7bbb',
  'heather navy': '#2a3a6a', 'heather-navy': '#2a3a6a',

  // ── Greens ────────────────────────────────────────────────────────────────
  'green': '#228b22', 'forest green': '#228b22', 'forest-green': '#228b22',
  'dark green': '#165a16', 'hunter green': '#355e3b',
  'kelly green': '#4cbb17', 'lime green': '#32cd32', 'lime': '#00ff00',
  'olive': '#6b7c2c', 'army green': '#4b5320', 'military green': '#4a5240',
  'sage': '#8faf79', 'mint': '#98ff98', 'mint green': '#98ff98',
  'emerald': '#50c878', 'seafoam': '#70e4b4',
  'moss': '#8a9a5b', 'fern': '#4f7942', 'camo green': '#78866b',
  'heather green': '#5a8a60', 'military olive': '#5a5a28',

  // ── Yellows & golds ───────────────────────────────────────────────────────
  'yellow': '#e8c41a', 'bright yellow': '#ffe135', 'daisy': '#f5d842',
  'gold': '#c8a42c', 'antique gold': '#c9ae5d', 'metallic gold': '#d4af37',
  'mustard': '#e1ad01', 'sunflower': '#ffb300',

  // ── Oranges & earthy tones ────────────────────────────────────────────────
  'orange': '#cc5500', 'burnt orange': '#cc5500', 'deep orange': '#b84200',
  'neon orange': '#ff6600', 'tangerine': '#f28500',
  'rust': '#b54a22', 'terracotta': '#c16a4e', 'copper': '#b87333',
  'pumpkin': '#ff7518', 'amber': '#ffbf00',

  // ── Purples & violets ─────────────────────────────────────────────────────
  'purple': '#6b2d8b', 'dark purple': '#4b0082', 'violet': '#7f00ff',
  'lavender': '#c084fc', 'light lavender': '#d8b4fe',
  'heather purple': '#9b59b6', 'plum': '#8e4585', 'grape': '#6f2da8',
  'lilac': '#c8a2c8', 'orchid': '#da70d6',

  // ── Browns & naturals ─────────────────────────────────────────────────────
  'brown': '#795548', 'chocolate': '#5d3c1e',
  'cream': '#f0ece4', 'bone': '#d4cdc0',
  'tan': '#c4a882', 'khaki': '#c3b091',
  'beige': '#d9c9a3', 'camel': '#c19a6b', 'linen': '#faf0e6',
  'stone': '#b0a090', 'hemp': '#c7b08b',

  // ── Gelato compound color names (exact strings from the API) ─────────────
  // Only names not already covered above — a repeated key would silently shadow
  // the earlier one, so every entry here must be new.
  'cardinal red': '#c41230', 'dtg white': '#f5f5f5', 'dtg black': '#1a1a1a',
  'heather ice blue': '#c5dce8', 'heather mint': '#b5e0d0',
  'heather peach': '#f5c6a0', 'heather red': '#c05050',
  'heather forest': '#4a7a50', 'heather midnight navy': '#2a3a6a',
  'heather true royal': '#4169e1', 'heather cardinal': '#9b2335',
  'heather maroon': '#6e2233', 'heather dark chocolate': '#5a3020',
  'heather sport dark navy': '#1a2a4a', 'sport dark navy': '#1a2a4a',
  'sport dark green': '#1e4d2b',
  'athletic heather': '#b0b0b8', 'heather athletic': '#b0b0b8',
  'dark heather gray': '#585858', 'dark heather grey': '#585858',
  'vintage heather navy': '#3a4a6a', 'vintage heather black': '#3a3a3a',
  'navy heather': '#3a4a72', 'charcoal gray': '#3d3d3d',

  // ── Gelato / Gildan catalog names (incl. "RS …" brand-prefixed) ────────────
  // Gildan's own swatches for 'sand', 'natural' and 'dark chocolate' are warmer
  // than the generic names above, so the catalog values are the ones we keep.
  'royal': '#3a5dae', 'rs royal': '#3a5dae',
  'rs sport grey': '#a0a0a0', 'rs sport gray': '#a0a0a0',
  'sportgrey': '#a0a0a0', 'graphite heather': '#5b5f63',
  'irish green': '#00a651', 'rs irish green': '#00a651',
  'azalea': '#f25f9c', 'heliconia': '#db3e79', 'antique heliconia': '#c84e7a',
  'safety pink': '#ff5fa2', 'cornsilk': '#f5e6a8',
  'old gold': '#b8923a', 'tweed': '#5a5750',
  'sand': '#d8c9a3', 'natural': '#e8ddc4', 'sapphire': '#0f52ba',
  'antique sapphire': '#0b6e8f', 'tropical blue': '#0073cf', 'indigo blue': '#3b4a8c',
  'antique cherry red': '#9e1b32', 'safety green': '#c8e600', 'safety orange': '#ff5a1f',
  'dark chocolate': '#3a2820', 'kiwi': '#8fbf3f',
}

/** Resolve best hex for a color object — falls back to label name lookup, then null */
export function resolveSwatchHex(c) {
  if (c.hex && c.hex !== '#888888') return c.hex
  const raw = (c.label || c.id || '').toLowerCase().trim()
  const key = raw.replace(/^rs\s+/, '')          // strip Gelato "RS " brand prefix
  return APPAREL_COLOR_HEX[raw]
    ?? APPAREL_COLOR_HEX[key]
    ?? APPAREL_COLOR_HEX[key.replace(/-/g, ' ')]
    ?? APPAREL_COLOR_HEX[key.replace(/\s+/g, ' ')]
    ?? null
}
