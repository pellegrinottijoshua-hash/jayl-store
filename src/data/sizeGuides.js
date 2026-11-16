/**
 * Guide taglie per blank, non per prodotto.
 *
 * Ogni prodotto Gelato porta il blank dentro l'id variante
 * ("…_inlbl_gildan_64000"), quindi la guida si ricava da li': un capo
 * caricato domani sullo stesso blank la riceve senza che nessuno la scriva
 * nel pannello. Un blank non in tabella non mostra nessuna guida — meglio
 * niente che le misure di un'altra maglia.
 *
 * Gildan 64000 Softstyle: larghezza e lunghezza dalla Gildan 2026 USA Style &
 * Color Guide (p. 22), manica dalla scheda Softstyle 64000; pollici convertiti
 * in cm e arrotondati al centimetro. Capo misurato in piano. Solo le taglie
 * con tutte e tre le misure da fonte: XS e 3XL non hanno la manica pubblicata,
 * e una misura stimata in una guida taglie e' un reso che aspetta.
 */
export const SIZE_GUIDES = {
  gildan_64000: {
    garment: 'Gildan 64000 Softstyle',
    cols: ['Length', 'Chest', 'Sleeve'],
    unit: 'cm',
    rows: {
      S:   [71, 46, 42],
      M:   [74, 51, 45],
      L:   [76, 56, 48],
      XL:  [79, 61, 51],
      '2XL': [81, 66, 55],
    },
    notes: [
      'Garment measured flat. Chest is side to side — double it for the full circumference.',
      'Length from the highest point of the shoulder; sleeve from the centre back.',
      'Semi-fitted cut. Between sizes, or after a looser fit, take one size up.',
    ],
  },
}

// Capi Zack the Duck. Felpa 18500 e girocollo 18000: stesso corpo Gildan
// (larghezza 20-34", lunghezza 27-34" da S a 5XL), dalle schede tecniche
// SanMar/Gildan 18500 e dai rivenditori della 18000 (verificato il 16/11);
// pollici -> cm arrotondati. La manica non c'e': le fonti non coincidono.
// La tee Zack e' una Gildan 64000: usa la guida qui sopra.
const GILDAN_HEAVY_BLEND_ROWS = {
  S: [69, 51], M: [71, 56], L: [74, 61], XL: [76, 66],
  '2XL': [79, 71], '3XL': [81, 76], '4XL': [84, 81], '5XL': [86, 86],
}
const GILDAN_HEAVY_BLEND_NOTES = [
  'Garment measured flat. Chest is side to side, 2.5 cm below the armhole — double it for the full circumference.',
  'Length from the highest point of the shoulder to the hem, at the back.',
  'Classic unisex fit, roomy. Between sizes, take your usual size.',
]
SIZE_GUIDES.gildan_18500 = {
  garment: 'Gildan 18500 Heavy Blend Hoodie',
  cols: ['Length', 'Chest'],
  unit: 'cm',
  rows: GILDAN_HEAVY_BLEND_ROWS,
  notes: GILDAN_HEAVY_BLEND_NOTES,
}
SIZE_GUIDES.gildan_18000 = {
  garment: 'Gildan 18000 Heavy Blend Crewneck',
  cols: ['Length', 'Chest'],
  unit: 'cm',
  rows: GILDAN_HEAVY_BLEND_ROWS,
  notes: GILDAN_HEAVY_BLEND_NOTES,
}

export const SIZE_ORDER =['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

/** Ordina per taglia (XS → 5XL): Gelato le consegna in ordine sparso (S, L, M, XL). */
export function bySize(a, b) {
  const ia = SIZE_ORDER.indexOf(a.id ?? a), ib = SIZE_ORDER.indexOf(b.id ?? b)
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
}

function blankOf(product) {
  for (const v of product?.variants || []) {
    const m = /(gildan_\d+|bella_canvas_\d+|stanley_stella_\w+)$/i.exec(v.gelatoVariantId || '')
    if (m) return m[1].toLowerCase()
  }
  return null
}

/**
 * La guida per questo prodotto, limitata alle taglie che vende davvero —
 * o null se il blank non e' in tabella.
 */
export function sizeGuideFor(product) {
  const guide = SIZE_GUIDES[blankOf(product)]
  if (!guide) return null
  const sold = (product.sizes || []).map((s) => s.id)
  const sizes = Object.keys(guide.rows)
    .filter((id) => !sold.length || sold.includes(id))
    .sort(bySize)
  return { ...guide, rows: sizes.map((id) => [id, ...guide.rows[id]]) }
}
