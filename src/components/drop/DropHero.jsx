import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getProductById } from '@/data/products'
import { getDrop } from '../../../api/_lib/drop.js'
import GoldenTrail from './GoldenTrail'
import { shortProductName as shortName } from '@/lib/utils'
import { dropWindowState, LIVE } from './dropWindowState'
import { homeVideoSrc, stripSourceRect } from '@/lib/heroVideo'
import NewMark from './NewMark'
import ShippedPrice from './ShippedPrice'
import { VIDEO_VIGNETTE } from './videoVignette'

/**
 * Il drop in home: NEW, tre schede curve, nome e prezzo. Nient'altro.
 *
 * Le schede stanno sulla faccia esterna di un cilindro visto un filo
 * dall'alto: quella davanti e' piena, le laterali girano via verso i bordi, e
 * i bordi alti e bassi di tutte e tre disegnano un arco. Ogni scheda e' fatta
 * di strisce verticali (STRIPS), ognuna ruotata del suo spicchio: e' cosi'
 * che l'immagine si curva davvero invece di restare un rettangolo inclinato.
 * Si gira con swipe/drag, frecce, tastiera o toccando una laterale; toccare
 * quella davanti apre il prodotto. Nessun movimento da solo.
 *
 * Video: la scheda davanti, se il pezzo ha un video home (tab Drop) o un video
 * hero, si muove. Un solo <video> muto, quello del pezzo davanti, e ogni
 * striscia ne ridisegna la sua fetta su un <canvas> a ogni fotogramma: cosi'
 * il video si curva come la foto. La foto resta sotto la canvas: finche' il
 * video non ha dati, o se il telefono blocca l'autoplay, si vede lei.
 * Il video gira una volta e resta sul fotogramma finale: chi l'ha visto gira
 * il cilindro per gli altri, o torna indietro e lo rivede dall'inizio. Una
 * sfumatura nel nero della pagina sui bordi della scheda video toglie
 * l'effetto riquadro (lo sfondo dei video Kling non e' il nostro nero).
 *
 * Su desktop la home e' un'altra (DropDesktop: le tre schede affiancate); NEW,
 * prezzo e sfumatura sono gli stessi (NewMark, ShippedPrice, videoVignette).
 */

const STRIPS = 16
const SPRING = { type: 'spring', stiffness: 170, damping: 26, mass: 1 }

// ── Carosello curvo ──────────────────────────────────────────────────────────

// Le schede che girano dietro spariscono nel fondo quasi di taglio. Solo
// l'opacita' della striscia (un nodo foglia: li' non appiattisce il 3D) e solo
// oltre i 68°: prima, due strisce semitrasparenti sovrapposte di un soffio
// disegnerebbero una riga su ogni giunta. La luce che cala verso i fianchi la
// fa una sfumatura continua sul palco (sotto), non la singola striscia: una
// luminosita' per striscia fa gradini visibili.
function edgeFade(deg) {
  const d = Math.abs(deg)
  return d <= 68 ? 1 : d >= 86 ? 0 : 1 - (d - 68) / 18
}

function Strip({ j, slotDeg, rot, W, H, R, alphaDeg, src, eager, video }) {
  const dA = alphaDeg / STRIPS
  const a = slotDeg - alphaDeg / 2 + dA * (j + 0.5)
  const chord = 2 * R * Math.sin(((dA / 2) * Math.PI) / 180)
  const stripW = chord + 0.8 // +0.8px: niente fessure fra una striscia e l'altra
  const opacity = useTransform(rot, (r) => edgeFade(a + r))

  // La fetta del video che cade su questa striscia, a ogni fotogramma nuovo
  // (requestVideoFrameCallback dove c'e', altrimenti a ogni frame di schermo).
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.ceil(stripW * dpr)
    canvas.height = Math.ceil(H * dpr)
    const ctx = canvas.getContext('2d')
    const byFrame = typeof video.requestVideoFrameCallback === 'function'
    let handle = 0
    let stopped = false
    const draw = () => {
      if (stopped) return
      if (video.readyState >= 2 && video.videoWidth) {
        const r = stripSourceRect({ videoW: video.videoWidth, videoH: video.videoHeight, W, H, x: (j * W) / STRIPS, w: stripW })
        ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height)
      }
      handle = byFrame ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw)
    }
    draw()
    return () => {
      stopped = true
      if (byFrame) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [video, W, H, j, stripW])

  return (
    <motion.div
      className="absolute overflow-hidden"
      style={{
        width: stripW,
        height: H,
        left: -stripW / 2,
        top: -H / 2,
        transform: `rotateY(${a}deg) translateZ(${R}px)`,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        opacity,
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute top-0 max-w-none select-none pointer-events-none object-cover"
        style={{ width: W, height: H, left: -(j * W) / STRIPS, objectPosition: '50% 30%' }}
      />
      {video && (
        <>
          <canvas ref={canvasRef} aria-hidden className="absolute top-0 left-0 pointer-events-none" style={{ width: stripW, height: H }} />
          <div aria-hidden className="absolute top-0 pointer-events-none" style={{ width: W, height: H, left: -(j * W) / STRIPS, background: VIDEO_VIGNETTE }} />
        </>
      )}
      {/* Ombre in basso (nome) e in alto (countdown): identiche su ogni
          striscia perche' verticali, quindi niente giunte. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-1/6 bg-gradient-to-b from-black/45 to-transparent" />
    </motion.div>
  )
}

export default function DropHero() {
  const cfg = getDrop()
  const navigate = useNavigate()
  const { state, target } = dropWindowState(cfg)

  // `current.productIds` resta popolato finche' l'admin non chiude il drop,
  // anche dopo endsAt — quindi CLOSED arriva sia da li' sia da un current gia'
  // svuotato. In entrambi i casi si mostrano i pezzi di `current` se ci sono,
  // altrimenti quelli del drop appena chiuso. Lo schermo non resta mai vuoto.
  const currentIds     = cfg.current?.productIds || []
  const showingCurrent = currentIds.length > 0
  const shown = showingCurrent ? currentIds : (cfg.previous?.productIds || [])
  const items = shown.map(getProductById).filter(Boolean)
  const n = items.length
  const price = showingCurrent ? cfg.current.dropPrice : cfg.archivePrice

  // Misura del palco: le schede si dimensionano sull'altezza disponibile, non
  // solo sulla larghezza — su un telefono basso spingerebbero prezzo e
  // subscribe sotto la piega.
  const stageRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const mobile   = stage.w < 640
  // Piu' alte che larghe: crescono in altezza fino a riempire il palco, e la
  // larghezza resta quella che lascia vedere le due laterali ai bordi.
  // Su desktop la scheda e' piu' grande e piu' verticale di prima: ora e'
  // il primo schermo anche li', e i video hero sono 9:16.
  const ratio    = mobile ? 0.61 : 0.66
  const W        = mobile
    ? Math.min(stage.w * 0.68, stage.h * 1.1 * ratio, 460)
    : Math.min(stage.w * 0.3, stage.h * 0.86 * ratio, 600)
  const H        = W / ratio
  const thetaDeg = mobile ? 40 : 40              // passo angolare fra una scheda e l'altra
  const alphaDeg = thetaDeg - (mobile ? 3 : 4)   // quanto arco occupa la scheda
  const R        = W / ((alphaDeg * Math.PI) / 180)

  // `pos` non ha limiti (…, -1, 0, 1, 2, …): il pezzo mostrato e' pos mod n.
  // Cosi' andando sempre avanti il cilindro gira sempre nello stesso verso,
  // senza il salto all'indietro di chi riparte da zero.
  const [pos, setPos] = useState(() => Math.floor((n - 1) / 2))
  const rot = useMotionValue(0)
  const posRef = useRef(pos)
  useLayoutEffect(() => { rot.set(-posRef.current * thetaDeg) }, [thetaDeg, rot])

  const goTo = useCallback((next) => {
    posRef.current = next
    setPos(next)
    animate(rot, -next * thetaDeg, SPRING)
  }, [rot, thetaDeg])
  const go = useCallback((dir) => goTo(posRef.current + dir), [goTo])

  // Drag/swipe: il cilindro segue il dito, al rilascio si ferma sul pezzo
  // piu' vicino (con un colpo veloce si passa al successivo).
  const moved = useRef(false)
  const degPerPx = thetaDeg / (W * 1.1 || 1)
  const onPan = (_, info) => {
    if (Math.abs(info.offset.x) > 6) moved.current = true
    const drag = Math.max(-thetaDeg * 1.2, Math.min(thetaDeg * 1.2, info.offset.x * degPerPx))
    rot.set(-posRef.current * thetaDeg + drag)
  }
  const onPanEnd = (_, info) => {
    const flick = info.velocity.x * degPerPx * 0.12
    const landed = Math.round(-(rot.get() + flick) / thetaDeg)
    const clamped = Math.max(posRef.current - 1, Math.min(posRef.current + 1, landed))
    goTo(clamped)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1) }
    if (e.key === 'Enter' && items.length) navigate(`/product/${items[((posRef.current % n) + n) % n].id}`)
  }

  // ── Video della scheda davanti ─────────────────────────────────────────────
  // Niente video con "riduci movimento" o il risparmio dati: restano le foto.
  const reduceMotion = useReducedMotion()
  const [saveData] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.connection?.saveData))
  const front = n ? items[((pos % n) + n) % n] : null
  const videoSrc = front && !reduceMotion && !saveData
    ? homeVideoSrc(showingCurrent ? cfg.current : null, front)
    : null
  // Il <video> del pezzo davanti, appena ha un fotogramma da disegnare.
  const [videoEl, setVideoEl] = useState(null)
  // Gira solo mentre il cilindro e' sullo schermo.
  useEffect(() => {
    const stageEl = stageRef.current
    if (!videoEl || !stageEl || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      // Finito resta finito: si rivede tornando sul pezzo, non scorrendo la pagina.
      if (e.isIntersecting && !videoEl.ended) videoEl.play().catch(() => {})
      else if (!e.isIntersecting) videoEl.pause()
    }, { threshold: 0.25 })
    io.observe(stageEl)
    return () => io.disconnect()
  }, [videoEl])
  // Dopo un giro il pezzo davanti cambia: le strisce ricevono un video solo
  // quando e' davvero il suo, mai per un frame quello del pezzo precedente.
  const frontVideo = videoEl && videoEl.dataset.src === videoSrc ? videoEl : null

  if (n === 0) return null

  const mod = (k) => ((k % n) + n) % n
  const current = items[mod(pos)]
  // Su schermi larghi (tablet) solo le tre davanti: con schede grandi e la vista dall'alto,
  // quelle a ±80° salivano sopra le altre e disegnavano una banda scura in
  // cima al palco. Quella che entra girando compare al bordo, nel buio dei fianchi.
  const slots = (mobile ? [-2, -1, 0, 1, 2] : [-1, 0, 1]).map((o) => pos + o)

  return (
    <div className="relative flex-1 min-h-0 flex flex-col pt-[84px]">
      <NewMark word={(showingCurrent && cfg.current.headline) || 'NEW'} />

      {/* Palco: occhio all'altezza del bordo alto (che resta dritto), cosi' curva solo il bordo basso. Prima: occhio sopra il bordo alto, cosi' sia il
          bordo alto sia quello basso delle schede curvano verso il basso al
          centro — l'arco del cilindro visto da sopra. */}
      <motion.div
        ref={stageRef}
        className="relative flex-1 min-h-[240px] mt-2 outline-none"
        style={{ perspective: mobile ? 1800 : 1500, perspectiveOrigin: '50% -150%', touchAction: 'pan-y' }}
        onPan={onPan}
        onPanEnd={onPanEnd}
        // Un click nuovo non deve ereditare il "moved" di uno swipe finito
        // fuori dalla scheda: si azzera a ogni pressione.
        onPointerDown={() => { moved.current = false }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="region"
        aria-roledescription="carousel"
        aria-label="New pieces"
      >
        {/* Il video del pezzo davanti: lo leggono le strisce, lui resta sotto le
            schede quasi trasparente. Non del tutto invisibile: iOS non fa
            partire l'autoplay di un video che considera nascosto. */}
        {stage.w > 0 && videoSrc && (
          <video
            key={videoSrc}
            data-src={videoSrc}
            ref={(el) => {
              if (!el) return
              // React non scrive `muted` come attributo: senza, Safari iOS
              // rifiuta l'autoplay. E iOS non scarica niente finche' non si
              // chiede play(): aspettare loadeddata prima di play() bloccherebbe.
              el.muted = true
              el.defaultMuted = true
              el.play?.().catch(() => {})
            }}
            src={videoSrc}
            muted
            playsInline
            autoPlay
            preload="auto"
            disablePictureInPicture
            aria-hidden
            onLoadedData={(e) => setVideoEl(e.currentTarget)}
            className="absolute left-1/2 top-1/2 pointer-events-none object-cover"
            style={{ width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, opacity: 0.01 }}
          />
        )}

        {stage.w > 0 && (
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{ transformStyle: 'preserve-3d', z: -R, rotateY: rot }}
          >
            {slots.map((s) => {
              const p = items[mod(s)]
              const isCenter = s === pos
              return (
                <Link
                  key={s}
                  to={`/product/${p.id}`}
                  draggable={false}
                  aria-label={shortName(p.name)}
                  aria-hidden={isCenter ? undefined : true}
                  tabIndex={-1}
                  onClick={(e) => {
                    if (moved.current) { e.preventDefault(); moved.current = false; return }
                    // Una laterale non apre il prodotto: la porta davanti.
                    if (!isCenter) { e.preventDefault(); goTo(s) }
                  }}
                  className="absolute left-0 top-0"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {Array.from({ length: STRIPS }, (_, j) => (
                    <Strip
                      key={j}
                      j={j}
                      slotDeg={s * thetaDeg}
                      rot={rot}
                      W={W}
                      H={H}
                      R={R}
                      alphaDeg={alphaDeg}
                      src={cfg.current?.heroImages?.[p.id] ?? p.heroImage ?? p.image}
                      eager={Math.abs(s - pos) <= 1}
                      video={isCenter ? frontVideo : null}
                    />
                  ))}
                </Link>
              )
            })}
          </motion.div>
        )}

        {/* Chiaroscuro: i fianchi del cilindro affondano nel fondo della pagina
            (nero sul nero, panna sulla panna), in continuo. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(90deg, rgb(var(--c-off-black) / 0.7) 0%, rgb(var(--c-off-black) / 0.3) 10%, rgb(var(--c-off-black) / 0) 22%, rgb(var(--c-off-black) / 0) 78%, rgb(var(--c-off-black) / 0.3) 90%, rgb(var(--c-off-black) / 0.7) 100%)',
          }}
        />

        {/* Il tempo del prezzo di lancio, dentro la scheda davanti in cima
            alla foto: la scia dorata di Zack, niente numeri. */}
        {stage.w > 0 && state === LIVE && (
          <div
            className="absolute inset-x-0 z-20 pointer-events-none flex justify-center"
            style={{ top: `calc(50% - ${H / 2 - 10}px)` }}
          >
            <GoldenTrail startsAt={cfg.current.startsAt} endsAt={target} width={`${Math.round(W * 0.5)}px`} />
          </div>
        )}

        {/* Il nome dentro la scheda davanti, sul fondo della foto. */}
        {stage.w > 0 && (
          <div
            className="absolute inset-x-0 z-20 pointer-events-none text-center"
            style={{ top: `calc(50% + ${H / 2 - 38}px)` }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={current.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="text-white text-[11px] tracking-[0.32em] uppercase pl-[0.32em]"
              >
                {shortName(current.name)}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous piece"
              className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center text-cream/50 hover:text-cream transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.1} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next piece"
              className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center text-cream/50 hover:text-cream transition-colors"
            >
              <ChevronRight size={22} strokeWidth={1.1} />
            </button>
          </>
        )}
      </motion.div>

      <ShippedPrice cents={price} />
    </div>
  )
}
