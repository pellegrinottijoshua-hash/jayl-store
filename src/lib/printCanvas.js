// Fits a transparent design PNG onto Gelato's print canvas, in the browser,
// and lets the operator move/resize it before committing.
//
// WHY IN THE BROWSER
// The admin needs both an auto-fit and a print preview. They are the same canvas
// operation, so doing it client-side gives us both from one implementation — no
// `sharp` dependency, no serverless CPU, and the operator sees the result BEFORE
// the file is committed to the repo rather than after.
//
// The default numbers below are measured from the print files already in
// production (public/designs/*/design.png), not invented:
//   BACK  → art 92% of canvas width, centred, top at 15%
//   FRONT → art 35% of canvas width, left edge at 61%, top at 2%
// The front sits on the RIGHT of the canvas because the canvas is seen from the
// outside: the wearer's left chest is the viewer's right. Centring a front design
// is the classic mistake — see docs/gelato-pipeline.md. They're a STARTING POINT,
// not a lock: PrintPlacementEditor.jsx lets the operator drag/resize from here,
// because "adatta automaticamente" alone can't know a design needs to sit lower,
// or smaller, than the generic spec assumes.

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
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')) }
    img.src = url
  })
}

/**
 * Load a same-origin-or-CORS-enabled URL into an HTMLImageElement. Used to
 * re-open an ALREADY UPLOADED print file for repositioning: raw.githubusercontent.com
 * sends `Access-Control-Allow-Origin: *`, so this works for every print file
 * this app writes — but any URL that doesn't will taint the canvas on the
 * getImageData() call inside alphaBounds/extractArt, which throws a
 * SecurityError. Callers must catch that and say so plainly rather than
 * silently failing.
 */
export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('Immagine non raggiungibile'))
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
 * Crop `img` to its tight alpha bounding box and return it as an offscreen
 * canvas (has .width/.height, drawable via ctx.drawImage like any image
 * source). This is "the art" that PrintPlacementEditor moves and resizes —
 * whether `img` is raw untouched source artwork, or an ALREADY COMPOSITED
 * print file being reopened for editing (alphaBounds finds the same tight box
 * either way, since a composited file is just the same art on more
 * transparent padding).
 */
export function extractArt(img) {
  const b = alphaBounds(img) || { x: 0, y: 0, w: img.width, h: img.height }
  const c = document.createElement('canvas')
  c.width  = Math.max(1, Math.round(b.w))
  c.height = Math.max(1, Math.round(b.h))
  const ctx = c.getContext('2d')
  ctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height)
  return c
}

/**
 * Where a design CURRENTLY sits within an already-composited print file, as
 * {leftPct, topPct, widthPct, heightPct} of PRINT_CANVAS — measured directly
 * from the pixels, not assumed. Used to open the placement editor on an
 * EXISTING print file starting from where the art actually is, instead of
 * resetting it to the generic default and discarding a manual adjustment a
 * previous session already made.
 *
 * Returns null for a fully transparent (or fully opaque, alpha-less) image —
 * the caller falls back to defaultTransform in that case.
 */
export function measurePlacement(compositedImg) {
  const b = alphaBounds(compositedImg)
  if (!b) return null
  return {
    leftPct:   b.x / compositedImg.width,
    topPct:    b.y / compositedImg.height,
    widthPct:  b.w / compositedImg.width,
    heightPct: b.h / compositedImg.height,
  }
}

/**
 * The auto-fit starting transform for a placement type, given the art's own
 * aspect ratio (height/width). Same numbers PLACEMENT_SPECS always used,
 * expressed as an editable {leftPct, topPct, widthPct, heightPct} instead of
 * being baked directly into a canvas draw — height is derived from the art's
 * real proportions and clamped so tall artwork can't overflow the canvas,
 * exactly like the pre-editor auto-fit did.
 */
export function defaultTransform(type, artAspect) {
  const spec = PLACEMENT_SPECS[type] || PLACEMENT_SPECS.default
  const canvasAspect = PRINT_CANVAS.w / PRINT_CANVAS.h

  let widthPct  = spec.widthPct
  let heightPct = widthPct * canvasAspect * artAspect
  const maxHeightPct = (1 - spec.topPct) * 0.98
  if (heightPct > maxHeightPct) {
    heightPct = maxHeightPct
    widthPct  = heightPct / canvasAspect / artAspect
  }

  const leftPct = spec.centerX ? (1 - widthPct) / 2 : spec.leftPct
  return { leftPct, topPct: spec.topPct, widthPct, heightPct }
}

/**
 * Render `art` onto a fresh PRINT_CANVAS-sized canvas at `transform`.
 * Pure composition, no fitting logic — defaultTransform/measurePlacement
 * decide WHERE, this only draws it there. Used both for the small live
 * preview (any target size) and the final full-resolution export.
 */
export function renderToCanvas(art, transform, size = PRINT_CANVAS) {
  const canvas = document.createElement('canvas')
  canvas.width  = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    art, 0, 0, art.width, art.height,
    transform.leftPct * size.w, transform.topPct * size.h,
    transform.widthPct * size.w, transform.heightPct * size.h,
  )
  return canvas
}

/** Full-resolution PNG blob for upload, plus the same metadata block the old single-shot flow showed. */
export async function renderPrintFile(art, transform, type) {
  const canvas = renderToCanvas(art, transform, PRINT_CANVAS)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Impossibile generare il file di stampa')
  return {
    blob,
    previewUrl: canvas.toDataURL('image/png'),
    meta: {
      type,
      artSize:   `${art.width}×${art.height}`,
      drawnSize: `${Math.round(transform.widthPct * PRINT_CANVAS.w)}×${Math.round(transform.heightPct * PRINT_CANVAS.h)}`,
      widthPct:  Math.round(transform.widthPct * 100),
      offset:    `x ${Math.round(transform.leftPct * 100)}% · y ${Math.round(transform.topPct * 100)}%`,
      bytes:     blob.size,
    },
  }
}

/**
 * Clamp a transform so the art can never be dragged/resized fully off the
 * 3661×4843 canvas — same intent as the old hard-coded clamp in the single-shot
 * fitter, generalised to any transform an operator produces by hand.
 */
export function clampTransform(t) {
  const widthPct  = Math.min(1, Math.max(0.02, t.widthPct))
  const heightPct = Math.min(1, Math.max(0.02, t.heightPct))
  const leftPct = Math.min(Math.max(0, t.leftPct), 1 - widthPct)
  const topPct  = Math.min(Math.max(0, t.topPct),  1 - heightPct)
  return { leftPct, topPct, widthPct, heightPct }
}

/**
 * One-shot convenience: pick a file, get back a ready-to-render-editable
 * state. Used by AdminProductPage's file picker to go straight from "file
 * chosen" to "editor open, pre-filled with the sensible default" in one call.
 */
export async function prepareDesignForPlacement(file, type) {
  const img = await loadImageFromFile(file)
  const art = extractArt(img)
  const transform = clampTransform(defaultTransform(type, art.height / art.width))
  return { art, transform, sourceSize: `${img.width}×${img.height}` }
}
