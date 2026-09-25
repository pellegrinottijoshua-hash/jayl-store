import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getProductById } from '@/data/products'
import { getDrop } from '../../../api/_lib/drop.js'
import DropCountdown from './DropCountdown'
import { formatPrice, shortProductName as shortName } from '@/lib/utils'
import { dropWindowState, BEFORE, LIVE, CLOSED } from './dropWindowState'

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
 */

const STRIPS = 16
const SPRING = { type: 'spring', stiffness: 170, damping: 26, mass: 1 }

// ── NEW ──────────────────────────────────────────────────────────────────────
// Un ciclo, non un'insegna accesa: le lettere arrivano sfocate e larghe e si
// stringono a fuoco, la parola tiene, poi se ne va in dissolvenza e per un
// attimo non c'e' niente. Il vuoto fa parte dell'animazione: e' quello che fa
// tornare a guardare.
const NEW_IN    = 1.4  // entrata (s)
const NEW_HOLD  = 2.6  // parola ferma
const NEW_OUT   = 0.9  // uscita
const NEW_REST  = 0.9  // vuoto prima del giro dopo

const EASE_OUT_EXPO    = [0.16, 1, 0.3, 1]
const EASE_IN_QUART    = [0.5, 0, 0.75, 0]

const letterVariants = {
  hidden: (i) => ({
    opacity: 0,
    filter: 'blur(12px)',
    x: `${(i - 1) * 0.22}em`,
    transition: { duration: NEW_OUT * 0.8, delay: i * 0.07, ease: EASE_IN_QUART },
  }),
  shown: (i) => ({
    opacity: 1,
    filter: 'blur(0px)',
    x: '0em',
    transition: { duration: NEW_IN - 0.2, delay: 0.1 + i * 0.1, ease: EASE_OUT_EXPO },
  }),
}

// Il carattere di NEW, in un posto solo. Deve essere caricato in index.html.
const NEW_FONT = { family: "'Tenor Sans', 'Space Grotesk', sans-serif", weight: 400, tracking: '0.18em' }

function NewMark() {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (reduce) { setShown(true); return }
    let t
    const step = (next) => {
      setShown(next)
      t = setTimeout(() => step(!next), (next ? NEW_IN + NEW_HOLD : NEW_OUT + NEW_REST) * 1000)
    }
    t = setTimeout(() => step(true), 200)
    return () => clearTimeout(t)
  }, [reduce])

  return (
    <motion.h1
      aria-label="New"
      className="relative leading-[0.9] flex justify-center select-none mb-3 text-accent [[data-site-theme=cream]_&]:text-ink"
      style={{ fontFamily: NEW_FONT.family, fontWeight: NEW_FONT.weight, fontSize: 'clamp(4.25rem, 21vw, 8.5rem)', letterSpacing: NEW_FONT.tracking, paddingLeft: `calc(${NEW_FONT.tracking} + 0.04em)` }}
      initial="hidden"
      animate={shown ? 'shown' : 'hidden'}
    >
      {['N', 'E', 'W'].map((l, i) => (
        <motion.span key={l} aria-hidden custom={i} variants={letterVariants} className="inline-block will-change-transform">
          {l}
        </motion.span>
      ))}
    </motion.h1>
  )
}

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

function Strip({ j, slotDeg, rot, W, H, R, alphaDeg, src, eager }) {
  const dA = alphaDeg / STRIPS
  const a = slotDeg - alphaDeg / 2 + dA * (j + 0.5)
  const chord = 2 * R * Math.sin(((dA / 2) * Math.PI) / 180)
  const opacity = useTransform(rot, (r) => edgeFade(a + r))
  return (
    <motion.div
      className="absolute overflow-hidden"
      style={{
        width: chord + 0.8, // +0.8px: niente fessure fra una striscia e l'altra
        height: H,
        left: -(chord + 0.8) / 2,
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
  const ratio    = mobile ? 0.61 : 0.78
  const W        = Math.min(stage.w * (mobile ? 0.68 : 0.27), stage.h * 1.1 * ratio, 460)
  const H        = W / ratio
  const thetaDeg = mobile ? 44 : 40              // passo angolare fra una scheda e l'altra
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

  if (n === 0) return null

  const mod = (k) => ((k % n) + n) % n
  const current = items[mod(pos)]
  const slots = [-2, -1, 0, 1, 2].map((o) => pos + o)
  const countdownCls = 'text-[9px] tracking-[0.2em] uppercase tabular-nums text-white/75'

  return (
    <div className="relative flex-1 min-h-0 flex flex-col pt-[62px]">
      <NewMark />

      {/* Palco: occhio all'altezza del bordo alto (che resta dritto), cosi' curva solo il bordo basso. Prima: occhio sopra il bordo alto, cosi' sia il
          bordo alto sia quello basso delle schede curvano verso il basso al
          centro — l'arco del cilindro visto da sopra. */}
      <motion.div
        ref={stageRef}
        className="relative flex-1 min-h-[240px] mt-2 outline-none"
        style={{ perspective: mobile ? 800 : 1500, perspectiveOrigin: '50% 50%', touchAction: 'pan-y' }}
        onPan={onPan}
        onPanEnd={onPanEnd}
        // Un click nuovo non deve ereditare il "moved" di uno swipe finito
        // fuori dalla scheda: si azzera a ogni pressione.
        onPointerDown={() => { moved.current = false }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="region"
        aria-roledescription="carousel"
        aria-label="Drop pieces"
      >
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

        {/* Il countdown dentro la scheda davanti, in cima alla foto: piccolo e
            senza una riga sua, cosi' non spinge giu' le schede. */}
        {stage.w > 0 && (
          <div
            className="absolute inset-x-0 z-20 pointer-events-none text-center"
            style={{ top: `calc(50% - ${H / 2 - 4}px)` }}
          >
            {state === BEFORE && <DropCountdown to={target} label="opens in" className={countdownCls} />}
            {state === LIVE && <DropCountdown to={target} label="closes in" className={countdownCls} />}
            {state === CLOSED && target && <DropCountdown to={target} label="next drop in" className={countdownCls} />}
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

      {/* Il prezzo come protagonista: 22 centrato da solo, l'euro in apice
          fuori dal centro (absolute), "shipped" centrato sotto. La spedizione
          e' gratis ovunque: quello e' il prezzo finale. */}
      <div className="pt-3 pb-3 text-center text-cream">
        <p className="font-display font-light leading-none" style={{ fontSize: 'clamp(4.25rem, 20vw, 6.5rem)' }}>
          <span className="relative inline-block">
            {formatPrice(price).replace(/[^\d.,]/g, '')}
            <span className="absolute left-full top-[0.1em] ml-[0.05em] text-[0.34em]">€</span>
          </span>
        </p>
        {/* pl pari al tracking: la spaziatura dopo l'ultima lettera sposterebbe
            la parola a sinistra del centro. */}
        <p className="mt-1.5 text-[10px] tracking-[0.42em] pl-[0.42em] uppercase text-cream/60">shipped</p>
      </div>
    </div>
  )
}
