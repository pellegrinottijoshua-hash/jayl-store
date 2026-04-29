// Origin allow-list for the JAYL API. Locks CORS down to our own domains
// so /api/* can't be called cross-origin from arbitrary sites.

function getAllowedOrigins() {
  const list = new Set()
  if (process.env.SITE_URL)   list.add(process.env.SITE_URL)
  if (process.env.VERCEL_URL) list.add(`https://${process.env.VERCEL_URL}`)
  list.add('https://jayl.store')
  list.add('https://www.jayl.store')
  // Local dev
  if (process.env.NODE_ENV !== 'production') {
    list.add('http://localhost:3000')
    list.add('http://127.0.0.1:3000')
  }
  return list
}

const ALLOWED = getAllowedOrigins()

function isAllowed(origin) {
  if (!origin) return false
  if (ALLOWED.has(origin)) return true
  // Allow Vercel preview deployments for the same project
  try {
    const host = new URL(origin).hostname
    return host.endsWith('.vercel.app')
  } catch {
    return false
  }
}

/** Apply CORS headers. Returns true if the origin is allowed (or no origin — same-origin requests). */
export function applyCors(req, res) {
  const origin = req.headers.origin
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (!origin) return true  // same-origin request — no CORS header needed
  if (isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    return true
  }
  return false
}
