import { buildImageOwnership } from './colorImageMatch.js'

/**
 * Quanti colori della stessa maglia mostra il sito.
 *
 * Gelato ne importa 5-9 per prodotto: sulla scheda erano una fila di pillole
 * che andava fuori schermo e una gallery di dieci mockup quasi uguali. Tre
 * bastano per scegliere. Gli altri restano su Gelato e in admin-products.js —
 * nascosti, non cancellati: alzare questo numero li riporta tutti.
 */
export const MAX_SHOWN_COLORS = 3

// Dopo il colore d'apertura vengono nero e bianco: il chiaroscuro del brand,
// e le due tinte su cui ogni stampa della collezione regge.
const PREFERRED = ['black', 'white']

/**
 * I colori da mostrare, al massimo MAX_SHOWN_COLORS: prima quello d'apertura
 * (il colore del drop, o il primo), poi nero e bianco, poi l'ordine di Gelato.
 */
export function shownColors(colors, openingColorId, storeColors) {
  if (!colors || colors.length <= MAX_SHOWN_COLORS) return colors
  const picked = []
  // Scelta a mano dall'admin (product.storeColors): vince sulla regola, ma il
  // colore d'apertura del drop resta sempre visibile e primo.
  const chosen = (storeColors || []).map((id) => colors.find((c) => c.id === id)).filter(Boolean)
  if (chosen.length) {
    const opening = colors.find((c) => c.id === openingColorId)
    const list = opening && !chosen.includes(opening) ? [opening, ...chosen] : chosen
    return list.slice(0, MAX_SHOWN_COLORS)
  }
  const add = (c) => {
    if (c && !picked.includes(c) && picked.length < MAX_SHOWN_COLORS) picked.push(c)
  }
  add(colors.find((c) => c.id === openingColorId))
  for (const id of PREFERRED) add(colors.find((c) => c.id === id))
  for (const c of colors) add(c)
  return picked
}

/**
 * Toglie dalla gallery le foto dei colori nascosti. La proprietà si calcola su
 * TUTTI i colori, non solo su quelli mostrati: con i soli mostrati un file
 * "…-heather-navy-01.jpg" risulterebbe di "navy" (sottostringa) e resterebbe.
 * Foto senza colore (lifestyle, dettagli) restano sempre.
 */
export function imagesForShownColors(images, allColors, shown, imageColors) {
  if (!images?.length || !allColors || shown === allColors) return images
  const owners = buildImageOwnership(allColors, images, imageColors)
  const kept = images.filter((img) => {
    const owner = owners.get(img)
    return !owner || shown.includes(owner)
  })
  return kept.length ? kept : images
}
