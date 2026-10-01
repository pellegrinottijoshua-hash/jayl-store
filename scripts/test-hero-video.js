#!/usr/bin/env node
// Video della home (src/lib/heroVideo.js):
// 1. quale video usa un pezzo del drop — quello dedicato del tab Drop
//    (heroVideos), altrimenti il video hero della scheda;
// 2. quale porzione del fotogramma finisce su ogni striscia del cilindro
//    mobile: lo stesso ritaglio (object-fit: cover, posizione 50% 30%) della
//    foto che sostituisce, altrimenti girando da foto a video l'immagine
//    salterebbe.
//
// Run: node scripts/test-hero-video.js

import assert from 'node:assert'
import { heroVideoSrc, homeVideoSrc, stripSourceRect } from '../src/lib/heroVideo.js'

let passed = 0
const check = (name, fn) => {
  try { fn(); passed++ } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exit(1) }
}

const product = { id: 'p1', videoUrl: '/images/p1/hero.mp4' }

check('video dedicato del drop prima del video della scheda', () => {
  assert.strictEqual(homeVideoSrc({ heroVideos: { p1: '/images/p1/home-1.mp4' } }, product), '/images/p1/home-1.mp4')
  assert.strictEqual(homeVideoSrc({ heroVideos: {} }, product), '/images/p1/hero.mp4')
  assert.strictEqual(homeVideoSrc(null, product), '/images/p1/hero.mp4')
  assert.strictEqual(homeVideoSrc({ heroVideos: { p1: '/images/p1/x.jpg' } }, product), '/images/p1/hero.mp4', 'un non-mp4 non conta')
  assert.strictEqual(homeVideoSrc({}, { id: 'p2', videoUrl: 'https://youtube.com/watch?v=x' }), null)
  assert.strictEqual(heroVideoSrc({ videoUrl: ' /a.MP4 ' }), '/a.MP4')
})

check('striscia: stesso ritaglio cover della foto, dentro il fotogramma', () => {
  // Video 9:16 (720×1292) in una scheda 0,61 (250×410): più largo che alto
  // rispetto al video → si scala sulla larghezza e si taglia sopra e sotto.
  const W = 250, H = 410, n = 16
  const first = stripSourceRect({ videoW: 720, videoH: 1292, W, H, x: 0, w: W / n })
  assert.ok(Math.abs(first.sx) < 1e-9, 'la prima striscia parte dal bordo sinistro')
  assert.ok(first.sy > 0, 'si taglia un po\' in alto (posizione 30%)')
  assert.ok(first.sy + first.sh <= 1292 + 1e-6, 'non esce dal fotogramma in basso')
  const last = stripSourceRect({ videoW: 720, videoH: 1292, W, H, x: W - W / n, w: W / n })
  assert.ok(Math.abs(last.sx + last.sw - 720) < 1e-6, 'l\'ultima striscia finisce sul bordo destro')
  // Taglio in alto ≈ 30% del totale tagliato (object-position 50% 30%).
  const cut = 1292 - first.sh
  assert.ok(Math.abs(first.sy - cut * 0.3) < 1e-6)
})

console.log(`✓ hero-video: ${passed} controlli passati`)
