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
 *
 * Con `action` invece di `platform`: la pubblicazione rapida dall'admin e
 * dagli agenti (status, state, caption, publish, mark-used, settings, assets)
 * — vedi api/_lib/socialActions.js e
 * docs/superpowers/specs/2026-09-30-social-publish-design.md.
 */

import { applyCors } from './_lib/cors.js'
import { resolveMeta, publishInstagram as igPublish, publishFacebook as fbPublish, GRAPH } from './_lib/meta.js'
import { handleSocialAction } from './_lib/socialActions.js'
import { readSocial, updateSocial, listProductFiles } from './_lib/socialStore.js'
import { generateCaptions } from './_lib/socialCaptions.js'
import { adminProducts } from '../src/data/admin-products.js'

// I video su Instagram e Facebook si elaborano lato Meta: l'attesa può
// superare il minuto.
export const config = { maxDuration: 300 }

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const SITE_URL = 'https://www.jayl.store'

const META_INSTRUCTIONS = [
  '1. Instagram professionale collegato alla Pagina Facebook di JAYL',
  '2. Vercel env: FACEBOOK_PAGE_TOKEN (token utente o di Pagina) + FACEBOOK_PAGE_ID',
  '3. Admin → scheda prodotto → Social: il controllo Meta dice cosa manca',
]

// ── Instagram (Meta, via api/_lib/meta.js) ────────────────────────────────────
async function publishInstagram({ imageUrl, videoUrl, caption, hashtags }) {
  const meta = await resolveMeta()
  if (!meta.ok || !meta.igUserId) return needsConnect('instagram', META_INSTRUCTIONS)
  if (!imageUrl && !videoUrl) throw new Error('imageUrl o videoUrl richiesto')
  const isVideo = !!videoUrl
  const r = await igPublish(meta, {
    format: isVideo ? 'reel' : 'post',
    mediaType: isVideo ? 'video' : 'image',
    mediaUrl: videoUrl || imageUrl,
    caption: [caption, hashtags].filter(Boolean).join('\n\n'),
  })
  return { ok: true, platform: 'instagram', postId: r.id, url: r.url, type: isVideo ? 'reel' : 'photo' }
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
async function publishPinterest({ imageUrl, videoUrl, caption, hashtags, title, description, altText, link, boardId: bodyBoardId }) {
  const token   = (process.env.PINTEREST_ACCESS_TOKEN || '').trim()
  const boardId = bodyBoardId?.trim() || process.env.PINTEREST_BOARD_ID
  if (!token) return needsConnect('pinterest', [
    '1. developers.pinterest.com → app 1568655 → genera access token',
    '2. Scope richiesti: pins:write, boards:read',
    '3. Vercel env: PINTEREST_ACCESS_TOKEN',
  ])
  if (!boardId) return needsConnect('pinterest', [
    'Board ID mancante — inseriscilo nel pannello admin oppure aggiungi PINTEREST_BOARD_ID su Vercel',
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

// ── Facebook (Meta, via api/_lib/meta.js) ─────────────────────────────────────
async function publishFacebook({ imageUrl, videoUrl, caption, hashtags, link }) {
  const meta = await resolveMeta()
  if (!meta.ok || !meta.pageId) return needsConnect('facebook', META_INSTRUCTIONS)
  const message = [caption, hashtags].filter(Boolean).join('\n\n')

  if (videoUrl || imageUrl) {
    const isVideo = !!videoUrl
    const r = await fbPublish(meta, { format: 'post', mediaType: isVideo ? 'video' : 'image', mediaUrl: videoUrl || imageUrl, caption: message })
    return { ok: true, platform: 'facebook', postId: r.id, url: r.url, type: isVideo ? 'video' : 'photo' }
  }
  const d = await gfetch(`${GRAPH}/${meta.pageId}/feed`, { message, link: link || undefined, access_token: meta.pageToken })
  if (d.error) throw new Error(d.error.message)
  return { ok: true, platform: 'facebook', postId: d.id, type: 'text' }
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

async function gfetch(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

// ── Pubblicazione rapida: stato dei social ────────────────────────────────────
// mode: 'api' = un clic · 'manual' = apri e copia · 'error' = collegato male.
async function pinterestStatus(settings) {
  const token = (process.env.PINTEREST_ACCESS_TOKEN || '').trim()
  if (!token) return { mode: 'manual', detail: 'PINTEREST_ACCESS_TOKEN non configurato: apre il pin builder' }
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const acc = await fetch('https://api.pinterest.com/v5/user_account', { headers, signal: AbortSignal.timeout(8000) })
    if (!acc.ok) return { mode: 'error', detail: `Token Pinterest non valido o scaduto (${acc.status}): va rigenerato` }
    const user = await acc.json()
    const b = await fetch('https://api.pinterest.com/v5/boards?page_size=50', { headers, signal: AbortSignal.timeout(8000) })
    const boards = b.ok ? ((await b.json()).items || []).map((x) => ({ id: x.id, name: x.name })) : []
    const boardId = settings.pinterestBoardId || process.env.PINTEREST_BOARD_ID || null
    if (!boardId) return { mode: 'error', detail: 'Scegli la board su cui pubblicare', boards }
    const board = boards.find((x) => x.id === boardId)
    return { mode: 'api', detail: `@${user.username} · board ${board?.name || boardId}`, boards, boardId }
  } catch (e) {
    return { mode: 'error', detail: `Pinterest non raggiungibile: ${e.message}` }
  }
}

async function socialStatus({ settings }) {
  const [meta, pinterest] = await Promise.all([resolveMeta(), pinterestStatus(settings)])
  const hasMetaEnv = !!(process.env.FACEBOOK_PAGE_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN)
  const metaOff = hasMetaEnv
    ? { mode: 'error', detail: meta.error }
    : { mode: 'manual', detail: 'Per 1 clic: FACEBOOK_PAGE_TOKEN e FACEBOOK_PAGE_ID su Vercel' }
  const missing = meta.missingScopes || []
  const instagram = !meta.ok ? metaOff
    : !meta.igUserId ? { mode: 'error', detail: 'Nessun Instagram professionale collegato alla Pagina' }
    : missing.includes('instagram_content_publish') ? { mode: 'error', detail: 'Al token manca il permesso instagram_content_publish' }
    : { mode: 'api', detail: `@${meta.igUsername || meta.igUserId}` }
  const facebook = !meta.ok ? metaOff
    : !meta.pageId ? { mode: 'error', detail: 'Nessuna Pagina Facebook trovata con questo token' }
    : missing.includes('pages_manage_posts') ? { mode: 'error', detail: 'Al token manca il permesso pages_manage_posts' }
    : { mode: 'api', detail: meta.pageName || meta.pageId }
  const youtubeApi = !!(process.env.YOUTUBE_REFRESH_TOKEN && process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)
  return {
    platforms: {
      pinterest,
      instagram,
      facebook,
      x: { mode: 'manual', detail: 'Apre il post già scritto (API di X a pagamento)' },
      tiktok: { mode: 'manual', detail: 'Apre TikTok e copia il testo (API dopo l\'approvazione dell\'app)' },
      youtube: youtubeApi ? { mode: 'api', detail: 'Shorts via API' } : { mode: 'manual', detail: 'Apre YouTube Studio e copia il testo' },
    },
    // Mai i token: solo cosa serve per capire se il collegamento è sano.
    meta: {
      ok: meta.ok, error: meta.error || null, pageName: meta.pageName, igUsername: meta.igUsername,
      tokenType: meta.tokenType, expiresAt: meta.expiresAt, missingScopes: missing,
    },
  }
}

function socialDeps() {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) throw new Error('GITHUB_TOKEN not configured')
  return {
    products: adminProducts,
    siteUrl: SITE_URL,
    store: {
      read: () => readSocial(githubToken),
      update: (mutate, message) => updateSocial(githubToken, mutate, message),
    },
    generate: generateCaptions,
    urlExists: async (url) => {
      try { return (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })).ok } catch { return false }
    },
    status: socialStatus,
    listAssets: () => listProductFiles(githubToken),
    adapters: {
      pinterest: async ({ mediaUrl, caption, text, link, settings }) => {
        const r = await publishPinterest({
          imageUrl: mediaUrl, title: caption?.title, description: text, altText: caption?.title, link,
          boardId: settings.pinterestBoardId || undefined,
        })
        if (!r.ok) throw new Error(r.message || r.error || 'Pinterest non collegato')
        return { id: r.pinId, url: r.pinUrl }
      },
      instagram: async ({ format, mediaType, mediaUrl, text }) =>
        igPublish(await resolveMeta(), { format, mediaType, mediaUrl, caption: text }),
      facebook: async ({ format, mediaType, mediaUrl, text, link }) =>
        // Solo nel post un link è cliccabile; nei reel e nelle storie no.
        fbPublish(await resolveMeta(), { format, mediaType, mediaUrl, caption: format === 'post' ? `${text}\n\n${link}`.trim() : text }),
      youtube: async ({ mediaUrl, caption, text }) => {
        const r = await publishYoutube({ videoUrl: mediaUrl, title: caption?.title, description: text })
        if (!r.ok) throw new Error(r.message || r.error || 'YouTube non collegato')
        return { id: r.videoId, url: r.videoUrl }
      },
    },
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
const HANDLERS = { instagram: publishInstagram, tiktok: publishTiktok, pinterest: publishPinterest, facebook: publishFacebook, youtube: publishYoutube }

export default async function handler(req, res) {
  await applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Pinterest boards listing — GET ?action=boards ─────────────────────────
  if (req.method === 'GET' && req.query.action === 'boards') {
    const token = (process.env.PINTEREST_ACCESS_TOKEN || '').trim()
    if (!token) return res.status(500).json({ error: 'PINTEREST_ACCESS_TOKEN not configured' })
    try {
      const r = await fetch('https://api.pinterest.com/v5/boards?page_size=25', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!r.ok) return res.status(r.status).json({ error: `Pinterest API ${r.status}` })
      const data = await r.json()
      return res.status(200).json({ boards: data.items || [] })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { password, platform, action, ...rest } = req.body || {}
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })

  if (action) {
    try {
      const { status, json } = await handleSocialAction({ action, platform, ...rest }, socialDeps())
      return res.status(status).json(json)
    } catch (e) {
      console.error(`[publish-social:${action}]`, e.message)
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  if (!platform || !HANDLERS[platform]) return res.status(400).json({ error: `Invalid platform. Use: ${Object.keys(HANDLERS).join(' | ')}` })

  try {
    const result = await HANDLERS[platform](rest)
    return res.status(200).json(result)
  } catch (e) {
    console.error(`[publish-social:${platform}]`, e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
