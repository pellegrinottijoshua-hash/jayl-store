/**
 * Lightweight in-memory rate limiter for Vercel serverless functions.
 * Best-effort: resets per cold start, not shared across instances.
 * For production scale, replace with Upstash Redis or Vercel KV.
 *
 * Usage:
 *   import { rateLimit } from './_lib/rateLimit.js'
 *   const limited = rateLimit(req, { max: 20, windowMs: 60_000, key: 'my-endpoint' })
 *   if (limited) return res.status(429).json({ error: 'Too many requests' })
 *
 * `key` scopes the counter to a single call site. A consolidated router file
 * (api/orders.js absorbs track-order/capture-email/validate-discount/
 * drop-status/gmf into one module, one `store`) previously shared ONE bucket
 * per IP across every one of those endpoints, keyed on IP alone: a burst
 * against the loosest-limited one (drop-status, 60/min) could exhaust the
 * shared counter and 429 an unrelated one (validate-discount, 15/min) on the
 * same IP — plausible behind one CGNAT/office egress IP. `key` defaults to
 * 'default' so a caller that omits it keeps its EXACT prior behaviour: one
 * shared bucket per IP across every rateLimit() call in that file that also
 * omits `key` (this is intentional for api/ai.js's single router-level call,
 * a deliberate combined budget across all of that file's AI actions).
 */

const store = new Map() // `${key}:${ip}` → { count, resetAt }
let callCount = 0

/**
 * @param {Request} req - Node/Vercel request object
 * @param {{ max?: number, windowMs?: number, key?: string }} opts
 * @returns {boolean} true if the request should be blocked
 */
export function rateLimit(req, { max = 30, windowMs = 60_000, key = 'default' } = {}) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const bucketKey = `${key}:${ip}`
  const now = Date.now()

  // Inline pruning every 50 calls — no setInterval (unsafe in serverless)
  if (++callCount % 50 === 0) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k)
    }
  }

  const entry = store.get(bucketKey)

  if (!entry || now > entry.resetAt) {
    store.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  if (entry.count > max) return true  // blocked

  return false
}
