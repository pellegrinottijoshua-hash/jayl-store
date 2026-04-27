import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'
import { cn } from '@/lib/utils'

const artProducts     = products.filter((p) => p.section === 'art')
const objectsProducts = products.filter((p) => p.section === 'objects')
const pokemonProduct  = products.find((p) => p.collection === 'Cool Pokemon')
const featuredArt     = artProducts.find((p) => p.featured) || artProducts[0]

const SECTION_THEMES = ['dark', 'light', 'dark', 'dark', 'dark', 'light']
const SECTION_COUNT  = SECTION_THEMES.length

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
  const [section, setSection]       = useState(0)
  const [artIdx, setArtIdx]         = useState(0)
  const [objectsIdx, setObjectsIdx] = useState(0)
  const [animKey, setAnimKey]       = useState(0)
  const { setPageTheme, setActiveSection } = useThemeStore()
  const navigate   = useNavigate()
  const sectionRef = useRef(0)
  const swipedRef  = useRef(false)

  useEffect(() => {
    setPageTheme(SECTION_THEMES[section])
    setActiveSection(null)
  }, [section, setPageTheme, setActiveSection])

  const scrollToSection = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(idx, SECTION_COUNT - 1))
    window.scrollTo({ top: clamped * window.innerHeight, behavior: 'smooth' })
  }, [])

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

  const nextArt = useCallback(() => {
    setArtIdx((i) => (i + 1) % artProducts.length)
    setAnimKey((k) => k + 1)
  }, [])

  const nextObjects = useCallback(() => {
    setObjectsIdx((i) => (i + 1) % objectsProducts.length)
    setAnimKey((k) => k + 1)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const cur = sectionRef.current
      if (e.key === 'ArrowRight') {
        if (cur === 0) navigate(`/product/${featuredArt.slug}`)
        if (cur === 1) nextArt()
        if (cur === 2) nextObjects()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextArt, nextObjects, navigate])

  const { onTouchStart, onTouchEnd } = useSwipe({
    onSwipeRight: () => {
      const cur = sectionRef.current
      if (cur === 0) navigate(`/product/${featuredArt.slug}`)
      if (cur === 1) nextArt()
      if (cur === 2) nextObjects()
    },
    onSwipeLeft: () => {
      if (sectionRef.current === 5) { swipedRef.current = true; navigate('/objects') }
    },
  })

  const artProduct     = artProducts[artIdx]
  const objectsProduct = objectsProducts[objectsIdx]
  const currentTheme   = SECTION_THEMES[section]

  return (
    <div
      className="w-full"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      {/* ════ SECTION 1 — Video (black, fullscreen) ════════════════════ */}
      <section className="h-screen w-screen bg-black relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black" aria-hidden="true" />
        <div className="relative z-10 select-none pointer-events-none">
          <p className="font-display text-7xl sm:text-9xl text-cream/10 tracking-widest">JAYL</p>
        </div>
      </section>

      {/* ════ SECTION 2 — Art collection (cream) ══════════════════════ */}
      <section className="h-screen w-screen bg-paper relative overflow-hidden">
        <div className="absolute top-[88px] left-6 sm:left-8 z-10">
          <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted">art</p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pt-[84px] pb-52 px-10">
          <img
            key={`art-img-${artIdx}`}
            src={artProduct.image}
            alt={artProduct.name}
            className="max-h-full max-w-full object-contain animate-fade-in"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        <div key={`art-info-${animKey}`} className="absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14 animate-fade-up">
          <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted mb-1">
            {slugToTitle(artProduct.movement)}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl text-ink leading-tight mb-1">
            {artProduct.name}
          </h2>
          <p className="text-sm text-ink-muted">from {formatPrice(artProduct.price)}</p>
        </div>

        <ProductDots
          count={artProducts.length}
          active={artIdx}
          onSelect={(i) => { setArtIdx(i); setAnimKey((k) => k + 1) }}
          dark={false}
        />
      </section>

      {/* ════ SECTION 3 — Objects hero (black) ════════════════════════ */}
      <section className="h-screen w-screen bg-off-black relative overflow-hidden">
        <div className="absolute top-[88px] left-6 sm:left-8 z-10">
          <p className="text-2xs font-mono tracking-ultra uppercase text-text-muted">objects</p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pt-[84px] pb-56 px-8 sm:px-16">
          <img
            key={`obj-img-${objectsIdx}`}
            src={objectsProduct.image}
            alt={objectsProduct.name}
            className="max-h-full max-w-full object-contain animate-fade-in"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        <div key={`obj-info-${animKey}`} className="absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14 animate-fade-up">
          <h2 className="font-display text-2xl sm:text-3xl text-cream leading-tight mb-1">
            {objectsProduct.name}
          </h2>
          <p className="text-sm text-text-muted mb-6">from {formatPrice(objectsProduct.price)}</p>
          <Link
            to={`/product/${objectsProduct.slug}`}
            className="btn-primary inline-flex items-center gap-2 text-xs"
          >
            Shop Now <ArrowRight size={12} />
          </Link>
        </div>

        <ProductDots
          count={objectsProducts.length}
          active={objectsIdx}
          onSelect={(i) => { setObjectsIdx(i); setAnimKey((k) => k + 1) }}
          dark
        />
      </section>

      {/* ════ SECTION 4 — Objects pop mockup (black) ══════════════════ */}
      <section
        className="h-screen w-screen bg-black relative flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={() => navigate('/objects/pokemon-logos')}
      >
        <div className="absolute top-[88px] left-6 sm:left-8 z-10">
          <p className="text-2xs font-mono tracking-ultra uppercase text-text-muted">cool pokemon</p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pt-[84px] pb-32 px-10">
          {pokemonProduct ? (
            <img
              src={pokemonProduct.image}
              alt="Cool Pokemon Collection"
              className="max-h-full max-w-full object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="w-full max-w-xs aspect-square bg-stone-900" />
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14">
          <p className="text-2xs font-mono tracking-ultra uppercase text-text-muted mb-2">New Collection</p>
          <h2 className="font-display text-2xl sm:text-3xl text-cream leading-tight mb-2">Cool Pokemon</h2>
          <p className="text-sm text-text-muted inline-flex items-center gap-1.5">
            Explore <ArrowRight size={12} />
          </p>
        </div>
      </section>

      {/* ════ SECTION 5 — Objects horizontal scroll ═══════════════════ */}
      <section className="h-screen w-screen bg-off-black relative overflow-hidden">
        <div className="absolute top-[88px] left-6 sm:left-8 z-10">
          <p className="text-2xs font-mono tracking-ultra uppercase text-text-muted">objects</p>
        </div>

        <div className="absolute inset-0 flex flex-col justify-center pt-[84px] pb-10">
          <div
            className="flex gap-5 overflow-x-auto px-6 sm:px-8 pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {objectsProducts.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.slug}`}
                className="flex-shrink-0 w-48 sm:w-60 group"
                draggable={false}
              >
                <div className="w-full aspect-square bg-stone-900 overflow-hidden mb-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <h3 className="font-display text-sm text-cream leading-tight truncate">{product.name}</h3>
                <p className="text-xs text-text-muted mt-0.5">from {formatPrice(product.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SECTION 6 — Artist's (cream) ════════════════════════════ */}
      <section
        className="h-screen w-screen bg-paper relative flex items-center justify-center cursor-pointer"
        onClick={() => {
          if (swipedRef.current) { swipedRef.current = false; return }
          navigate('/artist')
        }}
      >
        <div className="absolute top-[88px] left-6 sm:left-8 z-10">
          <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted">
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

      {/* ── Section progress indicator (right edge, fixed) ─────────── */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 pointer-events-none">
        {SECTION_THEMES.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToSection(i)}
            className={cn(
              'w-1 rounded-full transition-all duration-300 pointer-events-auto',
              section === i
                ? (currentTheme === 'dark' ? 'h-6 bg-cream/70' : 'h-6 bg-ink/50')
                : (currentTheme === 'dark' ? 'h-1.5 bg-cream/20' : 'h-1.5 bg-ink/15')
            )}
            aria-label={`Go to section ${i + 1}`}
          />
        ))}
      </div>

    </div>
  )
}

function ProductDots({ count, active, onSelect, dark }) {
  if (count <= 1) return null
  return (
    <div className="absolute bottom-6 right-6 flex gap-1.5 items-center">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn(
            'h-[3px] rounded-full transition-all duration-300',
            i === active
              ? cn('w-5', dark ? 'bg-cream/70' : 'bg-ink/60')
              : cn('w-1.5', dark ? 'bg-cream/20' : 'bg-ink/20')
          )}
          aria-label={`Product ${i + 1}`}
        />
      ))}
    </div>
  )
}
