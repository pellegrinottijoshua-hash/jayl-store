import { applyCors } from './_lib/cors.js'
import { applyDiscount } from './_lib/catalog.js'

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, subtotal } = req.body || {}
  if (!code?.trim()) return res.status(400).json({ error: 'code required' })
  if (!subtotal || subtotal < 1) return res.status(400).json({ error: 'subtotal required' })

  const result = applyDiscount(Number(subtotal), code)
  if (!result.ok) return res.status(400).json({ error: result.error })

  return res.status(200).json({
    valid:          true,
    code:           String(code).trim().toUpperCase(),
    discountAmount: result.amount,
    discountLabel:  result.label,
  })
}
