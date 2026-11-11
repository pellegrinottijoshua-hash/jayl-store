import { heroVideoSrc } from './heroVideo'

/**
 * I ruoli degli asset di un prodotto, assegnati in admin (scheda prodotto,
 * galleria "Importate"):
 *
 * - Hero: il video da 3 s (`videoUrl`) oppure le foto hero (`heroShots`: uomo
 *   e donna di schiena). E' quello che si vede su Objects e apre la scheda.
 *   Col video, le foto hero non stanno in galleria: il video le sostituisce.
 * - Mockup: `images`, in ordine. Il mockup 1 e' quello su cui la scheda
 *   arriva quando il video finisce.
 * - Dettaglio: `detailImage` ("hold to reveal").
 * - Lifestyle home: `heroImage`, solo nelle sezioni a foto piena della home.
 */
export function heroShotsOf(product) {
  return Array.isArray(product?.heroShots) ? product.heroShots.filter(Boolean) : []
}

/**
 * I mockup della galleria della scheda. Mai la copertina (hero), la lifestyle
 * o il dettaglio: hanno un posto loro (catalogo, home, "hold to reveal").
 * Le foto Front/Back che sceglie l'admin arrivano da `sidePhotos`.
 */
export function galleryBaseFor(product) {
  if (product?.heroImages?.length > 0) return product.heroImages // vecchio campo, oggi vuoto
  const name = (u) => String(u || '').split('?')[0].split('/').pop()
  const own = new Set([...heroShotsOf(product), product?.heroImage, product?.detailImage].filter(Boolean).map(name))
  const all = product?.images?.length > 0 ? product.images : (product?.image ? [product.image] : [])
  const mockups = all.filter((u) => !own.has(name(u)))
  return mockups.length > 0 || product?.images?.length > 0 ? mockups : all
}

/** La foto della scheda nel catalogo (e poster del video hero). */
export function cardImageOf(product) {
  // Mai un mockup liscio senza stampa (blankImages, calcolati alla build).
  const blank = new Set(product?.blankImages || [])
  return heroShotsOf(product)[0] || product?.images?.find((u) => !blank.has(u)) || product?.image
}

/** Il video hero da mostrare nel catalogo, se c'e'. */
export const cardVideoOf = heroVideoSrc
