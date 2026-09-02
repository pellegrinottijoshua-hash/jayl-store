import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'
import { getDrop } from '../../api/_lib/drop.js'
import DropPanels from '@/components/drop/DropPanels'
import DropCountdown from '@/components/drop/DropCountdown'

const objectsProducts = products.filter((p) => p.section === 'objects')
const dropCfg          = getDrop()

// Prodotti rilasciati dal drop (usciti dalla finestra live, tornati in listino).
// Guida sia l'archivio sotto sia il countdown "prossimo drop" nella sezione lista
// d'attesa. Vuoto finché non viene chiuso il primo drop.
const releasedProducts = (dropCfg.released || [])
  .map((id) => objectsProducts.find((p) => p.id === id))
  .filter(Boolean)

// light = cream sections, dark = dark sections
// Screen 1: Drop panels | Screen 2: Waitlist | Screen 3: Artist's
const SECTION_THEMES = ['dark', 'dark', 'light']

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

// Reusable auto-scrolling collection carousel — each instance owns its own ref,
// drag state and rAF loop, so multiple carousels on one page run independently.
function CollectionCarousel({ title, viewAllTo, products: items, imagePick }) {
  const ref  = useRef(null)
  const drag = useRef({ active: false, hovered: false, startX: 0, startScroll: 0, moved: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const SPEED = 36 // px / second
    let last = null
    let raf

    function tick(now) {
      const d = drag.current
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

  if (!items.length) return null

  const onEnter = () => { drag.current.hovered = true }
  const onLeave = () => {
    drag.current.hovered = false
    drag.current.active  = false
    if (ref.current) ref.current.style.cursor = 'grab'
  }
  const onDown = (e) => {
    if (!ref.current) return
    drag.current = { active: true, hovered: true, startX: e.clientX, startScroll: ref.current.scrollLeft, moved: false }
    ref.current.style.cursor = 'grabbing'
    e.preventDefault()
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d.active || !ref.current) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 3) d.moved = true
    ref.current.scrollLeft = d.startScroll - dx
  }
  const onUp = () => {
    drag.current.active = false
    if (ref.current) ref.current.style.cursor = 'grab'
  }

  return (
    <section className="h-screen w-screen bg-off-black relative overflow-hidden">
      <div className="absolute top-[88px] left-6 sm:left-8 right-6 sm:right-8 z-10 flex items-center gap-3">
        <p className="text-2xs font-sans tracking-label-xl uppercase text-text-muted">{title}</p>
        <div className="flex-1" />
        <Link
          to={viewAllTo}
          className="inline-flex items-center gap-1.5 text-2xs font-sans tracking-label uppercase text-text-muted hover:text-cream transition-colors"
        >
          View all <ArrowRight size={10} />
        </Link>
      </div>

      {/* Scrollable track — rAF auto-scroll, mouse drag, native touch */}
      <div className="absolute inset-0 flex flex-col justify-center pt-[84px] pb-10">
        <div
          ref={ref}
          className="flex gap-5 overflow-x-scroll will-change-transform select-none"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            cursor: 'grab',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
          }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
        >
          {/* Render the list twice for seamless infinite loop — the second set is
              a visual clone, hidden from screen readers / crawlers to avoid
              duplicate content in the accessibility tree. */}
          {[...items, ...items].map((product, idx) => {
            const isClone = idx >= items.length
            return (
            <Link
              key={`${product.id}-${idx}`}
              to={`/product/${product.id}`}
              className="flex-shrink-0 w-48 sm:w-60 group"
              draggable={false}
              aria-hidden={isClone || undefined}
              tabIndex={isClone ? -1 : undefined}
              onClick={e => {
                // block navigation if user was dragging
                if (drag.current.moved) e.preventDefault()
              }}
            >
              <div className="w-full aspect-[3/4] bg-stone-900 overflow-hidden mb-3 pointer-events-none">
                <img
                  src={imagePick.get(product.id) ?? product.image}
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
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const [section, setSection] = useState(0)
  const { setPageTheme, setActiveSection } = useThemeStore()

  usePageMeta({
    // usePageMeta appends " — JAYL"; keep the brand out of the title here to
    // avoid "JAYL — Art & Wearable Art — JAYL".
    title:       'Art & Wearable Art',
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

  // Carousel auto-scroll/drag now lives in the <CollectionCarousel> component.

  // ── Waitlist form — reuses the same /api/capture-email endpoint as
  // EmailCapturePopup, so no new server code is needed for this screen.
  const [waitlistEmail,     setWaitlistEmail]     = useState('')
  const [waitlistLoading,   setWaitlistLoading]   = useState(false)
  const [waitlistError,     setWaitlistError]     = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)

  const handleWaitlistSubmit = async (e) => {
    e.preventDefault()
    if (!waitlistEmail.trim()) return
    setWaitlistLoading(true)
    setWaitlistError('')
    try {
      const res  = await fetch('/api/capture-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: waitlistEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setWaitlistSubmitted(true)
    } catch (err) {
      setWaitlistError(err.message)
    } finally {
      setWaitlistLoading(false)
    }
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

      {/* ════ SCREEN 1 — Drop panels: the live (or just-closed) drop pieces ══ */}
      <DropPanels />

      {/* ════ SCREEN 2 — Waitlist ═══════════════════════════════════════ */}
      <section className="min-h-screen w-screen bg-off-black relative overflow-hidden flex items-center justify-center px-6 sm:px-12">
        {/* Faint decorative large letter, matches the value-prop treatment used elsewhere on the site */}
        <span
          aria-hidden="true"
          className="absolute right-[-0.05em] top-1/2 -translate-y-1/2 font-display leading-none select-none pointer-events-none"
          style={{ fontSize: 'clamp(12rem, 28vw, 26rem)', color: '#C4A35A', opacity: 0.04, letterSpacing: '-0.05em' }}
        >J</span>

        <div className="relative max-w-md w-full text-center">
          <p className="text-[10px] font-sans tracking-[0.25em] uppercase mb-6" style={{ color: '#C4A35A', opacity: 0.7 }}>
            Get notified
          </p>
          <h2 className="font-display text-3xl sm:text-4xl text-cream leading-tight mb-4">
            Never miss a drop.
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            Every drop is a limited edition — once it closes, the pieces go back to the
            archive at full price. Join the list for early access to the next one.
          </p>

          {dropCfg.next?.startsAt && (
            <DropCountdown
              to={dropCfg.next.startsAt}
              label="prossimo drop tra"
              className="block text-xs tracking-widest uppercase text-white/50 tabular-nums mb-8"
            />
          )}

          {waitlistSubmitted ? (
            <p className="text-cream text-sm">You're on the list.</p>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 bg-gray-900 border border-border text-cream px-4 py-3 text-sm focus:outline-none focus:border-border-light transition-colors placeholder:text-text-muted"
              />
              <button
                type="submit"
                disabled={waitlistLoading || !waitlistEmail.trim()}
                className="bg-cream text-off-black px-6 py-3 text-xs font-sans tracking-label uppercase disabled:opacity-40 transition-opacity hover:opacity-90"
              >
                {waitlistLoading ? 'Just a sec…' : 'Join the waitlist'}
              </button>
            </form>
          )}
          {waitlistError && <p className="text-red-400 text-xs mt-2">{waitlistError}</p>}
        </div>
      </section>

      {/* ════ Archive — only once enough drops have closed to fill it (releasedProducts
          comes from getDrop().released; empty today, so nothing renders yet). Reuses
          CollectionCarousel, which duplicates its list for the infinite-loop illusion
          and looks visibly broken with too few items — same 6-item floor "New In" used. ════ */}
      {releasedProducts.length >= 6 && (
        <CollectionCarousel
          title="The Archive"
          viewAllTo="/objects"
          products={releasedProducts}
          imagePick={carouselImagePick}
        />
      )}

      {/* ════ SCREEN 3 — Artist's (cream) ════════════════════════════ */}
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
