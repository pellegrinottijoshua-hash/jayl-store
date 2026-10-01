import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import path from 'path'
import { drop } from './src/data/drop.js'
import { classifyMockupColors } from './scripts/mockup-colors.js'
import { createImageOptimizer, optimizeProductImages, IMAGE_LITERAL } from './scripts/optimize-images.js'
import { isSocialAsset, mediaTypeOf } from './src/lib/socialAssets.js'

/**
 * Fields the storefront never reads — Etsy copy, Pinterest bookkeeping, Gelato
 * import leftovers. They make up roughly a third of admin-products.js and used to
 * ship inside the main bundle. Verified against every `src/` reference outside the
 * admin pages; add a field here only after checking it the same way.
 */
const ADMIN_ONLY_FIELDS = [
  'etsyTitle', 'etsyTags', 'etsyDescription', 'etsyImageAlts',
  'pinterestPins', 'pinterestPublishedImages', 'pinterestCaption',
  'instagramCaption', 'primaryKeywords', 'longTailKeywords',
  'gelatoCdnImages', 'imageAlts', 'printCost', 'neckLabelUrl',
  'adminManaged', 'excludedGelato',
]

const VIRTUAL_ID = 'virtual:storefront-products'
const SOCIAL_ID = 'virtual:social-assets'
const PRODUCTS_SOURCE = path.resolve(__dirname, 'src/data/admin-products.js')

// Un solo ottimizzatore per tutta la build (foto del negozio e asset social):
// una foto chiesta da due plugin si converte una volta. Null nel dev server.
const images = { optimize: null }
const setupImages = (config) => {
  if (config.command === 'build') images.optimize ??= createImageOptimizer({ publicDir: config.publicDir })
}

function readAdminProducts() {
  const raw = readFileSync(PRODUCTS_SOURCE, 'utf-8')
  const match = raw.match(/=\s*(\[[\s\S]*\])\s*$/)
  if (!match) throw new Error('[vite] could not parse admin-products.js')
  return JSON.parse(match[1])
}

/**
 * Serves admin-products.js to the storefront with the admin-only fields dropped.
 * In `vite build` it also swaps every storefront photo — catalog and drop heroes
 * in drop.js — for a light WebP copy (scripts/optimize-images.js). The dev
 * server keeps the originals.
 */
function storefrontProducts() {
  const dropSource = path.resolve(__dirname, 'src/data/drop.js')
  return {
    name: 'storefront-products',
    configResolved: setupImages,
    async transform(code, id) {
      const { optimize } = images
      if (!optimize || id.split('?')[0] !== dropSource) return null
      const emit = (asset) => this.emitFile(asset)
      const urls = [...new Set([...code.matchAll(IMAGE_LITERAL)].map((m) => m[1]))]
      const swapped = new Map(await Promise.all(urls.map(async (u) => [u, await optimize(u, emit)])))
      return { code: code.replace(IMAGE_LITERAL, (lit, u) => JSON.stringify(swapped.get(u))), map: null }
    },
    resolveId: (id) => (id === VIRTUAL_ID ? '\0' + VIRTUAL_ID : null),
    async load(id) {
      if (id !== '\0' + VIRTUAL_ID) return null
      this.addWatchFile(PRODUCTS_SOURCE)
      const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])
      const stripped = readAdminProducts()
        // I prodotti VAULT non sono nascosti via CSS: non entrano proprio nel bundle.
        .filter((product) => visible.has(product.id))
        .map((product) => {
          const out = { ...product }
          for (const field of ADMIN_ONLY_FIELDS) delete out[field]
          return out
        })
      // Colore dei mockup Gelato senza colore nel nome — letto dai pixel, qui
      // e non nel browser, cosi' la scheda prodotto sa gia' al primo paint
      // quali foto appartengono ai colori che non mostra.
      const publicDir = path.resolve(__dirname, 'public')
      for (const product of stripped) {
        const imageColors = await classifyMockupColors(product, publicDir)
        if (Object.keys(imageColors).length) product.imageColors = imageColors
      }
      // Dopo classifyMockupColors, che legge i pixel dai file originali.
      const { optimize } = images
      if (optimize) {
        const emit = (asset) => this.emitFile(asset)
        await Promise.all(stripped.map((product) => optimizeProductImages(product, (u) => optimize(u, emit))))
      }
      return `export const adminProducts = ${JSON.stringify(stripped)}\n`
    },
  }
}

/** Nomi dei file nella cartella di un prodotto, compresa la sottocartella generated/. */
function productFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (!statSync(full).isDirectory()) out.push(name)
    else if (name === 'generated') for (const g of readdirSync(full)) out.push(`generated/${g}`)
  }
  return out
}

/**
 * Serves the per-product social assets to the admin pages (never the
 * storefront): every photo/video in public/images/<id>/ except the Gelato
 * mockup copies (src/lib/socialAssets.js). In `vite build` each photo also gets
 * a 240 px WebP thumbnail and a JPEG for Instagram (src/lib/optimizedImage.js);
 * the dev server points both at the original.
 */
function socialAssets() {
  let publicDir = path.resolve(__dirname, 'public')
  return {
    name: 'social-assets',
    configResolved(config) {
      setupImages(config)
      publicDir = config.publicDir
    },
    resolveId: (id) => (id === SOCIAL_ID ? '\0' + SOCIAL_ID : null),
    async load(id) {
      if (id !== '\0' + SOCIAL_ID) return null
      const { optimize } = images
      const emit = (asset) => this.emitFile(asset)
      const out = {}
      await Promise.all(readAdminProducts().map(async ({ id: productId }) => {
        const dir = path.join(publicDir, 'images', productId)
        if (!existsSync(dir)) return
        const names = productFiles(dir)
          .filter(isSocialAsset)
          // Prima i video (l'hero Kling), poi le foto in ordine di nome.
          .sort((a, b) => (mediaTypeOf(b) === 'video') - (mediaTypeOf(a) === 'video') || a.localeCompare(b))
        const assets = await Promise.all(names.map(async (name) => {
          const src = `/images/${productId}/${name.split('/').map(encodeURIComponent).join('/')}`
          const type = mediaTypeOf(name)
          if (type === 'video' || !optimize) return { src, type, thumb: src, jpg: type === 'image' ? src : null }
          const [thumb, jpg] = await Promise.all([optimize(src, emit, 'thumb'), optimize(src, emit, 'ig')])
          return { src, type, thumb, jpg }
        }))
        if (assets.length) out[productId] = assets
      }))
      return `export const socialAssets = ${JSON.stringify(out)}\n`
    },
  }
}

export default defineConfig({
  plugins: [react(), storefrontProducts(), socialAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        // Split the big, rarely-changing vendors into their own long-lived chunks
        // so a copy tweak doesn't force visitors to re-download React or Framer Motion.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
          // Full catalog + the share widget are admin-only; keep them in one chunk
          // that the storefront never requests.
          if (id.includes('src/data/products-full.js') || id.includes('src/data/admin-products.js')) return 'admin-catalog'
          return undefined
        },
      },
    },
  },
})
