// Il cappello di Natale, quello grande sopra tutta la testa (prova 2 del
// 17/11, motion-lab/occhi-video/cappello_testa.py): stessa forma e stessa
// fisica, in coordinate del logo.
//
// Due punti d'appoggio (sopra l'occhio sinistro e il destro) cadono per
// gravita' e si fermano sulle palpebre: se Zack spalanca gli occhi il
// cappello salta, se li chiude scivola giu', se guarda di lato il cappello
// scivola da quella parte. Il pompon dondola come una molla.

// ── Quando c'e' ─────────────────────────────────────────────────────────
// Dal 1/12 al 6/1 (ora di Roma), una visita si' e una no. ?cappello=1 lo
// forza (per provarlo), ?cappello=0 lo toglie. Deciso una volta per pagina.
const FROM = Date.parse('2026-12-01T00:00:00+01:00')
const TO = Date.parse('2027-01-07T00:00:00+01:00')
let decided = null
export function hatToday() {
  if (decided !== null) return decided
  decided = false
  if (typeof window === 'undefined') return decided
  const q = new URLSearchParams(window.location.search).get('cappello')
  if (q === '1' || q === '0') return (decided = q === '1')
  const now = Date.now()
  if (now < FROM || now >= TO) return decided
  try {
    const n = Number(localStorage.getItem('zackVisite') || 0) + 1
    localStorage.setItem('zackVisite', String(n))
    decided = n % 2 === 1          // la prima visita si', la seconda no, ...
  } catch { decided = true }       // niente storage: sempre
  return decided
}

// ── Forma ───────────────────────────────────────────────────────────────
const K = 2.2                        // grandezza (la prova 1 era 0.84)
const XL = 371, XR = 829             // appoggi sopra i due occhi
const G = 3400                       // gravita' (unita' del logo / s²)
const TOP = 205 - 113                // il bianco non sale oltre la cima dell'ellisse
const PIV = [-14, -226]
// Centro del cappello: un po' a destra del centro della testa, perche' la
// punta e il pompon pendono a sinistra (cosi' su mobile restano nello schermo).
const REST = 625

const cub = (p0, p1, p2, p3, n = 22) => {
  const out = []
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t
    out.push([u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
      u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]])
  }
  return out
}
const around = (p, c, a) => {
  const ca = Math.cos(a), sa = Math.sin(a)
  return [c[0] + (p[0] - c[0]) * ca - (p[1] - c[1]) * sa, c[1] + (p[0] - c[0]) * sa + (p[1] - c[1]) * ca]
}
const circle = (cx, cy, r, n = 40) =>
  Array.from({ length: n }, (_, k) => [cx + r * Math.cos(2 * Math.PI * k / n), cy + r * Math.sin(2 * Math.PI * k / n)])

const BAND = (() => {
  const pts = []
  for (let k = 0; k <= 20; k++) { const a = Math.PI / 2 + Math.PI * k / 20; pts.push([-118 + 22 * Math.cos(a), 22 * Math.sin(a)]) }
  for (let k = 0; k <= 20; k++) { const a = -Math.PI / 2 + Math.PI * k / 20; pts.push([118 + 22 * Math.cos(a), 22 * Math.sin(a)]) }
  return pts
})()

function shapes(phi) {
  const R = (p, k = 1) => around(p, PIV, phi * k)
  const body = [
    ...cub([118, -14], [112, -130], [62, -240], [-8, -252]),
    ...cub([-8, -252], R([-80, -262]), R([-170, -205]), R([-190, -118])).slice(1),
    R([-160, -104]),
    ...cub(R([-160, -104]), R([-150, -160]), R([-104, -180], 0.6), R([-66, -170], 0.4)).slice(1),
    ...cub(R([-66, -170], 0.4), [-82, -120], [-112, -66], [-118, -14]).slice(1),
  ]
  const pom = R([-186, -100])
  return [body, BAND, circle(pom[0], pom[1], 38, 48)]
}

const toD = (pts, hx, hy, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang)
  let d = ''
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] * K, y = 22 * K + (pts[i][1] - 22) * K
    d += `${i ? 'L' : 'M'}${(hx + x * c - y * s).toFixed(1)} ${(hy + x * s + y * c).toFixed(1)}`
  }
  return d + 'Z'
}

// ── Fisica ──────────────────────────────────────────────────────────────
// tops: y della palpebra di sopra al centro dei due occhi; gaze: di quanto
// le pupille sono spostate di lato rispetto a riposo.
export function createHat(els) {
  const h = { pl: -900, pr: -900, vl: 0, vr: 0, hx: REST, vx: 0, phi: 0.35, vphi: 0, prev: null }
  els.g.style.display = ''

  const step = (tops, gaze, dt) => {
    const yl = Math.max(tops[0], TOP), yr = Math.max(tops[1], TOP)
    if (!h.prev) h.prev = [yl, yr]
    const vs = [(yl - h.prev[0]) / dt, (yr - h.prev[1]) / dt]
    h.prev = [yl, yr]
    ;[['pl', 'vl', yl, vs[0]], ['pr', 'vr', yr, vs[1]]].forEach(([pk, vk, ys, v_s]) => {
      let p = h[pk], v = h[vk] + G * dt
      p += v * dt
      if (p >= ys) {                                        // tocca la palpebra
        v = v > 300 ? -0.28 * v                             // piccolo rimbalzo
          : Math.max(Math.min(v, v_s * 0.6), -700)          // palpebra che sale di colpo: lo lancia (piano)
        p = ys
      }
      h[pk] = p; h[vk] = v
    })
    const ang = Math.atan2(h.pr - h.pl, XR - XL)
    // Sul sito lo sguardo segue il mouse: si sposta meno che nel video, e il
    // cappello resta dentro la testa (il pompon non esce dallo schermo).
    h.vx += ((REST + gaze * 0.9 - h.hx) * 18 - h.vx * 6.5 + Math.sin(ang) * 600) * dt
    h.hx = Math.min(REST + 40, Math.max(REST - 15, h.hx + h.vx * dt))
    const aPom = -70 * h.phi - 3.2 * h.vphi + 0.0016 * (h.vl + h.vr) - 0.004 * h.vx
    h.vphi += aPom * dt
    h.phi += h.vphi * dt
  }

  return {
    update(tops, gaze, dt) {
      // Passi piccoli: la fisica e' fatta per 1/60 s o meno.
      const n = Math.max(1, Math.ceil(dt / (1 / 120)))
      for (let i = 0; i < n; i++) step(tops, gaze, dt / n)
      const ang = Math.atan2(h.pr - h.pl, XR - XL) + (h.hx - REST) * 0.0011
      const hy = (h.pl + h.pr) / 2 - 6 - 22 * K
      const [body, band, pom] = shapes(h.phi)
      els.body.setAttribute('d', toD(body, h.hx, hy, ang))
      els.band.setAttribute('d', toD(band, h.hx, hy, ang))
      els.pom.setAttribute('d', toD(pom, h.hx, hy, ang))
    },
  }
}

// Quanto spazio serve sopra gli occhi, in frazione della larghezza del
// viewBox (876): la punta arriva ~540 unita' sopra la cima del bianco.
export const HAT_HEADROOM = 0.6
