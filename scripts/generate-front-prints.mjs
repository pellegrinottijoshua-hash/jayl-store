#!/usr/bin/env node
/**
 * File di stampa del fronte per le maglie back, dallo stesso disegno.
 *
 * Legge public/designs/<id>/design.png (il retro, disegno grande sul canvas
 * 3661×4843), ritaglia l'arte sul suo alpha e la ricompone piccola sul petto
 * sinistro con la stessa posizione di default delle maglie front
 * (PLACEMENT_SPECS.default in src/lib/printCanvas.js): design-front.png
 * accanto, e altPrintFileUrl sul prodotto. L'admin puo' poi riposizionarla.
 *
 * Non tocca un fronte gia' esistente (riposizionato a mano) salvo --force.
 * Uso: node scripts/generate-front-prints.mjs [--force] [productId…]
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { drop } from '../src/data/drop.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const FILE = path.join(ROOT, 'src/data/admin-products.js')
const CANVAS = { w: 3661, h: 4843 }
const FRONT = { widthPct: 0.35, topPct: 0.02, leftPct: 0.61 } // = PLACEMENT_SPECS.default

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((a) => !a.startsWith('--'))

const products = JSON.parse(fs.readFileSync(FILE, 'utf8').match(/=\s*(\[[\s\S]*\])\s*$/)[1])
const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])

for (const p of products) {
  if (only.length ? !only.includes(p.id) : !visible.has(p.id)) continue
  if (!/_gpr_0-\d+_/.test(p.variants?.[0]?.gelatoVariantId || '')) continue // solo maglie back
  const m = /\/public\/designs\/([^/]+)\/([^/?#]+)$/.exec(p.printFileUrl || '')
  if (!m) { console.log('skip (no print file)', p.id); continue }
  const src = path.join(ROOT, 'public/designs', m[1], m[2])
  if (!fs.existsSync(src)) { console.log('skip (file missing)', p.id); continue }
  const outName = 'design-front.png'
  const out = path.join(ROOT, 'public/designs', m[1], outName)
  if (p.altPrintFileUrl && fs.existsSync(out) && !force) { console.log('keep', p.id); continue }

  const art = await sharp(src).ensureAlpha().trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
  const aspect = art.info.height / art.info.width
  let widthPct = FRONT.widthPct
  let heightPct = widthPct * (CANVAS.w / CANVAS.h) * aspect
  const maxH = (1 - FRONT.topPct) * 0.98
  if (heightPct > maxH) { heightPct = maxH; widthPct = heightPct / (CANVAS.w / CANVAS.h) / aspect }
  const w = Math.round(widthPct * CANVAS.w), h = Math.round(heightPct * CANVAS.h)
  const resized = await sharp(art.data).resize(w, h, { fit: 'fill' }).png().toBuffer()
  await sharp({ create: { width: CANVAS.w, height: CANVAS.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round(FRONT.leftPct * CANVAS.w), top: Math.round(FRONT.topPct * CANVAS.h) }])
    .png().toFile(out)

  p.altPrintFileUrl = p.printFileUrl.replace(/[^/]+$/, outName)
  console.log('front', p.id)
}

fs.writeFileSync(FILE, `// This file is managed by the JAYL admin panel. Do not edit manually.\nexport const adminProducts = ${JSON.stringify(products, null, 2)}\n`)
