import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'

const artProducts     = products.filter((p) => p.section === 'art')
const objectsProducts = products.filter((p) => p.section === 'objects')
const pokemonProduct  = products.find((p) => p.id === 'cool-pokemon-tee')
const featuredArt     = artProducts.find((p) => p.featured) || artProducts[0]
const featuredObject  = objectsProducts[0]

const SECTION_THEMES = ['dark', 'dark', 'dark', 'dark', 'dark', 'light']

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
  const navigate   = useNavigate()
  const sectionRef = useRef(0)

  useEffect(() => {
    setPageTheme(SECTION_THEMES[section])
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

      {/* ════ SECTION 1 — Hero (black, video placeholder) ══════════════ */}
      <section className="h-screen w-screen bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-black" aria-hidden="true" />
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
          <p className="font-display text-7xl sm:text-9xl text-cream/10 tracking-widest">JAYL</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 px-8 sm:px-12 pb-14 z-10">
          <p className="text-xs font-mono tracking-wider uppercase text-white/50 mb-3">Art</p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-2">
            {featuredArt.name}
          </h1>
          <p className="text-sm text-white/60 mb-6">{featuredArt.subtitle}</p>
          <Link
            to={`/product/${featuredArt.id}`}
            className="inline-flex items-center gap-2 bg-white text-black text-xs font-mono tracking-wider uppercase px-5 py-3 hover:bg-white/90 transition-colors"
          >
            Shop Now <ArrowRight size={12} />
          </Link>
        </div>
      </section>

      {/* ════ SECTION 2 — Art fullscreen hero ══════════════════════════ */}
      <section
        className="h-screen w-screen relative overflow-hidden cursor-pointer"
        onClick={() => navigate(`/product/${featuredArt.id}`)}
      >
        <img
          src={featuredArt.image}
          alt={featuredArt.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 px-8 sm:px-12 pb-14 z-10">
          <p className="text-xs font-mono tracking-wider uppercase text-white/60 mb-3">
            {slugToTitle(featuredArt.movement)}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-1">
            {featuredArt.name}
          </h2>
          <p className="text-sm text-white/70 mb-6">from {formatPrice(featuredArt.price)}</p>
          <Link
            to={`/product/${featuredArt.id}`}
            className="inline-flex items-center gap-2 bg-white text-black text-xs font-mono tracking-wider uppercase px-5 py-3 hover:bg-white/90 transition-colors"
          >
            Shop Now <ArrowRight size={12} />
          </Link>
        </div>
      </section>

      {/* ════ SECTION 3 — Objects fullscreen hero ══════════════════════ */}
      <section
        className="h-screen w-screen relative overflow-hidden cursor-pointer"
        onClick={() => navigate(`/product/${featuredObject.id}`)}
      >
        <img
          src={featuredObject.image}
          alt={featuredObject.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 px-8 sm:px-12 pb-14 z-10">
          <p className="text-xs font-mono tracking-wider uppercase text-white/60 mb-3">Objects</p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-1">
            {featuredObject.name}
          </h2>
          <p className="text-sm text-white/70 mb-6">from {formatPrice(featuredObject.price)}</p>
          <Link
            to={`/product/${featuredObject.id}`}
            className="inline-flex items-center gap-2 bg-white text-black text-xs font-mono tracking-wider uppercase px-5 py-3 hover:bg-white/90 transition-colors"
          >
            Shop Now <ArrowRight size={12} />
          </Link>
        </div>
      </section>

      {/* ════ SECTION 4 — Objects pop mockup (black) ══════════════════ */}
      <section
        className="h-screen w-screen bg-black relative flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={() => navigate('/objects')}
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
                to={`/product/${product.id}`}
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
        onClick={() => navigate('/artist')}
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

    </div>
  )
}
