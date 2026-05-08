/**
 * POST /api/publish-social
 * Unified social platform publisher — replaces 5 individual publish-*.js files.
 *
 * Body: {
 *   platform:    "instagram" | "tiktok" | "pinterest" | "facebook" | "youtube"
 *   imageUrl?:   string
 *   videoUrl?:   string
 *   caption?:    string
 *   hashtags?:   string
 *   altText?:    string
 *   title?:      string   (YouTube / Pinterest)
 *   description?:string   (YouTube / Pinterest)
 *   link?:       string   (Pinterest)
 *   password:    string
 * }
 *
 * Response:
 *   { ok: true,  platform, postId?, pinId?, videoId?, type? }
 *   { ok: false, needsConnect: true, platform, message, instructions[] }
 *   { ok: false, error: string }
 */

import { applyCors } from './_lib/cors.js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaylpelle'

// ── Instagram (Meta Graph API v19) ────────────────────────────────────────────
async function publishInstagram({ imageUrl, videoUrl, caption, hashtags, altText }) {
  const token  = process.env.INSTAGRAM_ACCESS_TOKEN
  const userId = process.env.INSTAGRAM_USER_ID
  if (!token || !userId) return needsConnect('instagram', [
    '1. developers.facebook.com → crea un app',
    '2. Aggiungi prodotto: Instagram Graph API',
    '3. Genera long-lived token: instagram_basic, instagram_content_publish',
    '4. Copia il tuo Instagram Business Account ID',
    '5. Vercel env vars: INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID',
  ])

  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n')
  const BASE = `https://graph.facebook.com/v19.0/${userId}`

  if (videoUrl) {
    const c = await gfetch(`${BASE}/media`, {
      media_type: 'REELS', video_url: videoUrl, caption: fullCaption, access_token: token,
    })
    if (c.error) throw new Error(c.error.message)
    // Poll until ready (max 2 min)
    for (let i = 0; i < 30; i++) {
      const s = await rawFetch(`https://graph.facebook.com/v19.0/${c.id}?fields=status_code&access_token=${token}`)
      if (s.status_code === 'FINISHED') break
      if (s.status_code === 'ERROR') throw new Error('Video processing failed')
      await sleep(4000)
    }
    const p = await gfetch(`${BASE}/media_publish`, { creation_id: c.id, access_token: token })
    if (p.error) throw new Error(p.error.message)
    return { ok: true, platform: 'instagram', postId: p.id, type: 'reel' }
  } else if (imageUrl) {
    const c = await gfetch(`${BASE}/media`, {
      image_url: imageUrl, caption: fullCaption, alt_text: altText || undefined, access_token: token,
    })
    if (c.error) throw new Error(c.error.message)
    const p = await gfetch(`${BASE}/media_publish`, { creation_id: c.id, access_token: token })
    if (p.error) throw new Error(p.error.message)
    return { ok: true, platform: 'instagram', postId: p.id, type: 'photo' }
  }
  throw new Error('imageUrl o videoUrl richiesto')
}

// ── TikTok (Content Posting API v2) ──────────────────────────────────────────
async function publishTiktok({ videoUrl, caption, hashtags }) {
  const token  = process.env.TIKTOK_ACCESS_TOKEN
  const openId = process.env.TIKTOK_OPEN_ID
  if (!token || !openId) return needsConnect('tiktok', [
    '1. developers.tiktok.com → crea un app in Developer Mode',
    '2. Abilita scope: video.upload, video.publish',
    '3. Esegui OAuth → ottieni access_token + open_id',
    '4. Vercel env vars: TIKTOK_ACCESS_TOKEN + TIKTOK_OPEN_ID',
  ])

  if (!videoUrl) return { ok: false, platform: 'tiktok', error: 'TikTok richiede un video 🎬' }

  const title = [caption, hashtags].filter(Boolean).join(' ').slice(0, 150)
  const init = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: { title, privacy_level: 'PUBLIC_TO_EVERYONE', disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 },
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
    }),
  }).then(r => r.json())
  if (init.error?.code && init.error.code !== 'ok') throw new Error(init.error.message || 'TikTok init failed')
  const publishId = init.data?.publish_id
  if (!publishId) throw new Error('TikTok: no publish_id')
  return { ok: true, platform: 'tiktok', publishId, status: 'processing' }
}

// ── Pinterest (API v5) ────────────────────────────────────────────────────────
async function publishPinterest({ imageUrl, videoUrl, caption, hashtags, title, description, altText, link }) {
  const token   = process.env.PINTEREST_ACCESS_TOKEN
  const boardId = process.env.PINTEREST_BOARD_ID
  if (!token || !boardId) return needsConnect('pinterest', [
    '1. developers.pinterest.com → crea un app',
    '2. Scope: pins:write, boards:read',
    '3. OAuth → access_token',
    '4. Trova Board ID: GET /v5/boards',
    '5. Vercel env vars: PINTEREST_ACCESS_TOKEN + PINTEREST_BOARD_ID',
  ])

  const mediaUrl = imageUrl || videoUrl
  if (!mediaUrl) throw new Error('imageUrl o videoUrl richiesto')

  const pinTitle = (title || caption || '').slice(0, 100)
  const pinDesc  = (description || [caption, hashtags].filter(Boolean).join('\n\n')).slice(0, 800)
  const isVideo  = !!videoUrl && !imageUrl

  const data = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board_id: boardId,
      title:    pinTitle,
      description: pinDesc,
      link:     link || 'https://jayl.store',
      alt_text: (altText || pinTitle).slice(0, 500),
      media_source: isVideo
        ? { source_type: 'video_url', url: mediaUrl }
        : { source_type: 'image_url', url: mediaUrl, is_standard: true },
    }),
  }).then(r => r.json())

  if (!data.id) throw new Error(data.message || 'Pinterest API error')
  return { ok: true, platform: 'pinterest', pinId: data.id, pinUrl: `https://pinterest.com/pin/${data.id}` }
}

// ── Facebook (Graph API v19) ──────────────────────────────────────────────────
async function publishFacebook({ imageUrl, videoUrl, caption, hashtags, link }) {
  const token  = process.env.FACEBOOK_PAGE_TOKEN
  const pageId = process.env.FACEBOOK_PAGE_ID
  if (!token || !pageId) return needsConnect('facebook', [
    '1. developers.facebook.com → crea un app',
    '2. Aggiungi: Facebook Login, Pages API',
    '3. Genera Page Access Token (Graph API Explorer)',
    '4. Copia il Page ID dalla tua pagina Facebook',
    '5. Vercel env vars: FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID',
  ])

  const message = [caption, hashtags].filter(Boolean).join('\n\n')
  const BASE    = `https://graph.facebook.com/v19.0/${pageId}`

  if (videoUrl) {
    const d = await gfetch(`${BASE}/videos`, { file_url: videoUrl, description: message, access_token: token })
    if (d.error) throw new Error(d.error.message)
    return { ok: true, platform: 'facebook', postId: d.id, type: 'video' }
  } else if (imageUrl) {
    const d = await gfetch(`${BASE}/photos`, { url: imageUrl, caption: message, access_token: token })
    if (d.error) throw new Error(d.error.message)
    return { ok: true, platform: 'facebook', postId: d.post_id || d.id, type: 'photo' }
  } else {
    const d = await gfetch(`${BASE}/feed`, { message, link: link || undefined, access_token: token })
    if (d.error) throw new Error(d.error.message)
    return { ok: true, platform: 'facebook', postId: d.id, type: 'text' }
  }
}

// ── YouTube (Data API v3 — resumable upload) ──────────────────────────────────
async function publishYoutube({ videoUrl, title, description, hashtags, caption }) {
  const hasCredentials = process.env.YOUTUBE_REFRESH_TOKEN && process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET
  if (!hasCredentials) return needsConnect('youtube', [
    '1. console.cloud.google.com → crea un progetto',
    '2. Abilita YouTube Data API v3',
    '3. Crea credenziali OAuth2 (Desktop App)',
    '4. OAuth flow → refresh_token con scope youtube.upload',
    '5. Vercel env vars: YOUTUBE_REFRESH_TOKEN + YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET',
  ])

  if (!videoUrl) return { ok: false, platform: 'youtube', error: 'YouTube richiede un video 🎬' }

  // Refresh access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  }).then(r => r.json())
  if (tokenRes.error) throw new Error(`Token refresh: ${tokenRes.error_description || tokenRes.error}`)
  const accessToken = tokenRes.access_token

  // Download video
  const videoFetch  = await fetch(videoUrl)
  if (!videoFetch.ok) throw new Error(`Cannot fetch video: ${videoFetch.status}`)
  const videoBuffer = Buffer.from(await videoFetch.arrayBuffer())
  const contentType = videoFetch.headers.get('content-type') || 'video/mp4'

  const fullDesc = [description || caption || '', hashtags ? `\n\n${hashtags}` : '', '\n\n🛒 Shop: https://jayl.store'].join('')

  // Initiate resumable upload
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': videoBuffer.length,
      },
      body: JSON.stringify({
        snippet: {
          title:       (title || 'JAYL Product Video').slice(0, 100),
          description: fullDesc.slice(0, 5000),
          tags:        (hashtags || '').replace(/#/g, '').split(/\s+/).filter(Boolean).slice(0, 30),
          categoryId:  '22',
        },
        status: { privacyStatus: 'public' },
      }),
    }
  )
  if (!initRes.ok) throw new Error(`YouTube init: ${await initRes.text()}`)
  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('No upload URL from YouTube')

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': videoBuffer.length },
    body: videoBuffer,
  })
  if (!uploadRes.ok && uploadRes.status !== 308) throw new Error(`YouTube upload: ${await uploadRes.text()}`)
  const uploadData = await uploadRes.json().catch(() => ({}))
  return { ok: true, platform: 'youtube', videoId: uploadData.id, videoUrl: uploadData.id ? `https://youtube.com/watch?v=${uploadData.id}` : null }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function needsConnect(platform, instructions) {
  const msgs = {
    instagram: 'Instagram non connesso. Aggiungi le env vars su Vercel.',
    tiktok:    'TikTok non connesso. Aggiungi le env vars su Vercel.',
    pinterest: 'Pinterest non connesso. Aggiungi le env vars su Vercel.',
    facebook:  'Facebook non connesso. Aggiungi le env vars su Vercel.',
    youtube:   'YouTube non connesso. Aggiungi le env vars su Vercel.',
  }
  return { ok: false, needsConnect: true, platform, message: msgs[platform], instructions }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function gfetch(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

async function rawFetch(url) {
  const res = await fetch(url)
  return res.json()
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
const HANDLERS = { instagram: publishInstagram, tiktok: publishTiktok, pinterest: publishPinterest, facebook: publishFacebook, youtube: publishYoutube }

export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { password, platform, ...rest } = req.body || {}
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  if (!platform || !HANDLERS[platform]) return res.status(400).json({ error: `Invalid platform. Use: ${Object.keys(HANDLERS).join(' | ')}` })

  try {
    const result = await HANDLERS[platform](rest)
    return res.status(200).json(result)
  } catch (e) {
    console.error(`[publish-social:${platform}]`, e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
