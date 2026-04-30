import { applyCors } from './_lib/cors.js'

const GELATO_CATALOG_URL   = 'https://product.gelatoapis.com/v3/products'
const GELATO_ECOMMERCE_URL = 'https://ecommerce.gelatoapis.com/v1/stores'

// UUID v4 pattern — identifies a Gelato *store* product (ecommerce API)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  // CORS — this is a GET-only endpoint
  const origin = req.headers.origin
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (origin) {
    const allowed = applyCors(req, res)
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  }
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  // Sanitize: strip invisible/non-ASCII chars that sneak in via copy-paste
  const rawId    = typeof req.query.productId === 'string' ? req.query.productId : ''
  const productId = rawId.replace(/[^\x20-\x7E]/g, '').trim()
  if (!productId || !/^[a-zA-Z0-9_.:-]+$/.test(productId)) {
    return res.status(400).json({ error: 'Missing or invalid productId' })
  }

  const apiKey = (process.env.GELATO_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()
  if (!apiKey) return res.status(500).json({ error: 'GELATO_API_KEY not configured' })

  try {
    // ── UUID → Gelato ecommerce store product ─────────────────────────────────
    if (UUID_RE.test(productId)) {
      const storeId = (process.env.GELATO_STORE_ID || '').replace(/[^\x20-\x7E]/g, '').trim()
      if (!storeId) {
        return res.status(500).json({
          error: 'GELATO_STORE_ID is not configured. Add it to your Vercel environment variables.',
        })
      }

      const url = `${GELATO_ECOMMERCE_URL}/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}`
      const gelatoRes = await fetch(url, {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      })
      const body = await gelatoRes.json().catch(() => null)

      if (!gelatoRes.ok) {
        console.error('[get-product-variants] ecommerce error', gelatoRes.status, body)
        return res.status(gelatoRes.status).json({
          error: body?.message || `Gelato ecommerce API error ${gelatoRes.status}`,
        })
      }

      // Gelato can wrap the product under a "product" key or return it directly.
      // Try all known wrapper shapes.
      const rawBody = body?.product ?? body?.data ?? body ?? {}

      // Normalize variants
      const rawVariants = rawBody.variants ?? rawBody.productVariants ?? body?.variants ?? []
      const variants = rawVariants.map(v => {
        const opts = v.options ?? v.variantOptions ?? []
        const get  = name => opts.find(o => o.name?.toLowerCase() === name.toLowerCase())?.value ?? null
        return {
          uid:             v.id ?? null,
          gelatoVariantId: v.productUid ?? null,
          color:           get('color'),
          size:            get('size'),
          price:           v.price != null ? (v.price / 100) : null,
          currency:        v.currency ?? rawBody.currency ?? null,
        }
      })

      // ── Collect images from every possible location ────────────────────────
      const seenSrcs = new Set()
      const images   = []

      const push = (src, variantIds = []) => {
        if (!src || seenSrcs.has(src)) return
        seenSrcs.add(src)
        images.push({ src, position: images.length, variantIds })
      }

      // 1. Top-level images array (most structured — includes variantIds)
      for (const img of (rawBody.images ?? rawBody.productImages ?? rawBody.media ?? [])) {
        const src = img.src ?? img.url ?? img.imageSrc ?? null
        push(src, img.variantIds ?? img.variant_ids ?? [])
      }

      // 2. Per-variant preview / mockup URLs (common fallback)
      for (const v of rawVariants) {
        const src = v.previewUrl ?? v.mockupUrl ?? v.imageSrc ?? v.thumbnailUrl ?? null
        push(src, [v.id].filter(Boolean))
      }

      // 3. Top-level single preview URL
      push(rawBody.previewUrl ?? rawBody.mockupUrl ?? null)

      const title = rawBody.title ?? rawBody.name ?? body?.title ?? ''

      // ── Debug info (always returned so admin UI can diagnose issues) ────────
      const firstVariant  = rawVariants[0] ?? {}
      const firstImgEntry = (rawBody.images ?? rawBody.productImages ?? rawBody.media ?? [])[0] ?? {}
      const debug = {
        topLevelKeys:      Object.keys(body ?? {}),
        rawBodyKeys:       Object.keys(rawBody),
        variantCount:      rawVariants.length,
        imagesFound:       images.length,
        firstVariantKeys:  Object.keys(firstVariant),
        firstVariantPreviewFields: {
          previewUrl:    firstVariant.previewUrl   ?? null,
          mockupUrl:     firstVariant.mockupUrl    ?? null,
          imageSrc:      firstVariant.imageSrc     ?? null,
          thumbnailUrl:  firstVariant.thumbnailUrl ?? null,
        },
        firstImageEntry:   Object.keys(firstImgEntry),
      }
      console.log('[get-product-variants] debug:', JSON.stringify(debug))

      return res.status(200).json({
        productId,
        source: 'ecommerce',
        title,
        variants,
        images,
        _debug: debug,
      })
    }

    // ── Non-UUID → Gelato catalog product ────────────────────────────────────
    const gelatoRes = await fetch(`${GELATO_CATALOG_URL}/${encodeURIComponent(productId)}`, {
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    })
    const body = await gelatoRes.json().catch(() => null)

    if (!gelatoRes.ok) {
      console.error('[get-product-variants] catalog error', gelatoRes.status, body)
      return res.status(gelatoRes.status).json({
        error: body?.message || `Gelato catalog API error ${gelatoRes.status}`,
      })
    }

    const rawVariants = body?.variants ?? body?.productVariants ?? []
    const variants = rawVariants.map(v => ({
      uid:      v.id ?? v.uid ?? v.productUid ?? null,
      size:     v.attributes?.find(a => a.name?.toLowerCase() === 'size')?.value ?? v.size ?? null,
      color:    v.attributes?.find(a => a.name?.toLowerCase() === 'color')?.value ?? v.color ?? null,
      price:    v.price ?? v.retailPrice ?? null,
      currency: v.currency ?? body?.currency ?? null,
    }))

    return res.status(200).json({ productId, source: 'catalog', variants })

  } catch (err) {
    console.error('[get-product-variants]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
