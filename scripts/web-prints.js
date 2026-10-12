// Versioni leggere dei file di stampa, per i mockup del negozio.
//
// public/designs/ (file 3661x4843, ~400 MB) non va nel deploy: lo toglie
// prune-dist.js. La scheda prodotto pero' appoggia il disegno sui mockup lisci
// (retro dei colori che Gelato non ha renderizzato, fronte con "Front"): per
// quello servono copie piccole. Qui, dopo la build e prima di prune-dist, si
// scrive dist/prints/<id>/back.webp e front.webp (900 px di larghezza).
//
// Se a un prodotto in vendita manca un file di stampa la build si ferma:
// un mockup senza disegno non deve piu' arrivare online (bug del 12/10).

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { adminProducts } from '../src/data/admin-products.js'
import { drop } from '../src/data/drop.js'
import { mainSide } from '../src/lib/printSides.js'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const RAW = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/main\/public/

const live = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])
const errors = []
let written = 0

const local = (url) => (url && RAW.test(url) ? path.join(root, 'public', decodeURIComponent(url.replace(RAW, ''))) : null)

for (const p of adminProducts) {
  const main = mainSide(p)
  if (!main) continue
  const files = { [main]: p.printFileUrl, [main === 'back' ? 'front' : 'back']: p.altPrintFileUrl }
  for (const [side, url] of Object.entries(files)) {
    if (!url) {
      if (side === main && live.has(p.id)) errors.push(`${p.id}: manca il file di stampa (${side})`)
      continue
    }
    const src = local(url)
    if (!src || !fs.existsSync(src)) {
      if (live.has(p.id)) errors.push(`${p.id}: file di stampa ${side} non trovato (${url})`)
      continue
    }
    const out = path.join(dist, 'prints', p.id, `${side}.webp`)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    await sharp(src).resize({ width: 900 }).webp({ quality: 82 }).toFile(out)
    written++
  }
}

if (errors.length) {
  console.error('[web-prints] prodotti in vendita senza disegno:\n  ' + errors.join('\n  '))
  process.exit(1)
}
console.log(`[web-prints] ${written} disegni leggeri in dist/prints/`)
