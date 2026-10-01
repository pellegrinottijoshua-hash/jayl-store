/** L'mp4 hero di un prodotto, se il suo `videoUrl` è un file .mp4 (vedi HeroVideo.jsx). */
export function heroVideoSrc(product) {
  const url = product?.videoUrl
  return typeof url === 'string' && /\.mp4$/i.test(url.trim()) ? url.trim() : null
}

/**
 * Il video della home per un pezzo del drop: quello caricato nel tab Drop
 * (`entry.heroVideos[id]`, lo spazio dedicato), altrimenti il video hero
 * della scheda prodotto.
 */
export function homeVideoSrc(entry, product) {
  const dedicated = entry?.heroVideos?.[product?.id]
  if (typeof dedicated === 'string' && /\.mp4$/i.test(dedicated.trim())) return dedicated.trim()
  return heroVideoSrc(product)
}

/**
 * La porzione del fotogramma che va disegnata su una striscia del cilindro
 * (DropHero): stesso `object-fit: cover` e `object-position` della foto che
 * il video sostituisce. `x`/`w` sono posizione e larghezza della striscia
 * dentro la scheda larga `W` e alta `H`. Rende il rettangolo sorgente per
 * `drawImage(video, sx, sy, sw, sh, …)`.
 */
export function stripSourceRect({ videoW, videoH, W, H, x, w, posX = 0.5, posY = 0.3 }) {
  const scale = Math.max(W / videoW, H / videoH)
  const offX = (W - videoW * scale) * posX
  const offY = (H - videoH * scale) * posY
  return { sx: (x - offX) / scale, sy: -offY / scale, sw: w / scale, sh: H / scale }
}
