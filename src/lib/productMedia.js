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

/** Le immagini della galleria della scheda, dopo l'eventuale video. */
export function galleryBaseFor(product, hasVideo) {
  if (product?.heroImages?.length > 0) return product.heroImages // vecchio campo, oggi vuoto
  const shots = heroShotsOf(product)
  const all = product?.images?.length > 0 ? product.images : (product?.image ? [product.image] : [])
  const mockups = all.filter((u) => !shots.includes(u))
  return hasVideo && mockups.length > 0 ? mockups : [...shots, ...mockups]
}

/** La foto della scheda nel catalogo (e poster del video hero). */
export function cardImageOf(product) {
  return heroShotsOf(product)[0] || product?.images?.[0] || product?.image
}

/** Il video hero da mostrare nel catalogo, se c'e'. */
export const cardVideoOf = heroVideoSrc
