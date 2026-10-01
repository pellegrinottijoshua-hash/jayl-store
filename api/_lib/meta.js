// Meta (Pagina Facebook + Instagram professionale) per la pubblicazione rapida
// dall'admin — docs/superpowers/specs/2026-09-30-social-publish-design.md.
//
// Su Vercel bastano FACEBOOK_PAGE_TOKEN e FACEBOOK_PAGE_ID, comunque li si
// sia presi: il token può essere dell'utente o della Pagina, l'id della Pagina
// o dell'account Instagram. resolveMeta() capisce cosa ha in mano e ricava il
// token di Pagina e l'account Instagram collegato. INSTAGRAM_ACCESS_TOKEN e
// INSTAGRAM_USER_ID restano come override facoltativi.
//
// Graph API v25.0: la v19 usata prima da api/publish-social.js è dismessa.

export const GRAPH_VERSION = 'v25.0'
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
export const META_SCOPES = ['pages_manage_posts', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish']

const PAGE_FIELDS = 'id,name,access_token,instagram_business_account{id,username}'
const CACHE_MS = 10 * 60 * 1000
let cache = null // { key, at, value }

export function clearMetaCache() { cache = null }

function graph(fetchImpl) {
  const get = async (path, params, token) => {
    const qs = new URLSearchParams({ ...params, access_token: token })
    const res = await fetchImpl(`${GRAPH}/${path}?${qs}`)
    return res.json().catch(() => ({ error: { message: `risposta non JSON (${res.status})` } }))
  }
  const post = async (path, body) => {
    const res = await fetchImpl(`${GRAPH}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({ error: { message: `risposta non JSON (${res.status})` } }))
    if (json.error) throw new Error(`Meta: ${json.error.message}${json.error.code ? ` (#${json.error.code})` : ''}`)
    return json
  }
  return { get, post }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, pageId: string|null, pageName: string|null,
 *   pageToken: string|null, igUserId: string|null, igUsername: string|null,
 *   tokenType: string|null, expiresAt: string|'never'|null, missingScopes: string[] }>}
 */
export async function resolveMeta({ env = process.env, fetchImpl = fetch } = {}) {
  const token = (env.FACEBOOK_PAGE_TOKEN || env.INSTAGRAM_ACCESS_TOKEN || '').trim()
  const id = (env.FACEBOOK_PAGE_ID || '').trim()
  const igOverride = (env.INSTAGRAM_USER_ID || '').trim()
  const empty = { pageId: null, pageName: null, pageToken: null, igUserId: null, igUsername: null, tokenType: null, expiresAt: null, missingScopes: [] }
  if (!token) return { ok: false, error: 'FACEBOOK_PAGE_TOKEN non configurato su Vercel', ...empty }

  const key = `${token}|${id}|${igOverride}`
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.value

  const { get } = graph(fetchImpl)
  // Best effort: con alcuni token debug_token non risponde, e va bene così.
  const dbg = (await get('debug_token', { input_token: token }, token).catch(() => ({})))?.data

  let page = null
  let ig = null
  let lastError = null
  if (id) {
    const r = await get(id, { fields: PAGE_FIELDS }, token)
    if (!r.error && r.id) page = r
    else {
      lastError = r.error?.message
      const asIg = await get(id, { fields: 'id,username' }, token)
      if (!asIg.error && asIg.username) ig = asIg
    }
  }
  if (!page) {
    const r = await get('me/accounts', { fields: PAGE_FIELDS }, token)
    if (!r.error && Array.isArray(r.data) && r.data.length) {
      page = r.data.find((p) => p.id === id)
        || (ig && r.data.find((p) => p.instagram_business_account?.id === ig.id))
        || r.data[0]
    } else if (r.error) lastError ??= r.error.message
  }
  if (!page) {
    // Un token di Pagina: /me È la Pagina.
    const r = await get('me', { fields: 'id,name,instagram_business_account{id,username}' }, token)
    if (!r.error && r.id && 'instagram_business_account' in r) page = r
    else if (!r.error && r.id && !ig) page = r
  }

  const igAccount = page?.instagram_business_account || ig
  const scopes = Array.isArray(dbg?.scopes) ? dbg.scopes : null
  const value = {
    ok: !!(page || ig || igOverride),
    ...(page || ig || igOverride ? {} : { error: `Token o id non validi${lastError ? `: ${lastError}` : ''}` }),
    pageId: page?.id || null,
    pageName: page?.name || null,
    pageToken: page?.access_token || token,
    igUserId: igOverride || igAccount?.id || null,
    igUsername: igAccount?.username || null,
    tokenType: dbg?.type || (page?.access_token && page.access_token !== token ? 'USER' : page ? 'PAGE' : null),
    // 'never' = token che non scade; null = scadenza non verificabile (debug_token muto).
    expiresAt: !dbg ? null : dbg.expires_at ? new Date(dbg.expires_at * 1000).toISOString() : 'never',
    missingScopes: scopes ? META_SCOPES.filter((s) => !scopes.includes(s)) : [],
  }
  cache = { key, at: Date.now(), value }
  return value
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Instagram: post (immagine JPEG), reel (video), storia (immagine o video,
 * senza testo: l'API non lo accetta). Crea il contenitore, aspetta che
 * Instagram abbia scaricato ed elaborato il file, poi pubblica.
 */
export async function publishInstagram(meta, { format, mediaType, mediaUrl, caption }, { fetchImpl = fetch, sleep = defaultSleep } = {}) {
  if (!meta?.igUserId) throw new Error('Nessun account Instagram collegato alla Pagina')
  const { get, post } = graph(fetchImpl)
  const tok = meta.pageToken
  let body
  if (format === 'post') {
    if (mediaType !== 'image') throw new Error('Il post Instagram vuole un\'immagine: per un video scegli Reel')
    body = { image_url: mediaUrl, caption }
  } else if (format === 'reel') {
    if (mediaType !== 'video') throw new Error('Il reel vuole un video')
    body = { media_type: 'REELS', video_url: mediaUrl, caption, share_to_feed: true }
  } else if (format === 'story') {
    body = { media_type: 'STORIES', [mediaType === 'video' ? 'video_url' : 'image_url']: mediaUrl }
  } else {
    throw new Error(`Formato Instagram non supportato: ${format}`)
  }

  const container = await post(`${meta.igUserId}/media`, { ...body, access_token: tok })
  const wait = mediaType === 'video' ? 3000 : 1000
  let ready = false
  for (let i = 0; i < 60 && !ready; i++) {
    const s = await get(container.id, { fields: 'status_code' }, tok)
    if (s.status_code === 'FINISHED') ready = true
    else if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') {
      throw new Error(`Instagram non ha elaborato il ${mediaType === 'video' ? 'video' : 'file'} (${s.status_code})`)
    } else await sleep(wait)
  }
  if (!ready) throw new Error('Instagram ci sta mettendo troppo a elaborare il file: riprova fra qualche minuto')

  const published = await post(`${meta.igUserId}/media_publish`, { creation_id: container.id, access_token: tok })
  const link = await get(published.id, { fields: 'permalink' }, tok)
  return { id: published.id, url: link.permalink || null }
}

/** Video su Facebook in tre tempi: start → upload dal nostro URL (file_url) → finish. */
async function uploadFacebookVideo(edge, mediaUrl, tok, fetchImpl) {
  const { post } = graph(fetchImpl)
  const start = await post(edge, { upload_phase: 'start', access_token: tok })
  const uploadUrl = start.upload_url || `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${start.video_id}`
  const res = await fetchImpl(uploadUrl, { method: 'POST', headers: { Authorization: `OAuth ${tok}`, file_url: mediaUrl } })
  const up = await res.json().catch(() => ({}))
  if (!res.ok || up.error || up.success === false) {
    throw new Error(`Facebook: caricamento del video non riuscito (${up.error?.message || res.status})`)
  }
  return start.video_id
}

/** Pagina Facebook: post (foto o video), reel (video), storia (foto o video). */
export async function publishFacebook(meta, { format, mediaType, mediaUrl, caption }, { fetchImpl = fetch } = {}) {
  if (!meta?.pageId) throw new Error('Nessuna Pagina Facebook collegata')
  const { post } = graph(fetchImpl)
  const tok = meta.pageToken
  const page = meta.pageId

  if (format === 'post') {
    if (mediaType === 'image') {
      const r = await post(`${page}/photos`, { url: mediaUrl, caption, access_token: tok })
      const postId = r.post_id || r.id
      return { id: postId, url: `https://www.facebook.com/${postId}` }
    }
    const r = await post(`${page}/videos`, { file_url: mediaUrl, description: caption, access_token: tok })
    return { id: r.id, url: `https://www.facebook.com/${page}/videos/${r.id}` }
  }
  if (format === 'reel') {
    if (mediaType !== 'video') throw new Error('Il reel vuole un video')
    const videoId = await uploadFacebookVideo(`${page}/video_reels`, mediaUrl, tok, fetchImpl)
    await post(`${page}/video_reels`, { upload_phase: 'finish', video_id: videoId, video_state: 'PUBLISHED', description: caption, access_token: tok })
    return { id: videoId, url: `https://www.facebook.com/reel/${videoId}` }
  }
  if (format === 'story') {
    if (mediaType === 'image') {
      const photo = await post(`${page}/photos`, { url: mediaUrl, published: false, access_token: tok })
      const r = await post(`${page}/photo_stories`, { photo_id: photo.id, access_token: tok })
      return { id: r.post_id || photo.id, url: null }
    }
    const videoId = await uploadFacebookVideo(`${page}/video_stories`, mediaUrl, tok, fetchImpl)
    const r = await post(`${page}/video_stories`, { upload_phase: 'finish', video_id: videoId, access_token: tok })
    return { id: r.post_id || videoId, url: null }
  }
  throw new Error(`Formato Facebook non supportato: ${format}`)
}
