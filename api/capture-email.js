import { applyCors } from './_lib/cors.js'

const GITHUB_OWNER  = 'pellegrinottijoshua-hash'
const GITHUB_REPO   = 'jayl-store'
const GITHUB_BRANCH = 'main'
const EMAILS_PATH   = 'src/data/emails.json'

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

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body || {}
  if (!email?.trim()) return res.status(400).json({ error: 'email required' })

  // Basic validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) return res.status(400).json({ error: 'Invalid email' })

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    // No token — accept silently
    return res.status(200).json({ ok: true })
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
