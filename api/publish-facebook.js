/**
 * POST /api/publish-facebook
 * Pubblica un post su una Facebook Page via Graph API.
 *
 * Env vars richieste:
 *   FACEBOOK_PAGE_TOKEN — Page Access Token (scope: pages_manage_posts, pages_read_engagement)
 *   FACEBOOK_PAGE_ID    — ID della Facebook Page
 *
 * Body: { imageUrl?, videoUrl?, caption, hashtags?, link?, password }
 * Response: { ok, postId } | { ok: false, needsConnect, message }
 */

import { applyCors } from './_lib/cors.js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { password, imageUrl, videoUrl, caption = '', hashtags = '', link } = req.body || {}
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })

  const token  = process.env.FACEBOOK_PAGE_TOKEN
  const pageId = process.env.FACEBOOK_PAGE_ID

  if (!token || !pageId) {
    return res.status(200).json({
      ok:           false,
      needsConnect: true,
      platform:     'facebook',
      message:      'Facebook non connesso. Aggiungi FACEBOOK_PAGE_TOKEN e FACEBOOK_PAGE_ID nelle env vars di Vercel.',
      instructions: [
        '1. Vai su developers.facebook.com → crea o seleziona un app',
        '2. Aggiungi prodotto: Facebook Login, Pages API',
        '3. Genera un Page Access Token per la tua pagina (da Graph API Explorer)',
        '4. Copia il Page ID dalla pagina Facebook → Informazioni → Info pagina',
        '5. Aggiungi le env vars su Vercel: FACEBOOK_PAGE_TOKEN e FACEBOOK_PAGE_ID',
      ],
    })
  }

  const message = [caption, hashtags].filter(Boolean).join('\n\n')
  const BASE    = `https://graph.facebook.com/v19.0/${pageId}`

  try {
    if (videoUrl) {
      // ── Video post ───────────────────────────────────────────────────────────
      const uploadRes = await fetch(`${BASE}/videos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          file_url:     videoUrl,
          description:  message,
          access_token: token,
        }),
      })
      const uploadData = await uploadRes.json()
      if (uploadData.error) throw new Error(uploadData.error.message)

      return res.json({ ok: true, platform: 'facebook', postId: uploadData.id, type: 'video' })

    } else if (imageUrl) {
      // ── Photo post ───────────────────────────────────────────────────────────
      const photoRes = await fetch(`${BASE}/photos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          url:          imageUrl,
          caption:      message,
          access_token: token,
        }),
      })
      const photoData = await photoRes.json()
      if (photoData.error) throw new Error(photoData.error.message)

      return res.json({ ok: true, platform: 'facebook', postId: photoData.post_id || photoData.id, type: 'photo' })

    } else if (link || message) {
      // ── Text / link post ─────────────────────────────────────────────────────
      const feedRes = await fetch(`${BASE}/feed`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message,
          link:         link || undefined,
          access_token: token,
        }),
      })
      const feedData = await feedRes.json()
      if (feedData.error) throw new Error(feedData.error.message)

      return res.json({ ok: true, platform: 'facebook', postId: feedData.id, type: 'text' })

    } else {
      return res.status(400).json({ ok: false, error: 'Almeno imageUrl, videoUrl o caption richiesto' })
    }
  } catch (e) {
    console.error('[publish-facebook]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
