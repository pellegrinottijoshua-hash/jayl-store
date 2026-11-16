import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react'
import { VIEWBOX, MARKUP, D, IDLE_CYCLE } from './zackEyesData'

// Gli occhi di Zack: lo stesso motore di motion-lab/home-occhi, portato in
// React. Le pupille seguono mouse e dito su tutta la pagina; da fermo gira
// fra le espressioni; tocchi sugli occhi: 1 sorpreso, 2 stelle, 3+ KO.
// In piu' rispetto alla home-occhi:
//  - ref.lookAt(clientX, clientY): guarda un punto (il capo nel carosello);
//  - ref.wink(eye, { style, slow }): l'occhiolino (vedi sotto);
//  - si ferma quando esce dallo schermo (batteria).
// Disegno e dati: scripts/zack-eyes-sync.mjs → zackEyesData.js.
//
// L'OCCHIOLINO (scelto da Joshua il 16/11 sulle prove video
// runs/zack-occhiolino/): Zack guarda in camera (pupille al centro), poi le
// due palpebre di UN occhio si chiudono verso il centro, sopra giu' e sotto su.
//  - style 'A' solo quello; 'B' l'altro occhio socchiude; 'C' la testa fa un
//    piccolo rimbalzo verso l'occhio chiuso.
//  - veloce (~0,5 s) quando l'utente aspetta qualcosa (clic su un capo, sui
//    social); lento (~1 s) quando non aspetta niente (saluto, da fermo).
//  - eye 0 = l'occhio a sinistra sullo schermo, 1 = a destra: dal lato del clic.

const FORME = ['cerchio', 'cuore', 'stella', 'x', 'dollaro', 'spirale', 'pixel']
const NS = 'http://www.w3.org/2000/svg'
const EYE = [{ cx: 371, cy: 205 }, { cx: 829, cy: 205 }]
const RX = 129, RY = 113
const IDLE_AFTER = 3500, IDLE_HOLD = [2600, 3600]
const BLINK = 190
// Occhiolino: dove si chiudono le palpebre (inclinate come quelle di Zack),
// dove guardano le pupille in camera, i tempi.
const SHUT_TOP = [233, 245], SHUT_BOT = [245, 257], OPEN_BOT = 322
const CAM = [[371, 212], [829, 212]]
const WINKS = { fast: { close: 150, hold: 70, open: 200 }, slow: { close: 260, hold: 300, open: 340 } }
const CAM_LEAD = 110            // ms: le pupille arrivano in camera, poi chiude
const SLOW_WINK_EVERY = 5       // da fermo: un occhiolino lento ogni 5 espressioni
const f2 = (n) => n.toFixed(2)
const lerp = (a, b, t) => a + (b - a) * t
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const eOut = (t) => 1 - (1 - t) ** 3
const eInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const total = (w) => w.close + w.hold + w.open

const toVec = (name) => {
  const e = D.espr[name] || D.espr.originale
  return [...e.o[0], ...e.o[1], ...FORME.map((f) => (f === e.f ? 1 : 0)), e.rif, e.tear]
}
const lidY = (i, x, a, b) => {
  const lx = i === 0 ? x : 1200 - x
  return a + (b - a) * (lx - 242) / 258
}

function startEngine(svg, prefix, onReact) {
  const $ = (id) => svg.querySelector(`#${prefix}${id}`)

  const shapeEls = [[], []], rifEls = []
  for (let i = 0; i < 2; i++) {
    const g = $('pup' + i)
    g.replaceChildren()
    for (const f of FORME) {
      const p = document.createElementNS(NS, 'path')
      p.setAttribute('d', D.forme[f]); p.setAttribute('fill', '#111111')
      g.appendChild(p); shapeEls[i].push(p)
    }
    const r = document.createElementNS(NS, 'g')
    for (const [x, y, rr] of D.riflessi) {
      const c = document.createElementNS(NS, 'circle')
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', rr); c.setAttribute('fill', '#F5F0E8')
      r.appendChild(c)
    }
    g.appendChild(r); rifEls.push(r)
  }
  $('tearPath').setAttribute('d', D.lacrima)
  const poly = [$('poly0'), $('poly1')], pup = [$('pup0'), $('pup1')], tear = $('tear')

  let cur = toVec('originale'), tgt = cur.slice(), speed = 4
  let mode = 'track', exprName = 'originale'
  let pointer = null, lastMove = performance.now(), reactUntil = 0, reactExpr = 'sorpreso'
  let idleIdx = 0, idleNext = 0, clicks = []
  let blinkT = -1, nextBlink = performance.now() + 2500
  let prev = performance.now(), raf = 0, running = false
  let boostUntil = 0   // per un attimo le pupille scattano (balzo allo swipe)
  let holdExpr = null           // posa fissa (es. 'chiusi')
  // Occhiolino in corso: quando parte, quale occhio, che stile, che tempi.
  let winkT = -1, winkEye = 1, winkStyle = 'A', winkTimes = WINKS.fast, camUntil = 0
  // Rimbalzo della testa (stile C): una molla sul transform dell'svg.
  const head = { x: 0, v: 0, on: false }

  const toSvg = (x, y) => {
    const m = svg.getScreenCTM()
    if (!m) return null
    const p = svg.createSVGPoint(); p.x = x; p.y = y
    return p.matrixTransform(m.inverse())
  }
  const look = (x, y) => {
    const p = toSvg(x, y)
    if (!p) return
    pointer = p; lastMove = performance.now()
    if (mode === 'idle') mode = 'track'
  }
  // Il dito che trascina (carosello, scroll) non e' un cursore: su mobile le
  // pupille seguono il capo che scorre (look() dal carosello), non il dito,
  // se no saltano fra i due. I tocchi sugli occhi restano (onDown).
  const onMove = (ev) => { if (ev.pointerType !== 'touch') look(ev.clientX, ev.clientY) }
  const onDown = (ev) => {
    look(ev.clientX, ev.clientY)
    const now = performance.now()
    clicks = clicks.filter((t) => now - t < 1400); clicks.push(now)
    reactExpr = clicks.length >= 3 ? 'ko' : clicks.length === 2 ? 'stelle' : 'sorpreso'
    mode = 'react'; reactUntil = now + (reactExpr === 'ko' ? 1800 : reactExpr === 'stelle' ? 1000 : 650)
    blinkT = -1
    onReact?.(reactExpr)
  }

  const trackPupils = (base) => {
    const v = base.slice()
    for (let i = 0; i < 2; i++) {
      const o = i * 6, e = EYE[i], r = v[o + 5]
      const dx = pointer.x - e.cx, dy = (pointer.y - e.cy) * 1.25
      const d = Math.hypot(dx, dy) || 1, reach = Math.min(1, d / 420)
      const ax = RX - r - 14, ay = RY - r - 14, ux = dx / d, uy = dy / d
      const k = reach / Math.hypot(ux / ax, uy / ay)
      const px = e.cx + ux * k
      let py = e.cy + uy * k
      const minY = lidY(i, px, v[o], v[o + 1]) + r * 0.15
      if (py < minY) py = minY
      v[o + 3] = px; v[o + 4] = py
    }
    return v
  }
  const camera = () => {
    const v = toVec('originale')
    for (let i = 0; i < 2; i++) { v[i * 6 + 3] = CAM[i][0]; v[i * 6 + 4] = CAM[i][1] }
    return v
  }

  const blinkAmt = (now) => {
    if (blinkT < 0) {
      if (now > nextBlink && mode !== 'react' && now > camUntil) blinkT = now; else return 0
    }
    const t = (now - blinkT) / BLINK
    if (t >= 1) {
      blinkT = -1
      nextBlink = now + 2600 + Math.random() * 3800
      if (Math.random() < 0.18) nextBlink = now + 260
      return 0
    }
    return Math.sin(Math.PI * t) ** 0.8
  }

  const winkAmt = (now) => {
    if (winkT < 0 || now < winkT) return 0
    const u = now - winkT, { close, hold, open } = winkTimes
    if (u < close) return eInOut(u / close)
    if (u < close + hold) return 1
    if (u < close + hold + open) return 1 - eOut((u - close - hold) / open)
    winkT = -1
    return 0
  }

  // Occhiolino. Riparte solo a quello precedente finito. Ritorna i ms che
  // servono (pupille in camera + occhiolino): chi apre una pagina aspetta quelli.
  const wink = (eye = 1, { style = 'A', slow = false, lead = CAM_LEAD } = {}) => {
    const now = performance.now()
    if (winkT >= 0 && now < winkT + total(winkTimes)) return Math.max(0, winkT + total(winkTimes) - now)
    winkEye = eye ? 1 : 0; winkStyle = style; winkTimes = slow ? WINKS.slow : WINKS.fast
    winkT = now + lead
    camUntil = winkT + total(winkTimes) + 140
    if (mode === 'react') mode = 'track'
    blinkT = -1; nextBlink = camUntil + 900
    if (style === 'C') head.on = true
    play()
    return lead + total(winkTimes)
  }

  // La molla della testa (C): verso l'occhio chiuso mentre e' chiuso, poi torna.
  const stepHead = (now, dt) => {
    if (!head.on) return
    const u = now - winkT
    const target = winkT >= 0 && u >= 0 && u < winkTimes.close + winkTimes.hold ? 1 : 0
    for (let s = 0; s < 4; s++) {
      head.v += (420 * (target - head.x) - 15 * head.v) * (dt / 4)
      head.x += head.v * (dt / 4)
    }
    if (target === 0 && Math.abs(head.x) < 0.002 && Math.abs(head.v) < 0.02) {
      head.on = false; head.x = 0; head.v = 0; svg.style.transform = ''
      return
    }
    const side = winkEye ? 1 : -1
    svg.style.transform = `translateY(${f2(-3.7 * head.x)}%) rotate(${f2(side * 3.2 * head.x)}deg)`
  }

  const frame = (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now
    if (now < camUntil) { tgt = camera(); speed = 16 } else if (holdExpr) { tgt = toVec(holdExpr); speed = 9 } else {
    if (mode === 'react') {
      if (now > reactUntil) { mode = 'track'; lastMove = now }
      tgt = toVec(reactExpr); speed = 14; exprName = reactExpr
    }
    if (mode === 'track') {
      exprName = 'originale'
      tgt = pointer ? trackPupils(toVec('originale')) : toVec('originale')
      speed = now < boostUntil ? 18 : 7
      if (now - lastMove > IDLE_AFTER) { mode = 'idle'; idleNext = 0 }
    }
    if (mode === 'idle') {
      if (now > idleNext) {
        // Ogni tanto, da fermo, un occhiolino lento (nessuno sta aspettando).
        if (idleIdx > 0 && idleIdx % SLOW_WINK_EVERY === 0) {
          exprName = 'originale'
          wink(Math.random() < 0.5 ? 0 : 1, { style: 'C', slow: true })
        } else exprName = IDLE_CYCLE[idleIdx % IDLE_CYCLE.length]
        idleIdx += 1
        idleNext = now + IDLE_HOLD[0] + Math.random() * (IDLE_HOLD[1] - IDLE_HOLD[0])
      }
      tgt = toVec(exprName); speed = 2.6
    }
    }
    const k = 1 - Math.exp(-speed * dt)
    for (let j = 0; j < cur.length; j++) cur[j] += (tgt[j] - cur[j]) * k

    const bl = holdExpr ? 0 : blinkAmt(now), w = winkAmt(now), CL = 288
    for (let i = 0; i < 2; i++) {
      const o = i * 6
      // Palpebra di sopra (a, c) e di sotto (la, lc), inclinate come lidY.
      let a = cur[o] + (CL - cur[o]) * bl, c = cur[o + 1] + (CL - cur[o + 1]) * bl
      let la = Math.min(cur[o + 2], OPEN_BOT), lc = la, pupOp = 1
      if (w > 0 && i === winkEye) {
        a = lerp(a, SHUT_TOP[0], w); c = lerp(c, SHUT_TOP[1], w)
        la = lerp(la, SHUT_BOT[0], w); lc = lerp(lc, SHUT_BOT[1], w)
        pupOp = 1 - seg(w, 0.62, 0.8)   // a occhio quasi chiuso la pupilla non si vede
      } else if (w > 0 && winkStyle === 'B') {
        const s = w * 0.6               // l'altro occhio socchiude
        a += 34 * s; c += 26 * s; la -= 48 * s; lc -= 26 * s
      }
      const x0 = i ? 688 : 230, x1 = i ? 970 : 512
      poly[i].setAttribute('points',
        `${x0},${f2(lidY(i, x0, a, c))} ${x1},${f2(lidY(i, x1, a, c))} ${x1},${f2(lidY(i, x1, la, lc))} ${x0},${f2(lidY(i, x0, la, lc))}`)
      pup[i].setAttribute('transform', `translate(${f2(cur[o + 3])} ${f2(cur[o + 4])}) scale(${Math.max(0, cur[o + 5]).toFixed(3)})`)
      pup[i].setAttribute('opacity', pupOp.toFixed(2))
      FORME.forEach((f, j) => shapeEls[i][j].setAttribute('transform', `scale(${Math.max(0, cur[12 + j]).toFixed(3)})`))
      rifEls[i].setAttribute('transform', `scale(${Math.max(0, cur[12 + FORME.length]).toFixed(3)})`)
    }
    const t = Math.max(0, cur[cur.length - 1])
    tear.setAttribute('transform', `translate(296 ${f2(316 + (1 - t) * -8)}) scale(${t.toFixed(3)}) translate(-296 -316)`)
    stepHead(now, dt)
    raf = requestAnimationFrame(frame)
  }

  function play() { if (!running) { running = true; prev = performance.now(); raf = requestAnimationFrame(frame) } }
  const pause = () => { running = false; cancelAnimationFrame(raf) }

  window.addEventListener('pointermove', onMove, { passive: true })
  svg.addEventListener('pointerdown', onDown)
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? play() : pause()))
  io.observe(svg)
  play()

  // Swipe del carosello: le pupille saltano verso il lato (dir -1 sinistra,
  // +1 destra), oltre il bordo, e poi tornano dove le manda look().
  const glance = (dir) => {
    const r = svg.getBoundingClientRect()
    look(r.left + r.width / 2 + dir * r.width * 1.4, r.bottom + r.height * 0.5)
    boostUntil = performance.now() + 320
  }
  // Un'espressione per ms millisecondi (es. 'spirale' = confuso).
  const react = (expr, ms = 1200) => {
    if (!D.espr[expr]) return
    reactExpr = expr; mode = 'react'; reactUntil = performance.now() + ms; blinkT = -1
  }

  // Posa fissa finche' non si toglie (null): niente sguardo, niente idle.
  const hold = (expr) => { holdExpr = expr && D.espr[expr] ? expr : null; lastMove = performance.now() }

  return {
    look,
    glance,
    wink,
    hold,
    react,
    stop() {
      pause(); io.disconnect()
      window.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerdown', onDown)
    },
  }
}

const ZackEyes = forwardRef(function ZackEyes({ className, style, onReact }, ref) {
  const svgRef = useRef(null)
  const engine = useRef(null)
  const reactCb = useRef(onReact)
  useEffect(() => { reactCb.current = onReact })
  // Id unici per ogni paio di occhi: i clipPath si cercano in tutta la pagina,
  // e gli occhi possono essere due (home + schermata dei social).
  const prefix = `zk${useId().replace(/[^a-zA-Z0-9]/g, '')}-`
  const markup = useRef(MARKUP.replaceAll('zk-', prefix))

  useEffect(() => {
    engine.current = startEngine(svgRef.current, prefix, (e) => reactCb.current?.(e))
    return () => engine.current?.stop()
  }, [prefix])

  useImperativeHandle(ref, () => ({
    lookAt: (x, y) => engine.current?.look(x, y),
    glance: (dir) => engine.current?.glance(dir),
    wink: (eye, opts) => engine.current?.wink(eye, opts) ?? 0,
    hold: (expr) => engine.current?.hold(expr),
    react: (expr, ms) => engine.current?.react(expr, ms),
    // L'occhio dal lato di un punto dello schermo: 0 sinistra, 1 destra.
    sideOf: (clientX) => {
      const r = svgRef.current?.getBoundingClientRect()
      return r && clientX < r.left + r.width / 2 ? 0 : 1
    },
    // Testa che scuote: la classe riparte da capo anche se e' gia' applicata.
    shake: () => {
      const el = svgRef.current
      if (!el) return
      el.classList.remove('zk-shake'); void el.getBoundingClientRect(); el.classList.add('zk-shake')
    },
  }), [])

  return (
    <svg
      ref={svgRef}
      viewBox={VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Zack the Duck"
      className={className}
      style={{ touchAction: 'manipulation', userSelect: 'none', WebkitTapHighlightColor: 'transparent', ...style }}
      dangerouslySetInnerHTML={{ __html: markup.current }}
    />
  )
})

export default ZackEyes
