import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

const artProducts = products.filter((p) => p.section === 'art')

export default function ArtPage() {
  const [idx, setIdx] = useState(0)
  const { setPageTheme, setActiveSection } = useThemeStore()
  const carouselRef  = useRef(null)
  const idxRef       = useRef(0)

  useEffect(() => {
    setPageTheme('light')
    setActiveSection('art')
  }, [setPageTheme, setActiveSection])

  const scrollToProduct = useCallback((i) => {
    if (!carouselRef.current) return
    const clamped = Math.max(0, Math.min(i, artProducts.length - 1))
    carouselRef.current.scrollTo({ left: clamped * window.innerWidth, behavior: 'smooth' })
  }, [])

  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return
    const newIdx = Math.round(carouselRef.current.scrollLeft / window.innerWidth)
    if (newIdx !== idxRef.current) {
      idxRef.current = newIdx
      setIdx(newIdx)
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const cur = idxRef.current
      if (e.key === 'ArrowRight') scrollToProduct(cur + 1)
      if (e.key === 'ArrowLeft')  scrollToProduct(cur - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scrollToProduct])

  return (
    <div
      className="h-screen w-screen overflow-hidden relative select-none"
      style={{ colorScheme: 'light' }}
    >
      {/* Horizontal snap carousel — drag freely, snaps on release */}
      <div
        ref={carouselRef}
        className="absolute inset-0 flex overflow-x-scroll snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={handleCarouselScroll}
      >
        {artProducts.map((product) => (
          <div
            key={product.id}
            className="snap-start snap-always flex-shrink-0 w-screen h-screen bg-paper relative"
          >
            {/* Product image */}
            <div className="absolute inset-0 flex items-center justify-center pt-[84px] pb-56 px-8 sm:px-16 lg:px-24">
              <img
                src={product.image}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
                draggable={false}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>

            {/* Product info */}
            <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14">
              <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted mb-2">
                {slugToTitle(product.movement)}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-ink leading-tight mb-1">
                {product.name}
              </h2>
              <p className="text-sm text-ink-muted mb-6">from {formatPrice(product.price)}</p>
              <Link
                to={`/product/${product.slug}`}
                className="btn-ink inline-flex items-center gap-2 text-xs"
              >
                Shop Now <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Dot progress */}
      <div className="absolute bottom-6 right-6 flex gap-1.5 items-center z-10">
        {artProducts.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToProduct(i)}
            className={cn(
              'h-[3px] rounded-full transition-all duration-300',
              i === idx ? 'w-5 bg-ink/60' : 'w-1.5 bg-ink/20'
            )}
            aria-label={`Product ${i + 1}`}
          />
        ))}
      </div>

      {/* Desktop arrows */}
      <button
        onClick={() => scrollToProduct(idxRef.current - 1)}
        className="hidden lg:flex absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-ink-muted hover:text-ink transition-colors z-10"
        aria-label="Previous"
      >
        <ArrowRight size={18} className="rotate-180" />
      </button>
      <button
        onClick={() => scrollToProduct(idxRef.current + 1)}
        className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-ink-muted hover:text-ink transition-colors z-10"
        aria-label="Next"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  )
}
