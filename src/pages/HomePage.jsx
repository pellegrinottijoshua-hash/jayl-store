import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'
import { getDrop, basePriceFor } from '../../api/_lib/drop.js'
import DropPanels from '@/components/drop/DropPanels'
import DropCountdown from '@/components/drop/DropCountdown'
import { dropWindowState, BEFORE } from '@/components/drop/dropWindowState'

const objectsProducts = products.filter((p) => p.section === 'objects')
const dropCfg          = getDrop()

// Prodotti rilasciati dal drop (usciti dalla finestra live, tornati in listino).
// Guida sia l'archivio sotto sia il countdown "prossimo drop" nella sezione lista
// d'attesa. Vuoto finché non viene chiuso il primo drop.
const releasedProducts = (dropCfg.released || [])
  .map((id) => objectsProducts.find((p) => p.id === id))
  .filter(Boolean)

// Same condition used further down in JSX to decide whether the archive
// renders anything — not time-dependent (unlike the before/live/closed
// state, which lives inside the individual components because it must stay
// fresh on every render), so computable once at module-load like the rest
// of the data derived above.
const archiveWillRender = releasedProducts.length >= 6

// light = cream sections, dark = dark sections. Derived from the screens that
// actually render (the archive is gated at 6+ released products) — hard-coding
// this array desyncs it from reality and Navbar paints the wrong text color on
// whichever screen inherits the wrong index.
//
// Screen 1 (drop pieces + waitlist, merged into one <section>) always renders
// — even with zero configured pieces, the waitlist half still shows — so
// unlike the old two-screen layout this first entry needs no conditional.
const SECTION_THEMES = [
  'dark', // Screen — Drop pieces + waitlist, always renders
  ...(archiveWillRender ? ['dark'] : []),
  'light', // Screen — Artist's, always renders
]

// Stable per-session random choice between images[0] and images[1] per product,
// for the archive carousel only — the sole consumer. Gated the same as the
// carousel itself and scoped to just the released products, not the whole
// catalog: no reason to burn Math.random() over items nothing renders.
const carouselImagePick = archiveWillRender
  ? new Map(
      releasedProducts.map(p => {
        const imgs = p.images || []
        const pick = Math.random() < 0.5 ? (imgs[0] ?? p.image) : (imgs[1] ?? imgs[0] ?? p.image)
        return [p.id, pick]
      })
    )
  : null

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
function CollectionCarousel({ title, viewAllTo, products: items, imagePick, sectionRef }) {
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
    <section ref={sectionRef} className="h-screen w-screen bg-off-black relative overflow-hidden">
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
              <p className="text-xs text-text-muted mt-0.5 pointer-events-none">from {formatPrice(basePriceFor(product.id, null, product, dropCfg))}</p>
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
  const navigate      = useNavigate()
  const sectionIdxRef = useRef(0)
  // DOM node per top-level screen, in the same order as SECTION_THEMES —
  // sectionEls[i] and SECTION_THEMES[i] must always describe the same screen.
  const sectionEls    = useRef([])

  useEffect(() => {
    setPageTheme(SECTION_THEMES[section] ?? 'dark')
    setActiveSection(null)
  }, [section, setPageTheme, setActiveSection])

  // Screen 1 is no longer a fixed h-screen panel (4:5 cards size themselves
  // by width, and the waitlist block now lives inside it too), so its height
  // is no longer a clean multiple of window.innerHeight — the old
  // `scrollY / innerHeight` division would drift out of sync with which
  // screen is actually on glass as soon as screen 1 differs from 100vh.
  // Measuring each screen's own offsetTop instead stays correct regardless
  // of any individual screen's height.
  const handleScroll = useCallback(() => {
    const els = sectionEls.current
    if (!els.length) return
    const mid = window.scrollY + window.innerHeight / 2
    let idx = 0
    for (let i = 0; i < els.length; i++) {
      if (els[i] && els[i].offsetTop <= mid) idx = i
    }
    if (idx !== sectionIdxRef.current) {
      sectionIdxRef.current = idx
      setSection(idx)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Carousel auto-scroll/drag now lives in the <CollectionCarousel> component.

  // Time-dependent, unlike dropPanelsWillRender above — recomputed every render
  // so it stays correct as the countdown crosses startsAt/endsAt during a
  // long-lived tab, same as DropPanels' own call to dropWindowState.
  const dropState = dropWindowState(dropCfg)

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
      // Same key EmailCapturePopup sets on its own successful submit — without
      // this, a visitor who signs up here still gets asked for the same email
      // seconds later by that popup (it fires on scroll depth, which a 3-screen
      // homepage crosses right around this section).
      localStorage.setItem('jayl-email-popup', 'subscribed')
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

      {/* ════ SCREEN 1 — Drop pieces + waitlist, one screen, nothing below the
          fold to reach the email field. DropPanels renders the bar + pieces
          (nothing if the drop is empty — the top-anchored flex column just
          leaves the waitlist half alone at the top); the waitlist half below
          always renders, so this <section> is never empty and SECTION_THEMES'
          first 'dark' entry is never wrong. `min-h-screen`, not `h-screen`:
          on a short viewport the composition may run past 100vh (a little
          scroll), it must never shrink the hero images to force an exact fit. ════ */}
      <section ref={(el) => { sectionEls.current[0] = el }} className="min-h-screen w-screen bg-off-black flex flex-col">
        <DropPanels />

        <div className="flex-1 flex flex-col justify-center pt-6 pb-8 sm:pt-8 sm:pb-16">
          <div className="relative overflow-hidden px-6 sm:px-12">
            {/* Faint decorative large letter, matches the value-prop treatment used elsewhere on the site */}
            <span
              aria-hidden="true"
              className="absolute right-[-0.05em] top-1/2 -translate-y-1/2 font-display leading-none select-none pointer-events-none"
              style={{ fontSize: 'clamp(8rem, 20vw, 20rem)', color: '#C4A35A', opacity: 0.04, letterSpacing: '-0.05em' }}
            >J</span>

            <div className="relative max-w-md mx-auto w-full text-center">
              <p className="hidden sm:block text-[10px] font-sans tracking-[0.25em] uppercase mb-4" style={{ color: '#C4A35A', opacity: 0.7 }}>
                Get notified
              </p>
              <h2 className="font-display text-xl sm:text-4xl text-cream leading-tight mb-2 sm:mb-4">
                Never miss a drop.
              </h2>
              <p className="text-white/60 text-xs sm:text-sm leading-snug sm:leading-relaxed mb-3 sm:mb-6 max-w-[280px] sm:max-w-none mx-auto">
                Every drop is a limited edition — once it closes, the pieces go back to the
                archive at full price. Join the list for early access to the next one.
              </p>

              {/* Before the current drop opens, "the next drop" IS the current one —
                  pointing this at cfg.next here would put a second, later date next
                  to DropPanels' own "opens in" for the same drop, two countdowns
                  disagreeing about when the thing actually opens. Once it's live or
                  closed, this goes back to genuinely meaning the drop after this one. */}
              {dropState.state === BEFORE ? (
                <DropCountdown
                  to={dropState.target}
                  label="opens in"
                  className="block text-xs tracking-widest uppercase text-white/50 tabular-nums mb-3 sm:mb-8"
                />
              ) : dropCfg.next?.startsAt && (
                <DropCountdown
                  to={dropCfg.next.startsAt}
                  label="next drop in"
                  className="block text-xs tracking-widest uppercase text-white/50 tabular-nums mb-3 sm:mb-8"
                />
              )}

              {waitlistSubmitted ? (
                <p className="text-cream text-sm">You're on the list.</p>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="flex gap-2 sm:gap-2.5">
                  <input
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="flex-1 min-w-0 bg-gray-900 border border-border text-cream px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:outline-none focus:border-border-light transition-colors placeholder:text-text-muted"
                  />
                  <button
                    type="submit"
                    disabled={waitlistLoading || !waitlistEmail.trim()}
                    className="shrink-0 bg-cream text-off-black px-4 sm:px-6 py-2.5 sm:py-3 text-2xs sm:text-xs font-sans tracking-label uppercase disabled:opacity-40 transition-opacity hover:opacity-90"
                  >
                    {waitlistLoading ? 'Just a sec…' : 'Join the waitlist'}
                  </button>
                </form>
              )}
              {waitlistError && <p className="text-red-400 text-xs mt-2">{waitlistError}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ════ Archive — only once enough drops have closed to fill it (releasedProducts
          comes from getDrop().released; empty today, so nothing renders yet). Reuses
          CollectionCarousel, which duplicates its list for the infinite-loop illusion
          and looks visibly broken with too few items — same 6-item floor "New In" used. ════ */}
      {archiveWillRender && (
        <CollectionCarousel
          title="The Archive"
          viewAllTo="/objects"
          products={releasedProducts}
          imagePick={carouselImagePick}
          sectionRef={(el) => { sectionEls.current[1] = el }}
        />
      )}

      {/* ════ SCREEN 3 — Artist's (cream) ════════════════════════════ */}
      <section
        ref={(el) => { sectionEls.current[archiveWillRender ? 2 : 1] = el }}
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
