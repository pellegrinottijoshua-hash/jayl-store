import { applyCors } from './_lib/cors.js'
import { rateLimit } from './_lib/rateLimit.js'

const GITHUB_OWNER   = 'pellegrinottijoshua-hash'
const GITHUB_REPO    = 'jayl-store'
const GITHUB_BRANCH  = 'main'
const EMAILS_PATH    = 'src/data/emails.json'
const CARTS_PATH     = 'src/data/abandoned-carts.json'

async function ghGet(path, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`)
  return res.json()
}

async function ghPut(path, content, sha, message, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${JSON.stringify(err.message || err)}`)
  }
  return res.json()
}

// ── Abandoned cart helpers ────────────────────────────────────────────────────

async function readCarts(token) {
  try {
    const file = await ghGet(CARTS_PATH, token)
    return { carts: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')), sha: file.sha }
  } catch {
    return { carts: [], sha: null }
  }
}

async function writeCarts(carts, sha, message, token) {
  await ghPut(CARTS_PATH, JSON.stringify(carts, null, 2) + '\n', sha, message, token)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, action } = req.body || {}

  if (rateLimit(req, { max: 20, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  // ── Cart capture ──────────────────────────────────────────────────────────
  if (action === 'cart') {
    const { cartItems } = req.body || {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email?.trim() || !emailRegex.test(email.trim())) {
      return res.status(400).json({ ok: false })
    }
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return res.status(200).json({ ok: true }) // silently skip
    try {
      const { carts, sha } = await readCarts(githubToken)
      const normalised = email.trim().toLowerCase()
      // Upsert: update existing entry for this email or create new
      const idx = carts.findIndex(c => c.email === normalised)
      const entry = {
        id: idx >= 0 ? carts[idx].id : `cart_${Date.now()}`,
        email:       normalised,
        cartItems:   cartItems || [],
        capturedAt:  new Date().toISOString(),
        sent:        false,
        converted:   false,
      }
      if (idx >= 0) carts[idx] = entry; else carts.push(entry)
      // Keep only last 500 entries, newest first
      carts.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
      carts.splice(500)
      await writeCarts(carts, sha, `[cart] capture ${normalised}`, githubToken)
    } catch (e) {
      console.warn('[capture-email] cart capture error:', e.message)
    }
    return res.status(200).json({ ok: true })
  }

  // ── Mark cart converted ───────────────────────────────────────────────────
  if (action === 'cart-converted') {
    const githubToken = process.env.GITHUB_TOKEN
    if (email?.trim() && githubToken) {
      try {
        const normalised = email.trim().toLowerCase()
        const { carts, sha } = await readCarts(githubToken)
        const idx = carts.findIndex(c => c.email === normalised)
        if (idx >= 0 && !carts[idx].converted) {
          carts[idx].converted = true
          await writeCarts(carts, sha, `[cart] converted ${normalised}`, githubToken)
        }
      } catch (e) {
        console.warn('[capture-email] cart-converted error:', e.message)
      }
    }
    return res.status(200).json({ ok: true })
  }

  // ── Newsletter capture (original behaviour) ───────────────────────────────
  if (!email?.trim()) return res.status(400).json({ error: 'email required' })

  // Basic validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) return res.status(400).json({ error: 'Invalid email' })

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    console.error('[capture-email] GITHUB_TOKEN not configured — email not stored')
    return res.status(503).json({ error: 'Email capture not available. Please try again later.' })
  }

  try {
    let emails = []; let sha = null
    try {
      const file = await ghGet(EMAILS_PATH, githubToken)
      sha = file.sha
      emails = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'))
    } catch {
      // File doesn't exist yet — create it
    }

    // Deduplicate
    const normalised = email.trim().toLowerCase()
    if (emails.find(e => e.email === normalised)) {
      return res.status(200).json({ ok: true, duplicate: true })
    }

    emails.push({ email: normalised, subscribedAt: new Date().toISOString() })

    await ghPut(
      EMAILS_PATH,
      JSON.stringify(emails, null, 2) + '\n',
      sha,
      `newsletter: new subscriber ${normalised}`,
      githubToken
    )

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[capture-email]', err.message)
    // Don't expose internal errors; silently succeed so UX isn't broken
    return res.status(200).json({ ok: true })
  }
}
