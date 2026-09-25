import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { getProductById, products } from '@/data/products'
import { useCartStore } from '@/store/cartStore'
import { trackGA4, gaItem, toMajor, trackTikTok, ttContent } from '@/lib/analytics'
import { slugToTitle, cn } from '@/lib/utils'
import TrustBox from '@/components/TrustBox'
import ProductCard from '@/components/product/ProductCard'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'
import { usePageMeta } from '@/hooks/usePageMeta'
import { findColorImageIndex, findImageColor } from '@/lib/colorImageMatch'
import { resolveSwatchHex } from '@/lib/apparelColors'
import { shownColors, imagesForShownColors } from '@/lib/shownColors'
import { sizeGuideFor, bySize } from '@/data/sizeGuides'
import { useDropStatus } from '@/hooks/useDropStatus'
import { dropWindowState, BEFORE, LIVE, CLOSED } from '@/components/drop/dropWindowState'
import { getDrop, productState, capFor, basePriceFor, DROP } from '../../api/_lib/drop.js'
import Money from '@/components/Money'

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

  const btnCls  = isLight
    ? 'border-paper-border text-ink-muted hover:border-ink hover:text-ink'
    : 'border-border text-text-muted hover:border-border-light hover:text-cream'
  const menuCls = isLight
    ? 'bg-paper border-paper-border text-ink'
    : 'bg-surface border-border text-cream'
  const itemCls = isLight
    ? 'hover:bg-paper-2 text-ink-secondary hover:text-ink'
    : 'hover:bg-surface-2 text-text-secondary hover:text-cream'

  // Solo i due gesti che si fanno davvero da una scheda prodotto: mandarla in
  // chat, o copiarne il link. Facebook/X/Pinterest/"Share via…" erano righe
  // che nessuno toccava, e Instagram non accetta link condivisi da web.
  const SHARE_ITEMS = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, icon: '💬' },
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

          {SHARE_ITEMS.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={cn('flex items-center gap-3 px-4 py-3 text-sm transition-colors', itemCls)}
            >
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
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

// Le stampe art hanno la loro tabella; i capi la ricavano dal blank Gelato
// (src/data/sizeGuides.js), cosi' ogni caricamento nuovo la riceve da solo.
const ART_PRINT_GUIDE = {
  garment: 'Print sizes',
  cols: ['Width', 'Height'],
  rows: [
    ['8×10"',   '20 cm', '25 cm'],
    ['12×16"',  '30 cm', '40 cm'],
    ['18×24"',  '46 cm', '61 cm'],
    ['24×36"',  '61 cm', '91 cm'],
  ],
  notes: ['All prints include a 5 mm white border. Frames add ~2 cm to each side.'],
}

function guideFor(product) {
  return product?.section === 'art' ? ART_PRINT_GUIDE : sizeGuideFor(product)
}

function SizeChart({ guide, isLight }) {
  const unit = guide.unit ? ` (${guide.unit})` : ''
  return (
    <div>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className={`text-[10px] uppercase tracking-[0.15em] ${isLight ? 'text-ink-muted' : 'text-text-muted'}`}>
            <th className="text-left pb-2 font-medium pr-3">Size</th>
            {guide.cols.map(c => (
              <th key={c} className="text-left pb-2 font-medium pr-3">{c}{unit}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${isLight ? 'divide-paper-border' : 'divide-border'}`}>
          {guide.rows.map(row => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={i} className={`py-2 pr-3 ${i === 0 ? 'font-medium' : ''} ${isLight ? 'text-ink' : 'text-text-primary'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {guide.notes?.length > 0 && (
        <ul className={`mt-4 space-y-1 text-xs leading-relaxed ${isLight ? 'text-ink-muted' : 'text-text-secondary'}`}>
          {guide.notes.map(n => <li key={n}>{n}</li>)}
        </ul>
      )}
      {guide.unit && (
        <p className={`mt-3 text-[10px] uppercase tracking-[0.15em] ${isLight ? 'text-ink-muted' : 'text-text-muted'}`}>{guide.garment}</p>
      )}
    </div>
  )
}

function SizeGuideModal({ open, onClose, guide, isLight }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  if (!open || !guide) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md mx-4 mb-0 sm:mb-0 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl ${isLight ? 'bg-paper text-ink' : 'bg-surface text-cream'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-base font-semibold ${isLight ? 'text-ink' : 'text-cream'}`}>Size Guide</h2>
          <button onClick={onClose} aria-label="Close size guide" className={`text-xl leading-none transition-opacity hover:opacity-60 ${isLight ? 'text-ink-muted' : 'text-cream/50'}`}>×</button>
        </div>
        <SizeChart guide={guide} isLight={isLight} />
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
              : isLight ? 'text-ink-muted/30' : 'text-fg/20'
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
  // Single fetch shared by the DropBlock badge and the sold-out gate below —
  // called unconditionally (rules of hooks), correct even before it resolves:
  // useDropStatus() starts at {status: null}, and every read of it below is
  // optional-chained to a safe fallback.
  const { status: dropStatus } = useDropStatus()
  const dropCfg = getDrop()
  // Window state (BEFORE/LIVE/CLOSED) doesn't depend on `product` — only on the
  // drop config — so it's safe to compute unconditionally up here, before the
  // not-found bail-out, same as `dropCfg` above. Task 8's `DropBlock` computes
  // its own copy for the same reason: it's a pure function of `cfg`, cheap to
  // call twice, and importing a shared *value* across two components would be
  // more coupling than the seconds it'd save.
  const dropWin = dropWindowState(dropCfg)
  // Representative product-level price (no size/frame math) — used anywhere
  // that isn't the buy box itself: JSON-LD, og:price, and ad-pixel event
  // values. Same basePriceFor() the buy box and checkout both use, so none of
  // these can drift from what the customer is actually charged.
  const productBasePrice = product ? basePriceFor(product.id, null, product, dropCfg) : undefined

  const isArt = product?.section === 'art'
  const isLight = isArt

  useEffect(() => {
    setPageTheme(isLight ? 'light' : 'dark')
  }, [isLight, setPageTheme])

  // Reviews state must be declared before productJsonLd which references it
  const [reviews, setReviews] = useState([])

  // Recensioni raccolte da noi: le sole che possono alimentare un
  // aggregateRating. Le importate portano source: 'etsy' (o altro) e restano
  // fuori dai dati strutturati, pur restando visibili in pagina.
  const ownReviews = reviews.filter(r => !r.source || r.source === 'jayl')

  // Dynamic SEO meta tags + JSON-LD Product schema
  const productImage = product
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${product.image || (product.images?.[0] ?? '')}`
    : undefined
  const productDesc = product
    ? (product.description?.slice(0, 160) || `${product.name} — ${product.collection || 'JAYL'}. Premium print-on-demand. Free shipping worldwide.`)
    : undefined
  const productUrl = typeof window !== 'undefined' ? window.location.href : `https://jayl.store/product/${product?.id}`
  const productJsonLd = product ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type':      'Product',
        name:         product.name,
        description:  productDesc,
        image:        productImage ? [productImage] : undefined,
        brand: { '@type': 'Brand', name: 'JAYL' },
        ...(product.collection ? { category: product.collection } : {}),
        // Solo le recensioni raccolte da noi finiscono nell'aggregateRating.
        // Quelle importate da Etsy sono autentiche e si mostrano in pagina,
        // ma dichiararle a Google come raccolte qui è un dato strutturato che
        // non corrisponde alla realtà — la stessa classe di problema del
        // prezzo che fa sospendere Merchant Center (vedi offers qui sotto),
        // con in più il rischio di manual action su tutto il dominio.
        ...(ownReviews.length > 0 ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (ownReviews.reduce((s, r) => s + r.rating, 0) / ownReviews.length).toFixed(1),
            reviewCount: ownReviews.length,
          },
        } : {}),
        offers: {
          '@type':        'Offer',
          priceCurrency:  'EUR',
          // basePriceFor(), not product.price — Merchant Center flags/suspends
          // accounts over a mismatch between declared structured-data price and
          // what checkout actually charges (see totalPrice above for the same
          // reasoning applied to the buy box).
          price:          ((productBasePrice ?? 0) / 100).toFixed(2),
          availability:   'https://schema.org/InStock',
          url:            productUrl,
          seller: { '@type': 'Organization', name: 'JAYL' },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://jayl.store' },
          { '@type': 'ListItem', position: 2, name: product.section === 'art' ? 'Art' : 'Objects', item: `https://jayl.store/${product.section === 'art' ? 'art' : 'objects'}` },
          ...(product.collection ? [{ '@type': 'ListItem', position: 3, name: product.collection, item: `https://jayl.store/collection/${encodeURIComponent(product.collection)}` }] : []),
          { '@type': 'ListItem', position: product.collection ? 4 : 3, name: product.name, item: productUrl },
        ],
      },
    ],
  } : undefined
  usePageMeta(product ? {
    title:       product.seoTitle || product.name,
    subtitle:    product.collection || undefined,
    description: productDesc,
    image:       productImage || undefined,
    url:         productUrl,
    type:        'product',
    jsonLd:      productJsonLd,
    priceAmount:  productBasePrice != null ? (productBasePrice / 100).toFixed(2) : undefined,
    priceCurrency: 'EUR',
  } : {})

  // Colore e taglia con cui si apre la scheda. Chi arriva da un ad ha visto un
  // colore preciso: se la pagina apre sul primo dell'elenco Gelato (Navy per
  // Blastoise, White per Vileplume, con l'ad che mostrava Royal e verde) pensa
  // di aver sbagliato pagina, o compra il colore sbagliato senza accorgersene.
  // Il valore lo sceglie l'admin per ogni pezzo del drop (tab Drop →
  // current.defaults); se manca, o non esiste fra le varianti del prodotto,
  // resta il comportamento di sempre. Solo per i pezzi del drop CORRENTE: fuori
  // dal drop nessuno ha visto un colore da rispettare.
  const dropDefaults = dropCfg.current?.productIds?.includes(product?.id)
    ? dropCfg.current.defaults?.[product.id]
    : null
  const pickDefault = (list, wanted) => (wanted && list?.some((x) => x.id === wanted) ? wanted : null)
  // Senza scelta esplicita la taglia d'apertura e' M, non la prima della lista:
  // Gelato le ordina dalla XL, e chi tocca "Add to cart" al volo compra XL.
  const fallbackSize = isArt
    ? product?.sizes?.[1]?.id
    : (product?.sizes?.some((x) => x.id === 'M') ? 'M' : product?.sizes?.[0]?.id)
  const defaultSize  = pickDefault(product?.sizes,  dropDefaults?.size)  ?? fallbackSize
  const defaultColor = pickDefault(product?.colors, dropDefaults?.color)
    ?? pickDefault(product?.colors, product?.storeColors?.[0])
    ?? product?.colors?.[0]?.id
  // Tre colori, non sette: quello d'apertura, poi nero e bianco (vedi
  // src/lib/shownColors.js). Gli altri restano su Gelato, solo non si vedono.
  const colors       = shownColors(product?.colors, defaultColor, product?.storeColors)
  // Guida taglie dal blank Gelato (src/data/sizeGuides.js): nessun campo da
  // compilare per prodotto, un capo nuovo sullo stesso blank la riceve da solo.
  const sizeGuide    = guideFor(product)
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
  // Reviews (state declared above, before productJsonLd)
  const [reviewsLoaded,  setReviewsLoaded]  = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewAuthor,   setReviewAuthor]   = useState('')
  const [showDetail,     setShowDetail]     = useState(false)
  const [reviewRating,   setReviewRating]   = useState(5)
  const [reviewBody,     setReviewBody]     = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted,  setReviewSubmitted]  = useState(false)
  const [reviewError,    setReviewError]    = useState('')

  // Viewer count — random on mount, drifts slightly every 5 min for "live" feel.
  // Kept to 3-7: a two-digit crowd on a brand this size reads as invented.
  useEffect(() => {
    const base = 3 + Math.floor(Math.random() * 5) // 3-7
    setViewerCount(base)
    const id = setInterval(() => {
      setViewerCount(n => Math.min(7, Math.max(3, n + (Math.random() > 0.5 ? 1 : -1))))
    }, 300_000)
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
    // Meta Pixel — ViewContent. `productBasePrice` è in CENTESIMI: le
    // piattaforme pubblicitarie vogliono unità maggiori, come già fa Purchase
    // in CheckoutPage. Senza toMajor() Meta registrava ogni vista prodotto a
    // €2.200 invece di €22.
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', {
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        value: toMajor(productBasePrice),
        currency: 'EUR',
      })
    }
    // Pinterest Tag — PageVisit (product page)
    if (typeof window.pintrk === 'function') {
      window.pintrk('track', 'pagevisit')
    }
    // GA4 — view_item
    trackGA4('view_item', {
      currency: 'EUR',
      value:    toMajor(productBasePrice),
      items:    [gaItem(product, productBasePrice)],
    })
    // TikTok Pixel — ViewContent
    trackTikTok('ViewContent', {
      currency: 'EUR',
      value:    toMajor(productBasePrice),
      contents: [ttContent(product, productBasePrice)],
    })
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

  // Whichever image array is actually shown in the gallery (hero gallery takes
  // priority), minus the photos of the colors the swatches no longer offer.
  const galleryImages = imagesForShownColors(
    product?.heroImages?.length > 0 ? product.heroImages : product?.images,
    product?.colors, colors, product?.imageColors,
  )

  // Jump to color image when color changes.
  //
  // `color.image` (admin-authored, stale) and the old plain-substring fallback
  // are both gone — see src/lib/colorImageMatch.js for why: nothing writes
  // color.image anymore so it drifts on every Gelato mockup reimport, and
  // substring matching alone picks the wrong photo whenever one color name is
  // contained in another ("Navy" inside "Heather Navy", "Red" inside
  // "Cardinal Red" — both are real color pairs on this catalog). The shared
  // resolver assigns each gallery image to its MOST SPECIFIC matching color,
  // so "Heather Navy" wins the file that mentions it even though "Navy" also
  // matches — same algorithm scripts/test-color-image-match.js runs against
  // the whole catalog before every deploy, so a future reimport that
  // reintroduces a collision fails the build instead of shipping quietly.
  useEffect(() => {
    if (!selectedColor || !product?.colors || !galleryImages) return
    const colorObj = product.colors.find(c => c.id === selectedColor)
    if (!colorObj) return
    const idx = findColorImageIndex(colorObj, product.colors, galleryImages, product.imageColors)
    if (idx >= 0 && idx !== activeImage) setActiveImage(idx)
  }, [selectedColor])

  // Reverse sync: when the active gallery image is a color variant, highlight its swatch
  useEffect(() => {
    if (activeImage < 0 || !product?.colors || !galleryImages) return
    const match = findImageColor(activeImage, product.colors, galleryImages, product.imageColors)
    if (match && match.id !== selectedColor) setSelectedColor(match.id)
  }, [activeImage])

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

  // ── Computed values ──────────────────────────────────────────────────────────
  // `product` may be null (unknown slug) — the "Not Found" bail-out lives further
  // down, after the last hook, so these stay optional-chained.

  const sizeObj   = product?.sizes?.find((s) => s.id === selectedSize)
  const frameObj  = product?.frames?.find((f) => f.id === selectedFrame)
  // basePriceFor overrides sizeObj/product.price for DROP and LISTINO state — a
  // drop has one price, not a per-size scale (see api/_lib/drop.js). Reading
  // product.price directly here would show the admin's list price (e.g. €23.99)
  // for a product whose actual drop price is €22: the buy box would contradict
  // what checkout actually charges.
  const totalPrice = basePriceFor(product?.id, sizeObj, product, dropCfg) + (frameObj?.price ?? 0)

  // Normalise image list (fallback to product.image)
  const productImages = product?.images?.length > 0
    ? product.images
    : (product?.image ? [product.image] : [])

  // Hero mode: admin-selected editorial images override the default gallery
  const heroImages    = product?.heroImages?.length > 0 ? product.heroImages : null
  // displayImages is what the main carousel shows — same color filter as
  // galleryImages above, so the two can't disagree about an index.
  const displayImages = imagesForShownColors(heroImages ?? productImages, product?.colors, colors, product?.imageColors)

  // Random starting image — shuffle on every product open (not on re-render).
  //
  // Solo fra le immagini NEUTRE (hero, macro, mockup senza colore nel nome):
  // l'effetto "immagine → swatch" più su cambia il colore selezionato in quello
  // dell'immagine mostrata, quindi un salto casuale su "…-black-01.jpg" apriva
  // la scheda con Black selezionato — e chi tocca "Add to cart" al volo
  // comprava un colore a caso. Se il drop ha scelto un colore d'apertura, non
  // si mescola niente: l'effetto sul colore ha già portato la galleria su
  // quell'immagine, ed e' il punto — chi viene dall'ad vede lo stesso capo.
  useEffect(() => {
    if (!product || videoInfo || dropDefaults?.color) return
    const neutral = displayImages
      .map((_, i) => i)
      .filter((i) => !findImageColor(i, product.colors || [], displayImages, product.imageColors))
    if (neutral.length > 1) setActiveImage(neutral[Math.floor(Math.random() * neutral.length)])
  }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile gallery: video slot (index -1) + images (0..n-1)
  const minSlide = videoInfo ? -1 : 0
  const maxSlide = displayImages.length - 1
  // Map activeImage to a 0-based mobile index
  const mobileSlideIdx    = videoInfo ? activeImage + 1 : activeImage
  const totalMobileSlides = (videoInfo ? 1 : 0) + displayImages.length

  // Which sizes are available for the selected color (when variants exist)
  const availableSizesForColor = (product?.variants?.length && selectedColor)
    ? new Set(
        product.variants
          .filter(v => colorToSlug(v.color) === colorToSlug(selectedColor))
          .map(v => v.size)
      )
    : null

  // Drop-window + sold-out gate: Add to Cart must never promise something the
  // server will refuse. `checkDropGate` in api/create-payment-intent.js
  // rejects any DROP product order placed outside its own open window
  // (state === DROP && !dropOpen) with a 409 — this mirrors that same check
  // client-side, using the identical `dropWindowState()` the DropBlock badge
  // above already reads, so the button and the badge can never disagree about
  // what's actually purchasable. This is a UX courtesy only, same as the
  // sold-out check below — the real defense is the server-side gate, which
  // rejects the order regardless of what the client shows.
  const dropProductState = product ? productState(product.id, dropCfg) : null
  const dropCap          = product ? capFor(product.id, dropCfg) : 0
  const dropSale         = product ? dropStatus?.products?.[product.id] : null
  const isDropBefore      = dropProductState === DROP && dropWin.state === BEFORE
  const isDropClosed      = dropProductState === DROP && dropWin.state === CLOSED
  // Sold-out only means something while the drop is actually LIVE — before it
  // opens there's no sales data to check yet, and once it's closed the
  // "Drop chiuso" label already covers it regardless of the last known count.
  const isSoldOut          = dropProductState === DROP && dropWin.state === LIVE && dropCap > 0
    && (dropSale?.sold ?? 0) >= (dropSale?.cap ?? dropCap)
  const dropWindowBlocked = isDropBefore || isDropClosed || isSoldOut

  // "Opens 5 September" — derived from the real startsAt (never hardcoded),
  // so it can't drift from the countdown DropBlock shows for the same date.
  const dropOpensLabel = dropCfg.current?.startsAt
    ? `Opens ${new Date(dropCfg.current.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
    : 'Coming soon'

  const canAddToCart = (!!selectedSize || !product?.sizes?.length) && !dropWindowBlocked

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
    // Meta Pixel — AddToCart. Stesso motivo di ViewContent sopra: centesimi
    // → unità maggiori, o il valore arriva gonfiato di 100 volte.
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'AddToCart', {
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        value: toMajor(productBasePrice),
        currency: 'EUR',
      })
    }
    // Pinterest Tag — AddToCart
    if (typeof window.pintrk === 'function') {
      window.pintrk('track', 'addtocart', {
        value: toMajor(productBasePrice),
        order_quantity: 1,
        currency: 'EUR',
      })
    }
    // GA4 — add_to_cart
    trackGA4('add_to_cart', {
      currency: 'EUR',
      value:    toMajor(productBasePrice),
      items:    [gaItem(product, productBasePrice, 1, {
        item_variant: [selectedSize, selectedColor].filter(Boolean).join(' / ') || undefined,
      })],
    })
    // TikTok Pixel — AddToCart
    trackTikTok('AddToCart', {
      currency: 'EUR',
      value:    toMajor(productBasePrice),
      contents: [ttContent(product, productBasePrice)],
    })
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

  // Last hook has run — safe to bail out. Returning any earlier would change the
  // hook count between renders and crash React when navigating to a bad slug.
  //
  // A VAULT product isn't in the storefront bundle (see the `storefront-products`
  // plugin in vite.config.js) — getProductById returns undefined for it, and
  // that undefined is the ONLY signal the client has. There's no way to tell a
  // real hidden product from a genuinely bogus /product/<id> from here: the full
  // catalog deliberately never reaches the storefront bundle (CLAUDE.md), so we
  // can't check existence client-side. productState() already treats "anything
  // not explicitly in the current drop or released" as VAULT (see api/_lib/drop.js);
  // this screen follows the same rule rather than claiming the piece doesn't
  // exist, which is wrong for the overwhelming majority of ids that land here
  // (37 of 39 products are VAULT today, 0 unknown). A URL that doesn't match any
  // route at all still gets the real 404 — the catch-all "*" -> <NotFound />
  // route in App.jsx, untouched by this file — so the two cases stay
  // distinguishable at the app level even though ProductPage itself can't tell
  // them apart for a bad /product/:id.
  if (!product) {
    return (
      <div className="min-h-screen bg-off-black flex flex-col items-center justify-center text-center px-6">
        <p className="text-xs tracking-[0.3em] uppercase text-fg/50 mb-3">Coming soon</p>
        <h1 className="text-cream text-2xl mb-6">This piece hasn't dropped yet.</h1>
        <p className="text-fg/60 text-sm mb-8 max-w-sm">
          Join the waitlist — we'll let you know when it enters a drop.
        </p>
        <Link to="/" className="text-cream underline text-sm">See the current drop</Link>
      </div>
    )
  }

  const related = products
    .filter((p) => p.section === product.section && p.id !== product.id)
    .slice(0, 4)

  const sectionLabel = isArt ? 'Fine Art Print' : 'Object'

  // ── Theme tokens ─────────────────────────────────────────────────────────────

  const t = isLight
    ? {
        page: 'bg-paper',
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
        btnActive: 'border-cream text-off-black bg-cream',
        btnInactive: 'border-border text-text-secondary hover:border-border-light',
        btnDisabled: 'border-border text-text-muted/30 cursor-not-allowed',
        colorActive: 'border-cream ring-1 ring-cream',
        colorInactive: 'border-border hover:border-border-light',
        pillActive: 'border-cream bg-cream text-off-black',
        pillInactive: 'border-border text-text-secondary',
        addBtn: added
          ? 'bg-success text-white'
          : 'bg-cream text-off-black hover:bg-accent hover:scale-[1.01] active:scale-[0.99]',
        stickyBg: 'bg-surface border-border',
        stickyBtn: 'bg-cream text-off-black',
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
          <div className="flex justify-center gap-1.5 py-4">
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
        <div className="px-4 pt-5 pb-4 relative">
          {/* ── Hold to reveal — square button, absolute top-right ─── */}
          {product.detailImage && (
            <button
              style={{
                position: 'absolute',
                top: 8,
                right: 16,
                width: 56,
                height: 56,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                border: `1px solid ${showDetail ? '#d4a853' : 'rgba(212,168,83,0.45)'}`,
                backgroundColor: showDetail ? 'rgba(212,168,83,0.1)' : 'transparent',
                color: showDetail ? '#d4a853' : 'rgba(212,168,83,0.7)',
                cursor: 'pointer',
                transition: 'border-color 0.12s, background-color 0.12s, color 0.12s, box-shadow 0.12s, opacity 0.12s',
                animation: showDetail ? 'none' : 'holdPulse 2.8s ease-in-out infinite',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: 'none',
                zIndex: 10,
              }}
              onContextMenu={e => e.preventDefault()}
              onMouseDown={() => setShowDetail(true)}
              onMouseUp={() => setShowDetail(false)}
              onMouseLeave={() => setShowDetail(false)}
              onTouchStart={e => { e.preventDefault(); setShowDetail(true) }}
              onTouchEnd={e => { e.preventDefault(); setShowDetail(false) }}
              onTouchCancel={() => setShowDetail(false)}
            >
              <span style={{ fontSize: 11, letterSpacing: '0.04em', lineHeight: 1 }}>✦</span>
              <span style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1, textAlign: 'center' }}>HOLD</span>
            </button>
          )}

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
            <Money cents={totalPrice} />
          </p>

          <TrustBox variant="micro" className="mt-2" theme={isLight ? 'light' : 'dark'} />

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
                    {colors.map(c => (
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
                    {colors.map(c => (
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
                {sizeGuide && <button
                  onClick={() => setSizeGuideOpen(true)}
                  className={cn('text-xs underline underline-offset-2 transition-opacity hover:opacity-60', isLight ? 'text-ink-muted' : 'text-text-muted')}
                >
                  Size guide
                </button>}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[...product.sizes].sort(bySize).map(s => {
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
                    {f.label}{f.price > 0 && <> +<Money cents={f.price} /></>}
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
            ) : isDropBefore ? (
              dropOpensLabel
            ) : isDropClosed ? (
              'Drop chiuso'
            ) : isSoldOut ? (
              'Sold Out'
            ) : (
              <>Add to Cart · <Money cents={totalPrice} /></>
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
          {sizeGuide && (
            <Accordion title="Size Guide" light={isLight}>
              <SizeChart guide={sizeGuide} isLight={isLight} />
            </Accordion>
          )}
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
              : isDropBefore
              ? dropOpensLabel
              : isDropClosed
              ? 'Drop chiuso'
              : isSoldOut
              ? 'Sold Out'
              : canAddToCart
              ? <>Add · <Money cents={totalPrice} /></>
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
                <Money cents={totalPrice} />
                {selectedFrame && selectedFrame !== 'none' && (
                  <span className={cn('text-sm font-normal ml-2', t.priceSub)}>(incl. frame)</span>
                )}
              </p>

              <TrustBox variant="micro" className="mt-2" theme={isLight ? 'light' : 'dark'} />

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
                            {/* basePriceFor, not sizeObj.price directly — same reasoning as
                                totalPrice above: a drop has one price, not a per-size scale,
                                and this label sits right next to the Add to Cart button that
                                already shows the drop price. */}
                            {sizeObj.label} · <Money cents={basePriceFor(product.id, sizeObj, product, dropCfg)} />
                          </p>
                        )}
                        {sizeGuide && <button
                          onClick={() => setSizeGuideOpen(true)}
                          className={cn('text-xs underline underline-offset-2 transition-opacity hover:opacity-60', isLight ? 'text-ink-muted' : 'text-text-muted')}
                        >
                          Size guide
                        </button>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[...product.sizes].sort(bySize).map(s => {
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
                        {colors.map(c => (
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
                        {colors.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedColor(c.id)}
                            title={c.label}
                            className={cn(
                              'w-8 h-8 rounded-full border-2 transition-all duration-200',
                              selectedColor === c.id ? t.colorActive : t.colorInactive
                            )}
                            style={{
                              background: resolveSwatchHex(c)
                                ?? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
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
                        <p className={cn('text-xs', t.selectorSub)}>+<Money cents={frameObj.price} /></p>
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
                          {f.label}{f.price > 0 && <> +<Money cents={f.price} /></>}
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
                ) : isDropBefore ? (
                  dropOpensLabel
                ) : isDropClosed ? (
                  'Drop chiuso'
                ) : isSoldOut ? (
                  'Sold Out'
                ) : (
                  <>Add to Cart · <Money cents={totalPrice} /></>
                )}
              </button>
              <UrgencyBadge text={product.urgency} isLight={isLight} />

              {/* Trust signals */}
              <div className={cn('mt-4 pt-4 border-t space-y-2.5', isLight ? 'border-ink/10' : 'border-fg/10')}>
                <div className="flex items-center gap-2.5 text-xs">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLight ? 'text-ink-muted' : 'text-text-secondary'}>
                    <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4"/><circle cx="8.5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                  </svg>
                  <span className={isLight ? 'text-ink-secondary' : 'text-text-secondary'}>
                    Ships in <strong>3–5 business days</strong> · Free worldwide shipping
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLight ? 'text-ink-muted' : 'text-text-secondary'}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span className={isLight ? 'text-ink-secondary' : 'text-text-secondary'}>
                    <strong>30-day guarantee</strong> · Premium Gelato print quality
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLight ? 'text-ink-muted' : 'text-text-secondary'}>
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['Visa', 'MC', 'PayPal', 'Apple Pay', 'Google Pay'].map(p => (
                      <span key={p} className={cn(
                        'px-1.5 py-0.5 text-[10px] font-medium border rounded',
                        isLight ? 'border-ink/20 text-ink-muted' : 'border-fg/15 text-text-secondary'
                      )}>{p}</span>
                    ))}
                  </div>
                </div>
              </div>

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
                {sizeGuide && (
                  <Accordion title="Size Guide" light={isLight}>
                    <SizeChart guide={sizeGuide} isLight={isLight} />
                  </Accordion>
                )}
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
              <form onSubmit={handleReviewSubmit} className={cn('mb-8 p-5 border space-y-4', isLight ? 'border-paper-border bg-paper' : 'border-border bg-surface/40')}>
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
                      className={cn('w-full px-3 py-2 text-sm focus:outline-none transition-colors', isLight ? 'bg-paper border border-paper-border text-ink focus:border-ink-muted' : 'bg-surface border border-border text-cream focus:border-border-light')}
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
                      className={cn('w-full px-3 py-2 text-sm resize-none focus:outline-none transition-colors', isLight ? 'bg-paper border border-paper-border text-ink focus:border-ink-muted' : 'bg-surface border border-border text-cream focus:border-border-light')}
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
        guide={sizeGuide}
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

      {/* ── Detail image overlay (hold to reveal) ───────────────────── */}
      {product?.detailImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#000',
            opacity: showDetail ? 1 : 0,
            pointerEvents: showDetail ? 'auto' : 'none',
            transition: 'opacity 0.12s ease',
            overflow: 'hidden',
          }}
        >
          {/* Image — 9:16, full screen height */}
          <img
            src={product.detailImage}
            alt="product detail"
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              height: '100%',
              width: 'auto',
              maxWidth: '100vw',
              objectFit: 'cover',
              display: 'block',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              pointerEvents: 'none',
            }}
          />

          {/* Top fade */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '12%',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
            pointerEvents: 'none',
          }} />
          {/* Bottom fade + label */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '16%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)',
            pointerEvents: 'none',
          }} />
          <p style={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(212,168,83,0.6)', fontSize: '9px',
            letterSpacing: '0.28em', textTransform: 'uppercase',
            fontFamily: 'inherit', whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>✦ &nbsp; DETAIL &nbsp; ✦</p>
        </div>
      )}
    </div>
  )
}
