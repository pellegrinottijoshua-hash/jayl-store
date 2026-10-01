// Schema degli URL delle foto ottimizzate — condiviso fra il plugin di Vite
// che le genera alla build (scripts/optimize-images.js), il client e
// api/publish-social.js.
//
//   web    /images/x/foto-black-01.png  →  /_img/images/x/foto-black-01.png.webp
//   thumb  /images/x/hf_1.png           →  /_img/thumb/images/x/hf_1.png.webp   (miniature admin)
//   ig     /images/x/hf_1.png           →  /_img/ig/images/x/hf_1.png.jpg       (Instagram vuole JPEG)
//
// Il path originale resta intero dentro quello nuovo di proposito:
// colorImageMatch.js assegna ogni foto a un colore cercando lo slug colore nel
// path ("…-black-01…"), e deve continuare a trovarlo anche sull'URL WebP.

export const OPTIMIZED_PREFIX = '/_img'

const VARIANTS = {
  web:   { dir: '',       ext: '.webp' },
  thumb: { dir: '/thumb', ext: '.webp' },
  ig:    { dir: '/ig',    ext: '.jpg' },
}

/** Path locale (sotto public/) → path della sua versione ottimizzata. */
export function optimizedPath(localPath, variant = 'web') {
  const v = VARIANTS[variant] || VARIANTS.web
  return `${OPTIMIZED_PREFIX}${v.dir}${localPath}${v.ext}`
}

/** URL di una versione ottimizzata → URL della foto originale. Qualunque altro valore torna com'è. */
export function originalImage(url) {
  if (typeof url !== 'string') return url
  for (const v of [VARIANTS.thumb, VARIANTS.ig, VARIANTS.web]) {
    const prefix = `${OPTIMIZED_PREFIX}${v.dir}/`
    if (url.startsWith(prefix) && url.endsWith(v.ext)) {
      return url.slice(OPTIMIZED_PREFIX.length + v.dir.length, -v.ext.length)
    }
  }
  return url
}
