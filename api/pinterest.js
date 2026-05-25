import { applyCors } from './_lib/cors.js'

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  const action = req.query.action

  if (action === 'boards')      return handleBoards(req, res)
  if (action === 'create-pin')  return handleCreatePin(req, res)
  return res.status(400).json({ error: 'Unknown action. Use ?action=boards or ?action=create-pin' })
}

async function handleBoards(req, res) {
  const token = (process.env.PINTEREST_ACCESS_TOKEN || '').trim()
  if (!token) return res.status(500).json({ error: 'PINTEREST_ACCESS_TOKEN not configured' })

  const r = await fetch('https://api.pinterest.com/v5/boards?page_size=25', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    return res.status(r.status).json({ error: `Pinterest API ${r.status}: ${text}` })
  }
  const data = await r.json()
  return res.status(200).json({ boards: data.items || [] })
}

async function handleCreatePin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = (process.env.PINTEREST_ACCESS_TOKEN || '').trim()
  if (!token) return res.status(500).json({ error: 'PINTEREST_ACCESS_TOKEN not configured — see JAYL dev guide' })

  const { boardId, title, description, imageUrl, link, altText } = req.body || {}
  if (!boardId)  return res.status(400).json({ error: 'boardId is required' })
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' })

  const payload = {
    board_id:     boardId,
    title:        title || '',
    description:  description || '',
    media_source: { source_type: 'image_url', url: imageUrl },
    ...(link     ? { link }                            : {}),
    ...(altText  ? { alt_text: String(altText).slice(0, 500) } : {}),
  }

  const r = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body:   JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })

  if (!r.ok) {
    const text = await r.text().catch(() => '')
    console.error('[pinterest] create-pin failed:', r.status, text)
    return res.status(r.status).json({ error: `Pinterest API ${r.status}: ${text}` })
  }

  const pin = await r.json()
  console.log('[pinterest] pin created:', pin.id)
  return res.status(200).json({
    id:  pin.id,
    url: `https://pinterest.com/pin/${pin.id}`,
  })
}
