import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'

const artProducts     = products.filter((p) => p.section === 'art')
const objectsProducts = products.filter((p) => p.section === 'objects')
// HIDDEN - re-enable for Art launch
// const pokemonProduct  = products.find((p) => p.id === 'cool-pokemon-tee')
// const featuredArt     = artProducts.find((p) => p.featured) || artProducts[0]
const featuredObject  = objectsProducts[0]  || null
const featuredObject2 = objectsProducts[1]  || objectsProducts[0] || null
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
// HIDDEN - re-enable for Art launch: ['light', 'dark', 'dark', 'dark', 'light', 'dark', 'light']
const SECTION_THEMES = ['dark', 'dark', 'light', 'dark', 'light']

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
        <img
          src={featuredObject.heroImage ?? featuredObject.image}
          alt={featuredObject.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
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
          <img
            src={featuredObject2.heroImage ?? featuredObject2.image}
            alt={featuredObject2.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
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

      {/* ════ SECTION 5 — New In (cream) ══════════════════════════════ */}
      <section
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
      </section>

      {/* ════ SECTION 6 — Objects horizontal scroll ═══════════════════ */}
      <section className="h-screen w-screen bg-off-black relative overflow-hidden">
        <div className="absolute top-[88px] left-6 sm:left-8 right-6 sm:right-8 z-10 flex items-center gap-3">
          <p className="text-2xs font-sans tracking-label-xl uppercase text-text-muted">objects</p>
          <div className="flex-1" />
          <Link
            to="/objects"
            className="inline-flex items-center gap-1.5 text-2xs font-sans tracking-label uppercase text-text-muted hover:text-cream transition-colors"
          >
            Shop all <ArrowRight size={10} />
          </Link>
        </div>

        <div className="absolute inset-0 flex flex-col justify-center pt-[84px] pb-10">
          <div
            className="flex gap-5 overflow-x-auto px-6 sm:px-8 pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {objectsProducts.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="flex-shrink-0 w-48 sm:w-60 group"
                draggable={false}
              >
                <div className="w-full aspect-square bg-stone-900 overflow-hidden mb-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
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
