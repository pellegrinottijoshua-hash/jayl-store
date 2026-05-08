/**
 * POST /api/publish-pinterest
 * Crea un Pin su Pinterest via Pinterest API v5.
 *
 * Env vars richieste:
 *   PINTEREST_ACCESS_TOKEN — OAuth2 access token (scope: pins:write, boards:read)
 *   PINTEREST_BOARD_ID     — ID della board su cui pubblicare
 *
 * Body: { imageUrl?, videoUrl?, title, description, link?, altText?, password }
 * Response: { ok, pinId } | { ok: false, needsConnect, message }
 */

import { applyCors } from './_lib/cors.js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const {
    password, imageUrl, videoUrl,
    title = '', description = '', link, altText = '',
    caption, hashtags,
  } = req.body || {}
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })

  const token   = process.env.PINTEREST_ACCESS_TOKEN
  const boardId = process.env.PINTEREST_BOARD_ID

  if (!token || !boardId) {
    return res.status(200).json({
      ok:           false,
      needsConnect: true,
      platform:     'pinterest',
      message:      'Pinterest non connesso. Aggiungi PINTEREST_ACCESS_TOKEN e PINTEREST_BOARD_ID nelle env vars di Vercel.',
      instructions: [
        '1. Vai su developers.pinterest.com → crea un app',
        '2. Richiedi scope: pins:write, boards:read',
        '3. Esegui il flusso OAuth per ottenere access_token',
        '4. Trova il tuo Board ID: GET /v5/boards nella sandbox',
        '5. Aggiungi le env vars su Vercel: PINTEREST_ACCESS_TOKEN e PINTEREST_BOARD_ID',
      ],
    })
  }

  const pinTitle = title || caption?.slice(0, 100) || 'JAYL Product'
  const pinDesc  = description || [caption, hashtags].filter(Boolean).join('\n\n') || ''
  const mediaUrl = imageUrl || videoUrl

  if (!mediaUrl) {
    return res.status(400).json({ ok: false, error: 'imageUrl o videoUrl richiesto' })
  }

  try {
    const isVideo = !!videoUrl && !imageUrl

    const pinBody = {
      board_id:    boardId,
      title:       pinTitle.slice(0, 100),
      description: pinDesc.slice(0, 800),
      link:        link || 'https://jayl.store',
      media_source: isVideo
        ? { source_type: 'video_url', url: mediaUrl }
        : {
            source_type:         'image_url',
            url:                 mediaUrl,
            is_standard:         true,
          },
      alt_text:    altText.slice(0, 500) || pinTitle,
    }

    const createRes = await fetch('https://api.pinterest.com/v5/pins', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(pinBody),
    })

    const data = await createRes.json()

    if (!createRes.ok) {
      throw new Error(data.message || `Pinterest API error: ${createRes.status}`)
    }

    return res.json({ ok: true, platform: 'pinterest', pinId: data.id, pinUrl: `https://pinterest.com/pin/${data.id}` })

  } catch (e) {
    console.error('[publish-pinterest]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
