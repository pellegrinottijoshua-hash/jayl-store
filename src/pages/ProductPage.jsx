import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { getProductById, products } from '@/data/products'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, slugToTitle, cn } from '@/lib/utils'
import ProductCard from '@/components/product/ProductCard'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'
import { usePageMeta } from '@/hooks/usePageMeta'

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

/** Common apparel/art color names → hex. Used to resolve swatches when .hex is missing or generic */
const APPAREL_COLOR_HEX = {
  // ── Blacks & near-blacks ──────────────────────────────────────────────────
  'black': '#1a1a1a', 'washed black': '#1a1a1a', 'jet black': '#111111',
  'solid black triblend': '#1a1a1a', 'solid-black-triblend': '#1a1a1a',
  'triblend black heather': '#2d2d2d', 'triblend-black-heather': '#2d2d2d',
  'black heather': '#2d2d2d', 'black-heather': '#2d2d2d',
  'vintage black': '#2a2a2a', 'faded black': '#333333',

  // ── Whites & off-whites ───────────────────────────────────────────────────
  'white': '#f5f5f5', 'off white': '#f0ece4', 'off-white': '#f0ece4',
  'solid white triblend': '#f0f0f0', 'solid-white-triblend': '#f0f0f0',
  'white heather': '#f2f2f2', 'natural white': '#f8f4ee',
  'ivory': '#fffff0', 'snow': '#fffafa',

  // ── Grays & charcoals ─────────────────────────────────────────────────────
  'gray': '#888888', 'grey': '#888888', 'light gray': '#c8c8c8', 'light grey': '#c8c8c8',
  'heather gray': '#aaaaaa', 'heather-gray': '#aaaaaa', 'heather grey': '#aaaaaa',
  'sport grey': '#a0a0a0', 'sport gray': '#a0a0a0',
  'charcoal': '#3d3d3d', 'dark heather': '#4a4a4a', 'graphite': '#555555',
  'smoke': '#707070', 'ash': '#b8b8b8', 'silver': '#c0c0c0',
  'carbon': '#3b3b3b', 'slate gray': '#708090', 'slate grey': '#708090',
  'deep heather': '#585858', 'tri blend charcoal': '#4a4a4a',

  // ── Reds & pinks ──────────────────────────────────────────────────────────
  'red': '#cc2200', 'true red': '#cc2200', 'fire red': '#bf0a0a',
  'cardinal': '#c41230', 'crimson': '#dc143c', 'cherry red': '#de3163',
  'maroon': '#800000', 'burgundy': '#6e0a1e', 'wine': '#722f37',
  'pink': '#f5a0c0', 'hot pink': '#e82a8a', 'light pink': '#ffb6c1',
  'neon pink': '#ff6eb4', 'coral': '#ff6b6b', 'salmon': '#fa8072',
  'dusty rose': '#dcb0b0', 'mauve': '#c5a0b0',
  'raspberry': '#e30b5c', 'rose': '#ff007f',

  // ── Blues & navys ─────────────────────────────────────────────────────────
  'blue': '#1a3c8c', 'navy': '#1f2d5c', 'navy blue': '#1f2d5c', 'dark navy': '#0f1a3a',
  'royal blue': '#4169e1', 'heather royal': '#4169e1', 'heather-royal': '#4169e1',
  'triblend navy': '#3a5280', 'triblend-navy': '#3a5280',
  'blue triblend': '#5272b0', 'blue-triblend': '#5272b0',
  'light blue': '#6ba4d4', 'light-blue': '#6ba4d4', 'sky blue': '#87ceeb',
  'carolina blue': '#56a0d3', 'columbia blue': '#9ecee1',
  'cobalt': '#0047ab', 'indigo': '#3f00ff', 'denim': '#1560bd',
  'steel blue': '#4682b4', 'slate': '#3a3f4a', 'slate blue': '#6a5acd',
  'midnight': '#191970', 'midnight navy': '#0a0f3c', 'ocean blue': '#006994',
  'teal': '#008080', 'dark teal': '#005f60', 'heather blue': '#4f7bbb',
  'heather navy': '#2a3a6a', 'heather-navy': '#2a3a6a',

  // ── Greens ────────────────────────────────────────────────────────────────
  'green': '#228b22', 'forest green': '#228b22', 'forest-green': '#228b22',
  'dark green': '#165a16', 'hunter green': '#355e3b',
  'kelly green': '#4cbb17', 'lime green': '#32cd32', 'lime': '#00ff00',
  'olive': '#6b7c2c', 'army green': '#4b5320', 'military green': '#4a5240',
  'sage': '#8faf79', 'mint': '#98ff98', 'mint green': '#98ff98',
  'emerald': '#50c878', 'seafoam': '#70e4b4',
  'moss': '#8a9a5b', 'fern': '#4f7942', 'camo green': '#78866b',
  'heather green': '#5a8a60', 'military olive': '#5a5a28',

  // ── Yellows & golds ───────────────────────────────────────────────────────
  'yellow': '#e8c41a', 'bright yellow': '#ffe135', 'daisy': '#f5d842',
  'gold': '#c8a42c', 'antique gold': '#c9ae5d', 'metallic gold': '#d4af37',
  'mustard': '#e1ad01', 'sunflower': '#ffb300',

  // ── Oranges & earthy tones ────────────────────────────────────────────────
  'orange': '#cc5500', 'burnt orange': '#cc5500', 'deep orange': '#b84200',
  'neon orange': '#ff6600', 'tangerine': '#f28500',
  'rust': '#b54a22', 'terracotta': '#c16a4e', 'copper': '#b87333',
  'pumpkin': '#ff7518', 'amber': '#ffbf00',

  // ── Purples & violets ─────────────────────────────────────────────────────
  'purple': '#6b2d8b', 'dark purple': '#4b0082', 'violet': '#7f00ff',
  'lavender': '#c084fc', 'light lavender': '#d8b4fe',
  'heather purple': '#9b59b6', 'plum': '#8e4585', 'grape': '#6f2da8',
  'lilac': '#c8a2c8', 'orchid': '#da70d6',

  // ── Browns & naturals ─────────────────────────────────────────────────────
  'brown': '#795548', 'chocolate': '#5d3c1e', 'dark chocolate': '#3d1c02',
  'natural': '#d4c5a9', 'cream': '#f0ece4', 'bone': '#d4cdc0',
  'sand': '#c8b89a', 'tan': '#c4a882', 'khaki': '#c3b091',
  'beige': '#d9c9a3', 'camel': '#c19a6b', 'linen': '#faf0e6',
  'stone': '#b0a090', 'hemp': '#c7b08b',

  // ── Special Gelato / print-on-demand colors ───────────────────────────────
  'dtg white': '#f5f5f5', 'dtg black': '#1a1a1a',
  'heather ice blue': '#c5dce8', 'heather mint': '#b5e0d0',
  'heather peach': '#f5c6a0', 'heather red': '#c05050',
  'heather forest': '#4a7a50', 'heather midnight navy': '#2a3a6a',
  'heather true royal': '#4169e1', 'heather cardinal': '#9b2335',
  'heather maroon': '#6e2233', 'heather dark chocolate': '#5a3020',
  'heather sport dark navy': '#1a2a4a',
  'athletic heather': '#b0b0b8', 'heather athletic': '#b0b0b8',
  'sport dark navy': '#1a2a4a', 'sport dark green': '#1e4d2b',
  'vintage heather navy': '#3a4a6a', 'vintage heather black': '#3a3a3a',
  'dark heather gray': '#585858', 'dark heather grey': '#585858',
}

/** Resolve best hex for a color object — falls back to label name lookup, then null */
function resolveSwatchHex(c) {
  if (c.hex && c.hex !== '#888888') return c.hex
  const key = (c.label || c.id || '').toLowerCase().trim()
  return APPAREL_COLOR_HEX[key] ?? APPAREL_COLOR_HEX[key.replace(/-/g, ' ')] ?? null
}

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

// ── Share button (dropdown) ───────────────────────────────────────────────────

function ShareButton({ title, isLight, onCopy, copied }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const url  = typeof window !== 'undefined' ? window.location.href : ''
  const text = `Check this out: "${title}"`

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const copyLink = async () => {
    await navigator.clipboard.writeText(url).catch(() => {})
    onCopy(); setOpen(false)
  }

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }) } catch {}
      setOpen(false)
    } else {
      copyLink()
    }
  }

  const btnCls  = isLight
    ? 'border-paper-border text-ink-muted hover:border-ink hover:text-ink'
    : 'border-border text-text-muted hover:border-border-light hover:text-cream'
  const menuCls = isLight
    ? 'bg-paper border-paper-border text-ink'
    : 'bg-surface border-border text-cream'
  const itemCls = isLight
    ? 'hover:bg-paper-2 text-ink-secondary hover:text-ink'
    : 'hover:bg-surface-2 text-text-secondary hover:text-cream'

  const SHARE_ITEMS = [
    { label: 'WhatsApp',   href: `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, icon: '💬' },
    { label: 'Facebook',   href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, icon: '𝒇' },
    { label: 'Instagram',  href: `https://www.instagram.com/`, icon: '◎', hint: 'Opens Instagram — paste link in story/bio' },
    { label: 'X',          href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, icon: '𝕏' },
    { label: 'Pinterest',  href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}`, icon: '𝓟' },
  ]

  return (
    <div className="relative mt-3" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 border text-xs font-sans tracking-label uppercase transition-all duration-150',
          btnCls,
          copied && 'text-green-500 border-green-500'
        )}
      >
        {copied ? '✓ Copied' : 'Share'}
        <ChevronDown size={10} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className={cn('absolute bottom-full left-0 mb-2 min-w-[180px] border shadow-lg z-30', menuCls)}>
          {/* Copy link row */}
          <button
            onClick={copyLink}
            className={cn('w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left', itemCls)}
          >
            <span className="text-base leading-none">🔗</span>
            <span>Copy link</span>
          </button>

          {/* Native share (mobile) */}
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              onClick={nativeShare}
              className={cn('w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left', itemCls)}
            >
              <span className="text-base leading-none">⬆</span>
              <span>Share via…</span>
            </button>
          )}

          <div className={cn('h-px', isLight ? 'bg-paper-border' : 'bg-border')} />

          {SHARE_ITEMS.map(({ label, href, icon, hint }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={hint}
              onClick={() => setOpen(false)}
              className={cn('flex items-center gap-3 px-4 py-3 text-sm transition-colors', itemCls)}
            >
              <span className="text-base leading-none w-5 text-center">{icon}</span>
              <span>{label}</span>
              {hint && <span className="text-xs opacity-50 ml-auto">↗</span>}
            </a>
          ))}
        </div>
      )}
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

// ── Reviews ───────────────────────────────────────────────────────────────────

function StarRating({ value, onChange, isLight }) {
  const [hover, setHover] = useState(null)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(null)}
          className={`text-xl leading-none transition-colors ${
            n <= (hover ?? value)
              ? 'text-yellow-400'
              : isLight ? 'text-ink-muted/30' : 'text-white/20'
          } ${onChange ? 'cursor-pointer' : 'cursor-default'}`}
        >★</button>
      ))}
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

  // Dynamic SEO meta tags per product
  const productImage = product
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${product.image || (product.images?.[0] ?? '')}`
    : undefined
  usePageMeta(product ? {
    title:       product.name,
    description: product.description
      ? product.description.slice(0, 160)
      : `${product.name} — ${product.collection || 'JAYL'}. Premium print-on-demand. Free shipping worldwide.`,
    image:       productImage || undefined,
    url:         typeof window !== 'undefined' ? window.location.href : undefined,
    type:        'product',
  } : {})

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
  // Reviews
  const [reviews,        setReviews]        = useState([])
  const [reviewsLoaded,  setReviewsLoaded]  = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewAuthor,   setReviewAuthor]   = useState('')
  const [reviewRating,   setReviewRating]   = useState(5)
  const [reviewBody,     setReviewBody]     = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted,  setReviewSubmitted]  = useState(false)
  const [reviewError,    setReviewError]    = useState('')

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

  // Load approved reviews for this product
  useEffect(() => {
    if (!product?.id) return
    fetch(`/api/reviews?productId=${encodeURIComponent(product.id)}`)
      .then(r => r.json())
      .then(data => { setReviews(data.reviews || []); setReviewsLoaded(true) })
      .catch(() => setReviewsLoaded(true))
  }, [product?.id])

  // Close lightbox on Escape
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') setLightboxOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // Ref on the in-flow "Add to Cart" button — sticky bar shows when it leaves viewport
  const addToCartBtnRef = useRef(null)

  // Jump to color image when color changes (only when not in hero-image mode)
  useEffect(() => {
    if (!selectedColor || !product?.colors) return
    if (product.heroImages?.length > 0) return // hero gallery is editorial — don't jump
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

  // Hero mode: admin-selected editorial images override the default gallery
  const heroImages    = product.heroImages?.length > 0 ? product.heroImages : null
  // displayImages is what the main carousel shows
  const displayImages = heroImages ?? productImages

  // Mobile gallery: video slot (index -1) + images (0..n-1)
  const minSlide = videoInfo ? -1 : 0
  const maxSlide = displayImages.length - 1
  // Map activeImage to a 0-based mobile index
  const mobileSlideIdx    = videoInfo ? activeImage + 1 : activeImage
  const totalMobileSlides = (videoInfo ? 1 : 0) + displayImages.length

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

  const handleReviewSubmit = async e => {
    e.preventDefault()
    if (!reviewAuthor.trim() || !reviewBody.trim()) return
    setReviewSubmitting(true); setReviewError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, author: reviewAuthor, rating: reviewRating, body: reviewBody }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setReviewSubmitted(true)
      setShowReviewForm(false)
    } catch (e) {
      setReviewError(e.message)
    } finally {
      setReviewSubmitting(false)
    }
  }

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
            {displayImages.map((src, i) => (
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
            <span className={cn('text-2xs font-sans tracking-label-xl uppercase', t.badge)}>
              {slugToTitle(product.movement)}
            </span>
            <span className={cn('text-2xs', isLight ? 'text-ink-muted' : 'text-text-muted')}>·</span>
            <span className={cn('text-2xs font-sans tracking-label-xl uppercase', t.sectionTag)}>
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

          {/* Color pills / thumbnails */}
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
              {/* In hero mode: square image thumbnails; otherwise: pill buttons */}
              {heroImages ? (
                <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
                  <div className="flex gap-3 pb-1 w-max">
                    {product.colors.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedColor(c.id)}
                        className={cn(
                          'flex flex-col items-center gap-1 transition-all duration-150',
                          selectedColor === c.id ? 'opacity-100' : 'opacity-55 hover:opacity-85'
                        )}
                      >
                        <span className={cn(
                          'block w-14 h-14 overflow-hidden border-2 transition-all',
                          selectedColor === c.id ? t.thumbnailActive : t.thumbnailInactive
                        )}>
                          {c.image ? (
                            <img src={c.image} alt={c.label} className="w-full h-full object-cover"
                              onError={e => { e.currentTarget.style.display = 'none' }} />
                          ) : (
                            <span className="w-full h-full block" style={{
                              background: resolveSwatchHex(c)
                                ?? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                            }} />
                          )}
                        </span>
                        <span className={cn('text-[10px] leading-none', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                          {c.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
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
                            background: resolveSwatchHex(c)
                              ?? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                          }}
                        />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
          <ShareButton title={product.name} isLight={isLight} onCopy={handleCopy} copied={copied} />
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
                    const src = displayImages[Math.max(0, activeImage)] ?? product.image
                    if (src) openLightbox(src)
                  }}
                  title="Click to zoom"
                >
                  <img
                    src={displayImages[Math.max(0, activeImage)] ?? product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
              )}

              {/* Thumbnail strip */}
              {(videoInfo || displayImages.length > 1) && (
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
                  {displayImages.map((img, i) => (
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
                <span className={cn('text-2xs font-sans tracking-label-xl uppercase', t.movement)}>
                  {slugToTitle(product.movement)}
                </span>
                <span className={cn(isLight ? 'text-ink-muted' : 'text-text-muted')}>·</span>
                <span className={cn('text-2xs font-sans tracking-label-xl uppercase', t.sectionTag)}>
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
                    {/* In hero mode: show Gelato variant thumbnails; otherwise: color circles */}
                    {heroImages ? (
                      <div className="flex gap-2 flex-wrap">
                        {product.colors.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedColor(c.id)}
                            title={c.label}
                            className={cn(
                              'flex flex-col items-center gap-1 transition-all duration-200',
                              selectedColor === c.id ? 'opacity-100' : 'opacity-60 hover:opacity-90'
                            )}
                          >
                            <span className={cn(
                              'block w-14 h-14 overflow-hidden border-2 transition-all',
                              selectedColor === c.id ? t.thumbnailActive : t.thumbnailInactive
                            )}>
                              {c.image ? (
                                <img src={c.image} alt={c.label} className="w-full h-full object-cover"
                                  onError={e => { e.currentTarget.style.display = 'none' }} />
                              ) : (
                                <span className="w-full h-full block" style={{
                                  background: resolveSwatchHex(c)
                                    ?? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                                }} />
                              )}
                            </span>
                            <span className={cn('text-[10px] leading-none', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                              {c.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
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
                    )}
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
              <ShareButton title={product.name} isLight={isLight} onCopy={handleCopy} copied={copied} />

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

      {/* ── Complete the look (curated upsell) ─────────────────────────────── */}
      {(() => {
        const upsell = (product.relatedProducts || [])
          .map(id => products.find(p => p.id === id))
          .filter(Boolean)
        if (!upsell.length) return null
        return (
          <div className={t.relatedBorder}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              <h2 className={cn('font-display text-2xl mb-10', t.relatedTitle)}>Complete the Look</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {upsell.map(p => (
                  <ProductCard key={p.id} product={p} light={isLight} />
                ))}
              </div>
            </div>
          </div>
        )
      })()}

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

      {/* ── Reviews ─────────────────────────────────────────────────────────── */}
      {reviewsLoaded && (
        <div className={cn('border-t', t.divider)}>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            {/* Header row */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className={cn('font-display text-2xl mb-1', t.relatedTitle)}>Reviews</h2>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating
                      value={Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)}
                      isLight={isLight}
                    />
                    <span className={cn('text-xs', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                      {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              {!reviewSubmitted && (
                <button
                  onClick={() => setShowReviewForm(v => !v)}
                  className={cn(
                    'text-xs tracking-widest uppercase transition-colors',
                    isLight ? 'text-ink-muted hover:text-ink border border-paper-border px-4 py-2' : 'text-text-muted hover:text-cream border border-border px-4 py-2'
                  )}
                >
                  {showReviewForm ? 'Cancel' : '+ Write a review'}
                </button>
              )}
            </div>

            {/* Submitted confirmation */}
            {reviewSubmitted && (
              <div className={cn('text-sm px-4 py-3 mb-6 border', isLight ? 'text-green-700 border-green-200 bg-green-50' : 'text-green-400 border-green-900/50 bg-green-900/10')}>
                ✓ Thank you! Your review is pending approval and will appear shortly.
              </div>
            )}

            {/* Review form */}
            {showReviewForm && !reviewSubmitted && (
              <form onSubmit={handleReviewSubmit} className={cn('mb-8 p-5 border space-y-4', isLight ? 'border-paper-border bg-paper' : 'border-border bg-gray-900/40')}>
                <div className="space-y-3">
                  <div>
                    <label className={cn('block text-xs mb-1.5', isLight ? 'text-ink-muted' : 'text-text-muted')}>Your rating</label>
                    <StarRating value={reviewRating} onChange={setReviewRating} isLight={isLight} />
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1.5', isLight ? 'text-ink-muted' : 'text-text-muted')}>Name</label>
                    <input
                      value={reviewAuthor}
                      onChange={e => setReviewAuthor(e.target.value)}
                      placeholder="Jane D."
                      required
                      maxLength={80}
                      className={cn('w-full px-3 py-2 text-sm focus:outline-none transition-colors', isLight ? 'bg-white border border-paper-border text-ink focus:border-ink-muted' : 'bg-gray-900 border border-border text-cream focus:border-border-light')}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1.5', isLight ? 'text-ink-muted' : 'text-text-muted')}>Review</label>
                    <textarea
                      value={reviewBody}
                      onChange={e => setReviewBody(e.target.value)}
                      placeholder="Share your experience with this product…"
                      required
                      maxLength={1000}
                      rows={4}
                      className={cn('w-full px-3 py-2 text-sm resize-none focus:outline-none transition-colors', isLight ? 'bg-white border border-paper-border text-ink focus:border-ink-muted' : 'bg-gray-900 border border-border text-cream focus:border-border-light')}
                    />
                  </div>
                </div>
                {reviewError && <p className="text-red-500 text-xs">{reviewError}</p>}
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className={cn('px-6 py-2.5 text-xs font-semibold tracking-widest uppercase transition-opacity disabled:opacity-40', isLight ? 'bg-ink text-cream hover:opacity-80' : 'bg-cream text-off-black hover:opacity-90')}
                >
                  {reviewSubmitting ? 'Submitting…' : 'Submit review'}
                </button>
              </form>
            )}

            {/* Review list */}
            {reviews.length === 0 && !showReviewForm && (
              <p className={cn('text-sm', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                No reviews yet. Be the first to share your thoughts.
              </p>
            )}

            <div className="space-y-6">
              {reviews.map(r => (
                <div key={r.id} className={cn('pb-6 border-b last:border-0', isLight ? 'border-paper-border' : 'border-border')}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className={cn('text-sm font-medium', isLight ? 'text-ink' : 'text-cream')}>{r.author}</p>
                      <StarRating value={r.rating} isLight={isLight} />
                    </div>
                    <time className={cn('text-xs', isLight ? 'text-ink-muted' : 'text-text-muted')}>
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </time>
                  </div>
                  <p className={cn('text-sm leading-relaxed mt-2', isLight ? 'text-ink-secondary' : 'text-text-secondary')}>
                    {r.body}
                  </p>
                </div>
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
