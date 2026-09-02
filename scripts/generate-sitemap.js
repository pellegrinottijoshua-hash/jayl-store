/**
 * scripts/generate-sitemap.js
 * Generates public/sitemap.xml at build time from admin-products + admin-collections.
 * Run automatically via "prebuild" script in package.json before vite build.
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { drop } from '../src/data/drop.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read data files directly (avoid Vite alias resolution)
const productsPath = resolve(__dirname, '../src/data/admin-products.js')

function extractExport(filePath) {
  const raw = readFileSync(filePath, 'utf-8')
  // Strip the ES export and eval as a plain array/object
  const match = raw.match(/=\s*(\[[\s\S]*\]|\{[\s\S]*\})\s*$/)
  if (!match) return []
  return JSON.parse(match[1].replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}'))
}

let adminProducts
try {
  adminProducts = extractExport(productsPath)
} catch (err) {
  console.error('[sitemap] Could not parse data files:', err.message)
  adminProducts = []
}

/**
 * Must stay identical to `collectionSlug` in src/pages/CollectionPage.jsx and
 * `colSlug` in api/orders.js. Collection URLs are derived from each product's
 * own `collection` string — NOT from the admin collection id, which drifts from
 * it (id "cool-pok-mon-back" vs product "cool pokemon back") and would emit a
 * URL that renders an empty page.
 */
function collectionSlug(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const SITE_URL = 'https://jayl.store'

const STATIC_PAGES = [
  { path: '/',          priority: '1.0',  changefreq: 'weekly'  },
  { path: '/objects',   priority: '0.9',  changefreq: 'weekly'  },
  { path: '/artist',    priority: '0.7',  changefreq: 'monthly' },
  { path: '/contact',   priority: '0.5',  changefreq: 'yearly'  },
  { path: '/shipping',  priority: '0.4',  changefreq: 'yearly'  },
  { path: '/returns',   priority: '0.4',  changefreq: 'yearly'  },
  { path: '/privacy',   priority: '0.3',  changefreq: 'yearly'  },
  { path: '/terms',     priority: '0.3',  changefreq: 'yearly'  },
]

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const now = new Date().toISOString().split('T')[0]
const urls = []

for (const p of STATIC_PAGES) {
  urls.push(`  <url>
    <loc>${esc(SITE_URL + p.path)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`)
}

// VAULT products aren't buyable or indexable (see api/orders.js handlePrerender) —
// keep them out of the sitemap too. Collection URLs below stay derived from the
// full catalog: a collection isn't itself vaulted, only the products in it are,
// and it may hold visible products again after a future drop.
const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])
const sitemapProducts = adminProducts.filter((p) => visible.has(p.id))

for (const product of sitemapProducts) {
  if (!product.id) continue
  const lastmod = product.updatedAt
    ? new Date(product.updatedAt).toISOString().split('T')[0]
    : now
  urls.push(`  <url>
    <loc>${esc(`${SITE_URL}/product/${product.id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
}

// Only collections that actually resolve to products get a URL.
const collectionSlugs = [...new Set(
  adminProducts.map(p => collectionSlug(p.collection)).filter(Boolean)
)]

for (const slug of collectionSlugs) {
  urls.push(`  <url>
    <loc>${esc(`${SITE_URL}/collection/${slug}`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

const outPath = resolve(__dirname, '../public/sitemap.xml')
writeFileSync(outPath, xml, 'utf-8')
console.log(`[sitemap] Generated ${urls.length} URLs → public/sitemap.xml`)
