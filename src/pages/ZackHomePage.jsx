import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { products } from '@/data/products'
import { isZackProduct, Z } from '@/lib/world'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useThemeStore } from '@/store/themeStore'
import Money from '@/components/Money'
import EtsyRating from '@/components/EtsyRating'
import ZackEyes from '@/components/zack/ZackEyes'
import { cn } from '@/lib/utils'

// La facciata di jayl.store: Zack the Duck.
// 1. Gli occhi, grandi: sono la testa di Zack.
// 2. Subito sotto, i tre capi: il corpo. Carosello infinito (a destra dopo
//    l'ultimo torna il primo); a ogni swipe gli occhi fanno un balzo verso il
//    lato, dopo 3 swipe di fila si confondono e scuotono la testa.
//    I mockup del capo (product.images) scorrono veloci: al passaggio del
//    mouse su desktop, una volta quando il capo arriva al centro su mobile.
// 3. Badge Etsy, poi i video.
// Mai Pokémon qui dentro: il negozio JAYL e' dietro la porta nei menu.

const ORDER = ['zack-the-duck-hoodie', 'zack-the-duck-tee', 'zack-the-duck-crewneck']
const rank = (p) => { const k = ORDER.indexOf(p.id); return k === -1 ? 99 : k }
const zackProducts = products.filter(isZackProduct).sort((a, b) => rank(a) - rank(b))
const N = zackProducts.length
// Tre copie in fila: si parte dalla centrale e, quando ci si ferma su una
// copia laterale, si salta in silenzio alla stessa scheda della centrale.
const LOOP = N > 1 ? [...zackProducts, ...zackProducts, ...zackProducts] : zackProducts
const START = N > 1 ? N : 0

const VIDEOS = [
  { src: '/zack/video/A_night-drop.mp4', poster: '/zack/video/A_night-drop.jpg', label: 'Night shift' },
  { src: '/zack/video/C_eyes-everywhere.mp4', poster: '/zack/video/C_eyes-everywhere.jpg', label: 'Eyes everywhere' },
  { src: '/zack/video/D_skate-day.mp4', poster: '/zack/video/D_skate-day.jpg', label: 'Skate day' },
]

const ROTATE_MS = 4200
const FLASH_MS = 110          // un fotogramma del flash
const CONFUSED_SWIPES = 3     // swipe ravvicinati che confondono Zack
const label = 'font-sans text-[10px] uppercase'

const framesOf = (p) => {
  const list = [p.heroImage, p.image, ...(p.images || [])].filter(Boolean)
  return [...new Set(list)]
}

// I bordi dell'immagine sfumano nel nero della pagina: i mockup su fondo
// nero (anche se non e' esattamente #111111) non mostrano un riquadro.
const FEATHER = 'radial-gradient(130% 100% at 50% 42%, #000 62%, transparent 100%)'

function ProductSlide({ product, active, innerRef, clone, flashKey }) {
  const frames = framesOf(product)
  const [frame, setFrame] = useState(0)
  const timer = useRef(null)

  const stop = useCallback(() => { clearInterval(timer.current); timer.current = null; setFrame(0) }, [])
  const flash = useCallback((loop) => {
    if (frames.length < 2 || timer.current) return
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      if (!loop && i >= frames.length) { stop(); return }
      setFrame(i % frames.length)
    }, FLASH_MS)
  }, [frames.length, stop])
  useEffect(() => stop, [stop])

  // Mobile: quando il capo arriva al centro, un giro di flash.
  useEffect(() => {
    if (flashKey && active && window.matchMedia?.('(hover: none)').matches) flash(false)
  }, [flashKey, active, flash])

  return (
    <Link
      ref={innerRef}
      to={`/product/${product.id}`}
      className={cn('snap-center shrink-0 w-[74vw] sm:w-[44vw] lg:w-auto lg:flex-1 group block', clone && 'lg:hidden')}
      aria-label={product.name}
      aria-hidden={clone || undefined}
      tabIndex={clone ? -1 : undefined}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') flash(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') stop() }}
    >
      <div
        className={cn('relative overflow-hidden transition-all duration-700',
          active ? 'opacity-100 scale-100' : 'opacity-50 scale-[0.94]')}
        style={{ aspectRatio: '4 / 5', background: Z.black, WebkitMaskImage: FEATHER, maskImage: FEATHER }}
      >
        <img
          src={frames[frame] || frames[0]}
          alt={product.altText || product.name}
          loading={clone ? 'lazy' : 'eager'}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 px-1">
        <p className="font-sans font-bold uppercase text-[15px] sm:text-base" style={{ color: Z.cream, letterSpacing: '0.02em' }}>
          {product.shortName || product.name.replace(/^Zack the Duck\s*/i, '')}
        </p>
        <span style={{ color: Z.cream }}><Money cents={product.price} className="font-sans text-[15px]" /></span>
      </div>
      <p className={cn(label, 'mt-1.5 px-1')} style={{ letterSpacing: '0.2em', color: active ? Z.gold : 'rgba(245,240,232,0.35)' }}>
        Shop →
      </p>
    </Link>
  )
}

function Collection({ eyesRef }) {
  const scroller = useRef(null)
  const cards = useRef([])
  const [activeK, setActiveK] = useState(START)   // indice nella fila LOOP
  const [flashKey, setFlashKey] = useState(0)
  const touched = useRef(0)
  const lastLeft = useRef(0)
  const lastGlance = useRef(0)
  const swipes = useRef([])
  const settleTimer = useRef(null)
  const jumping = useRef(false)   // lo scroll del salto silenzioso non e' uno swipe

  const scrollable = () => {
    const el = scroller.current
    return !!el && el.scrollWidth > el.clientWidth + 4
  }
  const leftFor = (k) => {
    const el = scroller.current, card = cards.current[k]
    return card.offsetLeft - (el.clientWidth - card.clientWidth) / 2
  }
  const nearest = () => {
    const el = scroller.current
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2
    let best = START, bestD = Infinity
    cards.current.forEach((c, i) => {
      if (!c) return
      const r = c.getBoundingClientRect()
      const d = Math.abs(r.left + r.width / 2 - mid)
      if (d < bestD) { bestD = d; best = i }
    })
    return best
  }
  // Salto istantaneo (snap spento per un frame), senza che si veda.
  const jumpTo = (k) => {
    const el = scroller.current
    el.style.scrollSnapType = 'none'
    jumping.current = true
    el.scrollLeft = leftFor(k)
    lastLeft.current = el.scrollLeft
    requestAnimationFrame(() => { el.style.scrollSnapType = '' })
  }

  // Si parte dalla copia centrale.
  useEffect(() => { if (scrollable()) jumpTo(START) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const settle = () => {
    let k = nearest()
    if (N > 1 && (k < N || k >= 2 * N)) {
      k = (k % N) + N
      jumpTo(k)
    }
    setActiveK(k)
    setFlashKey((f) => f + 1)
    // Swipe dell'utente: dopo 3 ravvicinati Zack si confonde.
    if (Date.now() - touched.current < 1500) {
      const now = Date.now()
      swipes.current = [...swipes.current.filter((t) => now - t < 3500), now]
      if (swipes.current.length >= CONFUSED_SWIPES) {
        swipes.current = []
        eyesRef.current?.react('spirale', 1500)
        eyesRef.current?.shake()
      }
    }
  }

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    if (jumping.current) { jumping.current = false; lastLeft.current = el.scrollLeft; return }
    // Balzo degli occhi verso la direzione dello swipe (solo se e' il dito).
    const dx = el.scrollLeft - lastLeft.current
    lastLeft.current = el.scrollLeft
    const now = Date.now()
    if (Math.abs(dx) > 2 && now - touched.current < 1500 && now - lastGlance.current > 380) {
      lastGlance.current = now
      eyesRef.current?.glance(dx > 0 ? 1 : -1)
    }
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(settle, 130)
  }

  // Rotazione: ogni ~4 s il capo dopo, finche' nessuno tocca.
  useEffect(() => {
    if (N < 2) return
    const id = setInterval(() => {
      if (Date.now() - touched.current < 7000) return
      if (scrollable()) {
        const k = nearest() + 1
        scroller.current.scrollTo({ left: leftFor(k), behavior: 'smooth' })
      } else {
        // Desktop: i tre capi sono tutti in vista, si accende il successivo.
        setActiveK((k) => ((k - START + 1) % N) + START)
        setFlashKey((f) => f + 1)
      }
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  // Gli occhi guardano il capo attivo (dopo il balzo, tornano qui).
  useEffect(() => {
    const t = setTimeout(() => {
      const card = cards.current[activeK]
      if (!card) return
      const r = card.getBoundingClientRect()
      eyesRef.current?.lookAt(r.left + r.width / 2, r.top + r.height * 0.3)
    }, 260)
    return () => clearTimeout(t)
  }, [activeK, eyesRef])

  if (!N) return null
  const active = activeK % N

  return (
    // Subito sotto gli occhi, senza titoli: il capo al centro ben visibile,
    // gli altri che spuntano ai lati e si scorrono all'infinito.
    <section id="shop" className="pb-6 scroll-mt-24 zk-rise" style={{ animationDelay: '150ms' }}>
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={() => { touched.current = Date.now() }}
        onTouchStart={() => { touched.current = Date.now() }}
        onTouchMove={() => { touched.current = Date.now() }}
        onWheel={() => { touched.current = Date.now() }}
        className="zk-noscrollbar flex gap-3 sm:gap-6 overflow-x-auto snap-x snap-mandatory px-[13vw] sm:px-[28vw] lg:px-10 lg:overflow-visible max-w-3xl mx-auto"
      >
        {LOOP.map((p, i) => (
          <ProductSlide
            key={i}
            product={p}
            clone={N > 1 && (i < N || i >= 2 * N)}
            active={i === activeK}
            flashKey={i === activeK ? flashKey : 0}
            innerRef={(el) => { cards.current[i] = el }}
          />
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-5" aria-hidden>
        {zackProducts.map((p, i) => (
          <span key={p.id} className="h-[3px] rounded-full transition-all duration-500"
            style={{ width: i === active ? 22 : 8, background: i === active ? Z.gold : 'rgba(245,240,232,0.25)' }} />
        ))}
      </div>
    </section>
  )
}

function Videos() {
  return (
    <section className="pt-14 pb-24">
      <p className={cn(label, 'text-center mb-8')} style={{ letterSpacing: '0.42em', color: Z.gold }}>
        Spotted.
      </p>
      <div className="zk-noscrollbar flex gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory px-6 sm:justify-center">
        {VIDEOS.map((v) => (
          <figure key={v.src} className="snap-center shrink-0 w-[58vw] sm:w-[240px]">
            <video
              src={v.src}
              poster={v.poster}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              className="w-full rounded-[2px] block"
              style={{ aspectRatio: '9 / 16', objectFit: 'cover', background: '#0b0b0b' }}
            />
            <figcaption className={cn(label, 'mt-3')} style={{ letterSpacing: '0.2em', color: 'rgba(245,240,232,0.45)' }}>
              {v.label}
            </figcaption>
          </figure>
        ))}
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
  const eyesRef = useRef(null)
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
      zackProducts.flatMap(framesOf).forEach((src) => { const im = new Image(); im.src = src })
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  usePageMeta({
    title: 'Zack the Duck — Official Merch',
    description: 'Zack the Duck: the deadpan duck. Tee, hoodie and crewneck with his eyes on the front. Free worldwide shipping.',
    image: '/zack/og-zack.jpg',
    url: 'https://jayl.store/',
  })

  return (
    <div style={{ background: Z.black, color: Z.cream }} className="min-h-screen">
      {/* La testa: gli occhi, grandi, in alto. Sotto, subito il corpo (i capi). */}
      <section className="flex justify-center px-3 pt-[92px] sm:pt-[100px] pb-5 sm:pb-7">
        <ZackEyes ref={eyesRef} className="w-[94vw] max-w-[640px] h-auto block cursor-pointer" />
      </section>

      <Collection eyesRef={eyesRef} />
      {/* Il voto Etsy: dopo i capi, prima dei video, non in faccia. */}
      <EtsyRating className="flex justify-center px-5 pt-10" />
      <Videos />

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
