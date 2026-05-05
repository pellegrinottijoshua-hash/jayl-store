/**
 * Lightweight in-memory rate limiter for Vercel serverless functions.
 * Best-effort: resets per cold start, not shared across instances.
 * For production scale, replace with Upstash Redis or Vercel KV.
 *
 * Usage:
 *   import { rateLimit } from './_lib/rateLimit.js'
 *   const limited = rateLimit(req, { max: 20, windowMs: 60_000 })
 *   if (limited) return res.status(429).json({ error: 'Too many requests' })
 */

const store = new Map() // ip → { count, resetAt }
let callCount = 0

/**
 * @param {Request} req - Node/Vercel request object
 * @param {{ max?: number, windowMs?: number }} opts
 * @returns {boolean} true if the request should be blocked
 */
export function rateLimit(req, { max = 30, windowMs = 60_000 } = {}) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const now = Date.now()

  // Inline pruning every 50 calls — no setInterval (unsafe in serverless)
  if (++callCount % 50 === 0) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k)
    }
  }

  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  if (entry.count > max) return true  // blocked

  return false
}
