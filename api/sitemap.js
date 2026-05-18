/**
 * api/sitemap.js  →  GET /sitemap.xml
 *
 * Dynamically generates a sitemap that includes all static pages
 * AND every product/collection from admin-products.js / admin-collections.js.
 * Triggered by the vercel.json rewrite:
 *   { "source": "/sitemap.xml", "destination": "/api/sitemap" }
 */

import { adminProducts    } from '../src/data/admin-products.js'
import { adminCollections } from '../src/data/admin-collections.js'

const SITE_URL = (process.env.SITE_URL || 'https://jayl.store').replace(/\/$/, '')

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

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const now = new Date().toISOString().split('T')[0]

  const urls = []

  // Static pages
  for (const p of STATIC_PAGES) {
    urls.push(`
  <url>
    <loc>${esc(SITE_URL + p.path)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`)
  }

  // Product pages
  for (const product of adminProducts) {
    if (!product.id) continue
    const lastmod = product.updatedAt
      ? new Date(product.updatedAt).toISOString().split('T')[0]
      : now
    urls.push(`
  <url>
    <loc>${esc(`${SITE_URL}/product/${product.id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
  }

  // Collection pages
  for (const coll of adminCollections) {
    if (!coll.id) continue
    urls.push(`
  <url>
    <loc>${esc(`${SITE_URL}/collection/${coll.id}`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  return res.status(200).send(xml)
}
