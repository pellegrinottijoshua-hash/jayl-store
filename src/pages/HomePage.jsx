import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowDownRight } from 'lucide-react'
import { getFeaturedProducts, products } from '@/data/products'
import ProductCard from '@/components/product/ProductCard'

// ─── Animated counter ────────────────────────────────────────────────────────
function StatItem({ value, label }) {
  return (
    <div className="text-center">
      <p className="font-display text-4xl lg:text-5xl text-cream">{value}</p>
      <p className="section-label mt-2">{label}</p>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label, title, description, cta, ctaTo }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
      <div>
        <p className="section-label mb-3">{label}</p>
        <h2 className="font-display text-3xl lg:text-5xl text-cream leading-tight">{title}</h2>
        {description && (
          <p className="text-text-secondary mt-4 max-w-lg leading-relaxed">{description}</p>
        )}
      </div>
      {cta && (
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-widest uppercase text-text-secondary hover:text-cream transition-colors duration-200 flex-shrink-0"
        >
          {cta}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}

// ─── Movement grid item ───────────────────────────────────────────────────────
const MOVEMENTS_DISPLAY = [
  { id: 'impressionism', label: 'Impressionism', desc: 'Light dissolved into data' },
  { id: 'surrealism', label: 'Surrealism', desc: 'Machine dreamscapes' },
  { id: 'cubism', label: 'Cubism', desc: 'Multiple simultaneous feeds' },
  { id: 'expressionism', label: 'Expressionism', desc: 'The city\'s nervous system' },
  { id: 'art-nouveau', label: 'Art Nouveau', desc: 'Organic interfaces' },
  { id: 'bauhaus', label: 'Bauhaus', desc: 'Form as ideology' },
]

export default function HomePage() {
  const heroRef = useRef(null)

  // Parallax effect on hero
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const onScroll = () => {
      const y = window.scrollY
      el.style.transform = `translateY(${y * 0.3}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const featured = getFeaturedProducts()
  const artProducts = products.filter((p) => p.section === 'art').slice(0, 3)
  const streetwearProducts = products.filter((p) => p.section === 'streetwear').slice(0, 3)

  return (
    <div className="min-h-screen">
      {/* ─── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="relative h-screen min-h-[700px] flex items-center overflow-hidden">
        {/* Background image */}
        <div
          ref={heroRef}
          className="absolute inset-0 scale-110"
          style={{ willChange: 'transform' }}
        >
          <img
            src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-off-black via-off-black/60 to-off-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-off-black/80 via-transparent to-transparent" />
        </div>

        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.03] bg-noise pointer-events-none" />

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <div className="max-w-3xl">
            {/* Label */}
            <div className="flex items-center gap-3 mb-8 animate-fade-in">
              <div className="w-8 h-px bg-accent" />
              <span className="section-label text-accent">New Collection — 2025</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl text-cream leading-[0.95] tracking-tight animate-fade-up">
              Art Movements
              <br />
              <em className="text-accent-warm not-italic">Reimagined.</em>
              <br />
              Subjects
              <br />
              <em className="not-italic text-cream/70">Never Explored.</em>
            </h1>

            {/* Sub */}
            <p className="mt-8 text-lg text-text-secondary max-w-xl leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
              Impressionism applied to server farms. Surrealism applied to machine learning.
              Cubism applied to the social media feed. Premium prints and wearable art —
              fulfilled worldwide by Gelato.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap items-center gap-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/shop" className="btn-primary">
                Shop the Collection
                <ArrowRight size={16} />
              </Link>
              <Link to="/shop?section=art" className="btn-ghost">
                Art Prints
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 right-8 flex items-center gap-2 text-text-muted animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <span className="section-label">Scroll</span>
          <ArrowDownRight size={14} />
        </div>
      </section>

      {/* ─── TICKER ────────────────────────────────────────────────────────────── */}
      <div className="border-y border-border overflow-hidden bg-surface py-4">
        <div
          className="flex gap-12 whitespace-nowrap"
          style={{
            animation: 'marquee 30s linear infinite',
          }}
        >
          {[...Array(3)].flatMap((_, i) =>
            ['Impressionism', 'Surrealism', 'Cubism', 'Expressionism', 'Art Nouveau', 'Bauhaus'].map((m) => (
              <span key={`${i}-${m}`} className="section-label text-text-muted">
                {m} ·
              </span>
            ))
          )}
        </div>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33.333%); }
          }
        `}</style>
      </div>

      {/* ─── FEATURED ──────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <SectionHeader
          label="Featured Works"
          title="The Collection"
          description="Six art movements. Six subjects they never touched. Each piece interrogates the collision between historical aesthetics and contemporary life."
          cta="View All"
          ctaTo="/shop"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {featured.map((product, i) => (
            <div key={product.id} className="bg-off-black">
              <ProductCard
                product={product}
                className="border-0"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── SPLIT: ART ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text */}
            <div>
              <p className="section-label mb-4 text-accent">Art Prints</p>
              <h2 className="font-display text-4xl lg:text-6xl text-cream leading-tight mb-6">
                Gallery-quality
                <br />
                <em className="not-italic text-cream/60">prints,</em>
                <br />
                radical ideas.
              </h2>
              <p className="text-text-secondary leading-relaxed mb-8">
                Fine art giclée prints on 310gsm archival matte paper. Pigment inks rated
                100+ years. Each piece ships in a rigid tube or flat-packed, with optional
                framing. Fulfilled by Gelato from a print partner near you.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                {['Impressionism', 'Surrealism', 'Cubism', 'Expressionism'].map((m) => (
                  <Link
                    key={m}
                    to={`/shop?section=art&movement=${m.toLowerCase()}`}
                    className="text-xs border border-border text-text-secondary hover:border-accent hover:text-cream px-3 py-1.5 tracking-widest uppercase transition-all duration-200"
                  >
                    {m}
                  </Link>
                ))}
              </div>
              <Link to="/shop?section=art" className="btn-primary">
                Shop Art Prints
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-3">
              {artProducts.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── MOVEMENTS GRID ────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <SectionHeader
            label="Movements"
            title="Six Movements,\nSix New Worlds"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
            {MOVEMENTS_DISPLAY.map((movement) => (
              <Link
                key={movement.id}
                to={`/shop?section=art&movement=${movement.id}`}
                className="group bg-surface p-6 hover:bg-surface-2 transition-colors duration-300"
              >
                <div className="w-8 h-px bg-border-light group-hover:bg-accent transition-colors duration-300 mb-4" />
                <h3 className="font-display text-lg text-cream leading-tight mb-2 group-hover:text-accent transition-colors duration-200">
                  {movement.label}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {movement.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SPLIT: STREETWEAR ─────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Product grid first on large */}
            <div className="grid grid-cols-2 gap-3 order-2 lg:order-1">
              {streetwearProducts.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2">
              <p className="section-label mb-4 text-accent-cool">Streetwear</p>
              <h2 className="font-display text-4xl lg:text-6xl text-cream leading-tight mb-6">
                Wearable art
                <br />
                <em className="not-italic text-cream/60">for the</em>
                <br />
                gallery street.
              </h2>
              <p className="text-text-secondary leading-relaxed mb-8">
                100% organic cotton, garment-dyed blanks. Water-based screen printing.
                Oversized silhouettes built for the intersection of high art and street
                culture. Each run is limited — when it sells out, it's gone.
              </p>
              <Link to="/shop?section=streetwear" className="btn-primary">
                Shop Streetwear
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ─────────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            <StatItem value="100+" label="Years ink longevity" />
            <StatItem value="130+" label="Gelato print locations" />
            <StatItem value="6" label="Art movements" />
            <StatItem value="∞" label="New subjects" />
          </div>
        </div>
      </section>

      {/* ─── PHILOSOPHY ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-40 text-center">
          <p className="section-label mb-8">The Premise</p>
          <blockquote className="font-display text-3xl lg:text-5xl text-cream leading-tight">
            "Every art movement was a response to its moment.
            <em className="text-accent-warm"> Ours is no different."</em>
          </blockquote>
          <p className="mt-10 text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Monet painted haystacks because haystacks were his world. If he were alive today,
            he'd paint server farms — those vast, humming monuments to computation. JAYL is
            the premise that the great movements aren't finished. They just need new subjects.
          </p>
          <Link to="/shop" className="btn-primary mt-10 inline-flex">
            Explore the Collection
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}
