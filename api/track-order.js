import { applyCors } from './_lib/cors.js'

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { orderId } = req.query
  if (!orderId?.trim()) return res.status(400).json({ error: 'orderId required' })

  const apiKey  = process.env.GELATO_API_KEY
  const storeId = process.env.GELATO_STORE_ID

  if (!apiKey)  return res.status(500).json({ error: 'GELATO_API_KEY not configured' })
  if (!storeId) return res.status(500).json({ error: 'GELATO_STORE_ID not configured' })

  try {
    const gelatoRes = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/orders/${encodeURIComponent(orderId.trim())}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    if (gelatoRes.status === 404) {
      return res.status(404).json({ error: 'Order not found. Check your order ID and try again.' })
    }

    if (!gelatoRes.ok) {
      const err = await gelatoRes.json().catch(() => ({}))
      throw new Error(`Gelato API ${gelatoRes.status}: ${err.message || gelatoRes.statusText}`)
    }

    const order = await gelatoRes.json()
    return res.status(200).json({ order })
  } catch (err) {
    console.error('[track-order]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
