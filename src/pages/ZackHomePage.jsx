import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, VolumeX, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { products } from '@/data/products'
import { isZackProduct, Z } from '@/lib/world'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useThemeStore } from '@/store/themeStore'
import Money from '@/components/Money'
import EtsyRating from '@/components/EtsyRating'
import ZackEyes from '@/components/zack/ZackEyes'
import { cn } from '@/lib/utils'

// La facciata di jayl.store: Zack the Duck.
// «Zack si veste»: gli occhi sono la testa, il capo sotto e' il corpo (il
// manichino su fondo nero). Swipe (o frecce, o i capi ai lati su desktop) e
// Zack cambia vestito, all'infinito: gli occhi seguono il capo che scorre e
// fanno l'occhiolino quando arriva; dopo 3 cambi di fila si confondono.
// Sulla felpa il tasto ↺ gira Zack: si vede il retro e gli occhi si chiudono.
// Sotto: badge Etsy e un solo video 9:16. Mai Pokémon qui dentro.

const ORDER = ['zack-the-duck-tee', 'zack-the-duck-hoodie', 'zack-the-duck-crewneck']
const rank = (p) => { const k = ORDER.indexOf(p.id); return k === -1 ? 99 : k }
const zackProducts = products.filter(isZackProduct).sort((a, b) => rank(a) - rank(b))
const N = zackProducts.length

const VIDEO = { src: '/zack/video/zack-spotted.mp4', poster: '/zack/video/zack-spotted.jpg' }
const FLASH_MS = 110          // un fotogramma del flash dei mockup
const CONFUSED_SWIPES = 3     // cambi ravvicinati che confondono Zack
const label = 'font-sans text-[10px] uppercase'
// I bordi dell'immagine sfumano nel nero della pagina.
const FEATHER = 'radial-gradient(130% 100% at 50% 42%, #000 62%, transparent 100%)'

const sideOf = (p, u) => p.imageSides?.[u] || null
// I mockup su nero del lato davanti (o unici) e del retro, la copertina per prima.
const frontFrames = (p) => [...new Set([p.image, ...(p.homeImages || [])].filter((u) => u && sideOf(p, u) !== 'back'))]
const backFrames = (p) => (p.homeImages || []).filter((u) => sideOf(p, u) === 'back')
const shortName = (p) => p.shortName || p.name.replace(/^Zack the Duck\s*/i, '')

function Preview({ product, onClick, side }) {
  // Desktop: il capo prima / dopo, piccolo e spento ai lati; il mouse lo accende.
  return (
    <button type="button" onClick={onClick} aria-label={`Show ${product.name}`}
      className={cn('group hidden lg:flex flex-col items-center gap-3 w-[200px] opacity-40 hover:opacity-100 transition-opacity duration-300 mt-[18vh]',
        side === 'left' ? 'justify-self-end' : 'justify-self-start')}>
      <div className="w-full" style={{ aspectRatio: '4 / 5', WebkitMaskImage: FEATHER, maskImage: FEATHER }}>
        <img src={product.image} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" draggable={false} />
      </div>
      <span className="flex items-center gap-1 font-sans font-bold uppercase text-xs" style={{ color: Z.cream, letterSpacing: '0.12em' }}>
        {side === 'left' && <ChevronLeft size={14} />}{shortName(product)}{side === 'right' && <ChevronRight size={14} />}
      </span>
    </button>
  )
}

function DressUp() {
  const eyesRef = useRef(null)
  const bodyRef = useRef(null)
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const [back, setBack] = useState(false)
  const [frame, setFrame] = useState(0)
  const swipes = useRef([])
  const flashTimer = useRef(null)
  const winkTimer = useRef(null)
  const dragged = useRef(false)

  const p = zackProducts[idx]
  const frames = back ? backFrames(p) : frontFrames(p)
  const canTurn = !!p.altPrintFileUrl && backFrames(p).length > 0
  const href = `/product/${p.id}${back ? '?side=back' : ''}`

  const stopFlash = () => { clearInterval(flashTimer.current); flashTimer.current = null }
  // Un giro veloce sui mockup, poi si torna alla copertina.
  const flash = useCallback((count) => {
    stopFlash()
    if (count < 2) return
    let i = 0
    flashTimer.current = setInterval(() => {
      i += 1
      if (i >= count) { stopFlash(); setFrame(0); return }
      setFrame(i)
    }, FLASH_MS)
  }, [])
  useEffect(() => () => { stopFlash(); clearTimeout(winkTimer.current) }, [])

  // Gli occhi guardano il corpo: un po' sotto il centro.
  const lookAtBody = (dx = 0) => {
    const r = bodyRef.current?.getBoundingClientRect()
    if (r) eyesRef.current?.lookAt(r.left + r.width / 2 + dx, r.top + r.height * 0.35)
  }

  const go = (delta, byUser = true) => {
    if (!N) return
    setDir(delta > 0 ? 1 : -1)
    setIdx((i) => (i + delta + N) % N)
    setBack(false)
    setFrame(0)
    eyesRef.current?.hold(null)
    clearTimeout(winkTimer.current)
    let confused = false
    if (byUser) {
      const now = Date.now()
      swipes.current = [...swipes.current.filter((t) => now - t < 3500), now]
      if (swipes.current.length >= CONFUSED_SWIPES) {
        swipes.current = []
        confused = true
        eyesRef.current?.react('spirale', 1500)
        eyesRef.current?.shake()
      }
    }
    // Arrivato il capo: occhiolino (se non e' confuso) e flash dei mockup.
    winkTimer.current = setTimeout(() => {
      lookAtBody()
      if (!confused) eyesRef.current?.wink(1)
    }, 420)
  }
  const goTo = (k) => { if (k !== idx) { const d = (k - idx + N) % N; go(d <= N / 2 ? d : d - N) } }

  // Flash a ogni capo nuovo (e quando Zack si gira).
  useEffect(() => {
    const t = setTimeout(() => flash(frames.length), 520)
    return () => clearTimeout(t)
  }, [idx, back, flash, frames.length])

  const turn = () => {
    const b = !back
    setBack(b)
    setFrame(0)
    // Di spalle non ti guarda: occhi chiusi finche' non si rigira.
    eyesRef.current?.hold(b ? 'chiusi' : null)
  }

  // Desktop: frecce della tastiera.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea')) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // si riaggancia a ogni render: usa sempre idx attuale

  if (!N) return null
  const prev = zackProducts[(idx - 1 + N) % N]
  const next = zackProducts[(idx + 1) % N]
  const variants = {
    enter: (d) => ({ x: d > 0 ? '70%' : '-70%', opacity: 0, scale: 0.9, rotate: d > 0 ? 4 : -4 }),
    center: { x: 0, opacity: 1, scale: 1, rotate: 0 },
    exit: (d) => ({ x: d > 0 ? '-70%' : '70%', opacity: 0, scale: 0.9, rotate: d > 0 ? -4 : 4 }),
  }

  return (
    <section id="shop" className="pt-[88px] lg:pt-[84px] pb-4 scroll-mt-24">
      <div className="lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-14 lg:max-w-[1200px] lg:mx-auto lg:px-10 items-start">
        {N > 1 && <Preview product={prev} side="left" onClick={() => go(-1)} />}

        <div className="flex flex-col items-center">
          {/* La testa */}
          <ZackEyes ref={eyesRef} className="relative z-10 w-[90vw] max-w-[480px] h-auto block cursor-pointer" />

          {/* Il corpo: il capo che Zack indossa. Si trascina a destra e a sinistra. */}
          <div ref={bodyRef} className="relative w-[80vw] max-w-[360px] lg:w-[300px] -mt-[1vw] lg:-mt-2"
            style={{ aspectRatio: '4 / 5', touchAction: 'pan-y' }}>
            <AnimatePresence custom={dir} initial={false}>
              <motion.div
                key={p.id}
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 260, damping: 28, opacity: { duration: 0.2 } }}
                drag={N > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragStart={() => { dragged.current = true; stopFlash(); setFrame(0) }}
                onDrag={(e, info) => lookAtBody(info.offset.x * 2.2)}
                onDragEnd={(e, info) => {
                  setTimeout(() => { dragged.current = false }, 60)
                  if (info.offset.x < -60 || info.velocity.x < -450) go(1)
                  else if (info.offset.x > 60 || info.velocity.x > 450) go(-1)
                  else lookAtBody()
                }}
                onTap={() => { if (!dragged.current) navigate(href) }}
                onHoverStart={() => { if (window.matchMedia?.('(hover: hover)').matches) flash(frames.length) }}
                className="absolute inset-0 cursor-pointer select-none"
                style={{ WebkitMaskImage: FEATHER, maskImage: FEATHER }}
                role="link"
                aria-label={`${p.name}${back ? ' — back print' : ''}`}
              >
                <motion.img
                  key={back ? 'back' : 'front'}
                  src={frames[frame] || frames[0]}
                  alt={p.altText || p.name}
                  initial={{ rotateY: 80, opacity: 0.4 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              </motion.div>
            </AnimatePresence>

            {canTurn && (
              <button type="button" onClick={turn} aria-label={back ? 'Show the front' : 'Turn around: back print'}
                className="absolute z-10 bottom-3 right-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm font-sans font-bold text-[10px] uppercase"
                style={{ background: 'rgba(17,17,17,0.6)', color: Z.gold, letterSpacing: '0.14em', border: '1px solid rgba(196,163,90,0.45)' }}>
                <RotateCcw size={12} /> {back ? 'Front' : 'Back'}
              </button>
            )}
          </div>

          {/* Nome, prezzo, compra */}
          <div className="mt-4 w-[80vw] max-w-[360px] lg:w-[300px] flex items-baseline justify-between gap-3">
            <p className="font-sans font-extrabold uppercase text-lg" style={{ color: Z.cream }}>
              {shortName(p)}{back && <span className="ml-2 text-[10px] tracking-[0.2em]" style={{ color: Z.gold }}>BACK</span>}
            </p>
            <span style={{ color: Z.cream }}><Money cents={p.price} className="font-sans font-semibold text-lg" /></span>
          </div>
          <Link to={href}
            className="mt-3 w-[80vw] max-w-[360px] lg:w-[300px] text-center py-3 font-sans font-bold text-xs uppercase transition-colors"
            style={{ background: Z.cream, color: Z.black, letterSpacing: '0.22em' }}>
            Shop {shortName(p)}
          </Link>

          {/* Il guardaroba: un tocco e Zack si cambia */}
          <div className="mt-5 flex items-center gap-5" role="tablist" aria-label="Pieces">
            {zackProducts.map((q, k) => (
              <button key={q.id} type="button" role="tab" aria-selected={k === idx} onClick={() => goTo(k)}
                className="font-sans font-bold uppercase text-[11px] pb-1 border-b-2 transition-colors"
                style={{ letterSpacing: '0.18em', color: k === idx ? Z.cream : 'rgba(245,240,232,0.38)', borderColor: k === idx ? Z.gold : 'transparent' }}>
                {shortName(q)}
              </button>
            ))}
          </div>
          <p className={cn(label, 'mt-3 lg:hidden')} style={{ letterSpacing: '0.2em', color: 'rgba(245,240,232,0.3)' }}>
            Swipe to change his outfit
          </p>
        </div>

        {N > 1 && <Preview product={next} side="right" onClick={() => go(1)} />}
      </div>
    </section>
  )
}

function Spotted() {
  const ref = useRef(null)
  const [muted, setMuted] = useState(true)
  const toggle = () => {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted) v.play().catch(() => {})
  }
  return (
    // A tutto schermo sul telefono (9:16), alto quasi quanto la finestra su desktop.
    <section className="pt-14 pb-24">
      <p className={cn(label, 'text-center mb-6')} style={{ letterSpacing: '0.42em', color: Z.gold }}>
        Spotted.
      </p>
      <div className="relative mx-auto w-full sm:w-auto sm:h-[86vh] sm:max-h-[900px]" style={{ aspectRatio: '9 / 16' }}>
        <video
          ref={ref}
          src={VIDEO.src}
          poster={VIDEO.poster}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ background: '#0b0b0b' }}
        />
        <button onClick={toggle} aria-label={muted ? 'Sound on' : 'Sound off'}
          className="absolute bottom-4 right-4 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm"
          style={{ background: 'rgba(17,17,17,0.55)', color: Z.cream }}>
          {muted ? <VolumeX size={16} strokeWidth={1.6} /> : <Volume2 size={16} strokeWidth={1.6} />}
        </button>
      </div>
    </section>
  )
}

const PERKS = [
  ['Free shipping', 'Worldwide, always.'],
  ['Printed near you', 'On demand, less waste.'],
  ['Designed in Venice', 'By JAYL.'],
]

export default function ZackHomePage() {
  const { hash } = useLocation()
  // "/#shop": dopo il salto in cima di ScrollToTop, giu' ai capi.
  useEffect(() => {
    if (hash !== '#shop') return
    const t = setTimeout(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }), 60)
    return () => clearTimeout(t)
  }, [hash])
  const setPageTheme = useThemeStore((s) => s.setPageTheme)
  useEffect(() => { setPageTheme?.('dark') }, [setPageTheme])

  // I fotogrammi del flash si caricano a pagina ferma, per non rallentare
  // il primo schermo.
  useEffect(() => {
    const t = setTimeout(() => {
      zackProducts.flatMap((p) => [...frontFrames(p), ...backFrames(p)]).forEach((src) => { const im = new Image(); im.src = src })
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  usePageMeta({
    title: 'Zack the Duck — Official Merch',
    description: 'Zack the Duck: the deadpan duck. Tee, hoodie and crewneck with his eyes on the front. Free worldwide shipping.',
    image: '/zack/og-zack.jpg',
    url: 'https://jayl.store/',
  })

  return (
    <div style={{ background: Z.black, color: Z.cream }} className="min-h-screen overflow-x-hidden">
      <DressUp />
      {/* Il voto Etsy: dopo i capi, prima del video, non in faccia. */}
      <EtsyRating className="flex justify-center px-5 pt-10" />
      <Spotted />

      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center border-t pt-12" style={{ borderColor: 'rgba(245,240,232,0.1)' }}>
          {PERKS.map(([t, s]) => (
            <div key={t}>
              <p className="font-sans font-bold uppercase text-sm" style={{ letterSpacing: '0.08em' }}>{t}</p>
              <p className="font-sans text-xs mt-1.5" style={{ color: 'rgba(245,240,232,0.5)' }}>{s}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
