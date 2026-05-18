/**
 * scripts/generate-sitemap.js
 * Generates public/sitemap.xml at build time from admin-products + admin-collections.
 * Run automatically via "prebuild" script in package.json before vite build.
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read data files directly (avoid Vite alias resolution)
const productsPath    = resolve(__dirname, '../src/data/admin-products.js')
const collectionsPath = resolve(__dirname, '../src/data/admin-collections.js')

function extractExport(filePath) {
  const raw = readFileSync(filePath, 'utf-8')
  // Strip the ES export and eval as a plain array/object
  const match = raw.match(/=\s*(\[[\s\S]*\]|\{[\s\S]*\})\s*$/)
  if (!match) return []
  return JSON.parse(match[1].replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}'))
}

let adminProducts, adminCollections
try {
  adminProducts    = extractExport(productsPath)
  adminCollections = extractExport(collectionsPath)
} catch (err) {
  console.error('[sitemap] Could not parse data files:', err.message)
  adminProducts    = []
  adminCollections = []
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

for (const product of adminProducts) {
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

for (const coll of adminCollections) {
  if (!coll.id) continue
  urls.push(`  <url>
    <loc>${esc(`${SITE_URL}/collection/${coll.id}`)}</loc>
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
