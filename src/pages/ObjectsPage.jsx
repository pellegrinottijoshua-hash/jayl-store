import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'
import { cn } from '@/lib/utils'

const objectsProducts = products.filter((p) => p.section === 'objects')

export default function ObjectsPage() {
  const [idx, setIdx] = useState(0)
  const { setPageTheme, setActiveSection } = useThemeStore()
  const navigate     = useNavigate()
  const carouselRef  = useRef(null)
  const idxRef       = useRef(0)
  const wheelLock    = useRef(false)

  useEffect(() => {
    setPageTheme('dark')
    setActiveSection('objects')
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [setPageTheme, setActiveSection])

  const scrollToProduct = useCallback((i) => {
    if (!carouselRef.current) return
    const clamped = Math.max(0, Math.min(i, objectsProducts.length - 1))
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

  // Vertical-only swipe → route navigation; horizontal handled by CSS snap
  const { onTouchStart, onTouchEnd } = useSwipe({
    onSwipeUp:   () => navigate('/artist'),
    onSwipeDown: () => navigate('/art'),
  })

  // Mouse wheel scrolls through products on desktop
  useEffect(() => {
    const onWheel = (e) => {
      if (wheelLock.current) return
      if (Math.abs(e.deltaY) < 20) return
      wheelLock.current = true
      e.deltaY > 0
        ? scrollToProduct(idxRef.current + 1)
        : scrollToProduct(idxRef.current - 1)
      setTimeout(() => { wheelLock.current = false }, 700)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [scrollToProduct])

  useEffect(() => {
    const onKey = (e) => {
      const cur = idxRef.current
      if (e.key === 'ArrowRight') scrollToProduct(cur + 1)
      if (e.key === 'ArrowLeft')  scrollToProduct(cur - 1)
      if (e.key === 'ArrowDown')  navigate('/artist')
      if (e.key === 'ArrowUp')    navigate('/art')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scrollToProduct, navigate])

  const product = objectsProducts[idx]

  return (
    <div
      className="h-screen w-screen overflow-hidden relative select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Horizontal snap carousel — drag freely, snaps on release */}
      <div
        ref={carouselRef}
        className="absolute inset-0 flex overflow-x-scroll snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={handleCarouselScroll}
      >
        {objectsProducts.map((p) => (
          <div
            key={p.id}
            className="snap-start snap-always flex-shrink-0 w-screen h-screen bg-off-black relative"
          >
            {/* Product image */}
            <div className="absolute inset-0 flex items-center justify-center pt-[84px] pb-56 px-8 sm:px-16 lg:px-24">
              <img
                src={p.image}
                alt={p.name}
                className="max-h-full max-w-full object-contain"
                draggable={false}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>

            {/* Product info */}
            <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14">
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-cream leading-tight mb-1">
                {p.name}
              </h2>
              <p className="text-sm text-text-muted mb-6">from {formatPrice(p.price)}</p>
              <Link
                to={`/product/${p.slug}`}
                className="btn-primary inline-flex items-center gap-2 text-xs"
              >
                Shop Now <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Dot progress */}
      <div className="absolute bottom-6 right-6 flex gap-1.5 items-center z-10">
        {objectsProducts.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToProduct(i)}
            className={cn(
              'h-[3px] rounded-full transition-all duration-300',
              i === idx ? 'w-5 bg-cream/60' : 'w-1.5 bg-cream/20'
            )}
            aria-label={`Product ${i + 1}`}
          />
        ))}
      </div>

      {/* Desktop arrows */}
      <button
        onClick={() => scrollToProduct(idxRef.current - 1)}
        className="hidden lg:flex absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-text-muted hover:text-cream transition-colors z-10"
        aria-label="Previous"
      >
        <ArrowRight size={18} className="rotate-180" />
      </button>
      <button
        onClick={() => scrollToProduct(idxRef.current + 1)}
        className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-text-muted hover:text-cream transition-colors z-10"
        aria-label="Next"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  )
}
