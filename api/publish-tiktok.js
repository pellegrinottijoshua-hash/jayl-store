/**
 * POST /api/publish-tiktok
 * Pubblica un video su TikTok via Content Posting API.
 *
 * Env vars richieste:
 *   TIKTOK_ACCESS_TOKEN — OAuth2 access token (scope: video.upload, video.publish)
 *   TIKTOK_OPEN_ID      — TikTok user open_id (restituito durante OAuth)
 *
 * Body: { videoUrl, caption, hashtags?, password }
 * Response: { ok, publishId } | { ok: false, needsConnect, message }
 *
 * Note: TikTok Content Posting API supporta video da URL pubblico.
 * Immagini: TikTok non supporta post di sole immagini via API (solo video/slideshow).
 */

import { applyCors } from './_lib/cors.js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { password, videoUrl, imageUrl, caption = '', hashtags = '' } = req.body || {}
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })

  const token  = process.env.TIKTOK_ACCESS_TOKEN
  const openId = process.env.TIKTOK_OPEN_ID

  if (!token || !openId) {
    return res.status(200).json({
      ok:           false,
      needsConnect: true,
      platform:     'tiktok',
      message:      'TikTok non connesso. Aggiungi TIKTOK_ACCESS_TOKEN e TIKTOK_OPEN_ID nelle env vars di Vercel.',
      instructions: [
        '1. Vai su developers.tiktok.com → crea un app in "Developer Mode"',
        '2. Abilita scope: video.upload, video.publish',
        '3. Esegui il flusso OAuth per ottenere access_token e open_id',
        '4. Aggiungi le env vars su Vercel: TIKTOK_ACCESS_TOKEN e TIKTOK_OPEN_ID',
        'Note: il token scade ogni 24h — considera di usare il refresh token.',
      ],
    })
  }

  // TikTok supporta solo video (non immagini singole via API v2)
  if (!videoUrl) {
    return res.status(200).json({
      ok:      false,
      platform: 'tiktok',
      error:   'TikTok richiede un video. Genera prima un video con il prompt 🎬.',
    })
  }

  const title = [caption, hashtags].filter(Boolean).join(' ').slice(0, 150)

  try {
    // Step 1: Initialize video upload via URL
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level:      'PUBLIC_TO_EVERYONE',
          disable_duet:       false,
          disable_comment:    false,
          disable_stitch:     false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source:    'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    })

    const initData = await initRes.json()
    if (initData.error?.code && initData.error.code !== 'ok') {
      throw new Error(initData.error.message || 'TikTok upload init failed')
    }

    const publishId = initData.data?.publish_id
    if (!publishId) throw new Error('TikTok: no publish_id returned')

    return res.json({ ok: true, platform: 'tiktok', publishId, status: 'processing' })

  } catch (e) {
    console.error('[publish-tiktok]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
