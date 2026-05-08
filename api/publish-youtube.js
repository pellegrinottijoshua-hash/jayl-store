/**
 * POST /api/publish-youtube
 * Carica un video su YouTube via YouTube Data API v3.
 *
 * Env vars richieste:
 *   YOUTUBE_REFRESH_TOKEN  — OAuth2 refresh token (scope: youtube.upload)
 *   YOUTUBE_CLIENT_ID      — OAuth2 Client ID
 *   YOUTUBE_CLIENT_SECRET  — OAuth2 Client Secret
 *
 * Body: { videoUrl, title, description, hashtags?, password }
 * Response: { ok, videoId, videoUrl } | { ok: false, needsConnect, message }
 *
 * Note: videoUrl deve essere un URL pubblicamente accessibile (mp4).
 * Il server scarica il video e lo carica su YouTube tramite resumable upload.
 */

import { applyCors } from './_lib/cors.js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`)
  return data.access_token
}

export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const {
    password, videoUrl, imageUrl,
    title = 'JAYL Product Video', description = '', hashtags = '', caption,
  } = req.body || {}
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })

  const hasCredentials = process.env.YOUTUBE_REFRESH_TOKEN
    && process.env.YOUTUBE_CLIENT_ID
    && process.env.YOUTUBE_CLIENT_SECRET

  if (!hasCredentials) {
    return res.status(200).json({
      ok:           false,
      needsConnect: true,
      platform:     'youtube',
      message:      'YouTube non connesso. Aggiungi YOUTUBE_REFRESH_TOKEN, YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET nelle env vars di Vercel.',
      instructions: [
        '1. Vai su console.cloud.google.com → crea un progetto',
        '2. Abilita YouTube Data API v3',
        '3. Crea credenziali OAuth2 (Desktop App)',
        '4. Esegui il flusso OAuth per ottenere refresh_token (scope: youtube.upload)',
        '5. Aggiungi le env vars: YOUTUBE_REFRESH_TOKEN, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET',
      ],
    })
  }

  const targetUrl = videoUrl || imageUrl
  if (!targetUrl) {
    return res.status(400).json({ ok: false, error: 'videoUrl richiesto per YouTube' })
  }

  if (!videoUrl) {
    return res.status(200).json({
      ok:      false,
      platform: 'youtube',
      error:   'YouTube richiede un video. Genera prima un video con il prompt 🎬.',
    })
  }

  try {
    const accessToken = await getAccessToken()

    // 1. Download the video from the external URL
    const videoFetch = await fetch(videoUrl)
    if (!videoFetch.ok) throw new Error(`Cannot fetch video: ${videoFetch.status}`)
    const videoBuffer = Buffer.from(await videoFetch.arrayBuffer())
    const contentType = videoFetch.headers.get('content-type') || 'video/mp4'
    const videoSize   = videoBuffer.length

    const fullDescription = [
      description || caption || '',
      hashtags ? `\n\n${hashtags}` : '',
      '\n\n🛒 Shop: https://jayl.store',
    ].join('')

    // 2. Initiate resumable upload
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method:  'POST',
        headers: {
          'Authorization':       `Bearer ${accessToken}`,
          'Content-Type':        'application/json',
          'X-Upload-Content-Type':   contentType,
          'X-Upload-Content-Length': videoSize,
        },
        body: JSON.stringify({
          snippet: {
            title:       title.slice(0, 100),
            description: fullDescription.slice(0, 5000),
            tags:        hashtags.replace(/#/g, '').split(/\s+/).filter(Boolean).slice(0, 30),
            categoryId:  '22', // People & Blogs
          },
          status: {
            privacyStatus: 'public',
          },
        }),
      }
    )

    if (!initRes.ok) {
      const errText = await initRes.text()
      throw new Error(`YouTube init failed: ${errText}`)
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) throw new Error('No upload URL from YouTube')

    // 3. Upload video bytes
    const uploadRes = await fetch(uploadUrl, {
      method:  'PUT',
      headers: {
        'Content-Type':   contentType,
        'Content-Length': videoSize,
      },
      body: videoBuffer,
    })

    if (!uploadRes.ok && uploadRes.status !== 308) {
      const errText = await uploadRes.text()
      throw new Error(`YouTube upload failed: ${errText}`)
    }

    const uploadData = await uploadRes.json().catch(() => ({}))
    const videoId    = uploadData.id

    return res.json({
      ok:       true,
      platform: 'youtube',
      videoId,
      videoUrl: videoId ? `https://youtube.com/watch?v=${videoId}` : null,
    })

  } catch (e) {
    console.error('[publish-youtube]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
