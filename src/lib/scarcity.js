/**
 * Un colore "finito" a rotazione (Joshua, 2/10).
 *
 * Ogni settimana (lunedi', ora UTC) il sistema sceglie a caso meta' dei
 * prodotti; per quelli, il terzo colore mostrato in negozio non si vende per
 * tutta la settimana: pallino barrato, cartello FINISHED sul mockup, niente
 * "Add to cart". La scelta e' deterministica (stesso prodotto + stessa
 * settimana = stesso risultato) su ogni dispositivo, senza salvare niente.
 * I pezzi del drop in corso non ne fanno parte: hanno gia' il loro limite.
 */
const WEEK_MS = 7 * 24 * 3600 * 1000
// 5/1/1970 era un lunedi': le settimane partono da li'.
const MONDAY_EPOCH = Date.UTC(1970, 0, 5)

export const weekIndex = (now = Date.now()) => Math.floor((now - MONDAY_EPOCH) / WEEK_MS)

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Rimescola (finalizzatore murmur3): senza, il bit basso di FNV dipende solo
  // dalla parita' dei caratteri e le due rotazioni sceglievano gli stessi prodotti.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** L'id del colore finito questa settimana, o null. */
export function finishedColorFor(product, shownColors, { inDrop = false, now = Date.now() } = {}) {
  if (!product || inDrop || !Array.isArray(shownColors) || shownColors.length < 3) return null
  if (hash(`${product.id}:${weekIndex(now)}`) % 2 === 1) return null
  return shownColors[2]?.id ?? null
}

/**
 * Seconda rotazione, indipendente dalla prima: ogni settimana un'altra meta'
 * dei prodotti mostra "only N left" (N = 2, 3 o 4) su uno dei colori ancora
 * in vendita. Stesso calcolo deterministico: nessun dato salvato.
 */
export function lowStockFor(product, shownColors, { inDrop = false, finished = null, now = Date.now() } = {}) {
  if (!product || inDrop || !Array.isArray(shownColors) || shownColors.length < 2) return null
  const h = hash(`low:${product.id}:${weekIndex(now)}`)
  if (h % 2 === 1) return null
  const pool = shownColors.filter((c) => c.id !== finished)
  const color = pool[(h >>> 1) % pool.length]
  return color ? { colorId: color.id, left: 2 + ((h >>> 3) % 3) } : null
}
