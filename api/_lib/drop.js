// Logica pura del sistema drop: stato, prezzo, finestra, cap, contatore, bundle.
// Nessun I/O. Il registro vendite vive in api/_lib/drop-sales.js.
//
// Importato sia dal client (Vite) sia dalle funzioni serverless (Node), quindi
// tutto qui deve restare risolvibile da Node puro.
import { drop as dropConfig } from '../../src/data/drop.js'

export const DROP    = 'drop'
export const LISTINO = 'listino'
export const VAULT   = 'vault'

/** Configurazione corrente. */
export function getDrop() {
  return dropConfig
}

/** Stato di vendita di un prodotto. Tutto ciò che non è esplicito è VAULT. */
export function productState(productId, cfg = dropConfig) {
  if (cfg?.current?.productIds?.includes(productId)) return DROP
  if (cfg?.released?.includes(productId)) return LISTINO
  return VAULT
}

/** La finestra è [startsAt, endsAt): all'istante di chiusura il drop è già chiuso. */
export function isDropOpen(now = new Date(), cfg = dropConfig) {
  const c = cfg?.current
  if (!c?.startsAt || !c?.endsAt) return false
  const t = now.getTime()
  return t >= Date.parse(c.startsAt) && t < Date.parse(c.endsAt)
}

/**
 * Prezzo base in centesimi, prima di eventuali supplementi cornice.
 * L'override per stato ignora sia product.price sia sizes[].price: un drop ha un
 * prezzo unico, non una scala per taglia.
 */
export function basePriceFor(productId, sizeObj, product, cfg = dropConfig) {
  const state = productState(productId, cfg)
  if (state === DROP)    return cfg.current.dropPrice
  if (state === LISTINO) return cfg.archivePrice
  return sizeObj?.price ?? product?.price ?? 0
}

/** Cap dell'edizione. 0 per i prodotti che non sono nel drop corrente. */
export function capFor(productId, cfg = dropConfig) {
  if (productState(productId, cfg) !== DROP) return 0
  return cfg.current?.caps?.[productId] ?? cfg.current?.cap ?? 0
}

/**
 * Come mostrare la disponibilità.
 * Sotto il 30% venduto si mostra solo la dimensione dell'edizione: al lancio,
 * "19 disponibili su 20" non comunica scarsità, dimostra che non compra nessuno.
 */
export function counterMode(sold, cap) {
  if (!cap) return { mode: 'hidden' }
  if (sold >= cap) return { mode: 'soldout', sold, cap }
  if (sold < cap * 0.3) return { mode: 'edition', cap }
  return { mode: 'counter', sold, cap }
}

/** Sconto bundle in centesimi se il carrello contiene tutti e tre i pezzi del drop. */
export function bundleDiscount(items, cfg = dropConfig) {
  const ids = cfg?.current?.productIds || []
  if (ids.length !== 3) return 0
  const inCart = new Set((items || []).map(i => i.productId))
  if (!ids.every(id => inCart.has(id))) return 0
  return ids.length * cfg.current.dropPrice - cfg.current.bundlePrice
}
