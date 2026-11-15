import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { VIEWBOX, MARKUP, D, IDLE_CYCLE } from './zackEyesData'

// Gli occhi di Zack: lo stesso motore di motion-lab/home-occhi, portato in
// React. Le pupille seguono mouse e dito su tutta la pagina; da fermo gira
// fra le espressioni; tocchi sugli occhi: 1 sorpreso, 2 stelle, 3+ KO.
// In piu' rispetto alla home-occhi:
//  - ref.lookAt(clientX, clientY): guarda un punto (il capo nel carosello);
//  - si ferma quando esce dallo schermo (batteria).
// Disegno e dati: scripts/zack-eyes-sync.mjs → zackEyesData.js.

const FORME = ['cerchio', 'cuore', 'stella', 'x', 'dollaro', 'spirale', 'pixel']
const NS = 'http://www.w3.org/2000/svg'
const EYE = [{ cx: 371, cy: 205 }, { cx: 829, cy: 205 }]
const RX = 129, RY = 113
const IDLE_AFTER = 3500, IDLE_HOLD = [2600, 3600]
const BLINK = 190
const f2 = (n) => n.toFixed(2)

const toVec = (name) => {
  const e = D.espr[name] || D.espr.originale
  return [...e.o[0], ...e.o[1], ...FORME.map((f) => (f === e.f ? 1 : 0)), e.rif, e.tear]
}
const lidY = (i, x, a, b) => {
  const lx = i === 0 ? x : 1200 - x
  return a + (b - a) * (lx - 242) / 258
}

function startEngine(svg, onReact) {
  const $ = (id) => svg.querySelector('#zk-' + id)

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
  const onMove = (ev) => look(ev.clientX, ev.clientY)
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

  const blinkAmt = (now) => {
    if (blinkT < 0) {
      if (now > nextBlink && mode !== 'react') blinkT = now; else return 0
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

  const frame = (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now
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
        exprName = IDLE_CYCLE[idleIdx++ % IDLE_CYCLE.length]
        idleNext = now + IDLE_HOLD[0] + Math.random() * (IDLE_HOLD[1] - IDLE_HOLD[0])
      }
      tgt = toVec(exprName); speed = 2.6
    }
    const k = 1 - Math.exp(-speed * dt)
    for (let j = 0; j < cur.length; j++) cur[j] += (tgt[j] - cur[j]) * k

    const b = blinkAmt(now), CL = 288
    for (let i = 0; i < 2; i++) {
      const o = i * 6
      const a = cur[o] + (CL - cur[o]) * b, c = cur[o + 1] + (CL - cur[o + 1]) * b, low = cur[o + 2]
      const x0 = i ? 688 : 230, x1 = i ? 970 : 512
      poly[i].setAttribute('points',
        `${x0},${f2(lidY(i, x0, a, c))} ${x1},${f2(lidY(i, x1, a, c))} ${x1},${f2(low)} ${x0},${f2(low)}`)
      pup[i].setAttribute('transform', `translate(${f2(cur[o + 3])} ${f2(cur[o + 4])}) scale(${Math.max(0, cur[o + 5]).toFixed(3)})`)
      FORME.forEach((f, j) => shapeEls[i][j].setAttribute('transform', `scale(${Math.max(0, cur[12 + j]).toFixed(3)})`))
      rifEls[i].setAttribute('transform', `scale(${Math.max(0, cur[12 + FORME.length]).toFixed(3)})`)
    }
    const t = Math.max(0, cur[cur.length - 1])
    tear.setAttribute('transform', `translate(296 ${f2(316 + (1 - t) * -8)}) scale(${t.toFixed(3)}) translate(-296 -316)`)
    raf = requestAnimationFrame(frame)
  }

  const play = () => { if (!running) { running = true; prev = performance.now(); raf = requestAnimationFrame(frame) } }
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

  return {
    look,
    glance,
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

  useEffect(() => {
    engine.current = startEngine(svgRef.current, (e) => reactCb.current?.(e))
    return () => engine.current?.stop()
  }, [])

  useImperativeHandle(ref, () => ({
    lookAt: (x, y) => engine.current?.look(x, y),
    glance: (dir) => engine.current?.glance(dir),
    react: (expr, ms) => engine.current?.react(expr, ms),
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
      dangerouslySetInnerHTML={{ __html: MARKUP }}
    />
  )
})

export default ZackEyes
