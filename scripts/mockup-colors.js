/**
 * Riconosce il colore della maglia nei mockup Gelato.
 *
 * I mockup standard di Gelato vengono localizzati da api/admin.js come
 * "{titolo}-gelato-01.jpg", "-gelato-02.jpg"… senza il colore nel nome: la
 * risposta di Gelato non lo dice. Per colorImageMatch.js quei file sono
 * "neutri", quindi lo swatch non ci salta sopra e la scheda prodotto non puo'
 * nascondere le foto dei colori che non mostra.
 *
 * Qui si legge il tessuto: tutti i mockup Gelato inquadrano la maglia allo
 * stesso modo (schiena, stampa al centro), quindi due campioni sul fondo
 * della maglia, ai lati della stampa, cadono sempre sul tessuto. Il colore
 * medio si confronta in Lab con i soli colori del prodotto — mai con tutta
 * la palette: scegliere fra i 7 colori che quella maglia ha davvero e' un
 * problema molto piu' facile che indovinare fra 200 nomi.
 *
 * Gira a build time dentro il plugin storefront-products (vite.config.js),
 * cosi' anche i mockup importati domani vengono classificati senza passaggi
 * a mano. Se sharp non c'e' o un file non si legge, quel file resta
 * semplicemente senza colore — cioe' il comportamento di prima.
 */
import path from 'node:path'
import { existsSync } from 'node:fs'
import { resolveSwatchHex } from '../src/lib/apparelColors.js'
import { buildImageOwnership, colorToSlug } from '../src/lib/colorImageMatch.js'

const MOCKUP_RE = /-(gelato|mockup|front|collar)-\d+\.(jpe?g|png|webp)$/i

// Due toppe di tessuto: fondo maglia, a sinistra e a destra della stampa.
// Coordinate in frazioni del lato, tarate sui mockup Gelato Gildan 64000.
const PATCHES = [
  { x0: 0.30, x1: 0.38, y0: 0.74, y1: 0.82 },
  { x0: 0.62, x1: 0.70, y0: 0.74, y1: 0.82 },
]
const GRID = 64

// Il tessuto come lo rende Gelato nei mockup, misurato su questi stessi file
// (i render sono a tinta piatta: lo stesso colore da' lo stesso RGB su ogni
// prodotto, al pixel). Gli hex degli swatch non bastano: "Red" #cc2200 e'
// piu' lontano dal rosso reale del mockup di quanto lo sia "Cardinal Red", e
// le due tinte convivono su Arcanine ed Entei. Un colore che manca qui ripiega
// sull'hex dello swatch.
const MOCKUP_RGB = {
  'white':          [234, 234, 234],
  'black':          [29, 33, 35],
  'navy':           [25, 34, 57],
  'heather-navy':   [69, 80, 97],
  'royal':          [1, 109, 203],
  'heather-royal':  [43, 78, 125],
  'light-blue':     [136, 163, 190],
  'carolina-blue':  [106, 144, 197],
  'purple':         [65, 0, 124],
  'azalea':         [200, 99, 142],
  'red':            [192, 0, 41],
  'cardinal-red':   [121, 17, 46],
  'heather-maroon': [79, 34, 36],
  'maroon':         [102, 34, 55],
  'gold':           [231, 144, 13],
  'daisy':          [232, 188, 54],
  'natural':        [202, 188, 147],
  'sand':           [197, 185, 171],
  'rs-sport-grey':  [133, 134, 137],
  'military-green': [79, 100, 82],
  'irish-green':    [0, 147, 61],
}

// Oltre questa distanza in Lab il campione non somiglia a nessun colore del
// prodotto (foto non standard, sfondo diverso): meglio nessun colore che uno
// sbagliato.
const MAX_DELTA_E = 38

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

function rgbToLab([r, g, b]) {
  const lin = (c) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y =  R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(X), f(Y), f(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

async function sampleFabric(sharp, file) {
  const { data } = await sharp(file)
    .removeAlpha()
    .resize(GRID, GRID, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const acc = [0, 0, 0]
  let n = 0
  for (const p of PATCHES) {
    for (let y = Math.floor(p.y0 * GRID); y < Math.ceil(p.y1 * GRID); y++) {
      for (let x = Math.floor(p.x0 * GRID); x < Math.ceil(p.x1 * GRID); x++) {
        const i = (y * GRID + x) * 3
        acc[0] += data[i]; acc[1] += data[i + 1]; acc[2] += data[i + 2]
        n++
      }
    }
  }
  return acc.map((v) => Math.round(v / n))
}

let sharpPromise
function loadSharp() {
  sharpPromise ??= import('sharp').then((m) => m.default).catch(() => null)
  return sharpPromise
}

/**
 * @returns {Promise<Record<string,string>>} path immagine → id colore, solo
 *   per i mockup senza colore nel nome e riconosciuti con sicurezza.
 */
export async function classifyMockupColors(product, publicDir) {
  const colors = product.colors || []
  const images = product.images || []
  if (colors.length < 2 || images.length === 0) return {}

  const owners = buildImageOwnership(colors, images)
  const todo = images.filter((img) => MOCKUP_RE.test(img) && !owners.get(img))
  if (todo.length === 0) return {}

  const sharp = await loadSharp()
  if (!sharp) return {}

  const palette = colors
    .map((c) => {
      const rgb = MOCKUP_RGB[colorToSlug(c.id)] ?? MOCKUP_RGB[colorToSlug(c.label)]
      const hex = rgb ? null : resolveSwatchHex(c)
      return rgb || hex ? { id: c.id, lab: rgbToLab(rgb ?? hexToRgb(hex)) } : null
    })
    .filter(Boolean)

  const out = {}
  for (const img of todo) {
    const file = path.join(publicDir, img)
    if (!existsSync(file)) continue
    try {
      const lab = rgbToLab(await sampleFabric(sharp, file))
      let best = null
      for (const c of palette) {
        const d = deltaE(lab, c.lab)
        if (!best || d < best.d) best = { id: c.id, d }
      }
      if (best && best.d <= MAX_DELTA_E) out[img] = best.id
    } catch {
      // file illeggibile: resta neutro, come prima
    }
  }
  return out
}
