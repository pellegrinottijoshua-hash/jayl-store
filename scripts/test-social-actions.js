#!/usr/bin/env node
// Azioni del server della pubblicazione rapida — api/_lib/socialActions.js.
// Store in memoria, social e generatore AI finti: qui si verificano le regole
// che proteggono da un post sbagliato o da un testo ripetuto.
//
// Run: node scripts/test-social-actions.js

import assert from 'node:assert'
import { handleSocialAction } from '../api/_lib/socialActions.js'
import { emptySocial, addCaptions } from '../src/lib/socialPool.js'

let passed = 0
const checks = []
const check = (name, fn) => checks.push([name, fn])

const PRODUCT = {
  id: 'shiny-charizard', name: 'Shiny Charizard T-Shirt', description: 'Back print.', collection: 'cool pokemon back',
  pinterestPins: [
    { title: 'Pin già fatto', description: 'old', tags: ['a'], published: true },
    { title: 'Pin nuovo', description: 'fresh pin', tags: ['charizard', 'retro'] },
  ],
}
const ASSET_IMG = '/images/shiny-charizard/hf_20260930_1.png'
const ASSET_VID = '/images/shiny-charizard/hero.mp4'

function memStore(initial = emptySocial()) {
  let state = structuredClone(initial)
  const writes = []
  return {
    read: async () => ({ state: structuredClone(state), sha: 'sha' }),
    update: async (mutate, message) => { state = mutate(structuredClone(state)); writes.push(message); return structuredClone(state) },
    get state() { return state },
    writes,
  }
}

function deps({ store = memStore(), connected = ['instagram', 'facebook', 'pinterest'], adapter, generate, exists = () => true } = {}) {
  const calls = { adapter: [], generate: [] }
  const ok = async (args) => { calls.adapter.push(args); return { id: 'POST1', url: 'https://social/post/1' } }
  return {
    calls,
    store,
    d: {
      products: [PRODUCT],
      siteUrl: 'https://www.jayl.store',
      store,
      generate: async (args) => { calls.generate.push(args); return (generate || (() => [{ title: 'Gen', text: 'generated text', tags: ['x'] }]))(args) },
      urlExists: async (url) => exists(url),
      status: async () => ({ platforms: Object.fromEntries(['pinterest', 'instagram', 'facebook', 'x', 'tiktok', 'youtube']
        .map((k) => [k, { mode: connected.includes(k) ? 'api' : 'manual' }])) }),
      adapters: { instagram: adapter || ok, facebook: adapter || ok, pinterest: adapter || ok },
      listAssets: async () => ({ 'shiny-charizard': ['hf_20260930_1.png', 'hero.mp4', 'shiny-charizard-black-01.jpg'] }),
    },
  }
}

const withCaptions = () => memStore(addCaptions(emptySocial(), 'shiny-charizard', 'instagram', [
  { title: 'A', text: 'first', tags: ['pokemon'] },
  { title: 'B', text: 'second', tags: [] },
], '2026-09-30T10:00:00.000Z'))

check('publish senza captionId: primo testo non usato, JPEG del sito, segnato e loggato', async () => {
  const store = withCaptions()
  const { d, calls } = deps({ store })
  const r = await handleSocialAction({ action: 'publish', productId: 'shiny-charizard', asset: ASSET_IMG, platform: 'instagram', format: 'post' }, d)
  assert.strictEqual(r.status, 200, JSON.stringify(r.json))
  assert.strictEqual(calls.adapter.length, 1)
  const a = calls.adapter[0]
  assert.strictEqual(a.mediaUrl, 'https://www.jayl.store/_img/ig/images/shiny-charizard/hf_20260930_1.png.jpg')
  assert.strictEqual(a.text, 'first\n\n#pokemon')
  assert.strictEqual(a.link, 'https://www.jayl.store/product/shiny-charizard?utm_source=instagram&utm_medium=social&utm_content=post')
  const pool = store.state.captions['shiny-charizard'].instagram
  assert.ok(pool[0].usedAt, 'il testo usato è segnato')
  assert.strictEqual(pool[1].usedAt, null)
  assert.strictEqual(store.state.log.at(-1).mode, 'api')
  assert.strictEqual(store.state.log.at(-1).postId, 'POST1')
  assert.ok(store.writes.every((m) => !/skip ci/.test(m)), 'il [skip ci] lo aggiunge lo store, non le azioni')
})

check('pubblicazione fallita: testo NON segnato, nessuna scrittura', async () => {
  const store = withCaptions()
  const { d } = deps({ store, adapter: async () => { throw new Error('Meta: permesso mancante (#10)') } })
  const r = await handleSocialAction({ action: 'publish', productId: 'shiny-charizard', asset: ASSET_IMG, platform: 'instagram', format: 'post' }, d)
  assert.strictEqual(r.status, 502)
  assert.match(r.json.error, /permesso mancante/)
  assert.strictEqual(store.state.captions['shiny-charizard'].instagram[0].usedAt, null)
  assert.strictEqual(store.writes.length, 0)
})

check('asset fuori dalla cartella, con .., copia Gelato o formato incompatibile → 400', async () => {
  const { d, calls } = deps({ store: withCaptions() })
  const bad = [
    { asset: '/images/altro-prodotto/hf_1.png', format: 'post' },
    { asset: '/images/shiny-charizard/../segreto/hf_1.png', format: 'post' },
    { asset: '/images/shiny-charizard/shiny-charizard-black-01.jpg', format: 'post' },
    { asset: ASSET_IMG, format: 'reel' },
    { asset: 'https://evil.example/x.png', format: 'post' },
  ]
  for (const b of bad) {
    const r = await handleSocialAction({ action: 'publish', productId: 'shiny-charizard', platform: 'instagram', ...b }, d)
    assert.strictEqual(r.status, 400, `${b.asset} ${b.format}`)
  }
  const r = await handleSocialAction({ action: 'publish', productId: 'non-esiste', asset: ASSET_IMG, platform: 'instagram', format: 'post' }, d)
  assert.strictEqual(r.status, 404)
  assert.strictEqual(calls.adapter.length, 0)
})

check('social non collegato → 409, niente pubblicazione', async () => {
  const { d, calls } = deps({ store: withCaptions(), connected: ['pinterest'] })
  const r = await handleSocialAction({ action: 'publish', productId: 'shiny-charizard', asset: ASSET_IMG, platform: 'instagram', format: 'post' }, d)
  assert.strictEqual(r.status, 409)
  assert.strictEqual(calls.adapter.length, 0)
})

check('Instagram senza il JPEG nel sito → 409 (si aspetta il deploy)', async () => {
  const { d, calls } = deps({ store: withCaptions(), exists: (u) => !u.includes('/_img/ig/') })
  const r = await handleSocialAction({ action: 'publish', productId: 'shiny-charizard', asset: ASSET_IMG, platform: 'instagram', format: 'post' }, d)
  assert.strictEqual(r.status, 409)
  assert.match(r.json.error, /deploy/)
  assert.strictEqual(calls.adapter.length, 0)
})

check('storia: niente testo, captionId nullo; video servito dal sito', async () => {
  const store = withCaptions()
  const { d, calls } = deps({ store })
  const r = await handleSocialAction({ action: 'publish', productId: 'shiny-charizard', asset: ASSET_VID, platform: 'instagram', format: 'story' }, d)
  assert.strictEqual(r.status, 200, JSON.stringify(r.json))
  assert.strictEqual(calls.adapter[0].text, '')
  assert.strictEqual(calls.adapter[0].mediaUrl, 'https://www.jayl.store/images/shiny-charizard/hero.mp4')
  assert.strictEqual(store.state.log.at(-1).captionId, null)
  assert.ok(store.state.captions['shiny-charizard'].instagram.every((c) => !c.usedAt))
})

check('caption: pool vuoto → genera una volta, evitando i testi già scritti', async () => {
  const store = memStore(addCaptions(emptySocial(), 'shiny-charizard', 'facebook', [{ title: 'Old', text: 'already used text', tags: [] }], 't'))
  store.state.captions['shiny-charizard'].facebook[0].usedAt = 't'
  const { d, calls } = deps({ store })
  const r = await handleSocialAction({ action: 'caption', productId: 'shiny-charizard', platform: 'facebook' }, d)
  assert.strictEqual(r.status, 200, JSON.stringify(r.json))
  assert.strictEqual(r.json.caption.text, 'generated text')
  assert.strictEqual(calls.generate.length, 1)
  assert.deepStrictEqual(calls.generate[0].avoid, ['already used text'])
  assert.strictEqual(r.json.unused, 1)
})

check('caption Pinterest: il primo rifornimento parte dai pin non pubblicati', async () => {
  const { d, calls } = deps()
  const r = await handleSocialAction({ action: 'caption', productId: 'shiny-charizard', platform: 'pinterest' }, d)
  assert.strictEqual(r.status, 200, JSON.stringify(r.json))
  assert.strictEqual(r.json.caption.title, 'Pin nuovo')
  assert.strictEqual(r.json.caption.text, 'fresh pin')
  assert.strictEqual(calls.generate.length, 0)
})

check('mark-used e assets per l\'agente', async () => {
  const store = withCaptions()
  const { d } = deps({ store })
  const id = store.state.captions['shiny-charizard'].instagram[1].id
  const m = await handleSocialAction({ action: 'mark-used', productId: 'shiny-charizard', asset: ASSET_IMG, platform: 'x', format: 'post', captionId: null }, d)
  assert.strictEqual(m.status, 200)
  assert.strictEqual(store.state.log.at(-1).mode, 'manual')
  const m2 = await handleSocialAction({ action: 'mark-used', productId: 'shiny-charizard', asset: ASSET_IMG, platform: 'instagram', format: 'post', captionId: id }, d)
  assert.strictEqual(m2.status, 200)
  assert.ok(store.state.captions['shiny-charizard'].instagram[1].usedAt)

  const a = await handleSocialAction({ action: 'assets' }, d)
  assert.strictEqual(a.status, 200)
  const p = a.json.products.find((x) => x.productId === 'shiny-charizard')
  assert.deepStrictEqual(p.assets.map((x) => x.src), [ASSET_VID, ASSET_IMG], 'video prima, niente copie Gelato')
  assert.strictEqual(p.unused.instagram, 1)
})

check('azione sconosciuta → 400', async () => {
  const { d } = deps()
  const r = await handleSocialAction({ action: 'boh' }, d)
  assert.strictEqual(r.status, 400)
})

for (const [name, fn] of checks) {
  try { await fn(); passed++ } catch (e) { console.error(`✗ ${name}\n  ${e.stack}`); process.exit(1) }
}
console.log(`✓ social-actions: ${passed} controlli passati`)
