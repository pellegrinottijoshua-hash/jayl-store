#!/usr/bin/env node
/**
 * Importa da Gelato fronte e colletto delle maglie back-print, per colore.
 *
 * L'API di Gelato restituisce le "Product images" spuntate nel pannello
 * Gelato, senza dire quale e' fronte, retro o dettaglio. Si riconoscono dai
 * pixel:
 *   - tessuto fino ai bordi laterali            → colletto (inquadratura stretta)
 *   - stampa grande al centro                    → retro (gia' sul sito, salta)
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
import { MOCKUP_RGB } from './mockup-colors.js'
import { colorToSlug } from '../src/lib/colorImageMatch.js'

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
const allCollars = [] // { product, file, rgb } — per lo stampo (sotto)

// Quanta parte del centro si stacca dal colore del tessuto (letto sul fondo
// della maglia): una stampa grande ne copre molta, l'etichetta del colletto
// poca, un fronte liscio niente.
async function fabricOf(buf) {
  const { data } = await sharp(buf).removeAlpha().resize(48, 48, { fit: 'fill' }).extract({ left: 18, top: 30, width: 12, height: 6 }).raw().toBuffer({ resolveWithObject: true })
  return [0, 1, 2].map((c) => { const v = []; for (let i = c; i < data.length; i += 3) v.push(data[i]); return v.sort((a, b) => a - b)[v.length >> 1] })
}

async function kindOf(buf) {
  const N = 48
  const { data } = await sharp(buf).removeAlpha().resize(N, N, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  const px = (x, y) => { const i = (y * N + x) * 3; return [data[i], data[i + 1], data[i + 2]] }
  // Colletto: e' l'unica inquadratura in cui il tessuto arriva ai bordi
  // laterali (sotto le spalle fronte e retro hanno fondo bianco ai lati).
  // Vale per ogni colore: l'etichetta nera su una maglia scura non si
  // stacca dal tessuto, quindi il test sulla stampa non basta.
  const isWhite = (c) => c.every((v) => v > 225)
  const edges = [px(1, 28), px(46, 28), px(1, 32), px(46, 32)]
  if (edges.filter((c) => !isWhite(c)).length >= 3) return 'collar'
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
  // Colletto bianco su fondo bianco: i bordi non aiutano, lo dice l'etichetta.
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
    const out = await sharp(buf).resize(1400, 1400, { fit: 'inside' }).jpeg({ quality: 86 }).toBuffer()
    fs.writeFileSync(path.join(dir, name), out)
    added.push(`/images/${p.id}/${name}`)
    if (kind === 'collar') allCollars.push({ product: p, file: path.join(dir, name), rgb: await fabricOf(out), added })
  }
  p.images = [...(p.images || []).filter((u) => !IMPORTED.test(u) && !/-front-gelato-\d+\./.test(u)), ...added]
  console.log(`${p.id.slice(0, 44).padEnd(44)} front ${count.front}  collar ${count.collar}  back ${count.back}`)
}

// ── Un colletto per ogni colore ────────────────────────────────────────────
// Gelato espone un solo dettaglio colletto per prodotto (quasi sempre
// bianco). Tutti i suoi render del colletto hanno la stessa inquadratura e la
// stessa luce, quindi da uno scuro si ricava lo stampo — dove sta il tessuto,
// com'e' ombreggiato, dove sta l'etichetta — e lo si ricolora con il colore
// esatto che Gelato usa per ogni tessuto (MOCKUP_RGB, misurato al pixel).
// Il colletto vero di Gelato, se c'e' per quel colore, resta quello.
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const template = allCollars.find((c) => lum(...c.rgb) < 90)
if (template) {
  const img = sharp(template.file).removeAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const fL = lum(...template.rgb)
  const W = info.width, H = info.height
  // L'etichetta JAYL e' sempre nera. Dove sta la si legge da un colletto
  // bianco vero (nero su bianco, inequivocabile), allineato allo stampo.
  const whiteRef = allCollars.find((c) => lum(...c.rgb) > 200)
  let labelMask = null
  if (whiteRef) {
    const { data: w } = await sharp(whiteRef.file).removeAlpha().resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true })
    labelMask = w.map((v) => (v < 110 ? 1 : 0))
  }
  for (const p of targets) {
    const mine = allCollars.filter((c) => c.product === p)
    const has = new Set(mine.map((c) => nearest(c.rgb)))
    const dir = path.join(ROOT, 'public/images', p.id)
    const slug = (p.name || p.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    let n = mine.length
    for (const c of p.colors || []) {
      const rgb = MOCKUP_RGB[colorToSlug(c.id)]
      if (!rgb || has.has(colorToSlug(c.id))) continue
      const out = Buffer.alloc(data.length)
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const L = lum(r, g, b)
        const isBg = r > 225 && g > 225 && b > 225
        const isLabel = labelMask ? labelMask[i / 3] === 1 : (!isBg && L < fL * 0.55)
        if (isLabel) { out[i] = 17; out[i + 1] = 17; out[i + 2] = 17; continue }
        if (isBg) { out[i] = r; out[i + 1] = g; out[i + 2] = b; continue }
        const k = Math.min(1.25, L / fL)
        out[i] = Math.min(255, rgb[0] * k); out[i + 1] = Math.min(255, rgb[1] * k); out[i + 2] = Math.min(255, rgb[2] * k)
      }
      n++
      const name = `${slug}-collar-${String(n).padStart(2, '0')}.jpg`
      await sharp(out, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 86 }).toFile(path.join(dir, name))
      p.images.push(`/images/${p.id}/${name}`)
    }
  }
}
function nearest(rgb) {
  let best = null
  for (const [k, v] of Object.entries(MOCKUP_RGB)) {
    const d = Math.hypot(v[0] - rgb[0], v[1] - rgb[1], v[2] - rgb[2])
    if (!best || d < best.d) best = { k, d }
  }
  return best.k
}

fs.writeFileSync(FILE, `// This file is managed by the JAYL admin panel. Do not edit manually.\nexport const adminProducts = ${JSON.stringify(products, null, 2)}\n`)
