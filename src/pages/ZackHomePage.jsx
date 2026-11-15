import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { products } from '@/data/products'
import { isZackProduct, Z } from '@/lib/world'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useThemeStore } from '@/store/themeStore'
import Money from '@/components/Money'
import ZackEyes from '@/components/zack/ZackEyes'
import { cn } from '@/lib/utils'

// La facciata di jayl.store: Zack the Duck.
// 1. Gli occhi (motore della home-occhi): seguono dito e mouse, da fermi
//    cambiano espressione, toccati reagiscono.
// 2. I tre capi su fondo nero, in rotazione: gli occhi guardano il capo attivo.
// 3. I tre video, muti e in loop.
// Mai Pokémon qui dentro: il negozio JAYL e' dietro la porta (menu e footer).

const ORDER = ['zack-the-duck-hoodie', 'zack-the-duck-tee', 'zack-the-duck-crewneck']
const rank = (p) => { const k = ORDER.indexOf(p.id); return k === -1 ? 99 : k }
const zackProducts = products.filter(isZackProduct).sort((a, b) => rank(a) - rank(b))

const VIDEOS = [
  { src: '/zack/video/A_night-drop.mp4', poster: '/zack/video/A_night-drop.jpg', label: 'Night shift' },
  { src: '/zack/video/C_eyes-everywhere.mp4', poster: '/zack/video/C_eyes-everywhere.jpg', label: 'Eyes everywhere' },
  { src: '/zack/video/D_skate-day.mp4', poster: '/zack/video/D_skate-day.jpg', label: 'Skate day' },
]

const ROTATE_MS = 3800
const label = 'font-sans text-[10px] uppercase'

function cover(p) {
  return p.heroImage || p.image || p.images?.[0]
}

function ProductSlide({ product, active, innerRef }) {
  return (
    <Link
      ref={innerRef}
      to={`/product/${product.id}`}
      className="snap-center shrink-0 w-[76vw] sm:w-[46vw] lg:w-auto lg:flex-1 group block"
      aria-label={`${product.name}`}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-[2px] transition-all duration-700',
          active ? 'opacity-100 scale-100' : 'opacity-55 scale-[0.96]'
        )}
        style={{ aspectRatio: '4 / 5.6', background: '#0b0b0b' }}
      >
        <img
          src={cover(product)}
          alt={product.altText || product.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.03]"
          draggable={false}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(to top, rgba(17,17,17,.85), transparent)' }} />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 px-0.5">
        <p className="font-sans font-bold uppercase text-[15px] sm:text-base" style={{ color: Z.cream, letterSpacing: '0.02em' }}>
          {product.shortName || product.name.replace(/^Zack the Duck\s*/i, '')}
        </p>
        <span style={{ color: Z.cream }}><Money cents={product.price} className="font-sans text-[15px]" /></span>
      </div>
      <p className={cn(label, 'mt-1.5 px-0.5')} style={{ letterSpacing: '0.2em', color: active ? Z.gold : 'rgba(245,240,232,0.35)' }}>
        Shop →
      </p>
    </Link>
  )
}

function Collection({ eyesRef }) {
  const scroller = useRef(null)
  const cards = useRef([])
  const [active, setActive] = useState(0)
  const touched = useRef(0)

  // Il capo attivo e' quello piu' vicino al centro del carosello.
  const onScroll = useCallback(() => {
    const el = scroller.current
    if (!el || el.scrollWidth <= el.clientWidth + 4) return
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2
    let best = 0, bestD = Infinity
    cards.current.forEach((c, i) => {
      if (!c) return
      const r = c.getBoundingClientRect()
      const d = Math.abs(r.left + r.width / 2 - mid)
      if (d < bestD) { bestD = d; best = i }
    })
    setActive(best)
  }, [])

  // Rotazione: ogni ~4 s il capo dopo, finche' nessuno tocca.
  useEffect(() => {
    if (zackProducts.length < 2) return
    const id = setInterval(() => {
      if (Date.now() - touched.current < 7000) return
      setActive((a) => {
        const next = (a + 1) % zackProducts.length
        const el = scroller.current, card = cards.current[next]
        if (el && card && el.scrollWidth > el.clientWidth + 4) {
          el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: 'smooth' })
        }
        return next
      })
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  // Gli occhi guardano il capo attivo.
  useEffect(() => {
    const card = cards.current[active]
    if (!card) return
    const r = card.getBoundingClientRect()
    eyesRef.current?.lookAt(r.left + r.width / 2, r.top + r.height * 0.35)
  }, [active, eyesRef])

  if (!zackProducts.length) return null

  return (
    <section id="shop" className="pt-6 pb-24 scroll-mt-24">
      <div className="text-center mb-10 px-6">
        <p className={cn(label, 'zk-rise')} style={{ letterSpacing: '0.32em', color: Z.gold }}>Christmas collection</p>
        <h2 className="mt-3 font-sans font-bold uppercase leading-[0.95] zk-rise"
          style={{ color: Z.cream, fontSize: 'clamp(2rem, 7vw, 3.6rem)', animationDelay: '120ms', letterSpacing: '-0.01em' }}>
          Wear the look.
        </h2>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={() => { touched.current = Date.now() }}
        onWheel={() => { touched.current = Date.now() }}
        className="zk-noscrollbar flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory px-[12vw] sm:px-[27vw] lg:px-10 lg:overflow-visible max-w-6xl mx-auto"
      >
        {zackProducts.map((p, i) => (
          <ProductSlide key={p.id} product={p} active={i === active} innerRef={(el) => { cards.current[i] = el }} />
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-8" aria-hidden>
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
    <section className="pb-24">
      <p className={cn(label, 'text-center mb-8')} style={{ letterSpacing: '0.32em', color: 'rgba(245,240,232,0.5)' }}>
        Seen in the wild
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
  // "/#shop" dal menu: dopo il salto in cima di ScrollToTop, giu' ai capi.
  useEffect(() => {
    if (hash !== '#shop') return
    const t = setTimeout(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }), 60)
    return () => clearTimeout(t)
  }, [hash])
  const setPageTheme = useThemeStore((s) => s.setPageTheme)
  useEffect(() => { setPageTheme?.('dark') }, [setPageTheme])

  usePageMeta({
    title: 'Zack the Duck — Official Merch',
    description: 'Zack the Duck: the deadpan duck. Tee, hoodie and crewneck with his eyes on the front. Free worldwide shipping.',
    image: '/zack/og-zack.jpg',
    url: 'https://jayl.store/',
  })

  return (
    <div style={{ background: Z.black, color: Z.cream }} className="min-h-screen">
      {/* Hero: gli occhi */}
      <section className="relative flex flex-col items-center justify-center px-5 pt-28 pb-12" style={{ minHeight: '78svh' }}>
        <ZackEyes ref={eyesRef} className="w-[88vw] max-w-[860px] h-auto block cursor-pointer" />
        <p className={cn(label, 'mt-10 zk-rise')} style={{ letterSpacing: '0.42em', color: 'rgba(245,240,232,0.55)', animationDelay: '300ms' }}>
          He&rsquo;s watching.
        </p>
        <a href="#shop" aria-label="Shop the collection"
          className="mt-8 zk-rise font-sans text-[11px] uppercase px-7 py-3 border transition-colors"
          style={{ letterSpacing: '0.28em', borderColor: 'rgba(196,163,90,0.6)', color: Z.gold, animationDelay: '500ms' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = Z.gold; e.currentTarget.style.color = Z.black }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = Z.gold }}>
          Shop
        </a>
      </section>

      <Collection eyesRef={eyesRef} />
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
