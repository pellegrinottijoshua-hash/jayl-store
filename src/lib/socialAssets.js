// Quali file della cartella di un prodotto (public/images/<id>/) si possono
// pubblicare sui social: tutto tranne le copie dei mockup Gelato — foto
// caricate, video, hero Kling, immagini generate. Condiviso fra il plugin di
// Vite (miniature alla build) e api/publish-social.js (azione `assets`).

import { isGelatoCopy } from './gelatoPool.js'

const MEDIA = /\.(jpe?g|png|webp|mp4|mov|webm)$/i
const VIDEO = /\.(mp4|mov|webm)$/i

/** `name` è il path relativo alla cartella del prodotto (es. "generated/x.png"). */
export function isSocialAsset(name) {
  const base = String(name || '').split('/').pop()
  return MEDIA.test(base) && !base.startsWith('_') && !isGelatoCopy(base)
}

export function mediaTypeOf(path) {
  return VIDEO.test(String(path || '')) ? 'video' : 'image'
}
