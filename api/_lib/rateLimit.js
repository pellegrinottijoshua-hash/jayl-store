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
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  if (entry.count > max) return true  // blocked

  return false
}

// Periodically prune expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of store) {
    if (now > entry.resetAt) store.delete(ip)
  }
}, 5 * 60_000) // every 5 minutes
