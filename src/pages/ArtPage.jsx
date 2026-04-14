import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'
import { cn } from '@/lib/utils'

const artProducts = products.filter((p) => p.section === 'art')

export default function ArtPage() {
  const [idx, setIdx]     = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [dir, setDir]     = useState('right') // 'right' | 'left' for slide direction
  const { setPageTheme, setActiveSection } = useThemeStore()
  const navigate  = useNavigate()
  const wheelLock = useRef(false)

  useEffect(() => {
    setPageTheme('light')
    setActiveSection('art')
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [setPageTheme, setActiveSection])

  const advance = useCallback((direction) => {
    setDir(direction)
    setAnimKey((k) => k + 1)
    if (direction === 'right') {
      setIdx((i) => (i + 1) % artProducts.length)
    } else {
      setIdx((i) => (i - 1 + artProducts.length) % artProducts.length)
    }
  }, [])

  // Touch / swipe
  const { onTouchStart, onTouchEnd } = useSwipe({
    onSwipeLeft:  () => advance('right'),
    onSwipeRight: () => advance('left'),
    onSwipeUp:    () => navigate('/objects'),  // swipe up → next section
    onSwipeDown:  () => navigate('/'),
  })

  // Mouse wheel
  useEffect(() => {
    const onWheel = (e) => {
      if (wheelLock.current) return
      if (Math.abs(e.deltaY) < 20) return
      wheelLock.current = true
      e.deltaY > 0 ? advance('right') : advance('left')
      setTimeout(() => { wheelLock.current = false }, 700)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [advance])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') advance('right')
      if (e.key === 'ArrowLeft')  advance('left')
      if (e.key === 'ArrowDown')  navigate('/objects')
      if (e.key === 'ArrowUp')    navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, navigate])

  const product = artProducts[idx]
  const slideClass = dir === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <div
      className="h-screen w-screen bg-paper overflow-hidden relative select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Full-screen product image */}
      <div className="absolute inset-0 flex items-center justify-center pt-14 pb-56 px-8 sm:px-16 lg:px-24">
        <img
          key={`img-${idx}`}
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain animate-fade-in"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

      {/* Product info — bottom */}
      <div
        key={`info-${animKey}`}
        className={cn('absolute bottom-0 left-0 right-0 px-6 sm:px-8 pb-14', slideClass)}
      >
        <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted mb-2">
          {slugToTitle(product.movement)}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-ink leading-tight mb-1">
          {product.name}
        </h2>
        <p className="text-sm text-ink-muted mb-6">
          from {formatPrice(product.price)}
        </p>
        <Link
          to={`/product/${product.slug}`}
          className="btn-ink inline-flex items-center gap-2 text-xs"
        >
          Shop Now
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Dot progress */}
      <div className="absolute bottom-6 right-6 flex gap-1.5 items-center">
        {artProducts.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDir(i > idx ? 'right' : 'left'); setIdx(i); setAnimKey((k) => k + 1) }}
            className={cn(
              'h-[3px] rounded-full transition-all duration-300',
              i === idx ? 'w-5 bg-ink/60' : 'w-1.5 bg-ink/20'
            )}
            aria-label={`Product ${i + 1}`}
          />
        ))}
      </div>

      {/* Desktop hover arrows */}
      <button
        onClick={() => advance('left')}
        className="hidden lg:flex absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-ink-muted hover:text-ink transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
        aria-label="Previous"
        style={{ opacity: idx > 0 ? undefined : 0 }}
      >
        <ArrowRight size={18} className="rotate-180" />
      </button>
      <button
        onClick={() => advance('right')}
        className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-ink-muted hover:text-ink transition-colors"
        aria-label="Next"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  )
}
