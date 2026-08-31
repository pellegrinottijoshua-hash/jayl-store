// Fits a transparent design PNG onto Gelato's print canvas, in the browser.
//
// WHY IN THE BROWSER
// The admin needs both an auto-fit and a print preview. They are the same canvas
// operation, so doing it client-side gives us both from one implementation — no
// `sharp` dependency, no serverless CPU, and the operator sees the result BEFORE
// the file is committed to the repo rather than after.
//
// The numbers below are measured from the print files already in production
// (public/designs/*/design.png), not invented:
//   BACK  → art 92% of canvas width, centred, top at 15%
//   FRONT → art 35% of canvas width, left edge at 61%, top at 2%
// The front sits on the RIGHT of the canvas because the canvas is seen from the
// outside: the wearer's left chest is the viewer's right. Centring a front design
// is the classic mistake — see docs/gelato-pipeline.md.

/** Gelato Gildan 64000 print area, both placements. */
export const PRINT_CANVAS = { w: 3661, h: 4843 }

export const PLACEMENT_SPECS = {
  back:    { widthPct: 0.92, topPct: 0.15, centerX: true,  label: 'Retro — grande, centrato' },
  default: { widthPct: 0.35, topPct: 0.02, leftPct: 0.61,  label: 'Fronte — piccolo, petto sinistro' },
}

/** Mirrors api/_lib/placement.js so the preview shows what fulfillment will do. */
const GPR_RE = /_gpr_(\d+-\d+)_/

export function detectPlacement(product) {
  const uids = [
    ...(product?.variants || []).map((v) => v.gelatoVariantId),
    product?.gelatoProductId,
  ].filter(Boolean)

  for (const uid of uids) {
    const gpr = GPR_RE.exec(uid)?.[1]
    if (!gpr) continue
    const [front, back] = gpr.split('-').map(Number)
    if (front === 0 && back > 0) return { type: 'back',    source: 'uid', gpr }
    if (back === 0 && front > 0) return { type: 'default', source: 'uid', gpr }
  }
  return {
    type: /back/i.test(product?.collection || '') ? 'back' : 'default',
    source: 'collection',
    gpr: null,
  }
}

/** Load a File into an HTMLImageElement. */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')) }
    img.src = url
  })
}

/**
 * Bounding box of the non-transparent pixels. Source art is usually a character
 * floating in a large transparent square (the Higgsfield exports are 6400×6400),
 * so scaling the raw file would make the artwork far smaller than intended.
 * Returns null when the image is fully transparent or fully opaque-with-no-alpha.
 */
function alphaBounds(img) {
  // Downscale before scanning: a 6400×6400 scan is ~164MP of work for a bounding
  // box we only need to ~1px accuracy at final scale.
  const SCAN = 512
  const scale = Math.min(SCAN / img.width, SCAN / img.height, 1)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)

  const { data } = ctx.getImageData(0, 0, w, h)
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const inv = 1 / scale
  return {
    x: minX * inv,
    y: minY * inv,
    w: (maxX - minX + 1) * inv,
    h: (maxY - minY + 1) * inv,
  }
}

/**
 * Compose the design onto the 3661×4843 print canvas for the given placement.
 *
 * @param {File}   file      the source artwork (transparent PNG expected)
 * @param {'back'|'default'} type
 * @returns {Promise<{blob:Blob, previewUrl:string, meta:object}>}
 */
export async function fitDesignToCanvas(file, type) {
  const spec = PLACEMENT_SPECS[type] || PLACEMENT_SPECS.default
  const img  = await loadImage(file)
  const src  = alphaBounds(img) || { x: 0, y: 0, w: img.width, h: img.height }

  const canvas = document.createElement('canvas')
  canvas.width  = PRINT_CANVAS.w
  canvas.height = PRINT_CANVAS.h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  // Scale by width, then clamp so tall artwork cannot overflow the canvas.
  let drawW = PRINT_CANVAS.w * spec.widthPct
  let drawH = drawW * (src.h / src.w)
  const maxH = PRINT_CANVAS.h * (1 - spec.topPct) * 0.98
  if (drawH > maxH) { drawH = maxH; drawW = drawH * (src.w / src.h) }

  const dx = spec.centerX
    ? (PRINT_CANVAS.w - drawW) / 2
    : PRINT_CANVAS.w * spec.leftPct
  const dy = PRINT_CANVAS.h * spec.topPct

  ctx.drawImage(img, src.x, src.y, src.w, src.h, dx, dy, drawW, drawH)

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Impossibile generare il file di stampa')

  return {
    blob,
    previewUrl: canvas.toDataURL('image/png'),
    meta: {
      type,
      sourceSize: `${img.width}×${img.height}`,
      artSize:    `${Math.round(src.w)}×${Math.round(src.h)}`,
      drawnSize:  `${Math.round(drawW)}×${Math.round(drawH)}`,
      widthPct:   Math.round((drawW / PRINT_CANVAS.w) * 100),
      offset:     `x ${Math.round((dx / PRINT_CANVAS.w) * 100)}% · y ${Math.round((dy / PRINT_CANVAS.h) * 100)}%`,
      bytes:      blob.size,
    },
  }
}
