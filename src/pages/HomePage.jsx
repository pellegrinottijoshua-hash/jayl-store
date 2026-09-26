import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { products } from '@/data/products'
import { shortProductName as shortName } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'
import { getDrop, basePriceFor } from '../../api/_lib/drop.js'
import DropHero from '@/components/drop/DropHero'
import DropDesktop from '@/components/drop/DropDesktop'
import SubscribeForm from '@/components/SubscribeForm'
import HomeReviews from '@/components/HomeReviews'
import Money from '@/components/Money'

const objectsProducts = products.filter((p) => p.section === 'objects')
const dropCfg          = getDrop()

// L'archivio: i pezzi usciti dai drop chiusi, tornati in listino. `released`
// e' in ordine di rilascio, quindi rovesciato mette in testa l'ultimo drop.
const archiveProducts = (dropCfg.released || [])
  .map((id) => objectsProducts.find((p) => p.id === id))
  .filter(Boolean)
  .reverse()

// Il drop ha due composizioni: il ridisegno (NEW, cilindro, prezzo
// "shipped") e' pensato per il telefono, su desktop restano le tre schede
// affiancate di prima. Una sola delle due viene montata — con due montate e
// una nascosta via CSS il browser scaricherebbe comunque le foto di entrambe.
const DESKTOP_QUERY = '(min-width: 640px)'
function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

function FallingS() {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.68em',
        transform: 'rotate(14deg) translateY(0.18em)',
        transformOrigin: 'center bottom',
        opacity: 0.88,
        lineHeight: 1,
      }}
    >
      s
    </span>
  )
}

// L'archivio a schermo intero: una foto alla volta, 9:16, e si sfoglia in
// orizzontale come una storia. Scroll-snap nativo invece di un carosello JS:
// lo swipe e l'inerzia sono quelli del telefono, e lo scroll verticale della
// pagina passa sopra senza che nessuno lo debba gestire. Su schermi larghi la
// foto resta 9:16 al centro, con la stessa foto sfocata dietro a riempire.
function ArchiveReel({ items }) {
  const trackRef = useRef(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onScroll = () => setIdx(Math.round(el.scrollLeft / (el.clientWidth || 1)))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (i) => {
    const el = trackRef.current
    if (!el) return
    const next = Math.max(0, Math.min(items.length - 1, i))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  if (!items.length) return null
  const pad = (k) => String(k).padStart(2, '0')

  return (
    <section
      data-nav-theme="dark"
      className="relative h-[100svh] min-h-[560px] w-screen bg-off-black overflow-hidden"
      aria-roledescription="carousel"
      aria-label="The Archive"
    >
      <div
        ref={trackRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idx + 1) }
          if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(idx - 1) }
        }}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide outline-none"
        style={{ overscrollBehaviorX: 'contain' }}
      >
        {items.map((p, i) => {
          const src = p.heroImage ?? p.image
          return (
            <Link
              key={p.id}
              to={`/product/${p.id}`}
              className="group relative shrink-0 w-screen h-full snap-center snap-always flex items-center justify-center overflow-hidden"
              aria-label={`${shortName(p.name)} — ${i + 1} of ${items.length}`}
            >
              <img
                src={src}
                alt=""
                aria-hidden
                loading="lazy"
                className="hidden sm:block absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-35"
              />
              <div className="relative h-full w-full sm:w-auto sm:aspect-[9/16]">
                <img
                  src={src}
                  alt={p.altText || p.name}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: '50% 30%' }}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
                {/* Testo sopra la foto: bianco vero in entrambe le versioni
                    del sito, la foto e' la stessa. */}
                <div className="absolute inset-x-0 bottom-0 px-6 pb-14 pt-28 text-center bg-gradient-to-t from-black/70 via-black/25 to-transparent">
                  <p className="text-white text-[11px] tracking-[0.32em] uppercase">{shortName(p.name)}</p>
                  <p className="font-display font-light text-white text-4xl leading-none mt-2">
                    <Money cents={basePriceFor(p.id, null, p, dropCfg)} />
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Etichetta e contatore, fissi sopra le foto */}
      <div className="pointer-events-none absolute inset-x-0 top-[72px] px-5 sm:px-8 flex items-baseline justify-between text-white">
        <p className="text-[10px] tracking-[0.32em] uppercase text-white/80">The Archive</p>
        <p className="text-[10px] tracking-[0.32em] tabular-nums text-white/80">{pad(idx + 1)} / {pad(items.length)}</p>
      </div>

      {/* Avanzamento a segmenti, come le storie */}
      <div className="absolute inset-x-0 bottom-6 px-5 sm:px-8 flex gap-1 justify-center" aria-hidden>
        {items.map((p, i) => (
          <span key={p.id} className={`h-px flex-1 max-w-10 transition-colors duration-300 ${i === idx ? 'bg-white' : 'bg-white/30'}`} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => goTo(idx - 1)}
        disabled={idx === 0}
        aria-label="Previous"
        className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-white/60 hover:text-white disabled:opacity-0 transition"
      >
        <ChevronLeft size={24} strokeWidth={1.1} />
      </button>
      <button
        type="button"
        onClick={() => goTo(idx + 1)}
        disabled={idx === items.length - 1}
        aria-label="Next"
        className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-white/60 hover:text-white disabled:opacity-0 transition"
      >
        <ChevronRight size={24} strokeWidth={1.1} />
      </button>
    </section>
  )
}

// Desktop: tre pezzi dell'archivio affiancati, a tutta altezza, che scorrono
// piano verso sinistra da soli; si fermano sotto il mouse e si trascinano
// (o si scorrono col trackpad). La lista e' duplicata: a meta' strada si torna
// all'inizio senza salto visibile.
function ArchiveStrip({ items }) {
  const ref  = useRef(null)
  const drag = useRef({ active: false, hovered: false, startX: 0, startScroll: 0, moved: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const SPEED = 28 // px/s
    let last = null
    let pos = el.scrollLeft
    let raf
    const tick = (now) => {
      const d = drag.current
      if (!d.active && !d.hovered) {
        const dt = last !== null ? now - last : 0
        pos += (SPEED / 1000) * dt
        if (pos >= el.scrollWidth / 2) pos -= el.scrollWidth / 2
        el.scrollLeft = pos
      } else {
        pos = el.scrollLeft
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!items.length) return null

  const onDown = (e) => {
    drag.current = { ...drag.current, active: true, startX: e.clientX, startScroll: ref.current.scrollLeft, moved: false }
    e.preventDefault()
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 4) d.moved = true
    let next = d.startScroll - dx
    const half = ref.current.scrollWidth / 2
    if (next < 0) next += half
    if (next >= half) next -= half
    ref.current.scrollLeft = next
  }
  const stop = () => { drag.current.active = false }

  return (
    <section data-nav-theme="dark" className="relative h-[100svh] min-h-[560px] w-screen bg-off-black overflow-hidden" aria-label="The Archive">
      <div
        ref={ref}
        className="flex h-full overflow-x-scroll scrollbar-hide select-none cursor-grab active:cursor-grabbing"
        onMouseEnter={() => { drag.current.hovered = true }}
        onMouseLeave={() => { drag.current.hovered = false; stop() }}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={stop}
      >
        {[...items, ...items].map((p, i) => {
          const clone = i >= items.length
          return (
            <Link
              key={`${p.id}-${i}`}
              to={`/product/${p.id}`}
              draggable={false}
              aria-hidden={clone || undefined}
              tabIndex={clone ? -1 : undefined}
              onClick={(e) => { if (drag.current.moved) e.preventDefault() }}
              className="group relative shrink-0 w-[33.3333vw] h-full overflow-hidden border-r border-off-black"
            >
              <img
                src={p.heroImage ?? p.image}
                alt={clone ? '' : (p.altText || p.name)}
                loading="lazy"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03] pointer-events-none"
                style={{ objectPosition: '50% 30%' }}
              />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-12 pt-28 text-center bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none">
                <p className="text-white text-[11px] tracking-[0.32em] uppercase">{shortName(p.name)}</p>
                <p className="font-display font-light text-white text-4xl leading-none mt-2">
                  <Money cents={basePriceFor(p.id, null, p, dropCfg)} />
                </p>
              </div>
            </Link>
          )
        })}
      </div>
      <p className="pointer-events-none absolute left-8 top-[72px] text-[10px] tracking-[0.32em] uppercase text-white/80">The Archive</p>
    </section>
  )
}

export default function HomePage() {
  const [navTheme, setNavTheme] = useState('dark')
  const { setPageTheme, setActiveSection } = useThemeStore()

  usePageMeta({
    // usePageMeta appends " — JAYL"; keep the brand out of the title here to
    // avoid "JAYL — Art & Wearable Art — JAYL".
    title:       'Art & Wearable Art',
    description: 'Premium print-on-demand art and streetwear. AI-reinterpreted art movements meet contemporary culture. Free worldwide shipping.',
  })
  const navigate = useNavigate()
  const rootRef  = useRef(null)
  const desktop  = useIsDesktop()

  useEffect(() => {
    setPageTheme(navTheme)
    setActiveSection(null)
  }, [navTheme, setPageTheme, setActiveSection])

  // La navbar e' trasparente: il suo colore deve seguire lo schermo che le sta
  // sotto. Ogni sezione dichiara il proprio tema con data-nav-theme, e qui si
  // legge quello della sezione sotto la barra — niente array di indici da
  // tenere allineato a mano con le sezioni che davvero renderizzano (archivio
  // e recensioni spariscono da sole quando sono vuoti).
  const handleScroll = useCallback(() => {
    const els = rootRef.current?.querySelectorAll('[data-nav-theme]')
    if (!els?.length) return
    const probe = window.scrollY + 56
    let theme = els[0].dataset.navTheme
    for (const el of els) {
      if (el.offsetTop <= probe) theme = el.dataset.navTheme
    }
    setNavTheme(theme)
  }, [])

  useEffect(() => {
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <div ref={rootRef} className="w-full">

      {/* ════ SECTION 1 — Art Hero (cream) — HIDDEN - re-enable for Art launch ════
      <section className="h-screen w-screen relative overflow-hidden" style={{ backgroundColor: '#f5f0e8', colorScheme: 'light' }}>
        ...art hero content...
      </section>
      ════ SECTION 2 — Art fullscreen — HIDDEN - re-enable for Art launch ════
      <section className="h-screen w-screen relative overflow-hidden cursor-pointer" onClick={() => navigate(`/product/${featuredArt?.id}`)}>
        ...art fullscreen content...
      </section>
      ════════════════════════════════════════════════════════════════════════ */}

      {/* ════ SCREEN 1 — Il drop. Mobile: NEW, tre schede curve, prezzo,
          subscribe, in uno schermo esatto (svh: la barra del browser non
          taglia il subscribe). Desktop: le tre schede affiancate e la lista
          d'attesa, come prima. ════ */}
      {desktop ? (
        <section data-nav-theme="dark" className="min-h-screen w-screen bg-off-black flex flex-col">
          <DropDesktop />
        </section>
      ) : (
        <section data-nav-theme="dark" className="h-[100svh] min-h-[640px] w-screen bg-off-black flex flex-col overflow-hidden">
          <DropHero />
          <SubscribeForm className="px-5 pb-3" />
        </section>
      )}

      {/* ════ SCREEN 2 — L'archivio, una foto a schermo intero alla volta ════ */}
      {desktop ? <ArchiveStrip items={archiveProducts} /> : <ArchiveReel items={archiveProducts} />}

      {/* ════ Recensioni — subito sotto l'archivio, una alla volta.
          Si nasconde da sola finché reviews.json è vuoto. ════ */}
      <HomeReviews />

      {/* ════ Artist's (cream) ════════════════════════════════════════ */}
      <section
        data-nav-theme="light"
        className="h-screen w-screen bg-paper relative flex items-center justify-center cursor-pointer"
        onClick={() => navigate('/artist')}
      >
        <div className="absolute top-[72px] left-6 sm:left-8 z-10">
          <p className="text-2xs font-sans tracking-label-xl uppercase text-ink-muted">
            artist'<FallingS />
          </p>
        </div>

        <div className="px-6 sm:px-12 lg:px-20 max-w-3xl text-center">
          <p className="font-display text-2xl sm:text-3xl lg:text-4xl text-ink leading-[1.45]">
            Every great artist drew the world differently — they saw their world. JAYL takes the
            greatest visual languages in history and applies them to subjects, emotions, and
            landscapes they never reached.
          </p>
        </div>
      </section>

    </div>
  )
}
