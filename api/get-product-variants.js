import { applyCors } from './_lib/cors.js'

const GELATO_PRODUCTS_URL = 'https://product.gelatoapis.com/v3/products'

export default async function handler(req, res) {
  // Apply CORS — override the Allow-Methods header for this GET-only endpoint.
  const origin = req.headers.origin
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (origin) {
    // Re-use the same origin check from applyCors by calling it, then
    // overwriting the methods header it set.
    const allowed = applyCors(req, res)
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Strip any non-printable / non-ASCII characters that can sneak in via copy-paste
  // (e.g. U+2028 LINE SEPARATOR, U+FEFF BOM, smart quotes, etc.)
  const rawId = typeof req.query.productId === 'string' ? req.query.productId : ''
  const productId = rawId.replace(/[^\x20-\x7E]/g, '').trim()

  if (!productId || !/^[a-zA-Z0-9_.:-]+$/.test(productId)) {
    return res.status(400).json({ error: 'Missing or invalid productId — only ASCII alphanumerics, hyphens, underscores, dots and colons are allowed' })
  }

  // Sanitize the API key as well (guards against env vars saved with a trailing newline)
  const apiKey = (process.env.GELATO_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()
  if (!apiKey) {
    console.error('[get-product-variants] GELATO_API_KEY is not set')
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  try {
    const gelatoRes = await fetch(`${GELATO_PRODUCTS_URL}/${encodeURIComponent(productId)}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    })

    const body = await gelatoRes.json().catch(() => null)

    if (!gelatoRes.ok) {
      console.error('[get-product-variants] Gelato error', gelatoRes.status, body)
      return res.status(gelatoRes.status).json({
        error: body?.message || 'Failed to fetch product from Gelato',
      })
    }

    // Normalise the variants array into a clean, frontend-friendly shape.
    const rawVariants = body?.variants ?? body?.productVariants ?? []

    const variants = rawVariants.map((v) => ({
      uid:   v.id ?? v.uid ?? v.productUid ?? null,
      size:  v.attributes?.find((a) => a.name?.toLowerCase() === 'size')?.value
          ?? v.size
          ?? null,
      color: v.attributes?.find((a) => a.name?.toLowerCase() === 'color')?.value
          ?? v.color
          ?? null,
      price: v.price ?? v.retailPrice ?? null,
      currency: v.currency ?? body?.currency ?? null,
    }))

    return res.status(200).json({ productId, variants })
  } catch (err) {
    console.error('[get-product-variants]', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
