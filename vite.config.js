import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import path from 'path'
import { drop } from './src/data/drop.js'

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

/** Serves admin-products.js to the storefront with the admin-only fields dropped. */
function storefrontProducts() {
  const source = path.resolve(__dirname, 'src/data/admin-products.js')
  return {
    name: 'storefront-products',
    resolveId: (id) => (id === VIRTUAL_ID ? '\0' + VIRTUAL_ID : null),
    load(id) {
      if (id !== '\0' + VIRTUAL_ID) return null
      this.addWatchFile(source)
      const raw = readFileSync(source, 'utf-8')
      const match = raw.match(/=\s*(\[[\s\S]*\])\s*$/)
      if (!match) throw new Error('[storefront-products] could not parse admin-products.js')
      const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])
      const stripped = JSON.parse(match[1])
        // I prodotti VAULT non sono nascosti via CSS: non entrano proprio nel bundle.
        .filter((product) => visible.has(product.id))
        .map((product) => {
          const out = { ...product }
          for (const field of ADMIN_ONLY_FIELDS) delete out[field]
          return out
        })
      return `export const adminProducts = ${JSON.stringify(stripped)}\n`
    },
  }
}

export default defineConfig({
  plugins: [react(), storefrontProducts()],
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
