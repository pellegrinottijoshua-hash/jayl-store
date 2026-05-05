import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { getProductById, products } from '@/data/products'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, slugToTitle, cn } from '@/lib/utils'
import ProductCard from '@/components/product/ProductCard'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseVideoUrl(url) {
  if (!url) return null
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/)
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
  const vmMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vmMatch) return { type: 'vimeo', id: vmMatch[1] }
  if (/\.mp4$/i.test(url)) return { type: 'mp4', src: url }
  return null
}

/** Normalise a color label/id to a slug — mirrors catalog.js */
const colorToSlug = (c) =>
  (c ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Accordion({ title, children, light, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn('border-t', light ? 'border-paper-border' : 'border-border')}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between py-4 text-sm font-medium transition-colors',
          light ? 'text-ink hover:text-ink-secondary' : 'text-text-primary hover:text-cream'
        )}
      >
        {title}
        {open
          ? <ChevronUp size={16} className={light ? 'text-ink-muted' : 'text-text-muted'} />
          : <ChevronDown size={16} className={light ? 'text-ink-muted' : 'text-text-muted'} />}
      </button>
      {open && (
        <div className={cn('pb-4 text-sm leading-relaxed', light ? 'text-ink-secondary' : 'text-text-secondary')}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Share row ─────────────────────────────────────────────────────────────────

function ShareRow({ title, isLight, onCopy, copied }) {
  const url   = typeof window !== 'undefined' ? window.location.href : ''
  const text  = `Check this out: "${title}"`

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
      onCopy()
    }
  }

  const muted   = isLight ? 'text-ink-muted hover:text-ink' : 'text-text-muted hover:text-cream'
  const label   = isLight ? 'text-ink-muted' : 'text-text-muted'

  return (
    <div className="flex items-center gap-4 mt-3">
      <span className={cn('text-2xs tracking-widest uppercase', label)}>Share</span>

      {/* WhatsApp */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`}
        target="_blank" rel="noopener noreferrer"
        title="WhatsApp"
        className={cn('text-xs font-medium transition-colors', muted)}
      >
        WA
      </a>

      {/* X / Twitter */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank" rel="noopener noreferrer"
        title="X (Twitter)"
        className={cn('text-xs font-medium transition-colors', muted)}
      >
        𝕏
      </a>

      {/* Pinterest */}
      <a
        href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}`}
        target="_blank" rel="noopener noreferrer"
        title="Pinterest"
        className={cn('text-xs font-medium transition-colors', muted)}
      >
        Pin
      </a>

      {/* Copy link / Native share */}
      <button
        onClick={handleShare}
        className={cn('text-xs font-medium transition-colors', copied ? 'text-green-500' : muted)}
        title="Copy link"
      >
        {copied ? '✓ Copied' : '🔗 Copy'}
      </button>
    </div>
  )
}

// ── Urgency badge ─────────────────────────────────────────────────────────────

function UrgencyBadge({ text, isLight }) {
  if (!text) return null
  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium mt-3 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
      {text}
    </p>
  )
}

// ── Size guide modal ───────────────────────────────────────────────────────────

const SIZE_GUIDE = {
  art: {
    title: 'Print Sizes',
    cols: ['Size', 'Width', 'Height'],
    rows: [
      ['8×10"',   '20 cm', '25 cm'],
      ['12×16"',  '30 cm', '40 cm'],
      ['18×24"',  '46 cm', '61 cm'],
      ['24×36"',  '61 cm', '91 cm'],
    ],
    note: 'All prints include a 5 mm white border. Frames add ~2 cm to each side.',
  },
  objects: {
    title: 'Apparel Size Guide',
    cols: ['Size', 'Chest', 'Body length'],
    rows: [
      ['XS', '86–91 cm',   '66 cm'],
      ['S',  '91–96 cm',   '69 cm'],
      ['M',  '99–104 cm',  '72 cm'],
      ['L',  '107–112 cm', '74 cm'],
      ['XL', '117–122 cm', '77 cm'],
      ['2XL','127–132 cm', '79 cm'],
      ['3XL','137–142 cm', '81 cm'],
    ],
    note: 'Measurements are of the garment, not the body. Oversized styles run large — size down if unsure.',
  },
}

function SizeGuideModal({ open, onClose, section, isLight }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  if (!open) return null
  const guide = SIZE_GUIDE[section] || SIZE_GUIDE.objects

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md mx-4 mb-0 sm:mb-0 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl ${isLight ? 'bg-paper text-ink' : 'bg-gray-900 text-cream'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-base font-semibold ${isLight ? 'text-ink' : 'text-cream'}`}>{guide.title}</h2>
          <button onClick={onClose} className={`text-xl leading-none transition-opacity hover:opacity-60 ${isLight ? 'text-ink-muted' : 'text-cream/50'}`}>×</button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className={`text-xs uppercase tracking-wider ${isLight ? 'text-ink-muted' : 'text-cream/40'}`}>
              {guide.cols.map(c => (
                <th key={c} className="text-left pb-2 font-medium pr-4">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${isLight ? 'divide-paper-border' : 'divide-white/10'}`}>
            {guide.rows.map(row => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} className={`py-2 pr-4 ${i === 0 ? 'font-semibold' : ''} ${isLight ? 'text-ink' : 'text-cream/80'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {guide.note && (
          <p className={`mt-4 text-xs leading-relaxed ${isLight ? 'text-ink-muted' : 'text-cream/40'}`}>{guide.note}</p>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const product = getProductById(id)
  const { addItem, openCart } = useCartStore()
  const { setPageTheme } = useThemeStore()

  const isArt = product?.section === 'art'
  const isLight = isArt

  useEffect(() => {
    setPageTheme(isLight ? 'light' : 'dark')
  }, [isLight, setPageTheme])

  const defaultSize  = product?.sizes?.[isArt ? 1 : 0]?.id
  const defaultColor = product?.colors?.[0]?.id
  const videoInfo    = parseVideoUrl(product?.videoUrl)

  const [selectedSize,  setSelectedSize]  = useState(defaultSize)
  const [selectedColor, setSelectedColor] = useState(defaultColor)
  const [selectedFrame, setSelectedFrame] = useState('none')
  const [activeImage,   setActiveImage]   = useState(videoInfo ? -1 : 0)
  const [added,         setAdded]         = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [viewerCount,   setViewerCount]   = useState(null)
  const [copied,        setCopied]        = useState(false)
  const [lightboxOpen,   setLightboxOpen]   = useState(false)
  const [lightboxSrc,    setLightboxSrc]    = useState(null)
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [sizeGuideOpen,  setSizeGuideOpen]  = useState(false)

  // Viewer count — random on mount, drifts slightly every 30s for "live" feel
  useEffect(() => {
    const base = 4 + Math.floor(Math.random() * 14) // 4-17
    setViewerCount(base)
    const id = setInterval(() => {
      setViewerCount(n => Math.max(2, n + (Math.random() > 0.5 ? 1 : -1)))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  // Recently viewed — save current product; load others from localStorage
  useEffect(() => {
    if (!product?.id) return
    try {
      const KEY  = 'jayl-recently-viewed'
      const prev = JSON.parse(localStorage.getItem(KEY) || '[]')
      const next = [product.id, ...prev.filter(i => i !== product.id)].slice(0, 12)
      localStorage.setItem(KEY, JSON.stringify(next))
      const others = next.slice(1).map(i => getProductById(i)).filter(Boolean).slice(0, 4)
      setRecentlyViewed(others)
    } catch {}
  }, [product?.id])

  // Close lightbox on Escape
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') setLightboxOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // Ref on the in-flow "Add to Cart" button — sticky bar shows when it leaves viewport
  const addToCartBtnRef = useRef(null)

  // Jump to color image when color changes
  useEffect(() => {
    if (!selectedColor || !product?.colors) return
    const colorObj = product.colors.find(c => c.id === selectedColor)
    if (!colorObj?.image) return
    const idx = product.images?.findIndex(img => img === colorObj.image) ?? -1
    if (idx >= 0) setActiveImage(idx)
  }, [selectedColor])

  // Sticky CTA: appears when native add-to-cart button is out of view
  useEffect(() => {
    const el = addToCartBtnRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [product])

  if (!product) {
    return (
      <div className="min-h-screen bg-white pt-32 flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-display text-4xl text-ink mb-4">Not Found</h1>
        <p className="text-ink-secondary mb-8">This work doesn't exist (yet).</p>
        <Link to="/art" className="btn-ink">Back to Shop</Link>
      </div>
    )
  }

  // ── Computed values ──────────────────────────────────────────────────────────

  const sizeObj   = product.sizes?.find((s) => s.id === selectedSize)
  const frameObj  = product.frames?.find((f) => f.id === selectedFrame)
  const totalPrice = (sizeObj?.price ?? product.price) + (frameObj?.price ?? 0)

  // Normalise image list (fallback to product.image)
  const productImages = product.images?.length > 0
    ? product.images
    : (product.image ? [product.image] : [])

  // Mobile gallery: video slot (index -1) + images (0..n-1)
  const minSlide = videoInfo ? -1 : 0
  const maxSlide = productImages.length - 1
  // Map activeImage to a 0-based mobile index
  const mobileSlideIdx   = videoInfo ? activeImage + 1 : activeImage
  const totalMobileSlides = (videoInfo ? 1 : 0) + productImages.length

  // Which sizes are available for the selected color (when variants exist)
  const availableSizesForColor = (product.variants?.length && selectedColor)
    ? new Set(
        product.variants
          .filter(v => colorToSlug(v.color) === colorToSlug(selectedColor))
          .map(v => v.size)
      )
    : null

  const canAddToCart = !!selectedSize || !product.sizes?.length

  // ── Event handlers ───────────────────────────────────────────────────────────

  const handleAddToCart = () => {
    if (!canAddToCart) return
    addItem(product, { size: selectedSize, color: selectedColor, frame: selectedFrame })
    setAdded(true)
    openCart()
    setTimeout(() => setAdded(false), 2000)
  }

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openLightbox = (src) => { setLightboxSrc(src); setLightboxOpen(true) }

  const swipeHandlers = useSwipe({
    onSwipeLeft:  () => setActiveImage(i => Math.min(i + 1, maxSlide)),
    onSwipeRight: () => setActiveImage(i => Math.max(i - 1, minSlide)),
  })

  const related = products
    .filter((p) => p.section === product.section && p.id !== product.id)
    .slice(0, 4)

  const sectionLabel = isArt ? 'Fine Art Print' : 'Object'

  // ── Theme tokens ─────────────────────────────────────────────────────────────

  const t = isLight
    ? {
        page: 'bg-white',
        backBtn: 'text-ink-muted hover:text-ink',
        movement: 'text-ink-muted',
        sectionTag: 'text-ink-muted',
        title: 'text-ink',
        subtitle: 'text-ink-secondary',
        price: 'text-ink',
        priceSub: 'text-ink-muted',
        badge: 'text-ink-muted',
        selectorLabel: 'text-ink',
        selectorSub: 'text-ink-muted',
        btnActive: 'border-ink text-white bg-ink',
        btnInactive: 'border-paper-border text-ink hover:border-ink',
        btnDisabled: 'border-paper-border text-ink/25 cursor-not-allowed',
        colorActive: 'border-ink ring-1 ring-ink',
        colorInactive: 'border-paper-border hover:border-ink-muted',
        pillActive: 'border-ink bg-ink text-white',
        pillInactive: 'border-paper-border text-ink',
        addBtn: added
          ? 'bg-success text-white'
          : 'bg-ink text-white hover:bg-ink-secondary hover:scale-[1.01] active:scale-[0.99]',
        stickyBg: 'bg-paper border-paper-border',
        stickyBtn: 'bg-ink text-white',
        stickyBtnDisabled: 'bg-gray-200 text-gray-400',
        relatedBorder: 'border-t border-paper-border',
        relatedTitle: 'text-ink',
        relatedLink: 'text-ink-muted hover:text-ink',
        thumbnailActive: 'border-ink',
        thumbnailInactive: 'border-paper-border hover:border-ink-muted',
        imgBg: 'bg-paper',
        divider: 'border-paper-border',
        accordionText: 'text-ink-secondary',
      }
    : {
        page: 'bg-off-black text-text-primary',
        backBtn: 'text-text-muted hover:text-text-primary',
        movement: 'text-accent',
        sectionTag: 'text-text-muted',
        title: 'text-cream',
        subtitle: 'text-text-secondary',
        price: 'text-text-primary',
        priceSub: 'text-text-muted',
        badge: 'text-accent',
        selectorLabel: 'text-text-primary',
        selectorSub: 'text-text-muted',
        btnActive: 'border-cream text-black bg-cream',
        btnInactive: 'border-border text-text-secondary hover:border-border-light',
        btnDisabled: 'border-border text-text-muted/30 cursor-not-allowed',
        colorActive: 'border-cream ring-1 ring-cream',
        colorInactive: 'border-border hover:border-border-light',
        pillActive: 'border-cream bg-cream text-black',
        pillInactive: 'border-border text-text-secondary',
        addBtn: added
          ? 'bg-success text-white'
          : 'bg-cream text-black hover:bg-accent hover:scale-[1.01] active:scale-[0.99]',
        stickyBg: 'bg-surface border-border',
        stickyBtn: 'bg-cream text-black',
        stickyBtnDisabled: 'bg-surface-3 text-text-muted',
        relatedBorder: 'border-t border-border',
        relatedTitle: 'text-cream',
        relatedLink: 'text-text-secondary hover:text-cream',
        thumbnailActive: 'border-cream',
        thumbnailInactive: 'border-border hover:border-border-light',
        imgBg: 'bg-surface-2',
        divider: 'border-border',
        accordionText: 'text-text-secondary',
      }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={cn('min-h-screen', t.page)}>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (hidden on md+)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden pt-16">

        {/* ── Swipe Gallery ─────────────────────────────────────────────── */}
        <div
          className={cn('relative w-full aspect-square overflow-hidden', t.imgBg)}
          {...swipeHandlers}
        >
          {/* Sliding strip */}
          <div
            className="flex h-full transition-transform duration-300 ease-out will-change-transform"
            style={{ transform: `translateX(-${mobileSlideIdx * 100}%)` }}
          >
            {/* Video slide */}
            {videoInfo && (
              <div className="w-full h-full flex-shrink-0 bg-black">
                {videoInfo.type === 'mp4' ? (
                  <video src={videoInfo.src} controls className="w-full h-full object-contain" />
                ) : (
                  <iframe
                    src={
                      videoInfo.type === 'youtube'
                        ? `https://www.youtube.com/embed/${videoInfo.id}?autoplay=0&rel=0`
                        : `https://player.vimeo.com/video/${videoInfo.id}`
                    }
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={product.name}
                  />
                )}
              </div>
            )}
            {/* Image slides */}
            {productImages.map((src, i) => (
              <div key={i} className={cn('w-full h-full flex-shrink-0', t.imgBg)}>
                <img
                  src={src}
                  alt={product.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => openLightbox(src)}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              </div>
            ))}
          </div>

          {/* Back button overlay */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-full"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
        </div>

        {/* Dot pagination */}
        {totalMobileSlides > 1 && (
          <div className="flex justify-center gap-1.5 py-3">
            {Array.from({ length: totalMobileSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(videoInfo ? i - 1 : i)}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === mobileSlideIdx
                    ? cn('w-4 h-1.5', isLight ? 'bg-ink' : 'bg-cream')
                    : cn('w-1.5 h-1.5', isLight ? 'bg-ink/25' : 'bg-cream/25')
                )}
              />
            ))}
          </div>
        )}

        {/* ── Product info ───────────────────────────────────────────────── */}
        <div className="px-4 pt-2 pb-4">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('text-2xs font-mono tracking-ultra uppercase', t.badge)}>
              {slugToTitle(product.movement)}
            </span>
            <span className={cn('text-2xs', isLight ? 'text-ink-muted' : 'text-text-muted')}>·</span>
            <span className={cn('text-2xs font-mono tracking-ultra uppercase', t.sectionTag)}>
              {sectionLabel}
            </span>
          </div>

          <h1 className={cn('font-display text-2xl leading-tight mb-1', t.title)}>
            {product.name}
          </h1>
          {product.subtitle && (
            <p className={cn('text-sm italic font-display mb-3', t.subtitle)}>
              {product.subtitle}
            </p>
          )}

          <p className={cn('text-xl font-semibold', t.price)}>
            {formatPrice(totalPrice)}
          </p>

          {/* Social proof */}
          {viewerCount && (
            <p className={cn('flex items-center gap-1.5 text-xs mt-2', isLight ? 'text-ink-muted' : 'text-text-muted')}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              {viewerCount} people viewing right now
            </p>
          )}
        </div>

        <div className={cn('border-t mx-4', t.divider)} />

        {/* ── Variant Selectors ──────────────────────────────────────────── */}
        <div className="px-4 pt-4 space-y-5">

          {/* Color pills */}
          {product.colors && (
            <div>
              <p className={cn('text-xs font-semibold tracking-widest uppercase mb-3', t.selectorLabel)}>
                Color
                {selectedColor && (
                  <span className={cn('ml-2 font-normal normal-case tracking-normal', t.selectorSub)}>
                    — {product.colors.find(c => c.id === selectedColor)?.label}
                  </span>
                )}
              </p>
              {/* Horizontally scrollable, no scrollbar */}
              <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-1 w-max">
                  {product.colors.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedColor(c.id)}
                      className={cn(
                        'flex items-center gap-1.5 pl-2 pr-3 py-1.5 border text-xs font-medium rounded-full whitespace-nowrap transition-all duration-150',
                        selectedColor === c.id ? t.pillActive : t.pillInactive
                      )}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border flex-shrink-0"
                        style={{
                          backgroundColor: c.hex && c.hex !== '#888888' ? c.hex : undefined,
                          borderColor: selectedColor === c.id ? 'currentColor' : '#ccc',
                          background: (!c.hex || c.hex === '#888888')
                            ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'
                            : c.hex,
                        }}
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Size grid */}
          {product.sizes && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className={cn('text-xs font-semibold tracking-widest uppercase', t.selectorLabel)}>Size</p>
                <button
                  onClick={() => setSizeGuideOpen(true)}
                  className={cn('text-xs underline underline-offset-2 transition-opacity hover:opacity-60', isLight ? 'text-ink-muted' : 'text-text-muted')}
                >
                  Size guide
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {product.sizes.map(s => {
                  const available = !availableSizesForColor || availableSizesForColor.has(s.id)
                  const isSelected = selectedSize === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => available && setSelectedSize(s.id)}
                      className={cn(
                        'py-2.5 text-sm font-medium border transition-all duration-150',
                        isSelected
                          ? t.btnActive
                          : available
                          ? t.btnInactive
                          : t.btnDisabled
                      )}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Frame selector (art prints) */}
          {product.frames && (
            <div>
              <p className={cn('text-xs font-semibold tracking-widest uppercase mb-3', t.selectorLabel)}>
                Frame
              </p>
              <div className="grid grid-cols-2 gap-2">
                {product.frames.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFrame(f.id)}
                    className={cn(
                      'py-2.5 text-xs font-medium border transition-all duration-150',
                      selectedFrame === f.id ? t.btnActive : t.btnInactive
                    )}
                  >
                    {f.label}{f.price > 0 && ` +${formatPrice(f.price)}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={cn('border-t mx-4 mt-5', t.divider)} />

        {/* ── In-flow Add to Cart (anchor for IntersectionObserver) ─────── */}
        <div className="px-4 pt-4 pb-2">
          <button
            ref={addToCartBtnRef}
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className={cn(
              'w-full flex items-center justify-center gap-3 py-4 text-sm font-semibold tracking-widest uppercase transition-all duration-300',
              t.addBtn,
              !canAddToCart && 'opacity-50 cursor-not-allowed'
            )}
          >
            {added ? (
              <><Check size={16} />Added to Cart</>
            ) : (
              <>Add to Cart · {formatPrice(totalPrice)}</>
            )}
          </button>
          <UrgencyBadge text={product.urgency} isLight={isLight} />
        </div>

        {/* ── Share ─────────────────────────────────────────────────────── */}
        <div className="px-4 pb-2">
          <ShareRow title={product.name} isLight={isLight} onCopy={handleCopy} copied={copied} />
        </div>

        {/* ── Accordions ────────────────────────────────────────────────── */}
        <div className="px-4 pb-32">
          <Accordion title="About this work" light={isLight}>
            <p>{product.description}</p>
          </Accordion>
          <Accordion title="Details & Materials" light={isLight}>
            <ul className="space-y-2">
              {product.details?.map((d, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cn('flex-shrink-0 mt-0.5', isLight ? 'text-ink-muted' : 'text-accent')}>—</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </Accordion>
          <Accordion title="Shipping & Fulfillment" light={isLight}>
            <div className="space-y-3">
              <p>
                Fulfilled by <span className={isLight ? 'text-ink' : 'text-text-primary'}>Gelato</span> —
                the world's largest print-on-demand network with 130+ local print partners worldwide.
              </p>
              <p>
                Orders are printed and shipped from the facility nearest to you, minimising transit
                time and carbon footprint. Typical production time is 2–4 business days.
              </p>
              <p>Shipping is always free, worldwide.</p>
            </div>
          </Accordion>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STICKY BOTTOM CTA  (mobile only)
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-40 border-t transition-transform duration-300',
          t.stickyBg,
          showStickyBar ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 pb-safe">
          {/* Selection summary */}
          <div className="min-w-0">
            {(selectedColor || selectedSize) ? (
              <>
                {selectedColor && (
                  <p className={cn('text-xs font-medium capitalize truncate', isLight ? 'text-ink' : 'text-cream')}>
                    {product.colors?.find(c => c.id === selectedColor)?.label ?? selectedColor}
                  </p>
                )}
                {selectedSize && (
                  <p className={cn('text-xs truncate', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                    Size {selectedSize}
                  </p>
                )}
              </>
            ) : (
              <p className={cn('text-xs', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                Select options
              </p>
            )}
          </div>

          {/* CTA button */}
          <button
            onClick={canAddToCart ? handleAddToCart : undefined}
            className={cn(
              'flex-shrink-0 px-5 py-3 text-sm font-semibold tracking-wider uppercase transition-all duration-200',
              canAddToCart ? t.stickyBtn : t.stickyBtnDisabled,
              !canAddToCart && 'cursor-not-allowed'
            )}
          >
            {added
              ? '✓ Added'
              : canAddToCart
              ? `Add · ${formatPrice(totalPrice)}`
              : 'Select Size'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (hidden on mobile)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block pt-24">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
          <button
            onClick={() => navigate(-1)}
            className={cn(
              'flex items-center gap-2 text-xs tracking-widest uppercase transition-colors',
              t.backBtn
            )}
          >
            <ArrowLeft size={12} />
            Back
          </button>
        </div>

        {/* Main grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">

            {/* ── Images / Video ── */}
            <div className="space-y-3">
              {activeImage === -1 && videoInfo ? (
                <div className="aspect-[4/5] overflow-hidden bg-black">
                  {videoInfo.type === 'mp4' ? (
                    <video src={videoInfo.src} controls className="w-full h-full object-contain" />
                  ) : (
                    <iframe
                      src={
                        videoInfo.type === 'youtube'
                          ? `https://www.youtube.com/embed/${videoInfo.id}?autoplay=0&rel=0`
                          : `https://player.vimeo.com/video/${videoInfo.id}`
                      }
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={product.name}
                    />
                  )}
                </div>
              ) : (
                <div
                  className={cn('aspect-[4/5] overflow-hidden cursor-zoom-in', t.imgBg)}
                  onClick={() => {
                    const src = productImages[Math.max(0, activeImage)] ?? product.image
                    if (src) openLightbox(src)
                  }}
                  title="Click to zoom"
                >
                  <img
                    src={productImages[Math.max(0, activeImage)] ?? product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
              )}

              {/* Thumbnail strip */}
              {(videoInfo || productImages.length > 1) && (
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {videoInfo && (
                    <button
                      onClick={() => setActiveImage(-1)}
                      className={cn(
                        'w-20 h-20 overflow-hidden border-2 transition-all duration-200 flex-shrink-0 bg-black relative',
                        activeImage === -1 ? t.thumbnailActive : t.thumbnailInactive
                      )}
                    >
                      {videoInfo.type === 'youtube' ? (
                        <img
                          src={`https://img.youtube.com/vi/${videoInfo.id}/mqdefault.jpg`}
                          alt="Video"
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-white text-xl leading-none">▶</span>
                      </div>
                    </button>
                  )}
                  {productImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={cn(
                        'w-20 h-20 overflow-hidden border-2 transition-all duration-200 flex-shrink-0',
                        i === activeImage ? t.thumbnailActive : t.thumbnailInactive
                      )}
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info ── */}
            <div className="lg:pt-4">
              <div className="flex items-center gap-3 mb-4">
                <span className={cn('text-2xs font-mono tracking-ultra uppercase', t.movement)}>
                  {slugToTitle(product.movement)}
                </span>
                <span className={cn(isLight ? 'text-ink-muted' : 'text-text-muted')}>·</span>
                <span className={cn('text-2xs font-mono tracking-ultra uppercase', t.sectionTag)}>
                  {sectionLabel}
                </span>
              </div>

              <h1 className={cn('font-display text-3xl lg:text-5xl leading-tight mb-2', t.title)}>
                {product.name}
              </h1>
              {product.subtitle && (
                <p className={cn('text-lg italic font-display mb-6', t.subtitle)}>
                  {product.subtitle}
                </p>
              )}

              <p className={cn('text-2xl font-semibold', t.price)}>
                {formatPrice(totalPrice)}
                {selectedFrame && selectedFrame !== 'none' && (
                  <span className={cn('text-sm font-normal ml-2', t.priceSub)}>(incl. frame)</span>
                )}
              </p>

              {/* Social proof */}
              <div className="mb-8">
                {viewerCount && (
                  <p className={cn('flex items-center gap-1.5 text-xs mt-2', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    {viewerCount} people viewing right now
                  </p>
                )}
              </div>

              {/* Variant selectors */}
              <div className="space-y-6 mb-8">
                {product.sizes && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className={cn('text-xs font-semibold tracking-widest uppercase', t.selectorLabel)}>Size</p>
                      <div className="flex items-center gap-3">
                        {sizeObj && (
                          <p className={cn('text-xs', t.selectorSub)}>
                            {sizeObj.label} · {formatPrice(sizeObj.price)}
                          </p>
                        )}
                        <button
                          onClick={() => setSizeGuideOpen(true)}
                          className={cn('text-xs underline underline-offset-2 transition-opacity hover:opacity-60', isLight ? 'text-ink-muted' : 'text-text-muted')}
                        >
                          Size guide
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.sizes.map(s => {
                        const available = !availableSizesForColor || availableSizesForColor.has(s.id)
                        return (
                          <button
                            key={s.id}
                            onClick={() => available && setSelectedSize(s.id)}
                            className={cn(
                              'px-4 py-2.5 text-xs font-medium tracking-widest uppercase border transition-all duration-200',
                              selectedSize === s.id
                                ? t.btnActive
                                : available
                                ? t.btnInactive
                                : t.btnDisabled
                            )}
                          >
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {product.colors && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className={cn('text-xs font-semibold tracking-widest uppercase', t.selectorLabel)}>Color</p>
                      {selectedColor && (
                        <p className={cn('text-xs capitalize', t.selectorSub)}>
                          {product.colors.find(c => c.id === selectedColor)?.label}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {product.colors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedColor(c.id)}
                          title={c.label}
                          className={cn(
                            'w-8 h-8 rounded-full border-2 transition-all duration-200',
                            selectedColor === c.id ? t.colorActive : t.colorInactive
                          )}
                          style={{
                            background: (!c.hex || c.hex === '#888888')
                              ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'
                              : c.hex,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {product.frames && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className={cn('text-xs font-semibold tracking-widest uppercase', t.selectorLabel)}>Frame</p>
                      {frameObj?.price > 0 && (
                        <p className={cn('text-xs', t.selectorSub)}>+{formatPrice(frameObj.price)}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.frames.map(f => (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFrame(f.id)}
                          className={cn(
                            'px-4 py-2.5 text-xs font-medium tracking-widest uppercase border transition-all duration-200',
                            selectedFrame === f.id ? t.btnActive : t.btnInactive
                          )}
                        >
                          {f.label}{f.price > 0 && ` +${formatPrice(f.price)}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add to cart */}
              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart}
                className={cn(
                  'w-full flex items-center justify-center gap-3 py-4 text-sm font-semibold tracking-widest uppercase transition-all duration-300',
                  t.addBtn,
                  !canAddToCart && 'opacity-50 cursor-not-allowed'
                )}
              >
                {added ? (
                  <><Check size={16} />Added to Cart</>
                ) : (
                  <>Add to Cart · {formatPrice(totalPrice)}</>
                )}
              </button>
              <UrgencyBadge text={product.urgency} isLight={isLight} />

              {/* Share */}
              <ShareRow title={product.name} isLight={isLight} onCopy={handleCopy} copied={copied} />

              {/* Accordions */}
              <div className="mt-8">
                <Accordion title="About this work" light={isLight}>
                  <p>{product.description}</p>
                </Accordion>
                <Accordion title="Details & Materials" light={isLight}>
                  <ul className="space-y-2">
                    {product.details?.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={cn('flex-shrink-0 mt-0.5', isLight ? 'text-ink-muted' : 'text-accent')}>—</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </Accordion>
                <Accordion title="Shipping & Fulfillment" light={isLight}>
                  <div className="space-y-3">
                    <p>
                      Fulfilled by <span className={isLight ? 'text-ink' : 'text-text-primary'}>Gelato</span> —
                      the world's largest print-on-demand network with 130+ local print partners worldwide.
                    </p>
                    <p>
                      Orders are printed and shipped from the facility nearest to you, minimising
                      transit time and carbon footprint. Typical production time is 2–4 business days.
                    </p>
                    <p>Shipping is always free, worldwide.</p>
                  </div>
                </Accordion>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related products (shared) ───────────────────────────────────────── */}
      {related.length > 0 && (
        <div className={t.relatedBorder}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="flex items-center justify-between mb-10">
              <h2 className={cn('font-display text-2xl', t.relatedTitle)}>You May Also Like</h2>
              <Link
                to={`/${product.section}`}
                className={cn(
                  'text-xs tracking-widest uppercase flex items-center gap-2 transition-colors',
                  t.relatedLink
                )}
              >
                View All <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map(p => (
                <ProductCard key={p.id} product={p} light={isLight} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recently Viewed ──────────────────────────────────────────────────── */}
      {recentlyViewed.length > 0 && (
        <div className={t.relatedBorder}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className={cn('font-display text-2xl mb-10', t.relatedTitle)}>Recently Viewed</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {recentlyViewed.map(p => (
                <ProductCard key={p.id} product={p} light={isLight} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Size Guide Modal ─────────────────────────────────────────────────── */}
      <SizeGuideModal
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        section={product.section}
        isLight={isLight}
      />

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightboxOpen && lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-5 text-white/60 hover:text-white text-4xl leading-none transition-colors z-10 select-none"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
          {/* Image — click on image itself doesn't close */}
          <img
            src={lightboxSrc}
            alt=""
            className="object-contain select-none"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
            draggable={false}
          />
        </div>
      )}
    </div>
  )
}
