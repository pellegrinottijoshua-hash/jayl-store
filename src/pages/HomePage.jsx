import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { products } from '@/data/products'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'
import { cn } from '@/lib/utils'

const artProducts     = products.filter((p) => p.section === 'art')
const objectsProducts = products.filter((p) => p.section === 'objects')

// Each section's theme so the navbar colours update as we scroll
const SECTION_THEMES = ['dark', 'light', 'dark', 'light']

/** Falling-s treatment shared with Artist page */
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
  const navigate = useNavigate()
  const wheelLock = useRef(false)

  // Lock body scroll — we control all navigation
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Keep nav theme in sync with current section
  useEffect(() => {
    setPageTheme(SECTION_THEMES[section])
    setActiveSection(null)
  }, [section, setPageTheme, setActiveSection])

  const goDown = useCallback(() => setSection((s) => Math.min(s + 1, 3)), [])
  const goUp   = useCallback(() => setSection((s) => Math.max(s - 1, 0)), [])

  const nextArt = useCallback(() => {
    setArtIdx((i) => (i + 1) % artProducts.length)
    setAnimKey((k) => k + 1)
  }, [])

  const prevArt = useCallback(() => {
    setArtIdx((i) => (i - 1 + artProducts.length) % artProducts.length)
    setAnimKey((k) => k + 1)
  }, [])

  const nextObjects = useCallback(() => {
    setObjectsIdx((i) => (i + 1) % objectsProducts.length)
    setAnimKey((k) => k + 1)
  }, [])

  const prevObjects = useCallback(() => {
    setObjectsIdx((i) => (i - 1 + objectsProducts.length) % objectsProducts.length)
    setAnimKey((k) => k + 1)
  }, [])

  // Wheel navigation (desktop)
  useEffect(() => {
    const onWheel = (e) => {
      if (wheelLock.current) return
      if (Math.abs(e.deltaY) < 20) return
      wheelLock.current = true
      e.deltaY > 0 ? goDown() : goUp()
      setTimeout(() => { wheelLock.current = false }, 900)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [goDown, goUp])

  // Keyboard navigation (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown')  { e.preventDefault(); goDown() }
      if (e.key === 'ArrowUp')    { e.preventDefault(); goUp() }
      if (e.key === 'ArrowRight') {
        if (section === 0) navigate('/art')
        if (section === 1) nextArt()
        if (section === 2) nextObjects()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [section, goDown, goUp, nextArt, nextObjects, navigate])

  // Touch / swipe
  const { onTouchStart, onTouchEnd } = useSwipe({
    onSwipeUp:   goDown,                              // finger moves up → go to next section below
    onSwipeDown: goUp,    // finger moves down → go to previous section above
    onSwipeLeft: () => {
      if (section === 0) navigate('/art')
      if (section === 1) nextArt()
      if (section === 2) nextObjects()
      if (section === 3) navigate('/objects')
    },
    onSwipeRight: () => {
      if (section === 0) navigate('/art')
      if (section === 1) prevArt()
      if (section === 2) prevObjects()
    },
  })

  const artProduct     = artProducts[artIdx]
  const objectsProduct = objectsProducts[objectsIdx]

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Sliding stack ──────────────────────────────────────────────── */}
      <div
        className="will-change-transform"
        style={{
          transform: `translateY(-${section * 100}vh)`,
          transition: 'transform 720ms cubic-bezier(0.77,0,0.175,1)',
        }}
      >

        {/* ════ SECTION 1 — black, video hero ════════════════════════════ */}
        <section className="h-screen w-screen bg-black relative flex items-center justify-center overflow-hidden">
          {/* Video placeholder — autoplay, looping black rectangle */}
          <div className="absolute inset-0 bg-black" aria-hidden="true" />

        </section>

        {/* ════ SECTION 2 — cream, art product ═══════════════════════════ */}
        <section className="h-screen w-screen bg-paper relative overflow-hidden">
          {/* Section label */}
          <div className="absolute top-16 left-6 sm:left-8 z-10">
            <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted">art</p>
          </div>

          {/* Product image */}
          <div className="absolute inset-0 flex items-center justify-center pt-14 pb-52 px-10">
            <img
              key={`art-img-${artIdx}`}
              src={artProduct.image}
              alt={artProduct.name}
              className="max-h-full max-w-full object-contain animate-fade-in"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>

          {/* Product info */}
          <div
            key={`art-info-${animKey}`}
            className="absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14 animate-fade-up"
          >
            <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted mb-1">
              {slugToTitle(artProduct.movement)}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl text-ink leading-tight mb-1">
              {artProduct.name}
            </h2>
            <p className="text-sm text-ink-muted">from {formatPrice(artProduct.price)}</p>
          </div>

          {/* Dot indicator */}
          <ProductDots count={artProducts.length} active={artIdx} onSelect={(i) => { setArtIdx(i); setAnimKey(k => k + 1) }} dark={false} />
        </section>

        {/* ════ SECTION 3 — black, objects product ════════════════════════ */}
        <section className="h-screen w-screen bg-off-black relative overflow-hidden">
          {/* Section label */}
          <div className="absolute top-16 left-6 sm:left-8 z-10">
            <p className="text-2xs font-mono tracking-ultra uppercase text-text-muted">objects</p>
          </div>

          {/* Product image */}
          <div className="absolute inset-0 flex items-center justify-center pt-14 pb-52 px-10">
            <img
              key={`obj-img-${objectsIdx}`}
              src={objectsProduct.image}
              alt={objectsProduct.name}
              className="max-h-full max-w-full object-contain animate-fade-in"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>

          {/* Product info */}
          <div
            key={`obj-info-${animKey}`}
            className="absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14 animate-fade-up"
          >
            <h2 className="font-display text-2xl sm:text-3xl text-cream leading-tight mb-1">
              {objectsProduct.name}
            </h2>
            <p className="text-sm text-text-muted">from {formatPrice(objectsProduct.price)}</p>
          </div>

          {/* Dot indicator */}
          <ProductDots count={objectsProducts.length} active={objectsIdx} onSelect={(i) => { setObjectsIdx(i); setAnimKey(k => k + 1) }} dark />
        </section>

        {/* ════ SECTION 4 — cream, artist vision ══════════════════════════ */}
        <section
          className="h-screen w-screen bg-paper relative flex items-center justify-center cursor-pointer"
          onClick={() => navigate('/artist')}
        >
          {/* Section label */}
          <div className="absolute top-16 left-6 sm:left-8 z-10">
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

      </div>

      {/* ── Section progress indicator (right edge) ───────────────────── */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onClick={() => setSection(i)}
            className={cn(
              'w-1 rounded-full transition-all duration-400',
              section === i
                ? (SECTION_THEMES[i] === 'dark' ? 'h-6 bg-cream/70' : 'h-6 bg-ink/50')
                : (SECTION_THEMES[i] === 'dark' ? 'h-1.5 bg-cream/20' : 'h-1.5 bg-ink/15')
            )}
            aria-label={`Go to section ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

/** Small pill dots showing product position within a section */
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
