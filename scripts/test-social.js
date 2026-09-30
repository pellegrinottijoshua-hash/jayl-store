#!/usr/bin/env node
// Pubblicazione social rapida — la parte pura, condivisa fra admin e API
// (docs/superpowers/specs/2026-09-30-social-publish-design.md):
//
// 1. quali file di un prodotto sono asset da pubblicare (tutto tranne le
//    copie dei mockup Gelato);
// 2. quali formati accetta ogni social per un'immagine o un video;
// 3. il pool dei testi: si pesca il primo mai usato, "altro testo" gira, e
//    segnare un testo come usato non tocca lo stato di partenza;
// 4. il testo composto per ogni social (hashtag, limiti di lunghezza, UTM).
//
// Run: node scripts/test-social.js

import assert from 'node:assert'
import { isGelatoCopy } from '../src/lib/gelatoPool.js'
import { isSocialAsset, mediaTypeOf } from '../src/lib/socialAssets.js'
import {
  PLATFORMS, platformOf, formatsFor, composeText, productLink, manualUrl,
} from '../src/lib/socialPlatforms.js'
import {
  emptySocial, nextCaption, unusedCount, addCaptions, markUsed,
} from '../src/lib/socialPool.js'
import { buildCaptionPrompt } from '../api/_lib/socialCaptions.js'

let passed = 0
const check = (name, fn) => {
  try { fn(); passed++ } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exit(1) }
}

// ── Asset ────────────────────────────────────────────────────────────────────
check('asset: foto caricate, video, hero e generate sì; copie Gelato no', () => {
  for (const f of ['hf_20260829_174020_a3.png', 'hero.mp4', 'hero-1727700000000.mp4', 'generated/mood-1.png', 'lifestyle.jpg'])
    assert.ok(isSocialAsset(f), f)
  for (const f of ['gyarados-back-print-shirt-heather-navy-01.jpg', 'titolo-gelato-02.jpg', 'titolo-mockup-01.png', '_videos.json', 'notes.txt'])
    assert.ok(!isSocialAsset(f), f)
  // Le NBP hf_… con un numero finale non sono copie Gelato.
  assert.ok(!isGelatoCopy('hf_shot-01.png'))
  assert.strictEqual(mediaTypeOf('/images/x/hero.mp4'), 'video')
  assert.strictEqual(mediaTypeOf('/images/x/a.PNG'), 'image')
})

// ── Formati ──────────────────────────────────────────────────────────────────
check('formati coerenti col media', () => {
  assert.deepStrictEqual(formatsFor('instagram', 'image'), ['post', 'story'])
  assert.deepStrictEqual(formatsFor('instagram', 'video'), ['reel', 'story'])
  assert.deepStrictEqual(formatsFor('facebook', 'video'), ['post', 'reel', 'story'])
  assert.deepStrictEqual(formatsFor('pinterest', 'video'), [])
  assert.deepStrictEqual(formatsFor('youtube', 'image'), [])
  assert.deepStrictEqual(formatsFor('nessuno', 'image'), [])
  assert.ok(PLATFORMS.every((p) => p.key && p.label && p.short && p.color))
  assert.strictEqual(platformOf('x').label, 'X')
})

// ── Pool ─────────────────────────────────────────────────────────────────────
const NOW = '2026-09-30T12:00:00.000Z'
const base = addCaptions(emptySocial(), 'p1', 'instagram', [
  { title: 'A', text: 'uno', tags: ['a'] },
  { title: 'B', text: 'due', tags: ['b'] },
  { title: 'C', text: 'tre', tags: ['c'] },
], NOW)

check('il pool pesca il primo non usato e "altro testo" gira', () => {
  const [a, b, c] = base.captions.p1.instagram
  assert.ok(a.id && b.id && a.id !== b.id, 'ogni testo ha un id suo')
  assert.strictEqual(nextCaption(base, 'p1', 'instagram').id, a.id)
  assert.strictEqual(nextCaption(base, 'p1', 'instagram', a.id).id, b.id)
  assert.strictEqual(nextCaption(base, 'p1', 'instagram', c.id).id, a.id, 'dopo l\'ultimo riparte dal primo')
  assert.strictEqual(unusedCount(base, 'p1', 'instagram'), 3)
  assert.strictEqual(nextCaption(base, 'p1', 'facebook'), null)
  assert.strictEqual(nextCaption(base, 'nessuno', 'instagram'), null)
})

check('segnare usato: usedAt + riga di log, stato di partenza intatto', () => {
  const [a, b] = base.captions.p1.instagram
  const after = markUsed(base, {
    productId: 'p1', platform: 'instagram', format: 'post', captionId: a.id,
    asset: '/images/p1/hf_1.png', mode: 'api', postId: '123', url: 'https://instagram.com/p/x',
  }, NOW)
  assert.strictEqual(after.captions.p1.instagram[0].usedAt, NOW)
  assert.strictEqual(base.captions.p1.instagram[0].usedAt, null, 'lo stato di partenza non cambia')
  assert.strictEqual(nextCaption(after, 'p1', 'instagram').id, b.id)
  assert.strictEqual(nextCaption(after, 'p1', 'instagram', b.id).id, base.captions.p1.instagram[2].id)
  assert.strictEqual(unusedCount(after, 'p1', 'instagram'), 2)
  assert.strictEqual(after.log.length, 1)
  assert.deepStrictEqual(
    { ...after.log[0], at: undefined },
    { at: undefined, productId: 'p1', platform: 'instagram', format: 'post', captionId: a.id,
      asset: '/images/p1/hf_1.png', mode: 'api', postId: '123', url: 'https://instagram.com/p/x' },
  )
})

check('tutti usati → nessun testo', () => {
  let s = base
  for (const c of base.captions.p1.instagram) s = markUsed(s, { productId: 'p1', platform: 'instagram', captionId: c.id }, NOW)
  assert.strictEqual(nextCaption(s, 'p1', 'instagram'), null)
  assert.strictEqual(unusedCount(s, 'p1', 'instagram'), 0)
})

// ── Testo composto e link ────────────────────────────────────────────────────
check('testo per social: hashtag, limiti, UTM', () => {
  const cap = { title: 'Title', text: 'Some text', tags: ['pokemon', 'retro anime', '#streetwear'] }
  assert.strictEqual(composeText('instagram', cap), 'Some text\n\n#pokemon #retroanime #streetwear')
  const long = { title: 't', text: 'x'.repeat(400), tags: ['a', 'b'] }
  assert.ok(composeText('x', long).length <= 250, 'X lascia spazio al link')
  const link = productLink('shiny-charizard', 'instagram', 'reel')
  assert.strictEqual(link, 'https://www.jayl.store/product/shiny-charizard?utm_source=instagram&utm_medium=social&utm_content=reel')
  const x = manualUrl('x', { text: 'ciao', link })
  assert.ok(x.startsWith('https://x.com/intent/tweet?') && x.includes('text=ciao') && x.includes(encodeURIComponent(link)))
})

// ── Prompt dei testi ─────────────────────────────────────────────────────────
check('prompt: stile del social, niente "drop" né prezzi, testi da evitare', () => {
  const prompt = buildCaptionPrompt({
    product: { id: 'p1', name: 'Shiny Charizard T-Shirt', description: 'Back print.', collection: 'cool pokemon back' },
    platform: 'pinterest', count: 5, avoid: ['Old caption one'],
  })
  assert.ok(/Pinterest/.test(prompt))
  assert.ok(/Shiny Charizard/.test(prompt))
  assert.ok(/never.*"drop"/i.test(prompt), 'vieta la parola drop')
  assert.ok(/price/i.test(prompt), 'vieta i prezzi')
  assert.ok(prompt.includes('Old caption one'))
  assert.ok(/exactly 5/.test(prompt))
})

console.log(`✓ social: ${passed} controlli passati`)
