import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { adminCollections } from '@/data/admin-collections'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'

const artProducts     = products.filter((p) => p.section === 'art')
const objectsProducts = products.filter((p) => p.section === 'objects')

// Featured products for sections 3 + 4 — set via admin slot buttons (① ②)
// featured = 1 → slot 1 (first fullscreen, visible immediately)
// featured = 2 → slot 2 (second fullscreen, visible on scroll)
const featuredObject  = objectsProducts.find(p => p.featured === 1)
  ?? objectsProducts.find(p => p.featured === true)
  ?? objectsProducts[0] ?? null
const featuredObject2 = objectsProducts.find(p => p.featured === 2)
  ?? objectsProducts.find(p => p.featured === true && p.id !== featuredObject?.id)
  ?? objectsProducts[1] ?? objectsProducts[0] ?? null

// Carousel collection — set via admin "🎠 Carosello" toggle on a collection
const carouselColl    = adminCollections.find(c => c.carousel)
const carouselProducts = carouselColl
  ? objectsProducts.filter(p => p.collection?.toLowerCase() === carouselColl.name?.toLowerCase())
  : objectsProducts

// Sort: products with createdAt first (newest → oldest), then the rest in original order
const newInProducts = [...objectsProducts]
  .sort((a, b) => {
    if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt)
    if (a.createdAt) return -1
    if (b.createdAt) return 1
    return 0
  })
  .slice(0, 6)

// light = cream sections, dark = dark sections
// Art launch: ['light', 'dark', 'dark', 'dark', 'light', 'dark', 'light'] (7 sections)
// Current (no art, no new-in): Objects hero | Product 2 | Objects grid | Artist's
const SECTION_THEMES = ['dark', 'dark', 'dark', 'light']

// Stable per-session random choice between images[0] and images[1] per product.
// Computed once at module load: each product always shows the same image within a session,
// but rotates randomly between sessions (e.g. man → woman → man → ...).
const carouselImagePick = new Map(
  objectsProducts.map(p => {
    const imgs = p.images || []
    const pick = Math.random() < 0.5 ? (imgs[0] ?? p.image) : (imgs[1] ?? imgs[0] ?? p.image)
    return [p.id, pick]
  })
)

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

export default function HomePage() {
  const [section, setSection] = useState(0)
  const { setPageTheme, setActiveSection } = useThemeStore()

  usePageMeta({
    title:       'JAYL — Art & Wearable Art',
    description: 'Premium print-on-demand art and streetwear. AI-reinterpreted art movements meet contemporary culture. Free worldwide shipping.',
  })
  const navigate   = useNavigate()
  const sectionRef = useRef(0)

  useEffect(() => {
    setPageTheme(SECTION_THEMES[section] ?? 'dark')
    setActiveSection(null)
  }, [section, setPageTheme, setActiveSection])

  const handleScroll = useCallback(() => {
    const idx = Math.round(window.scrollY / window.innerHeight)
    if (idx !== sectionRef.current) {
      sectionRef.current = idx
      setSection(idx)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // ── Carousel: rAF auto-scroll + mouse drag + native touch ─────────────────
  const carouselRef  = useRef(null)
  const carouselDrag = useRef({ active: false, hovered: false, startX: 0, startScroll: 0, moved: false })

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const SPEED = 36 // px / second
    let last = null
    let raf

    function tick(now) {
      const d = carouselDrag.current
      if (!d.active && !d.hovered) {
        const dt = last !== null ? now - last : 0
        el.scrollLeft += (SPEED / 1000) * dt
        // Seamless infinite reset — content is duplicated so half = one full set
        if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft -= el.scrollWidth / 2
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function onCarouselMouseEnter() { carouselDrag.current.hovered = true }
  function onCarouselMouseLeave() {
    carouselDrag.current.hovered = false
    carouselDrag.current.active  = false
    if (carouselRef.current) carouselRef.current.style.cursor = 'grab'
  }
  function onCarouselMouseDown(e) {
    if (!carouselRef.current) return
    carouselDrag.current = { active: true, hovered: true, startX: e.clientX, startScroll: carouselRef.current.scrollLeft, moved: false }
    carouselRef.current.style.cursor = 'grabbing'
    e.preventDefault()
  }
  function onCarouselMouseMove(e) {
    const d = carouselDrag.current
    if (!d.active || !carouselRef.current) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 3) d.moved = true
    carouselRef.current.scrollLeft = d.startScroll - dx
  }
  function onCarouselMouseUp() {
    carouselDrag.current.active = false
    if (carouselRef.current) carouselRef.current.style.cursor = 'grab'
  }

  return (
    <div className="w-full">

      {/* ════ SECTION 1 — Art Hero (cream) — HIDDEN - re-enable for Art launch ════
      <section className="h-screen w-screen relative overflow-hidden" style={{ backgroundColor: '#f5f0e8', colorScheme: 'light' }}>
        ...art hero content...
      </section>
      ════ SECTION 2 — Art fullscreen — HIDDEN - re-enable for Art launch ════
      <section className="h-screen w-screen relative overflow-hidden cursor-pointer" onClick={() => navigate(`/product/${featuredArt?.id}`)}>
        ...art fullscreen content...
      </section>
      ════════════════════════════════════════════════════════════════════════ */}

      {/* ════ SECTION 3 — Objects fullscreen hero ══════════════════════ */}
      <section
        className="h-screen w-screen relative overflow-hidden cursor-pointer"
        onClick={() => navigate(`/product/${featuredObject.id}`)}
      >
        {/* Desktop: 16:9 hero image; Mobile: 9:16 portrait hero */}
        <picture className="absolute inset-0 w-full h-full">
          {featuredObject.image && (
            <source media="(min-width: 1024px)" srcSet={featuredObject.image} />
          )}
          <img
            src={featuredObject.heroImage ?? featuredObject.image}
            alt={featuredObject.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </picture>
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 px-8 sm:px-12 pb-14 z-10">
          <p className="text-xs font-sans tracking-label uppercase text-white/60 mb-3">Objects</p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-1">
            {featuredObject.name}
          </h2>
          <p className="text-sm text-white/70 mb-6">from {formatPrice(featuredObject.price)}</p>
          <Link
            to={`/product/${featuredObject.id}`}
            className="inline-flex items-center gap-2 bg-white text-black text-xs font-sans tracking-label uppercase px-5 py-3 hover:bg-white/90 transition-colors"
          >
            Shop Now <ArrowRight size={12} />
          </Link>
        </div>
      </section>

      {/* ════ SECTION 4 — Second featured product ════════════════════ */}
      <section
        className="h-screen w-screen bg-black relative overflow-hidden cursor-pointer"
        onClick={() => featuredObject2 && navigate(`/product/${featuredObject2.id}`)}
      >
        {featuredObject2 && (
          <picture className="absolute inset-0 w-full h-full">
            {featuredObject2.image && (
              <source media="(min-width: 1024px)" srcSet={featuredObject2.image} />
            )}
            <img
              src={featuredObject2.heroImage ?? featuredObject2.image}
              alt={featuredObject2.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </picture>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 px-8 sm:px-12 pb-14 z-10">
          <p className="text-xs font-sans tracking-label uppercase text-white/60 mb-3">
            {featuredObject2?.collection || 'New Collection'}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-1">
            {featuredObject2?.name || ''}
          </h2>
          {featuredObject2 && (
            <p className="text-sm text-white/70 mb-6">from {formatPrice(featuredObject2.price)}</p>
          )}
          {featuredObject2 && (
            <Link
              to={`/product/${featuredObject2.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 bg-white text-black text-xs font-sans tracking-label uppercase px-5 py-3 hover:bg-white/90 transition-colors"
            >
              Shop Now <ArrowRight size={12} />
            </Link>
          )}
        </div>
      </section>

      {/* ════ SECTION 5 — New In (cream) — HIDDEN with <6 products ══════
      <section
        className="h-screen w-screen relative overflow-hidden"
        style={{ backgroundColor: '#f5f0e8', colorScheme: 'light' }}
      > */}
      {false && <section
        className="h-screen w-screen relative overflow-hidden"
        style={{ backgroundColor: '#f5f0e8', colorScheme: 'light' }}
      >
        <div className="absolute top-[88px] left-6 sm:left-8 right-6 sm:right-8 z-10 flex items-center gap-3">
          <p className="text-2xs font-sans tracking-label-xl uppercase" style={{ color: 'rgba(17,17,17,0.45)' }}>New In</p>
          <div className="h-px w-8 flex-shrink-0" style={{ backgroundColor: 'rgba(17,17,17,0.15)' }} />
          <div className="flex-1" />
          <Link
            to="/objects"
            className="inline-flex items-center gap-1.5 text-2xs font-sans tracking-label uppercase transition-opacity hover:opacity-60"
            style={{ color: 'rgba(17,17,17,0.55)' }}
          >
            See all <ArrowRight size={10} />
          </Link>
        </div>

        <div className="absolute inset-0 flex flex-col justify-center pt-[84px] pb-10">
          <div
            className="flex gap-4 overflow-x-auto px-6 sm:px-8 pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {newInProducts.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="flex-shrink-0 w-44 sm:w-56 group"
                draggable={false}
              >
                <div
                  className="w-full aspect-[3/4] overflow-hidden mb-3"
                  style={{ backgroundColor: '#ece7df' }}
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <p className="text-2xs font-sans tracking-label-xl uppercase mb-0.5" style={{ color: 'rgba(17,17,17,0.45)' }}>
                  {product.collection || product.section}
                </p>
                <h3 className="font-display text-sm leading-tight truncate" style={{ color: '#111111' }}>
                  {product.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(17,17,17,0.55)' }}>
                  from {formatPrice(product.price)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>}
      {/* ════ END SECTION 5 hidden ══════════════════════════════════════ */}

      {/* ════ SECTION 6 — Collection carousel (auto-scroll) ══════════ */}
      <section className="h-screen w-screen bg-off-black relative overflow-hidden">
        <div className="absolute top-[88px] left-6 sm:left-8 right-6 sm:right-8 z-10 flex items-center gap-3">
          <p className="text-2xs font-sans tracking-label-xl uppercase text-text-muted">
            {carouselColl ? carouselColl.name : 'objects'}
          </p>
          <div className="flex-1" />
          <Link
            to={carouselColl ? `/collection/${carouselColl.id}` : '/objects'}
            className="inline-flex items-center gap-1.5 text-2xs font-sans tracking-label uppercase text-text-muted hover:text-cream transition-colors"
          >
            View all <ArrowRight size={10} />
          </Link>
        </div>

        {/* Scrollable track — rAF auto-scroll, mouse drag, native touch */}
        <div className="absolute inset-0 flex flex-col justify-center pt-[84px] pb-10">
          <div
            ref={carouselRef}
            className="flex gap-5 overflow-x-scroll will-change-transform select-none"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              cursor: 'grab',
              paddingLeft: '1.5rem',
              paddingRight: '1.5rem',
            }}
            onMouseEnter={onCarouselMouseEnter}
            onMouseLeave={onCarouselMouseLeave}
            onMouseDown={onCarouselMouseDown}
            onMouseMove={onCarouselMouseMove}
            onMouseUp={onCarouselMouseUp}
          >
            {/* Render the list twice for seamless infinite loop */}
            {[...carouselProducts, ...carouselProducts].map((product, idx) => (
              <Link
                key={`${product.id}-${idx}`}
                to={`/product/${product.id}`}
                className="flex-shrink-0 w-48 sm:w-60 group"
                draggable={false}
                onClick={e => {
                  // block navigation if user was dragging
                  if (carouselDrag.current.moved) e.preventDefault()
                }}
              >
                <div className="w-full aspect-[3/4] bg-stone-900 overflow-hidden mb-3 pointer-events-none">
                  <img
                    src={carouselImagePick.get(product.id) ?? product.image}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <h3 className="font-display text-sm text-cream leading-tight truncate pointer-events-none">{product.name}</h3>
                <p className="text-xs text-text-muted mt-0.5 pointer-events-none">from {formatPrice(product.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SECTION 7 — Artist's (cream) ════════════════════════════ */}
      <section
        className="h-screen w-screen bg-paper relative flex items-center justify-center cursor-pointer"
        onClick={() => navigate('/artist')}
      >
        <div className="absolute top-[88px] left-6 sm:left-8 z-10">
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
