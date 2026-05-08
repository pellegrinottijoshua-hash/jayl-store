/**
 * POST /api/publish-instagram
 * Pubblica un'immagine o video su Instagram via Meta Graph API.
 *
 * Env vars richieste:
 *   INSTAGRAM_ACCESS_TOKEN  — Long-lived user access token (scopes: instagram_basic, instagram_content_publish)
 *   INSTAGRAM_USER_ID       — Instagram Business/Creator account ID
 *
 * Body: { imageUrl?, videoUrl?, caption, hashtags, altText?, password }
 * Response: { ok, postId } | { ok: false, needsConnect, message }
 */

import { applyCors } from './_lib/cors.js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { password, imageUrl, videoUrl, caption = '', hashtags = '', altText = '' } = req.body || {}
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })

  const token  = process.env.INSTAGRAM_ACCESS_TOKEN
  const userId = process.env.INSTAGRAM_USER_ID

  if (!token || !userId) {
    return res.status(200).json({
      ok:           false,
      needsConnect: true,
      platform:     'instagram',
      message:      'Instagram non connesso. Aggiungi INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID nelle env vars di Vercel.',
      instructions: [
        '1. Vai su developers.facebook.com → crea un app',
        '2. Aggiungi prodotto: Instagram Graph API',
        '3. Genera un long-lived token con scope: instagram_basic, instagram_content_publish, pages_show_list',
        '4. Trova il tuo Instagram Business Account ID',
        '5. Aggiungi le env vars su Vercel: INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID',
      ],
    })
  }

  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n')
  const BASE = `https://graph.facebook.com/v19.0/${userId}`

  try {
    if (videoUrl) {
      // ── Reel (video) ────────────────────────────────────────────────────────
      const createRes = await fetch(`${BASE}/media`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          media_type:   'REELS',
          video_url:    videoUrl,
          caption:      fullCaption,
          access_token: token,
        }),
      })
      const createData = await createRes.json()
      if (createData.error) throw new Error(createData.error.message)

      // Poll until ready
      let ready = false
      for (let i = 0; i < 30; i++) {
        const statusRes  = await fetch(`https://graph.facebook.com/v19.0/${createData.id}?fields=status_code&access_token=${token}`)
        const statusData = await statusRes.json()
        if (statusData.status_code === 'FINISHED') { ready = true; break }
        if (statusData.status_code === 'ERROR') throw new Error('Video processing failed')
        await new Promise(r => setTimeout(r, 4000))
      }
      if (!ready) throw new Error('Video processing timed out')

      const publishRes  = await fetch(`${BASE}/media_publish`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ creation_id: createData.id, access_token: token }),
      })
      const publishData = await publishRes.json()
      if (publishData.error) throw new Error(publishData.error.message)

      return res.json({ ok: true, platform: 'instagram', postId: publishData.id, type: 'reel' })

    } else if (imageUrl) {
      // ── Photo post ──────────────────────────────────────────────────────────
      const createRes = await fetch(`${BASE}/media`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          image_url:    imageUrl,
          caption:      fullCaption,
          alt_text:     altText || undefined,
          access_token: token,
        }),
      })
      const createData = await createRes.json()
      if (createData.error) throw new Error(createData.error.message)

      const publishRes  = await fetch(`${BASE}/media_publish`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ creation_id: createData.id, access_token: token }),
      })
      const publishData = await publishRes.json()
      if (publishData.error) throw new Error(publishData.error.message)

      return res.json({ ok: true, platform: 'instagram', postId: publishData.id, type: 'photo' })

    } else {
      return res.status(400).json({ ok: false, error: 'imageUrl o videoUrl richiesto' })
    }
  } catch (e) {
    console.error('[publish-instagram]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
