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

      // Build a variantId → options lookup from productVariantOptions if available
      // Gelato ecommerce API: productVariantOptions = [{ id, name, values: [{ id, label }] }]
      // and each variant may have optionValueIds: [id, id]
      const variantOptionsList = rawBody.productVariantOptions ?? []

      // Normalize variants
      const rawVariants = rawBody.variants ?? rawBody.productVariants ?? body?.variants ?? []
      const variants = rawVariants.map(v => {
        // Try embedded options first
        const opts = v.options ?? v.variantOptions ?? []
        const get  = name => opts.find(o => o.name?.toLowerCase() === name.toLowerCase())?.value ?? null

        let color = get('color')
        let size  = get('size')

        // Fallback: resolve from productVariantOptions using optionValueIds
        if ((!color || !size) && variantOptionsList.length > 0 && v.optionValueIds?.length > 0) {
          for (const opt of variantOptionsList) {
            const matched = opt.values?.find(val => v.optionValueIds.includes(val.id))
            if (matched) {
              const nameLower = opt.name?.toLowerCase() ?? ''
              if (nameLower === 'color' || nameLower === 'colour') color = color ?? matched.label ?? matched.title ?? null
              if (nameLower === 'size')  size  = size  ?? matched.label ?? matched.title ?? null
            }
          }
        }

        // Fallback: parse from variant title like "Black / M" or "Black - Large"
        if (!color && v.title) {
          const parts = v.title.split(/\s*[\/\-]\s*/)
          if (parts.length >= 2) {
            // Heuristic: sizes tend to be short (S, M, L, XL, XXL, etc.)
            const sizeKeywords = /^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|one.size|\d+)$/i
            const last = parts[parts.length - 1].trim()
            const first = parts[0].trim()
            if (sizeKeywords.test(last)) {
              color = color ?? first
              size  = size  ?? last
            } else {
              color = color ?? first
            }
          }
        }

        return {
          uid:             v.id ?? null,
          gelatoVariantId: v.productUid ?? null,
          color,
          size,
          price:           v.price != null ? (v.price / 100) : null,
          currency:        v.currency ?? rawBody.currency ?? null,
        }
      })

      // ── Collect images from every possible location ────────────────────────
      const hdrs    = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
      const seenSrcs = new Set()
      const images   = []

      const push = (src, variantIds = []) => {
        if (!src || seenSrcs.has(src)) return
        seenSrcs.add(src)
        images.push({ src, position: images.length, variantIds })
      }

      // 1. Top-level images / productImages array (with variantIds)
      for (const img of (rawBody.images ?? rawBody.productImages ?? rawBody.media ?? [])) {
        const src = img.fileUrl ?? img.src ?? img.url ?? img.imageSrc ?? null
        push(src, img.productVariantIds ?? img.variantIds ?? img.variant_ids ?? [])
      }

      // 2. Per-variant preview / mockup URLs
      for (const v of rawVariants) {
        const src = v.previewUrl ?? v.mockupUrl ?? v.imageSrc
              ?? v.thumbnailUrl ?? v.coverImageUrl ?? null
        push(src, [v.id].filter(Boolean))
      }

      // 3. Top-level cover / preview URL
      push(rawBody.previewUrl ?? rawBody.mockupUrl
           ?? rawBody.coverImageUrl ?? rawBody.coverUrl ?? null)

      // 4. Dedicated /images sub-endpoint (if product-level images are empty)
      if (images.length <= 1) {
        try {
          const imgsUrl = `${GELATO_ECOMMERCE_URL}/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/images`
          const imgsRes = await fetch(imgsUrl, { headers: hdrs })
          if (imgsRes.ok) {
            const imgsBody = await imgsRes.json().catch(() => null)
            const list = imgsBody?.images ?? imgsBody?.productImages
                      ?? (Array.isArray(imgsBody) ? imgsBody : [])
            for (const img of list) {
              const src = img.fileUrl ?? img.src ?? img.url ?? img.imageSrc ?? null
              push(src, img.productVariantIds ?? img.variantIds ?? img.variant_ids ?? [])
            }
          }
        } catch (e) {
          console.warn('[get-product-variants] /images sub-endpoint failed:', e.message)
        }
      }

      // 5. Individual variant detail pages (last resort — may expose previewUrl)
      if (images.length <= 1 && rawVariants.length > 0) {
        // Only fetch a few to avoid timeout; de-dupe by color
        const seen = new Set()
        for (const v of rawVariants.slice(0, 20)) {
          const opts  = v.options ?? v.variantOptions ?? []
          const color = opts.find(o => o.name?.toLowerCase() === 'color')?.value ?? null
          const key   = color ?? v.id
          if (seen.has(key)) continue
          seen.add(key)
          try {
            const vUrl = `${GELATO_ECOMMERCE_URL}/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(v.id)}`
            const vRes = await fetch(vUrl, { headers: hdrs })
            if (vRes.ok) {
              const vBody = await vRes.json().catch(() => null)
              const vRaw  = vBody?.variant ?? vBody ?? {}
              const src   = vRaw.previewUrl ?? vRaw.mockupUrl ?? vRaw.imageSrc
                         ?? vRaw.thumbnailUrl ?? vRaw.coverImageUrl ?? null
              push(src, [v.id].filter(Boolean))
            }
          } catch {}
        }
      }

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
        firstVariantTitle: firstVariant.title ?? null,
        firstVariantPreviewFields: {
          previewUrl:    firstVariant.previewUrl   ?? null,
          mockupUrl:     firstVariant.mockupUrl    ?? null,
          imageSrc:      firstVariant.imageSrc     ?? null,
          thumbnailUrl:  firstVariant.thumbnailUrl ?? null,
        },
        firstImageEntry:       Object.keys(firstImgEntry),
        firstImageFileUrl:     firstImgEntry.fileUrl ?? firstImgEntry.src ?? firstImgEntry.url ?? null,
        firstImageVariantIds:  firstImgEntry.productVariantIds ?? firstImgEntry.variantIds ?? [],
        productVariantOptions: variantOptionsList.map(o => ({ name: o.name, valueCount: o.values?.length })),
        sampleVariantResolved: variants[0] ?? null,
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
