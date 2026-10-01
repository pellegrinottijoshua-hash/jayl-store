#!/usr/bin/env node
// Verifica le foto WebP generate alla build (scripts/optimize-images.js):
//
// 1. lo schema degli URL è reversibile — l'email del carrello abbandonato
//    risale all'originale con originalImage();
// 2. sull'intero catalogo del sito, ogni foto WebP finisce allo STESSO colore
//    dell'originale. colorImageMatch legge il colore dallo slug nel path: se
//    lo schema lo perdesse o ne aggiungesse uno, lo swatch salterebbe sulla
//    foto sbagliata solo in produzione, dove le foto sono WebP;
// 3. la regex che riscrive drop.js prende le foto, anche raw GitHub, e non
//    tocca il resto.
//
// Run: node scripts/test-optimized-image.js

import assert from 'node:assert'
import { adminProducts } from '../src/data/admin-products.js'
import { drop } from '../src/data/drop.js'
import { buildImageOwnership } from '../src/lib/colorImageMatch.js'
import { optimizedPath, originalImage } from '../src/lib/optimizedImage.js'
import { IMAGE_LITERAL } from './optimize-images.js'

let passed = 0
const check = (name, fn) => {
  try { fn(); passed++ } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exit(1) }
}

check('lo schema degli URL è reversibile', () => {
  const p = '/images/cool-snorlax/foto-heather-navy-01.png'
  assert.strictEqual(optimizedPath(p), '/_img/images/cool-snorlax/foto-heather-navy-01.png.webp')
  assert.strictEqual(originalImage(optimizedPath(p)), p)
  // Tutto il resto passa intatto.
  for (const u of ['/images/a.png', 'https://raw.githubusercontent.com/o/r/main/public/images/a.jpg', '/_img/x.png', null, undefined]) {
    assert.strictEqual(originalImage(u), u)
  }
})

check('varianti social: miniatura WebP e JPEG per Instagram, reversibili', () => {
  const p = '/images/cool-snorlax/hf_20260626_1.png'
  assert.strictEqual(optimizedPath(p, 'thumb'), '/_img/thumb/images/cool-snorlax/hf_20260626_1.png.webp')
  assert.strictEqual(optimizedPath(p, 'ig'), '/_img/ig/images/cool-snorlax/hf_20260626_1.png.jpg')
  assert.strictEqual(originalImage(optimizedPath(p, 'thumb')), p)
  assert.strictEqual(originalImage(optimizedPath(p, 'ig')), p)
  assert.strictEqual(originalImage(optimizedPath(p)), p)
})

check('ogni foto WebP resta del colore dell\'originale, su tutto il catalogo', () => {
  const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])
  const RAW = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/main\/public(?=\/)/
  let compared = 0
  for (const p of adminProducts.filter((x) => visible.has(x.id) && x.colors?.length && x.images?.length)) {
    const before = buildImageOwnership(p.colors, p.images)
    const webp = p.images.map((u) => optimizedPath(u.replace(RAW, '')))
    const after = buildImageOwnership(p.colors, webp)
    p.images.forEach((u, i) => {
      assert.strictEqual(after.get(webp[i])?.id ?? null, before.get(u)?.id ?? null, `${p.id}: ${u}`)
      compared++
    })
  }
  assert.ok(compared > 0, 'nessuna foto confrontata: il catalogo visibile è vuoto?')
})

check('la regex di drop.js prende le foto e basta', () => {
  const src = `{"a":"/images/x/hero.png","b":"https://raw.githubusercontent.com/o/r/main/public/images/y.JPG","c":"/fonts/f.woff2","d":"drop-05"}`
  const found = [...src.matchAll(IMAGE_LITERAL)].map((m) => m[1])
  assert.deepStrictEqual(found, ['/images/x/hero.png', 'https://raw.githubusercontent.com/o/r/main/public/images/y.JPG'])
})

console.log(`✓ optimized-image: ${passed} controlli passati`)
