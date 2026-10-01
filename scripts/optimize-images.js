/**
 * Converte le foto del negozio in WebP leggero durante `vite build`.
 *
 * Le foto arrivano da Higgsfield e da Gelato come PNG/JPEG da 0,5-2 MB, larghe
 * 928-2000 px, e il sito le serviva così com'erano. Misurato il 30/09/2026 da
 * telefono: la home del drop, dove atterrano le ads, scaricava ~8,6 MB di
 * immagini prima di mostrare la prima maglia, e la scheda prodotto ~3,7 MB di
 * galleria. In WebP q80, larghe al massimo 1000 px, pesano 7-90 KB l'una senza
 * differenze visibili, fondi scuri compresi.
 *
 * Le versioni WebP non si committano: ogni build le rigenera da public/
 * (~50 ms l'una, ~10 s per tutto il catalogo visibile), così una foto
 * caricata dall'admin è ottimizzata al deploy che quel commit fa partire. I
 * link raw.githubusercontent.com del catalogo puntano a file che al momento
 * della build sono già in public/: diventano foto servite dal sito stesso.
 *
 * Qualunque intoppo (sharp assente, file mancante, WebP non più leggero)
 * lascia l'URL originale: una foto non ottimizzata è meglio di una rotta.
 */
import { existsSync, statSync } from 'fs'
import path from 'path'
import { optimizedPath } from '../src/lib/optimizedImage.js'

// web: le foto del negozio. thumb: le miniature dell'admin (lista prodotti,
// pubblicazione social). ig: JPEG per Instagram, che accetta solo JPEG —
// sempre emesso, anche quando non è più leggero dell'originale.
const VARIANTS = {
  web:   { width: 1000, encode: (img) => img.webp({ quality: 80 }), mustEmit: false },
  thumb: { width: 240,  encode: (img) => img.webp({ quality: 70 }), mustEmit: false },
  ig:    { width: 1080, encode: (img) => img.flatten({ background: '#ffffff' }).jpeg({ quality: 90, mozjpeg: true }), mustEmit: true },
}
// Le foto Gelato arrivano a 2000×2000: decodificarne troppe insieme occupa
// gigabyte di RAM sulla macchina di build.
const CONCURRENCY = 4

const RAW_GITHUB_PUBLIC = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/main\/public(?=\/)/
const RASTER = /\.(png|jpe?g|webp)$/i

/** Il file sotto public/ a cui punta un URL del catalogo, o null. */
function localPathOf(url) {
  if (typeof url !== 'string') return null
  const local = url.replace(RAW_GITHUB_PUBLIC, '')
  return local.startsWith('/') && RASTER.test(local) ? local : null
}

/**
 * @param {{publicDir: string}} opts
 * @returns {(url: string, emitFile: (asset: object) => void, variant?: 'web'|'thumb'|'ig') => Promise<string>}
 *   url del catalogo → url della versione ottimizzata (o l'url com'era)
 */
export function createImageOptimizer({ publicDir }) {
  const done = new Map() // "<variante>:<path decodificato>" → Promise<string|null>
  const queue = []
  let running = 0
  let sharpPromise

  const next = () => {
    if (running >= CONCURRENCY || queue.length === 0) return
    running++
    const job = queue.shift()
    job().finally(() => { running--; next() })
  }
  const limit = (fn) => new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve, reject))
    next()
  })

  return async function optimize(url, emitFile, variant = 'web') {
    const v = VARIANTS[variant] || VARIANTS.web
    const local = localPathOf(url)
    if (!local) return url
    let decoded
    try { decoded = decodeURIComponent(local) } catch { return url }

    const key = `${variant}:${decoded}`
    if (!done.has(key)) {
      done.set(key, limit(async () => {
        const file = path.join(publicDir, decoded)
        if (!existsSync(file)) return null
        sharpPromise ??= import('sharp').then((m) => m.default).catch(() => null)
        const sharp = await sharpPromise
        if (!sharp) return null
        try {
          const out = await v.encode(sharp(file).rotate().resize({ width: v.width, withoutEnlargement: true })).toBuffer()
          if (!v.mustEmit && out.length >= statSync(file).size) return null
          emitFile({ type: 'asset', fileName: optimizedPath(decoded, variant).slice(1), source: out })
          return optimizedPath(local, variant)
        } catch {
          return null
        }
      }))
    }
    return (await done.get(key)) ?? url
  }
}

/** Riscrive i campi foto di un prodotto del negozio. Muta `product`. */
export async function optimizeProductImages(product, optimize) {
  const one = (url) => (url ? optimize(url) : url)
  const many = (list) => (Array.isArray(list) ? Promise.all(list.map(one)) : list)

  const [image, images, heroImage, detailImage, colorImages] = await Promise.all([
    one(product.image),
    many(product.images),
    one(product.heroImage),
    one(product.detailImage),
    many((product.colors || []).map((c) => c.image)),
  ])
  if (image !== undefined) product.image = image
  if (images !== undefined) product.images = images
  if (heroImage !== undefined) product.heroImage = heroImage
  if (detailImage !== undefined) product.detailImage = detailImage
  if (Array.isArray(product.colors)) {
    product.colors = product.colors.map((c, i) => (c.image ? { ...c, image: colorImages[i] } : c))
  }
  // imageColors è indicizzato per path: le chiavi seguono le foto.
  if (product.imageColors) {
    const entries = await Promise.all(
      Object.entries(product.imageColors).map(async ([img, color]) => [await optimize(img), color]),
    )
    product.imageColors = Object.fromEntries(entries)
  }
  return product
}

/** Le stringhe-foto dentro un sorgente JS/JSON (drop.js), come in un catalogo. */
export const IMAGE_LITERAL = /"((?:https:\/\/raw\.githubusercontent\.com\/[^/"]+\/[^/"]+\/main\/public)?\/[^"\s]+\.(?:png|jpe?g))"/gi
