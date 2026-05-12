import { applyCors } from './_lib/cors.js'
import { put, del as blobDel } from '@vercel/blob'
import { decodeItemsFromMetadata } from './_lib/catalog.js'

const GITHUB_OWNER       = 'pellegrinottijoshua-hash'
const GITHUB_REPO        = 'jayl-store'
const GITHUB_BRANCH      = 'main'
const ADMIN_PRODUCTS_PATH    = 'src/data/admin-products.js'
const ADMIN_COLLECTIONS_PATH = 'src/data/admin-collections.js'
const GENERATE_PROMPTS_PATH  = 'src/data/generate-prompts.js'
const PERSONAS_PATH          = 'src/data/personas.json'
const CONTENT_QUEUE_PATH     = 'src/data/content-queue.json'
const ASSETS_PATH            = 'src/data/assets.json'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

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

// ── Personas helpers ──────────────────────────────────────────────────────────

async function readPersonas(token) {
  try {
    const file = await ghGet(PERSONAS_PATH, token)
    return { personas: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')), sha: file.sha }
  } catch {
    return { personas: [], sha: null }
  }
}

async function writePersonas(personas, sha, message, token) {
  return ghPut(PERSONAS_PATH, JSON.stringify(personas, null, 2) + '\n', sha, message, token)
}

// ── Content Queue helpers ─────────────────────────────────────────────────────

async function readQueue(token) {
  try {
    const file = await ghGet(CONTENT_QUEUE_PATH, token)
    return { items: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')), sha: file.sha }
  } catch {
    return { items: [], sha: null }
  }
}

async function writeQueue(items, sha, message, token) {
  return ghPut(CONTENT_QUEUE_PATH, JSON.stringify(items, null, 2) + '\n', sha, message, token)
}

// ── Asset Gallery helpers ─────────────────────────────────────────────────────

async function readAssets(token) {
  try {
    const file = await ghGet(ASSETS_PATH, token)
    return { assets: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')), sha: file.sha }
  } catch {
    return { assets: [], sha: null }
  }
}

async function writeAssets(assets, sha, message, token) {
  return ghPut(ASSETS_PATH, JSON.stringify(assets, null, 2) + '\n', sha, message, token)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  // ── Cron GET: process due queue items ───────────────────────────────────────
  if (req.method === 'GET') {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers['authorization'] || ''
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' })

    const now = new Date()
    const { items, sha } = await readQueue(githubToken)
    const due = items.filter(it => it.status === 'pending' && new Date(it.scheduledAt) <= now)
    if (!due.length) return res.status(200).json({ processed: 0, message: 'No items due' })

    let processed = 0
    for (const item of due) {
      try {
        const result = await fetch(
          `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/publish-social`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              password: ADMIN_PASSWORD,
              platform: item.platform,
              imageUrl: item.imageUrl,
              videoUrl: item.videoUrl,
              caption:  item.caption,
              hashtags: item.hashtags,
              altText:  item.altText,
              title:    item.title,
              description: item.description,
              link:     item.link,
            }),
          }
        ).then(r => r.json())

        item.status      = result.ok ? 'published' : 'failed'
        item.publishedAt = result.ok ? new Date().toISOString() : null
        item.error       = result.ok ? null : (result.error || 'Unknown error')
        if (result.ok) processed++
      } catch (e) {
        item.status = 'failed'
        item.error  = e.message
      }
    }

    await writeQueue(items, sha, `[cron] Process ${processed} queue items`, githubToken)
    return res.status(200).json({ processed, total: due.length })
  }

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
      // Preserve createdAt on update; stamp it on first save
      const existing = idx >= 0 ? products[idx] : null
      const productWithMeta = {
        ...product,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      if (idx >= 0) products[idx] = productWithMeta
      else products.push(productWithMeta)

      await writeAdminProducts(products, sha, `admin: ${idx >= 0 ? 'update' : 'add'} ${product.id}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── update-product-images ─────────────────────────────────────────────────
    // Lightweight action: updates only the images/image fields of an existing product.
    // Used by the Review panel "Pubblica su jayl.store" without requiring the full product object.
    if (action === 'update-product-images') {
      const { productId, images: newImages, heroImage } = data
      if (!productId || !Array.isArray(newImages)) {
        return res.status(400).json({ error: 'productId and images[] required' })
      }
      const { products, sha } = await readAdminProducts(githubToken)
      const idx = products.findIndex(p => p.id === productId)
      if (idx < 0) return res.status(404).json({ error: 'Product not found' })
      products[idx] = {
        ...products[idx],
        images: newImages,
        image: heroImage ?? newImages[0] ?? products[idx].image,
        updatedAt: new Date().toISOString(),
      }
      await writeAdminProducts(products, sha, `admin: update images order for ${productId}`, githubToken)
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
          // Only add Gelato API key for actual Gelato API endpoints (not S3 presigned URLs)
          const isGelatoApi = /gelatoapis\.com/i.test(srcUrl)
          const imgRes = await fetch(srcUrl, isGelatoApi && gelatoApiKey
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

    // ── read-prompts ──────────────────────────────────────────────────────────
    if (action === 'read-prompts') {
      try {
        const file    = await ghGet(GENERATE_PROMPTS_PATH, githubToken)
        const content = Buffer.from(file.content, 'base64').toString('utf8')
        const match   = content.match(/export const generatePrompts = (\{[\s\S]*\})/)
        if (!match) return res.status(200).json({ prompts: null, sha: file.sha })
        return res.status(200).json({ prompts: JSON.parse(match[1]), sha: file.sha })
      } catch {
        return res.status(200).json({ prompts: null, sha: null })
      }
    }

    // ── save-prompts ──────────────────────────────────────────────────────────
    if (action === 'save-prompts') {
      const { prompts } = data
      if (!prompts) return res.status(400).json({ error: 'prompts required' })
      const content = `// This file is managed by the JAYL admin panel. Do not edit manually.\nexport const generatePrompts = ${JSON.stringify(prompts, null, 2)}\n`
      let sha = null
      try { const f = await ghGet(GENERATE_PROMPTS_PATH, githubToken); sha = f.sha } catch {}
      await ghPut(GENERATE_PROMPTS_PATH, content, sha, 'admin: update generate prompts', githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── import-generated-asset ────────────────────────────────────────────────
    // Downloads a generated image/video URL and commits it to GitHub.
    // Payload: { productId, assetUrl, assetType: 'image'|'video' }
    if (action === 'import-generated-asset') {
      const { productId, assetUrl, assetType = 'image' } = data
      if (!productId || !assetUrl) {
        return res.status(400).json({ error: 'productId and assetUrl required' })
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(productId)) {
        return res.status(400).json({ error: 'Invalid productId' })
      }

      const assetRes = await fetch(assetUrl)
      if (!assetRes.ok) {
        return res.status(502).json({ error: `Could not download asset: HTTP ${assetRes.status}` })
      }

      const arrayBuffer = await assetRes.arrayBuffer()
      const base64      = Buffer.from(arrayBuffer).toString('base64')
      const ct  = assetRes.headers.get('content-type') || (assetType === 'video' ? 'video/mp4' : 'image/jpeg')
      const ext = ct.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || (assetType === 'video' ? 'mp4' : 'jpg')

      const timestamp = Date.now()
      const filename  = `generated-${assetType === 'video' ? 'video' : 'img'}-${timestamp}.${ext}`
      const filePath  = `public/images/${productId}/generated/${filename}`

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
          message: `admin: save generated ${assetType} for ${productId}`,
          content: base64,
          branch: GITHUB_BRANCH,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      })

      if (!ghRes.ok) {
        const err = await ghRes.json().catch(() => ({}))
        throw new Error(`GitHub upload failed: ${ghRes.status} — ${JSON.stringify(err.message || '')}`)
      }

      const publicPath = `/images/${productId}/generated/${filename}`
      return res.status(200).json({ ok: true, path: publicPath })
    }

    // ── save-social-links ─────────────────────────────────────────────────────
    if (action === 'save-social-links') {
      const { links } = data
      if (!links || typeof links !== 'object') return res.status(400).json({ error: 'links object required' })
      const safe = {
        instagram:  String(links.instagram  || '').trim(),
        tiktok:     String(links.tiktok     || '').trim(),
        pinterest:  String(links.pinterest  || '').trim(),
      }
      const SOCIAL_PATH = 'src/data/social-links.js'
      const content = `// Social channel links — edit via Admin → Settings → Social Links\n// Saved from the admin panel; takes effect after Vercel deploy (~2 min).\nexport const SOCIAL_LINKS = ${JSON.stringify(safe, null, 2)}\n`
      let sha = null
      try { const f = await ghGet(SOCIAL_PATH, githubToken); sha = f.sha } catch {}
      await ghPut(SOCIAL_PATH, content, sha, 'admin: update social links', githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── personas: list ───────────────────────────────────────────────────────
    if (action === 'list-personas') {
      const { personas } = await readPersonas(githubToken)
      return res.status(200).json({ personas })
    }

    // ── personas: save (create or update) ────────────────────────────────────
    if (action === 'save-persona') {
      const { persona } = data
      if (!persona?.id || !persona?.name) return res.status(400).json({ error: 'persona.id and persona.name required' })
      const { personas, sha } = await readPersonas(githubToken)
      const idx = personas.findIndex(p => p.id === persona.id)
      const safe = {
        id:             String(persona.id),
        name:           String(persona.name || ''),
        handle:         String(persona.handle || ''),
        bio:            String(persona.bio || ''),
        personality:    String(persona.personality || ''),
        aesthetic:      String(persona.aesthetic || ''),
        contentStyle:   String(persona.contentStyle || ''),
        targetAudience: String(persona.targetAudience || ''),
        promptContext:  String(persona.promptContext || ''),
        instagram:      String(persona.instagram || ''),
        tiktok:         String(persona.tiktok || ''),
        youtube:        String(persona.youtube || ''),
        referenceImages: Array.isArray(persona.referenceImages) ? persona.referenceImages : [],
        prompts: (persona.prompts && typeof persona.prompts === 'object') ? persona.prompts : (personas[idx]?.prompts || { mockup: [], video: [] }),
        createdAt:      persona.createdAt || new Date().toISOString(),
        updatedAt:      new Date().toISOString(),
      }
      if (idx >= 0) personas[idx] = safe
      else personas.push(safe)
      await writePersonas(personas, sha, `admin: ${idx >= 0 ? 'update' : 'create'} persona ${safe.id}`, githubToken)
      return res.status(200).json({ ok: true, persona: safe })
    }

    // ── personas: delete ─────────────────────────────────────────────────────
    if (action === 'delete-persona') {
      const { personaId } = data
      if (!personaId) return res.status(400).json({ error: 'personaId required' })
      const { personas, sha } = await readPersonas(githubToken)
      const filtered = personas.filter(p => p.id !== personaId)
      await writePersonas(filtered, sha, `admin: delete persona ${personaId}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── personas: save prompts ────────────────────────────────────────────────
    if (action === 'save-persona-prompts') {
      const { personaId, prompts } = data
      if (!personaId) return res.status(400).json({ error: 'personaId required' })
      if (!prompts || typeof prompts !== 'object') return res.status(400).json({ error: 'prompts object required' })
      const { personas, sha } = await readPersonas(githubToken)
      const idx = personas.findIndex(p => p.id === personaId)
      if (idx === -1) return res.status(404).json({ error: 'Persona not found' })
      personas[idx] = { ...personas[idx], prompts, updatedAt: new Date().toISOString() }
      await writePersonas(personas, sha, `admin: update prompts for persona ${personaId}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── personas: upload reference image ─────────────────────────────────────
    if (action === 'upload-persona-image') {
      const { personaId, filename, dataUrl } = data
      if (!personaId || !filename || !dataUrl) return res.status(400).json({ error: 'personaId, filename, dataUrl required' })
      const base64   = dataUrl.replace(/^data:[^;]+;base64,/, '')
      const filePath = `public/personas/${personaId}/${filename}`
      let existingSha = null
      try { existingSha = (await ghGet(filePath, githubToken)).sha } catch {}
      const putUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ message: `admin: upload persona ref image for ${personaId}`, content: base64, branch: GITHUB_BRANCH, ...(existingSha ? { sha: existingSha } : {}) }),
      })
      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}))
        throw new Error(`GitHub PUT persona image: ${putRes.status} — ${err.message || ''}`)
      }
      return res.status(200).json({ ok: true, path: `/personas/${personaId}/${filename}` })
    }

    // ── reviews: list-reviews ─────────────────────────────────────────────────
    if (action === 'list-reviews') {
      const REVIEWS_PATH = 'src/data/reviews.json'
      let reviews = []
      try {
        const file = await ghGet(REVIEWS_PATH, githubToken)
        reviews = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'))
      } catch {}
      return res.status(200).json({ reviews })
    }

    // ── reviews: moderate (approve / reject / delete) ─────────────────────────
    if (action === 'moderate-review') {
      const { reviewId, decision } = data // decision: 'approve' | 'reject' | 'delete'
      if (!reviewId || !decision) return res.status(400).json({ error: 'reviewId and decision required' })
      const REVIEWS_PATH = 'src/data/reviews.json'
      let reviews = []; let sha = null
      try {
        const file = await ghGet(REVIEWS_PATH, githubToken)
        sha = file.sha
        reviews = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'))
      } catch {}

      if (decision === 'delete') {
        reviews = reviews.filter(r => r.id !== reviewId)
      } else {
        const idx = reviews.findIndex(r => r.id === reviewId)
        if (idx === -1) return res.status(404).json({ error: 'Review not found' })
        reviews[idx].status = decision === 'approve' ? 'approved' : 'rejected'
      }

      await ghPut(
        REVIEWS_PATH,
        JSON.stringify(reviews, null, 2) + '\n',
        sha,
        `admin: ${decision} review ${reviewId}`,
        githubToken
      )
      return res.status(200).json({ ok: true })
    }

    // ── emails: list-emails ───────────────────────────────────────────────────
    if (action === 'list-emails') {
      const EMAILS_PATH = 'src/data/emails.json'
      let emails = []
      try {
        const file = await ghGet(EMAILS_PATH, githubToken)
        emails = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'))
      } catch {}
      return res.status(200).json({ emails })
    }

    // ── remove-background ─────────────────────────────────────────────────────
    if (action === 'remove-background') {
      const { imageUrl, imageData } = data
      const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
      if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

      const FAL_REST = 'https://rest.alpha.fal.ai'

      let falUrl = imageUrl

      // If a base64 data URL was provided, upload it to fal storage first
      if (!falUrl && imageData) {
        const [header, b64] = imageData.split(',')
        const contentType   = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
        const ext           = contentType.includes('png') ? 'png' : 'jpg'
        const imageBytes    = Buffer.from(b64, 'base64')

        const initRes = await fetch(
          `${FAL_REST}/storage/upload/initiate?storage_type=fal-cdn-v3`,
          {
            method:  'POST',
            headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ content_type: contentType, file_name: `rmbg-upload.${ext}` }),
          }
        )
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}))
          return res.status(500).json({ error: `fal storage initiate failed: ${err.message || initRes.status}` })
        }
        const { upload_url, file_url } = await initRes.json()
        const putRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: imageBytes,
        })
        if (!putRes.ok) return res.status(500).json({ error: `fal storage PUT failed: ${putRes.status}` })
        falUrl = file_url
      }

      if (!falUrl) return res.status(400).json({ error: 'imageUrl or imageData required' })

      const falRes = await fetch('https://fal.run/fal-ai/birefnet', {
        method:  'POST',
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image_url: falUrl }),
      })
      const responseBody = await falRes.json().catch(() => null)
      if (!falRes.ok) {
        return res.status(falRes.status).json({
          error: responseBody?.detail || responseBody?.message || `birefnet error ${falRes.status}`,
        })
      }
      const resultUrl = responseBody?.image?.url ?? responseBody?.images?.[0]?.url ?? null
      if (!resultUrl) return res.status(500).json({ error: 'No image URL in birefnet response' })
      return res.status(200).json({ imageUrl: resultUrl })
    }

    // ── publish-social-asset ──────────────────────────────────────────────────
    // Atomic: save assets to product gallery + set hero + update SEO + store social copy
    // Payload: { productId, platform, assets: [{id, imageUrl, videoUrl}], copy: {...} }
    if (action === 'publish-social-asset') {
      const { productId, platform, assets = [], copy = {} } = data
      if (!productId) return res.status(400).json({ error: 'productId required' })
      if (!Array.isArray(assets) || assets.length === 0) return res.status(400).json({ error: 'assets array required' })

      // 1. Download & commit each asset to GitHub
      const savedPaths = []
      for (const asset of assets) {
        const url = asset.imageUrl || asset.videoUrl
        if (!url) continue
        const isVideo = !!asset.videoUrl
        const ext     = isVideo ? 'mp4' : 'jpg'
        const filename = `${platform}-${asset.id}-${Date.now()}.${ext}`
        const imagePath = `public/images/${productId}/generated/${filename}`

        let buffer
        try {
          const fetched = await fetch(url, { headers: { 'User-Agent': 'JAYL-Store/1.0' }, signal: AbortSignal.timeout(30_000) })
          if (!fetched.ok) continue
          buffer = Buffer.from(await fetched.arrayBuffer())
        } catch { continue }

        let sha = null
        try { const f = await ghGet(imagePath, githubToken); sha = f.sha } catch {}
        await ghPut(imagePath, buffer.toString('base64'), sha, `admin: publish ${platform} asset for ${productId}`, githubToken)
        savedPaths.push({ path: `/images/${productId}/generated/${filename}`, isVideo })
      }

      if (savedPaths.length === 0) return res.status(500).json({ error: 'No assets could be saved' })

      // 2. Update product: heroImages + SEO + socialCopy
      const { products, sha: prodSha } = await readAdminProducts(githubToken)
      const idx = products.findIndex(p => p.id === productId)
      if (idx < 0) return res.status(404).json({ error: 'Product not found' })

      const existing = products[idx]
      const newImages  = savedPaths.filter(p => !p.isVideo).map(p => p.path)
      const newVideos  = savedPaths.filter(p => p.isVideo).map(p => p.path)
      const heroImages = [...new Set([...(existing.heroImages || []), ...newImages])].slice(0, 6)

      const updated = {
        ...existing,
        heroImages,
        ...(newVideos.length > 0 ? { heroVideo: newVideos[0] } : {}),
        // SEO fields from copy (only overwrite if provided)
        ...(copy.seoTitle        ? { seoTitle:       copy.seoTitle        } : {}),
        ...(copy.seoDescription  ? { seoDescription: copy.seoDescription  } : {}),
        ...(copy.altText         ? { altText:         copy.altText         } : {}),
        // Per-platform copy
        socialCopy: {
          ...(existing.socialCopy || {}),
          [platform]: {
            caption:   copy.caption   || '',
            hashtags:  copy.hashtags  || '',
            altText:   copy.altText   || '',
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      }
      products[idx] = updated
      await writeAdminProducts(products, prodSha, `admin: publish ${platform} assets for ${productId}`, githubToken)

      return res.status(200).json({ ok: true, savedPaths, heroImages, updatedProduct: updated })
    }

    // ── generate-copy ─────────────────────────────────────────────────────────
    if (action === 'generate-copy') {
      const { productName, productType, collection, social, selectedAssets } = data
      const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim()
      if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

      const socialLabels = {
        tiktok: 'TikTok', instagram: 'Instagram', pinterest: 'Pinterest',
        facebook: 'Facebook', site: 'Website/Etsy', youtube: 'YouTube',
      }
      const productLabels = {
        tshirt: 'T-Shirt', mug: 'Mug', art: 'Art Print', tote: 'Tote Bag',
      }
      const socialLabel   = socialLabels[social]   || social
      const productLabel  = productLabels[productType] || productType
      const assetsCount   = Array.isArray(selectedAssets) ? selectedAssets.length : 0

      const systemPrompt = `You are a creative copywriter for JAYL, a print-on-demand lifestyle brand.
Write compelling, platform-appropriate copy for social media and e-commerce.
Always respond with valid JSON only, no markdown, no explanation.`

      const userPrompt = `Write copy for this product:
- Product: "${productName}"
- Type: ${productLabel}
- Collection: ${collection || 'General'}
- Platform: ${socialLabel}
- Number of selected assets: ${assetsCount}

Return a JSON object with these exact keys:
{
  "caption": "engaging platform-native caption (1-3 sentences, natural voice for ${socialLabel})",
  "hashtags": "10-15 relevant hashtags as a single string",
  "altText": "descriptive alt text for accessibility (1 sentence)",
  "seoTitle": "SEO-optimized product title (under 60 chars)",
  "seoDescription": "SEO meta description (under 160 chars)",
  "etsyTitle": "Etsy listing title (under 140 chars, include key terms)",
  "etsyTags": "13 comma-separated Etsy tags"
}`

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      const anthropicData = await anthropicRes.json()
      if (!anthropicRes.ok) {
        return res.status(500).json({ error: anthropicData.error?.message || 'Claude API error' })
      }
      const raw = anthropicData.content?.[0]?.text || '{}'
      let copy
      try {
        copy = JSON.parse(raw)
      } catch {
        // Try to extract JSON from response
        const match = raw.match(/\{[\s\S]*\}/)
        copy = match ? JSON.parse(match[0]) : {}
      }
      return res.status(200).json({ copy })
    }

    // ── revenue-stats ─────────────────────────────────────────────────────────
    if (action === 'revenue-stats') {
      const stripeKey = process.env.STRIPE_SECRET_KEY
      if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' })

      // Fetch up to 300 succeeded PaymentIntents (3 pages of 100)
      let allPIs = []
      let startingAfter = null
      for (let page = 0; page < 3; page++) {
        const params = new URLSearchParams({ limit: '100', 'expand[]': 'data.metadata' })
        if (startingAfter) params.set('starting_after', startingAfter)
        const r = await fetch(`https://api.stripe.com/v1/payment_intents?${params}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        })
        const d = await r.json()
        if (!r.ok) throw new Error(`Stripe: ${d.error?.message || r.status}`)
        const succeeded = (d.data || []).filter(pi => pi.status === 'succeeded')
        allPIs = allPIs.concat(succeeded)
        if (!d.has_more) break
        startingAfter = d.data[d.data.length - 1]?.id
      }

      // Import all products from GitHub for printCost + collection lookup
      const { products: adminProds } = await readAdminProducts(githubToken).catch(() => ({ products: [] }))
      const productMap = {}
      adminProds.forEach(p => { productMap[p.id] = p })

      // Also import static products for collection/name fallback
      // (we can't import frontend data server-side, so use metadata product name)

      const now  = new Date()
      const byProduct    = {}
      const byCollection = {}
      const byMonth      = {}
      let totalRevenue = 0
      let totalOrders  = 0

      for (const pi of allPIs) {
        if (!pi.amount) continue
        const amount    = pi.amount            // cents
        const createdAt = new Date(pi.created * 1000)
        const monthKey  = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`

        totalRevenue += amount
        totalOrders  += 1

        // Monthly trend
        byMonth[monthKey] = (byMonth[monthKey] || { revenue: 0, orders: 0 })
        byMonth[monthKey].revenue += amount
        byMonth[monthKey].orders  += 1

        // Per-product aggregation
        let items = []
        try { items = decodeItemsFromMetadata(pi.metadata?.items) } catch {}
        if (!items.length) {
          // Fallback: attribute to unknown
          const key = '__unknown__'
          byProduct[key] = byProduct[key] || { productId: key, name: 'Other / Unknown', collection: '', revenue: 0, orders: 0, printCost: 0 }
          byProduct[key].revenue += amount
          byProduct[key].orders  += 1
        } else {
          for (const item of items) {
            const pid   = item.productId || '__unknown__'
            const pdata = productMap[pid] || {}
            if (!byProduct[pid]) {
              byProduct[pid] = {
                productId:  pid,
                name:       item.product?.name || pdata.name || pid,
                collection: pdata.collection  || item.product?.collection || '',
                revenue:    0,
                orders:     0,
                printCost:  pdata.printCost   || 0,
              }
            }
            // Attribute full PI amount to first item if multi-item (approximation)
            byProduct[pid].revenue += Math.round(amount / items.length)
            byProduct[pid].orders  += item.quantity || 1
          }

          // Collections
          for (const item of items) {
            const pid  = item.productId || '__unknown__'
            const coll = productMap[pid]?.collection || 'General'
            byCollection[coll] = byCollection[coll] || { collection: coll, revenue: 0, orders: 0 }
            byCollection[coll].revenue += Math.round(amount / items.length)
            byCollection[coll].orders  += 1
          }
        }
      }

      // Sort top products
      const topProducts = Object.values(byProduct)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(p => ({
          ...p,
          margin:       p.printCost > 0 ? p.revenue - (p.printCost * p.orders) : null,
          marginPct:    p.printCost > 0 ? Math.round(((p.revenue - p.printCost * p.orders) / p.revenue) * 100) : null,
        }))

      const topCollections = Object.values(byCollection)
        .sort((a, b) => b.revenue - a.revenue)

      // Monthly trend: last 6 months
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months.push({ month: key, ...(byMonth[key] || { revenue: 0, orders: 0 }) })
      }

      return res.status(200).json({
        totalRevenue,
        totalOrders,
        aov:            totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        topProducts,
        topCollections,
        monthlyTrend:  months,
      })
    }

    // ── generate-seo ─────────────────────────────────────────────────────────
    if (action === 'generate-seo') {
      const { productId, productName, productType, collection, description, tags } = data
      const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim()
      if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

      const systemPrompt = `You are an Etsy SEO expert for JAYL, a premium print-on-demand art & lifestyle brand.
Your goal is to maximise organic search traffic on Etsy by crafting highly optimised titles, descriptions, and tags.
Rules:
- Etsy title: max 140 characters, start with the most searched keyword, include artistic style and product type.
- Etsy description: conversational, keyword-rich first paragraph, include materials/dimensions/use, 200-400 chars.
- Etsy tags: exactly 13 tags, each max 20 characters, no repeating words across tags, highly specific long-tail phrases.
- SEO title: max 60 characters, for web/Google.
- SEO description: max 160 characters, compelling meta description for web.
Always respond with valid JSON only, no markdown.`

      const userPrompt = `Generate complete Etsy + web SEO for this product:
- Name: "${productName}"
- Type: ${productType || 'art print'}
- Collection: ${collection || 'General'}
- Current description: ${description || 'N/A'}
- Current tags: ${(tags || []).join(', ') || 'N/A'}

Return JSON with these exact keys:
{
  "etsyTitle": "...",
  "etsyDescription": "...",
  "etsyTags": ["tag1","tag2",...],
  "seoTitle": "...",
  "seoDescription": "...",
  "altText": "..."
}`

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      const anthropicData = await anthropicRes.json()
      if (!anthropicRes.ok) return res.status(500).json({ error: anthropicData.error?.message || 'Claude API error' })
      const raw = anthropicData.content?.[0]?.text || '{}'
      let seo
      try { seo = JSON.parse(raw) }
      catch { const m = raw.match(/\{[\s\S]*\}/); seo = m ? JSON.parse(m[0]) : {} }
      return res.status(200).json({ seo })
    }

    // ── upload-reference ──────────────────────────────────────────────────────
    if (action === 'upload-reference') {
      const { filename, dataUrl } = data
      if (!filename || !dataUrl) return res.status(400).json({ error: 'filename + dataUrl required' })

      const safeFilename = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '').replace(/\s+/g, '-').slice(0, 80)
      const base64       = dataUrl.replace(/^data:[^;]+;base64,/, '')
      const blobToken    = process.env.BLOB_READ_WRITE_TOKEN

      if (blobToken) {
        // Try Vercel Blob — falls through to GitHub if the store is private (access: 'public' fails)
        try {
          const contentType = dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/jpeg'
          const buffer      = Buffer.from(base64, 'base64')
          const { url } = await put(`references/${Date.now()}-${safeFilename}`, buffer, {
            access: 'public', token: blobToken, contentType,
          })
          return res.status(200).json({ ok: true, url, name: safeFilename })
        } catch (blobErr) {
          // Private Blob store or any other Blob error → fall through to GitHub
          console.warn('[upload-reference] Vercel Blob failed, using GitHub fallback:', blobErr.message)
        }
      }

      // Fallback: commit to GitHub under public/images/_refs/
      const filePath = `public/images/_refs/${safeFilename}`
      let existingSha = null
      try { const e = await ghGet(filePath, githubToken); existingSha = e.sha } catch {}
      const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ message: `refs: upload ${safeFilename}`, content: base64, branch: GITHUB_BRANCH, ...(existingSha ? { sha: existingSha } : {}) }),
      })
      if (!ghRes.ok) throw new Error(`GitHub upload failed: ${ghRes.status}`)
      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`
      return res.status(200).json({ ok: true, url: rawUrl, name: safeFilename })
    }

    // ── list-queue ────────────────────────────────────────────────────────────
    if (action === 'list-queue') {
      const { items } = await readQueue(githubToken)
      return res.status(200).json({ items })
    }

    // ── save-queue-item ───────────────────────────────────────────────────────
    if (action === 'save-queue-item') {
      const { item } = data
      if (!item?.platform || !item?.scheduledAt) return res.status(400).json({ error: 'item.platform + item.scheduledAt required' })
      const { items, sha } = await readQueue(githubToken)
      const idx = items.findIndex(i => i.id === item.id)
      const now = new Date().toISOString()
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...item, updatedAt: now }
      } else {
        items.push({ ...item, id: `queue-${Date.now()}`, status: 'pending', createdAt: now })
      }
      await writeQueue(items, sha, `[queue] Save item for ${item.platform}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── delete-queue-item ─────────────────────────────────────────────────────
    if (action === 'delete-queue-item') {
      const { itemId } = data
      const { items, sha } = await readQueue(githubToken)
      const filtered = items.filter(i => i.id !== itemId)
      await writeQueue(filtered, sha, `[queue] Delete item ${itemId}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    // ── publish-queue-item ────────────────────────────────────────────────────
    if (action === 'publish-queue-item') {
      const { itemId } = data
      const { items, sha } = await readQueue(githubToken)
      const item = items.find(i => i.id === itemId)
      if (!item) return res.status(404).json({ error: 'Queue item not found' })

      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      const result = await fetch(`${baseUrl}/api/publish-social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD, platform: item.platform,
          imageUrl: item.imageUrl, videoUrl: item.videoUrl,
          caption: item.caption, hashtags: item.hashtags,
          altText: item.altText, title: item.title,
          description: item.description, link: item.link,
        }),
      }).then(r => r.json())

      const idx = items.findIndex(i => i.id === itemId)
      items[idx] = {
        ...item,
        status:      result.ok ? 'published' : 'failed',
        publishedAt: result.ok ? new Date().toISOString() : null,
        error:       result.ok ? null : (result.error || 'Unknown error'),
      }
      await writeQueue(items, sha, `[queue] Publish item ${itemId}`, githubToken)
      return res.status(200).json(result)
    }

    // ── list-assets ───────────────────────────────────────────────────────────
    if (action === 'list-assets') {
      const { productId } = data
      const { assets } = await readAssets(githubToken)
      const filtered = productId ? assets.filter(a => a.productId === productId) : assets
      return res.status(200).json({ assets: filtered })
    }

    // ── save-asset ────────────────────────────────────────────────────────────
    if (action === 'save-asset') {
      const { assetUrl, productId, type = 'image', platform = '', caption = '', hashtags = '' } = data
      if (!assetUrl || !productId) return res.status(400).json({ error: 'assetUrl + productId required' })

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN
      let finalUrl = assetUrl

      if (blobToken) {
        // Fetch and re-upload to Vercel Blob for permanent storage
        const assetRes = await fetch(assetUrl)
        if (!assetRes.ok) throw new Error(`Cannot fetch asset: ${assetRes.status}`)
        const buffer      = Buffer.from(await assetRes.arrayBuffer())
        const contentType = assetRes.headers.get('content-type') || (type === 'video' ? 'video/mp4' : 'image/jpeg')
        const ext         = type === 'video' ? 'mp4' : contentType.includes('png') ? 'png' : 'jpg'
        const filename    = `assets/${productId}/${Date.now()}.${ext}`
        const { url } = await put(filename, buffer, { access: 'public', token: blobToken, contentType })
        finalUrl = url
      }

      const { assets, sha } = await readAssets(githubToken)
      const asset = {
        id:        `asset-${Date.now()}`,
        productId,
        type,
        platform,
        blobUrl:   finalUrl,
        caption,
        hashtags,
        createdAt: new Date().toISOString(),
      }
      assets.unshift(asset)
      await writeAssets(assets, sha, `[assets] Save ${type} for ${productId}`, githubToken)
      return res.status(200).json({ ok: true, asset })
    }

    // ── delete-asset ──────────────────────────────────────────────────────────
    if (action === 'delete-asset') {
      const { assetId } = data
      const { assets, sha } = await readAssets(githubToken)
      const target = assets.find(a => a.id === assetId)
      if (!target) return res.status(404).json({ error: 'Asset not found' })

      // Delete from Vercel Blob if it was stored there
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN
      if (blobToken && target.blobUrl?.includes('blob.vercel-storage.com')) {
        await blobDel(target.blobUrl, { token: blobToken }).catch(() => {})
      }

      const filtered = assets.filter(a => a.id !== assetId)
      await writeAssets(filtered, sha, `[assets] Delete asset ${assetId}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })

  } catch (err) {
    console.error('[admin]', action, err.message)
    return res.status(500).json({ error: err.message })
  }
}
