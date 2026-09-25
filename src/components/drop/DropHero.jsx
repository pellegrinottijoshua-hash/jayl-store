import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getProductById } from '@/data/products'
import { getDrop } from '../../../api/_lib/drop.js'
import DropCountdown from './DropCountdown'
import { formatPrice, shortProductName as shortName } from '@/lib/utils'
import { dropWindowState, BEFORE, LIVE, CLOSED } from './dropWindowState'

/**
 * Il drop in home: NEW, tre schede curve, nome e prezzo. Nient'altro.
 *
 * Tutto quello che c'era prima (titolo del drop, badge copie, "Preview · not
 * on sale yet", la riga d'archivio) chiedeva di essere letto prima di
 * lasciar guardare le maglie. Qui restano le quattro cose che servono a
 * decidere: che e' nuovo, cos'e', quanto costa (spedizione compresa), quanto
 * manca. Il resto vive nella scheda prodotto.
 *
 * Le tre schede stanno su un arco (coverflow leggero): quella al centro e'
 * dritta, le laterali ruotano verso il centro. Si cambia con swipe/drag,
 * frecce, tastiera o toccando una laterale; toccare quella al centro apre il
 * prodotto.
 */

// Posizione di una scheda rispetto a quella attiva, sull'anello: -1 a sinistra,
// 0 al centro, 1 a destra. Con tre pezzi sono sempre visibili tutti e tre.
function ringOffset(idx, active, n) {
  let o = (((idx - active) % n) + n) % n
  if (o > n / 2) o -= n
  return o
}

const SWIPE_FRACTION = 0.18 // della larghezza scheda: oltre, lo swipe cambia pezzo

function NewMark() {
  const reduce = useReducedMotion()
  const letters = ['N', 'E', 'W']
  return (
    <h1
      aria-label="New"
      className="font-display font-light leading-[0.85] flex justify-center select-none"
      style={{ fontSize: 'clamp(4.5rem, 22vw, 8.5rem)', letterSpacing: '0.06em' }}
    >
      {letters.map((l, i) => (
        <span key={l} aria-hidden className="inline-block overflow-hidden px-[0.02em] pb-[0.06em]">
          {/* Entrata: ogni lettera sale dalla sua maschera, in sequenza. */}
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: '105%' }}
            animate={{ y: 0 }}
            transition={{ delay: 0.1 + i * 0.09, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Poi un'onda lenta che la attraversa, e una lama d'oro che passa
                da sinistra a destra (.new-letter in index.css). */}
            <motion.span
              className="inline-block new-letter"
              data-letter={l}
              style={{ animationDelay: `${1.4 + i * 0.14}s`, transformOrigin: '50% 100%' }}
              animate={reduce ? undefined : { y: [0, -5, 0], scaleY: [1, 1.07, 1] }}
              transition={{ delay: 1.2 + i * 0.16, duration: 2.6, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
            >
              {l}
            </motion.span>
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

export default function DropHero() {
  const cfg = getDrop()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
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

  // Si entra sul pezzo di mezzo: con due laterali visibili i tre pezzi si
  // annunciano come una scelta, non come un hero singolo.
  const [active, setActive] = useState(() => Math.floor((n - 1) / 2))
  const go = useCallback((dir) => setActive((a) => (((a + dir) % n) + n) % n), [n])

  // Misura del palco: le schede si dimensionano sull'altezza disponibile, non
  // solo sulla larghezza — su un telefono basso un 4:5 largo il 70% spingerebbe
  // prezzo e subscribe sotto la piega.
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
  // Su telefono la scheda e' piu' alta di un 4:5 (le foto nascono 9:16): cosi'
  // riempie il palco invece di lasciare una fascia vuota sopra e sotto.
  const mobile = stage.w < 640
  const ratio  = mobile ? 0.7 : 0.8
  const cardW  = Math.min(stage.w * (mobile ? 0.68 : 0.3), stage.h * 0.96 * ratio, 500)
  const cardH  = cardW / ratio

  // Drag/swipe: le schede seguono il dito, al rilascio si sceglie il pezzo.
  const [dragDx, setDragDx] = useState(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const onPanStart = () => { dragging.current = true; moved.current = false }
  const onPan = (_, info) => {
    if (Math.abs(info.offset.x) > 6) moved.current = true
    setDragDx(info.offset.x)
  }
  const onPanEnd = (_, info) => {
    dragging.current = false
    const dx = info.offset.x + info.velocity.x * 0.15
    if (dx < -cardW * SWIPE_FRACTION) go(1)
    else if (dx > cardW * SWIPE_FRACTION) go(-1)
    setDragDx(0)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1) }
    if (e.key === 'Enter' && items[active]) navigate(`/product/${items[active].id}`)
  }

  // Suggerimento una tantum: se nessuno tocca il carosello, dopo un attimo le
  // schede accennano uno spostamento — si capisce che si scorrono senza
  // scriverlo da nessuna parte.
  const [nudge, setNudge] = useState(0)
  const touched = useRef(false)
  useEffect(() => {
    if (reduce || n < 2) return
    const t1 = setTimeout(() => { if (!touched.current) setNudge(-cardW * 0.12) }, 2600)
    const t2 = setTimeout(() => setNudge(0), 3150)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [reduce, n, cardW])

  if (n === 0) return null

  const countdownCls = 'text-[10px] sm:text-xs tracking-[0.18em] uppercase tabular-nums text-cream/70'
  const current = items[active]

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Countdown in alto a destra — l'unica informazione sul drop che resta. */}
      <div className="flex justify-end px-5 sm:px-8 pt-[92px] sm:pt-[96px] h-[112px] sm:h-[118px]">
        {state === BEFORE && <DropCountdown to={target} label="opens in" className={countdownCls} />}
        {state === LIVE && <DropCountdown to={target} label="closes in" className={countdownCls} />}
        {state === CLOSED && target && <DropCountdown to={target} label="next drop in" className={countdownCls} />}
      </div>

      <div className="text-cream -mt-1">
        <NewMark />
      </div>

      {/* Palco del carosello */}
      <motion.div
        ref={stageRef}
        className="relative flex-1 min-h-[240px] mt-2 sm:mt-4 outline-none"
        style={{ perspective: mobile ? 760 : 1300, touchAction: 'pan-y' }}
        onPanStart={(e, i) => { touched.current = true; onPanStart(e, i) }}
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
        {stage.w > 0 && items.map((p, idx) => {
          const o = ringOffset(idx, active, n)
          const hidden = Math.abs(o) > 1
          const isCenter = o === 0
          const live = dragging.current || dragDx !== 0
          return (
            <motion.div
              key={p.id}
              className="absolute left-1/2 top-1/2"
              style={{
                width: cardW,
                height: cardH,
                marginLeft: -cardW / 2,
                marginTop: -cardH / 2,
                zIndex: 10 - Math.abs(o),
                transformStyle: 'preserve-3d',
                pointerEvents: hidden ? 'none' : 'auto',
              }}
              initial={false}
              animate={{
                x: o * cardW * (mobile ? 0.9 : 0.98) + dragDx + nudge,
                rotateY: -o * (mobile ? 42 : 30),
                scale: isCenter ? 1 : 0.9,
                opacity: hidden ? 0 : isCenter ? 1 : 0.7,
              }}
              transition={live
                ? { duration: 0 }
                : { type: 'spring', stiffness: 240, damping: 30, mass: 0.9 }}
            >
              <Link
                to={`/product/${p.id}`}
                draggable={false}
                aria-label={shortName(p.name)}
                tabIndex={isCenter ? 0 : -1}
                onClick={(e) => {
                  touched.current = true
                  if (moved.current) { e.preventDefault(); moved.current = false; return }
                  // Una laterale non apre il prodotto: lo porta al centro.
                  if (!isCenter) { e.preventDefault(); setActive(idx) }
                }}
                className="group block w-full h-full overflow-hidden bg-surface-2"
              >
                <img
                  src={cfg.current?.heroImages?.[p.id] ?? p.heroImage ?? p.image}
                  alt={p.altText || p.name}
                  draggable={false}
                  loading="eager"
                  ref={isCenter ? (el) => { if (el) el.setAttribute('fetchpriority', 'high') } : undefined}
                  className="w-full h-full object-cover select-none transition-transform duration-700 group-hover:scale-[1.03]"
                />
                {/* La curva: un'ombra morbida sui bordi, come carta piegata
                    verso chi guarda. */}
                <span
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.28), transparent 16%, transparent 84%, rgba(0,0,0,0.28))' }}
                />
              </Link>
            </motion.div>
          )
        })}

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => { touched.current = true; go(-1) }}
              aria-label="Previous piece"
              className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center text-cream/60 hover:text-cream transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.25} />
            </button>
            <button
              type="button"
              onClick={() => { touched.current = true; go(1) }}
              aria-label="Next piece"
              className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center text-cream/60 hover:text-cream transition-colors"
            >
              <ChevronRight size={22} strokeWidth={1.25} />
            </button>
          </>
        )}
      </motion.div>

      {/* Nome e prezzo del pezzo al centro. "Shipped": la spedizione e' gratis
          ovunque, il prezzo e' gia' quello finale. */}
      <div className="h-[92px] sm:h-[116px] pt-3 sm:pt-4 text-center text-cream" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <p className="font-sans text-sm sm:text-base tracking-[0.12em] leading-tight">{shortName(current.name)}</p>
            <p className="font-display text-3xl sm:text-4xl leading-none mt-1.5">{formatPrice(price)}</p>
            <p className="text-[9px] sm:text-[10px] tracking-[0.3em] uppercase text-cream/55 mt-1">shipped</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
