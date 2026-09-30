/** L'mp4 hero di un prodotto, se il suo `videoUrl` è un file .mp4 (vedi HeroVideo.jsx). */
export function heroVideoSrc(product) {
  const url = product?.videoUrl
  return typeof url === 'string' && /\.mp4$/i.test(url.trim()) ? url.trim() : null
}
