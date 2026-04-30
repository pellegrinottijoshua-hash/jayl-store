import { applyCors } from './_lib/cors.js'

const GITHUB_OWNER       = 'pellegrinottijoshua-hash'
const GITHUB_REPO        = 'jayl-store'
const GITHUB_BRANCH      = 'main'
const ADMIN_PRODUCTS_PATH    = 'src/data/admin-products.js'
const ADMIN_COLLECTIONS_PATH = 'src/data/admin-collections.js'
const ADMIN_PASSWORD = 'jaylpelle'

// ── GitHub helpers ────────────────────────────────────────────────────────────

async function ghGet(path, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`)
  return res.json()
}

async function ghPut(path, content, sha, message, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${JSON.stringify(err.message || err)}`)
  }
  return res.json()
}

async function ghDelete(path, sha, message, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ message, sha, branch: GITHUB_BRANCH }),
  })
  if (!res.ok) throw new Error(`GitHub DELETE ${path}: ${res.status}`)
  return res.json()
}

// ── Admin products helpers ────────────────────────────────────────────────────

async function readAdminProducts(token) {
  try {
    const file = await ghGet(ADMIN_PRODUCTS_PATH, token)
    const content = Buffer.from(file.content, 'base64').toString('utf8')
    // Extract the JSON array between the first [ and matching ]
    const match = content.match(/export const adminProducts = (\[[\s\S]*\])/)
    if (!match) return { products: [], sha: file.sha }
    return { products: JSON.parse(match[1]), sha: file.sha }
  } catch (e) {
    return { products: [], sha: null }
  }
}

async function writeAdminProducts(products, sha, message, token) {
  const content = `// This file is managed by the JAYL admin panel. Do not edit manually.\nexport const adminProducts = ${JSON.stringify(products, null, 2)}\n`
  return ghPut(ADMIN_PRODUCTS_PATH, content, sha, message, token)
}

// ── Admin collections helpers ─────────────────────────────────────────────────

async function readAdminCollections(token) {
  try {
    const file = await ghGet(ADMIN_COLLECTIONS_PATH, token)
    const content = Buffer.from(file.content, 'base64').toString('utf8')
    const match = content.match(/export const adminCollections = (\[[\s\S]*\])/)
    if (!match) return { collections: [], sha: file.sha }
    return { collections: JSON.parse(match[1]), sha: file.sha }
  } catch (e) {
    return { collections: [], sha: null }
  }
}

async function writeAdminCollections(collections, sha, message, token) {
  const content = `// This file is managed by the JAYL admin panel. Do not edit manually.\nexport const adminCollections = ${JSON.stringify(collections, null, 2)}\n`
  return ghPut(ADMIN_COLLECTIONS_PATH, content, sha, message, token)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, password, ...data } = req.body || {}

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured on server' })
  }

  try {
    // ── save-product ──────────────────────────────────────────────────────────
    if (action === 'save-product') {
      const { product } = data
      if (!product?.id) return res.status(400).json({ error: 'product.id required' })

      const { products, sha } = await readAdminProducts(githubToken)
      const idx = products.findIndex(p => p.id === product.id)
      if (idx >= 0) products[idx] = product
      else products.push(product)

      await writeAdminProducts(products, sha, `admin: ${idx >= 0 ? 'update' : 'add'} ${product.id}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── delete-product ────────────────────────────────────────────────────────
    if (action === 'delete-product') {
      const { productId } = data
      if (!productId) return res.status(400).json({ error: 'productId required' })

      const { products, sha } = await readAdminProducts(githubToken)
      const filtered = products.filter(p => p.id !== productId)
      if (filtered.length === products.length) {
        return res.status(404).json({ error: 'Product not found in admin products' })
      }
      await writeAdminProducts(filtered, sha, `admin: delete ${productId}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── upload-image ──────────────────────────────────────────────────────────
    if (action === 'upload-image') {
      const { productId, filename, dataUrl } = data
      if (!productId || !filename || !dataUrl) {
        return res.status(400).json({ error: 'productId, filename and dataUrl required' })
      }
      if (!/^[a-zA-Z0-9_\-./]+$/.test(productId) || !/^[a-zA-Z0-9_\-.]+$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid productId or filename' })
      }

      // Strip data-URL prefix to get raw base64
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
      const filePath = `public/images/${productId}/${filename}`

      // Get sha if file already exists (for update)
      let existingSha = null
      try {
        const existing = await ghGet(filePath, githubToken)
        existingSha = existing.sha
      } catch {}

      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`
      const ghRes = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `admin: upload image ${filename} for ${productId}`,
          content: base64,
          branch: GITHUB_BRANCH,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      })
      if (!ghRes.ok) {
        const err = await ghRes.json().catch(() => ({}))
        throw new Error(`Image upload failed: ${ghRes.status} — ${JSON.stringify(err.message || '')}`)
      }
      return res.status(200).json({ ok: true, path: `/images/${productId}/${filename}` })
    }

    // ── list-images ───────────────────────────────────────────────────────────
    if (action === 'list-images') {
      const { productId } = data
      if (!productId) return res.status(400).json({ error: 'productId required' })

      try {
        const files = await ghGet(`public/images/${productId}`, githubToken)
        const images = Array.isArray(files)
          ? files
              .filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name))
              .map(f => ({ name: f.name, path: f.path, sha: f.sha, url: `/images/${productId}/${f.name}` }))
          : []
        return res.status(200).json({ images })
      } catch {
        return res.status(200).json({ images: [] })
      }
    }

    // ── import-gelato-images ──────────────────────────────────────────────────
    // Downloads images from Gelato CDN and commits them with SEO filenames.
    // Payload: { productId, productTitle, images: [{ src, color }] }
    if (action === 'import-gelato-images') {
      const { productId, productTitle, images: imageList } = data
      if (!productId || !Array.isArray(imageList) || imageList.length === 0) {
        return res.status(400).json({ error: 'productId and images[] required' })
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(productId)) {
        return res.status(400).json({ error: 'Invalid productId' })
      }

      // Build a base slug from the product title for SEO filenames
      const titleSlug = (productTitle || productId)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 45)

      // Per-color counter so we get: product-name-black-01.jpg, product-name-black-02.jpg…
      const colorCounters = {}
      const paths = []

      const gelatoApiKey = (process.env.GELATO_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()

      for (let i = 0; i < imageList.length; i++) {
        const { src: srcUrl, color } = imageList[i]
        if (!srcUrl) continue
        try {
          const isGelatoUrl = /gelato/i.test(srcUrl)
          const imgRes = await fetch(srcUrl, isGelatoUrl && gelatoApiKey
            ? { headers: { 'X-API-KEY': gelatoApiKey } }
            : {})
          if (!imgRes.ok) {
            console.warn(`[admin] skip image ${i + 1} — HTTP ${imgRes.status}`)
            continue
          }
          const arrayBuffer = await imgRes.arrayBuffer()
          const base64      = Buffer.from(arrayBuffer).toString('base64')
          const ct  = imgRes.headers.get('content-type') || 'image/jpeg'
          const ext = ct.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'jpg'

          // SEO filename: {product-title}-{color}-01.jpg (or -mockup-01 if no color)
          const colorSlug = color
            ? color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            : 'mockup'
          colorCounters[colorSlug] = (colorCounters[colorSlug] || 0) + 1
          const n        = String(colorCounters[colorSlug]).padStart(2, '0')
          const filename = `${titleSlug}-${colorSlug}-${n}.${ext}`
          const filePath = `public/images/${productId}/${filename}`

          let existingSha = null
          try { const ex = await ghGet(filePath, githubToken); existingSha = ex.sha } catch {}

          const ghUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`
          const ghRes = await fetch(ghUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
              message: `admin: import gelato mockup ${filename} for ${productId}`,
              content: base64,
              branch: GITHUB_BRANCH,
              ...(existingSha ? { sha: existingSha } : {}),
            }),
          })
          if (!ghRes.ok) {
            const err = await ghRes.json().catch(() => ({}))
            console.warn(`[admin] upload failed ${filename}: ${ghRes.status} ${JSON.stringify(err.message || '')}`)
            continue
          }
          paths.push(`/images/${productId}/${filename}`)
        } catch (e) {
          console.warn(`[admin] error importing image ${i + 1}: ${e.message}`)
        }
      }
      return res.status(200).json({ ok: true, paths })
    }

    // ── delete-image ──────────────────────────────────────────────────────────
    if (action === 'delete-image') {
      const { path: filePath, sha } = data
      if (!filePath || !sha) return res.status(400).json({ error: 'path and sha required' })
      await ghDelete(filePath, sha, `admin: delete image ${filePath}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── read-product ─────────────────────────────────────────────────────────
    if (action === 'read-product') {
      const { productId } = data
      if (!productId) return res.status(400).json({ error: 'productId required' })
      const { products } = await readAdminProducts(githubToken)
      const product = products.find(p => p.id === productId)
      if (!product) return res.status(404).json({ error: 'Product not found in admin products' })
      return res.status(200).json({ product })
    }

    // ── list-collections ──────────────────────────────────────────────────────
    if (action === 'list-collections') {
      const { collections } = await readAdminCollections(githubToken)
      return res.status(200).json({ collections })
    }

    // ── save-collection ───────────────────────────────────────────────────────
    if (action === 'save-collection') {
      const { collection } = data
      if (!collection?.id) return res.status(400).json({ error: 'collection.id required' })

      const { collections, sha } = await readAdminCollections(githubToken)
      const idx = collections.findIndex(c => c.id === collection.id)
      if (idx >= 0) collections[idx] = collection
      else collections.push(collection)

      await writeAdminCollections(collections, sha, `admin: ${idx >= 0 ? 'update' : 'add'} collection ${collection.id}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── delete-collection ─────────────────────────────────────────────────────
    if (action === 'delete-collection') {
      const { collectionId } = data
      if (!collectionId) return res.status(400).json({ error: 'collectionId required' })

      const { collections, sha } = await readAdminCollections(githubToken)
      const filtered = collections.filter(c => c.id !== collectionId)
      if (filtered.length === collections.length) {
        return res.status(404).json({ error: 'Collection not found' })
      }
      await writeAdminCollections(filtered, sha, `admin: delete collection ${collectionId}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── reorder-collections ───────────────────────────────────────────────────
    if (action === 'reorder-collections') {
      const { collections } = data
      if (!Array.isArray(collections)) return res.status(400).json({ error: 'collections array required' })

      const { sha } = await readAdminCollections(githubToken)
      await writeAdminCollections(collections, sha, 'admin: reorder collections', githubToken)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })

  } catch (err) {
    console.error('[admin]', action, err.message)
    return res.status(500).json({ error: err.message })
  }
}
