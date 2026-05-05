import { applyCors } from './_lib/cors.js'

const GITHUB_OWNER  = 'pellegrinottijoshua-hash'
const GITHUB_REPO   = 'jayl-store'
const GITHUB_BRANCH = 'main'
const REVIEWS_PATH  = 'src/data/reviews.json'

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

async function readReviews(token) {
  try {
    const file    = await ghGet(REVIEWS_PATH, token)
    const raw     = Buffer.from(file.content, 'base64').toString('utf-8')
    return { reviews: JSON.parse(raw), sha: file.sha }
  } catch {
    return { reviews: [], sha: null }
  }
}

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  // GET /api/reviews?productId=xxx — return approved reviews for a product
  if (req.method === 'GET') {
    const { productId } = req.query
    if (!productId) return res.status(400).json({ error: 'productId required' })

    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return res.status(200).json({ reviews: [] })

    const { reviews } = await readReviews(githubToken)
    const approved = reviews.filter(r => r.productId === productId && r.status === 'approved')
    return res.status(200).json({ reviews: approved })
  }

  // POST /api/reviews — submit a new review (goes to pending, requires moderation)
  if (req.method === 'POST') {
    const { productId, author, rating, body } = req.body || {}
    if (!productId)                     return res.status(400).json({ error: 'productId required' })
    if (!author?.trim())                return res.status(400).json({ error: 'author required' })
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' })
    if (!body?.trim())                  return res.status(400).json({ error: 'review text required' })

    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return res.status(200).json({ ok: true })

    try {
      const { reviews, sha } = await readReviews(githubToken)

      const review = {
        id:        `r${Date.now()}`,
        productId,
        author:    author.trim().slice(0, 80),
        rating:    Number(rating),
        body:      body.trim().slice(0, 1000),
        status:    'pending',
        createdAt: new Date().toISOString(),
      }

      reviews.push(review)

      await ghPut(
        REVIEWS_PATH,
        JSON.stringify(reviews, null, 2) + '\n',
        sha,
        `review: new pending review for ${productId}`,
        githubToken
      )

      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[reviews POST]', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
