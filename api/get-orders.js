import { applyCors } from './_lib/cors.js'

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey  = process.env.GELATO_API_KEY
  const storeId = process.env.GELATO_STORE_ID

  if (!apiKey)  return res.status(500).json({ error: 'GELATO_API_KEY not configured' })
  if (!storeId) return res.status(500).json({ error: 'GELATO_STORE_ID not configured' })

  const page  = parseInt(req.query.page  || '1',  10)
  const limit = parseInt(req.query.limit || '20', 10)
  const offset = (page - 1) * limit

  try {
    const gelatoRes = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/orders?offset=${offset}&limit=${limit}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!gelatoRes.ok) {
      const err = await gelatoRes.json().catch(() => ({}))
      throw new Error(`Gelato API ${gelatoRes.status}: ${err.message || gelatoRes.statusText}`)
    }

    const data = await gelatoRes.json()

    // Gelato returns { orders: [...], total: N } or similar
    const orders  = data.orders  || data.data || []
    const total   = data.total   || data.totalCount || orders.length
    const hasMore = offset + orders.length < total

    return res.status(200).json({ orders, total, hasMore, page })
  } catch (err) {
    console.error('[get-orders]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
