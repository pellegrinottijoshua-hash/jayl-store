// Schema degli URL delle foto ottimizzate — condiviso fra il plugin di Vite
// che le genera alla build (scripts/optimize-images.js) e il client, che in un
// caso (le email del carrello abbandonato) deve risalire all'originale.
//
//   /images/x/foto-black-01.png  →  /_img/images/x/foto-black-01.png.webp
//
// Il path originale resta intero dentro quello nuovo di proposito:
// colorImageMatch.js assegna ogni foto a un colore cercando lo slug colore nel
// path ("…-black-01…"), e deve continuare a trovarlo anche sull'URL WebP.

export const OPTIMIZED_PREFIX = '/_img'

/** Path locale (sotto public/) → path della sua versione WebP. */
export function optimizedPath(localPath) {
  return `${OPTIMIZED_PREFIX}${localPath}.webp`
}

/** URL della versione WebP → URL della foto originale. Qualunque altro valore torna com'è. */
export function originalImage(url) {
  if (typeof url !== 'string') return url
  if (!url.startsWith(OPTIMIZED_PREFIX + '/') || !url.endsWith('.webp')) return url
  return url.slice(OPTIMIZED_PREFIX.length, -'.webp'.length)
}
