#!/usr/bin/env node
// Meta (Facebook Page + Instagram) per la pubblicazione rapida — api/_lib/meta.js.
// La Graph API è finta: qui si verifica che il codice capisca da solo che
// token e che id ha ricevuto, e che ogni formato chiami gli endpoint giusti
// con i parametri giusti (le regole sono nella spec del 30/9).
//
// Run: node scripts/test-meta.js

import assert from 'node:assert'
import { resolveMeta, clearMetaCache, publishInstagram, publishFacebook, META_SCOPES } from '../api/_lib/meta.js'

let passed = 0
const checks = []
const check = (name, fn) => checks.push([name, fn])

/** fetch finto: `routes(method, path, params, body, headers)` → JSON di risposta. */
function fakeFetch(routes) {
  const calls = []
  const impl = async (url, opts = {}) => {
    const u = new URL(url)
    const path = u.pathname.replace(/^\/v\d+\.\d+\//, '').replace(/^\/video-upload\/v\d+\.\d+\//, 'rupload/')
    const params = Object.fromEntries(u.searchParams)
    const method = opts.method || 'GET'
    const body = opts.body ? JSON.parse(opts.body) : null
    const call = { method, path, params, body, headers: opts.headers || {} }
    calls.push(call)
    const json = routes(call) ?? { error: { message: `rotta non prevista: ${method} ${path}`, code: 100 } }
    return { ok: !json.error, status: json.error ? 400 : 200, json: async () => json }
  }
  return { impl, calls }
}

const PAGE_FIELDS = 'id,name,access_token,instagram_business_account{id,username}'
const ERR = { error: { message: 'Unsupported get request', code: 100 } }

// ── Risoluzione ──────────────────────────────────────────────────────────────
check('token utente + id Pagina → token di Pagina e Instagram collegato', async () => {
  clearMetaCache()
  const { impl } = fakeFetch(({ method, path, params }) => {
    if (path === 'debug_token') return { data: { type: 'USER', expires_at: 1790000000, scopes: ['pages_manage_posts', 'pages_read_engagement', 'instagram_basic'] } }
    if (method === 'GET' && path === 'PAGE' && params.fields === PAGE_FIELDS) {
      assert.strictEqual(params.access_token, 'USER_TOKEN')
      return { id: 'PAGE', name: 'JAYL', access_token: 'PAGE_TOKEN', instagram_business_account: { id: 'IG', username: 'jayl_store' } }
    }
  })
  const m = await resolveMeta({ env: { FACEBOOK_PAGE_TOKEN: 'USER_TOKEN', FACEBOOK_PAGE_ID: 'PAGE' }, fetchImpl: impl })
  assert.strictEqual(m.ok, true)
  assert.strictEqual(m.pageId, 'PAGE')
  assert.strictEqual(m.pageName, 'JAYL')
  assert.strictEqual(m.pageToken, 'PAGE_TOKEN')
  assert.strictEqual(m.igUserId, 'IG')
  assert.strictEqual(m.igUsername, 'jayl_store')
  assert.strictEqual(m.tokenType, 'USER')
  assert.strictEqual(m.expiresAt, new Date(1790000000 * 1000).toISOString())
  assert.deepStrictEqual(m.missingScopes, ['instagram_content_publish'])
})

check('token di Pagina senza id → /me è la Pagina', async () => {
  clearMetaCache()
  const { impl } = fakeFetch(({ path }) => {
    if (path === 'debug_token') return ERR
    if (path === 'me/accounts') return ERR
    if (path === 'me') return { id: 'PAGE', name: 'JAYL', instagram_business_account: { id: 'IG', username: 'jayl_store' } }
  })
  const m = await resolveMeta({ env: { FACEBOOK_PAGE_TOKEN: 'PAGE_TOKEN' }, fetchImpl: impl })
  assert.strictEqual(m.ok, true)
  assert.strictEqual(m.pageId, 'PAGE')
  assert.strictEqual(m.pageToken, 'PAGE_TOKEN')
  assert.strictEqual(m.igUserId, 'IG')
  assert.strictEqual(m.tokenType, 'PAGE')
  assert.deepStrictEqual(m.missingScopes, [], 'senza debug_token non si inventano permessi mancanti')
})

check('id di un account Instagram → la Pagina si trova da me/accounts', async () => {
  clearMetaCache()
  const { impl } = fakeFetch(({ path, params }) => {
    if (path === 'debug_token') return ERR
    if (path === 'IG' && params.fields === PAGE_FIELDS) return ERR
    if (path === 'IG' && params.fields === 'id,username') return { id: 'IG', username: 'jayl_store' }
    if (path === 'me/accounts') return { data: [
      { id: 'OTHER', name: 'Altra', access_token: 'T2' },
      { id: 'PAGE', name: 'JAYL', access_token: 'PAGE_TOKEN', instagram_business_account: { id: 'IG', username: 'jayl_store' } },
    ] }
  })
  const m = await resolveMeta({ env: { FACEBOOK_PAGE_TOKEN: 'USER_TOKEN', FACEBOOK_PAGE_ID: 'IG' }, fetchImpl: impl })
  assert.strictEqual(m.ok, true)
  assert.strictEqual(m.pageId, 'PAGE')
  assert.strictEqual(m.pageToken, 'PAGE_TOKEN')
  assert.strictEqual(m.igUserId, 'IG')
})

check('senza token → non collegato, nessuna chiamata', async () => {
  clearMetaCache()
  const { impl, calls } = fakeFetch(() => ({}))
  const m = await resolveMeta({ env: {}, fetchImpl: impl })
  assert.strictEqual(m.ok, false)
  assert.match(m.error, /FACEBOOK_PAGE_TOKEN/)
  assert.strictEqual(calls.length, 0)
  assert.ok(META_SCOPES.includes('instagram_content_publish'))
})

// ── Instagram ────────────────────────────────────────────────────────────────
const META = { ok: true, pageId: 'PAGE', pageToken: 'PT', igUserId: 'IG' }
const igRoutes = ({ method, path, params }) => {
  if (method === 'POST' && path === 'IG/media') return { id: 'C1' }
  if (method === 'GET' && path === 'C1' && params.fields === 'status_code') return { status_code: 'FINISHED' }
  if (method === 'POST' && path === 'IG/media_publish') return { id: 'M1' }
  if (method === 'GET' && path === 'M1' && params.fields === 'permalink') return { permalink: 'https://www.instagram.com/p/abc/' }
}
const noSleep = async () => {}

check('IG post: immagine + caption, poi media_publish', async () => {
  const { impl, calls } = fakeFetch(igRoutes)
  const r = await publishInstagram(META, { format: 'post', mediaType: 'image', mediaUrl: 'https://x/a.jpg', caption: 'ciao' }, { fetchImpl: impl, sleep: noSleep })
  assert.deepStrictEqual(r, { id: 'M1', url: 'https://www.instagram.com/p/abc/' })
  const create = calls.find((c) => c.path === 'IG/media')
  assert.deepStrictEqual(create.body, { image_url: 'https://x/a.jpg', caption: 'ciao', access_token: 'PT' })
  assert.deepStrictEqual(calls.find((c) => c.path === 'IG/media_publish').body, { creation_id: 'C1', access_token: 'PT' })
})

check('IG reel e storia video: parametri giusti; reel con un\'immagine rifiutato', async () => {
  const reel = fakeFetch(igRoutes)
  await publishInstagram(META, { format: 'reel', mediaType: 'video', mediaUrl: 'https://x/v.mp4', caption: 'c' }, { fetchImpl: reel.impl, sleep: noSleep })
  assert.deepStrictEqual(reel.calls.find((c) => c.path === 'IG/media').body,
    { media_type: 'REELS', video_url: 'https://x/v.mp4', caption: 'c', share_to_feed: true, access_token: 'PT' })

  const story = fakeFetch(igRoutes)
  await publishInstagram(META, { format: 'story', mediaType: 'video', mediaUrl: 'https://x/v.mp4', caption: 'ignorata' }, { fetchImpl: story.impl, sleep: noSleep })
  assert.deepStrictEqual(story.calls.find((c) => c.path === 'IG/media').body,
    { media_type: 'STORIES', video_url: 'https://x/v.mp4', access_token: 'PT' }, 'le storie non hanno caption')

  await assert.rejects(
    publishInstagram(META, { format: 'reel', mediaType: 'image', mediaUrl: 'https://x/a.jpg' }, { fetchImpl: reel.impl, sleep: noSleep }),
    /video/,
  )
})

check('IG: elaborazione in ERROR → errore chiaro, niente media_publish', async () => {
  const { impl, calls } = fakeFetch((c) => (c.path === 'C1' ? { status_code: 'ERROR' } : igRoutes(c)))
  await assert.rejects(
    publishInstagram(META, { format: 'reel', mediaType: 'video', mediaUrl: 'https://x/v.mp4', caption: 'c' }, { fetchImpl: impl, sleep: noSleep }),
    /ERROR/,
  )
  assert.ok(!calls.some((c) => c.path === 'IG/media_publish'))
})

// ── Facebook ─────────────────────────────────────────────────────────────────
check('FB reel: start → upload col file_url → finish pubblicato', async () => {
  const { impl, calls } = fakeFetch(({ method, path, body }) => {
    if (method === 'POST' && path === 'PAGE/video_reels' && body.upload_phase === 'start') return { video_id: 'V1', upload_url: 'https://rupload.facebook.com/video-upload/v25.0/V1' }
    if (method === 'POST' && path === 'rupload/V1') return { success: true }
    if (method === 'POST' && path === 'PAGE/video_reels' && body.upload_phase === 'finish') return { success: true }
  })
  const r = await publishFacebook(META, { format: 'reel', mediaType: 'video', mediaUrl: 'https://x/v.mp4', caption: 'desc' }, { fetchImpl: impl })
  assert.deepStrictEqual(r, { id: 'V1', url: 'https://www.facebook.com/reel/V1' })
  const up = calls.find((c) => c.path === 'rupload/V1')
  assert.strictEqual(up.headers.file_url, 'https://x/v.mp4')
  assert.strictEqual(up.headers.Authorization, 'OAuth PT')
  assert.deepStrictEqual(calls.at(-1).body,
    { upload_phase: 'finish', video_id: 'V1', video_state: 'PUBLISHED', description: 'desc', access_token: 'PT' })
})

check('FB storia foto: foto non pubblicata → photo_stories', async () => {
  const { impl, calls } = fakeFetch(({ method, path }) => {
    if (method === 'POST' && path === 'PAGE/photos') return { id: 'P1' }
    if (method === 'POST' && path === 'PAGE/photo_stories') return { success: true, post_id: 'S1' }
  })
  const r = await publishFacebook(META, { format: 'story', mediaType: 'image', mediaUrl: 'https://x/a.jpg', caption: 'x' }, { fetchImpl: impl })
  assert.strictEqual(r.id, 'S1')
  assert.deepStrictEqual(calls[0].body, { url: 'https://x/a.jpg', published: false, access_token: 'PT' })
  assert.deepStrictEqual(calls[1].body, { photo_id: 'P1', access_token: 'PT' })
})

check('FB post foto: /photos con caption', async () => {
  const { impl, calls } = fakeFetch(({ path }) => (path === 'PAGE/photos' ? { id: 'P1', post_id: 'PAGE_P1' } : undefined))
  const r = await publishFacebook(META, { format: 'post', mediaType: 'image', mediaUrl: 'https://x/a.jpg', caption: 'ciao' }, { fetchImpl: impl })
  assert.deepStrictEqual(r, { id: 'PAGE_P1', url: 'https://www.facebook.com/PAGE_P1' })
  assert.deepStrictEqual(calls[0].body, { url: 'https://x/a.jpg', caption: 'ciao', access_token: 'PT' })
})

for (const [name, fn] of checks) {
  try { await fn(); passed++ } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exit(1) }
}
console.log(`✓ meta: ${passed} controlli passati`)
