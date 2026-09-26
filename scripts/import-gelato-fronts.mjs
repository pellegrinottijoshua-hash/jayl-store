#!/usr/bin/env node
/**
 * Importa da Gelato fronte e colletto delle maglie back-print, per colore.
 *
 * L'API di Gelato restituisce le "Product images" spuntate nel pannello
 * Gelato, senza dire quale e' fronte, retro o dettaglio. Si riconoscono dai
 * pixel:
 *   - stampa grande al centro                 → retro (gia' sul sito, salta)
 *   - solo l'etichetta JAYL staccata dal tessuto → colletto
 *   - centro tutto del colore del tessuto        → fronte
 * e si salvano come "{slug}-front-NN.jpg" / "{slug}-collar-NN.jpg": il
 * nome dice il tipo (ProductPage li mette in fila fronte/retro/colletto), il
 * colore lo legge il build dai pixel (scripts/mockup-colors.js).
 *
 * Idempotente: rilanciarlo sostituisce i fronti/colletti gia' importati.
 * Usa l'endpoint pubblico /api/get-product-variants di produzione, quindi
 * non servono chiavi in locale.
 *
 * Uso: node scripts/import-gelato-fronts.mjs [--all] [productId…]
 *      senza argomenti: le maglie back visibili in negozio (drop + archivio).
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { drop } from '../src/data/drop.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const FILE = path.join(ROOT, 'src/data/admin-products.js')
const API  = 'https://jayl.store/api/get-product-variants?productId='

const args = process.argv.slice(2)
const all  = args.includes('--all')
const only = args.filter((a) => !a.startsWith('--'))

const raw = fs.readFileSync(FILE, 'utf8')
const products = JSON.parse(raw.match(/=\s*(\[[\s\S]*\])\s*$/)[1])
const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])

const IMPORTED = /-(front|collar)-\d+\.jpg$/

// Quanta parte del centro si stacca dal colore del tessuto (letto sul fondo
// della maglia): una stampa grande ne copre molta, l'etichetta del colletto
// poca, un fronte liscio niente.
async function kindOf(buf) {
  const N = 48
  const { data } = await sharp(buf).removeAlpha().resize(N, N, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  const px = (x, y) => { const i = (y * N + x) * 3; return [data[i], data[i + 1], data[i + 2]] }
  const fabric = [0, 1, 2].map((c) => {
    const v = []
    for (let x = 18; x < 30; x++) for (let y = 36; y < 40; y++) v.push(px(x, y)[c])
    return v.sort((a, b) => a - b)[v.length >> 1]
  })
  let off = 0, n = 0
  for (let y = 10; y < 32; y++) for (let x = 12; x < 36; x++) {
    const p = px(x, y); n++
    if (Math.hypot(p[0] - fabric[0], p[1] - fabric[1], p[2] - fabric[2]) > 60) off++
  }
  const f = off / n
  return f > 0.2 ? 'back' : f > 0.015 ? 'collar' : 'front'
}

const targets = products.filter((p) =>
  /back/i.test(p.collection || '') &&
  /^[0-9a-f-]{36}$/i.test(p.gelatoProductId || '') &&
  (only.length ? only.includes(p.id) : all || visible.has(p.id)))

for (const p of targets) {
  const res = await fetch(API + p.gelatoProductId)
  const body = await res.json()
  const dir = path.join(ROOT, 'public/images', p.id)
  fs.mkdirSync(dir, { recursive: true })
  for (const f of fs.readdirSync(dir)) if (IMPORTED.test(f)) fs.unlinkSync(path.join(dir, f))

  const slug = (p.name || p.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const count = { front: 0, collar: 0, back: 0 }
  const added = []
  for (const img of body.images || []) {
    const r = await fetch(img.src)
    if (!r.ok) continue
    const buf = Buffer.from(await r.arrayBuffer())
    const kind = await kindOf(buf)
    count[kind]++
    if (kind === 'back') continue
    const name = `${slug}-${kind}-${String(count[kind]).padStart(2, '0')}.jpg`
    fs.writeFileSync(path.join(dir, name), await sharp(buf).resize(1400, 1400, { fit: 'inside' }).jpeg({ quality: 86 }).toBuffer())
    added.push(`/images/${p.id}/${name}`)
  }
  p.images = [...(p.images || []).filter((u) => !IMPORTED.test(u) && !/-front-gelato-\d+\./.test(u)), ...added]
  console.log(`${p.id.slice(0, 44).padEnd(44)} front ${count.front}  collar ${count.collar}  back ${count.back}`)
}

fs.writeFileSync(FILE, `// This file is managed by the JAYL admin panel. Do not edit manually.\nexport const adminProducts = ${JSON.stringify(products, null, 2)}\n`)
