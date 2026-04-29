import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { getProductById, products } from '@/data/products'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, slugToTitle, cn } from '@/lib/utils'
import ProductCard from '@/components/product/ProductCard'
import { useThemeStore } from '@/store/themeStore'

function Accordion({ title, children, light }) {
  const [open, setOpen] = useState(false)
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

export default function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const product = getProductById(id)
  const { addItem, openCart } = useCartStore()
  const { setPageTheme } = useThemeStore()

  const isArt = product?.section === 'art'
  const isLight = isArt // Art = light theme, Objects = dark

  useEffect(() => {
    setPageTheme(isLight ? 'light' : 'dark')
  }, [isLight, setPageTheme])

  const defaultSize = product?.sizes?.[isArt ? 1 : 2]?.id
  const defaultColor = product?.colors?.[0]?.id
  const defaultFrame = 'none'

  const [selectedSize, setSelectedSize] = useState(defaultSize)
  const [selectedColor, setSelectedColor] = useState(defaultColor)
  const [selectedFrame, setSelectedFrame] = useState(defaultFrame)
  const [activeImage, setActiveImage] = useState(0)
  const [added, setAdded] = useState(false)

  if (!product) {
    return (
      <div className="min-h-screen bg-white pt-32 flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-display text-4xl text-ink mb-4">Not Found</h1>
        <p className="text-ink-secondary mb-8">This work doesn't exist (yet).</p>
        <Link to="/art" className="btn-ink">Back to Shop</Link>
      </div>
    )
  }

  const sizeObj = product.sizes?.find((s) => s.id === selectedSize)
  const frameObj = product.frames?.find((f) => f.id === selectedFrame)
  const totalPrice = (sizeObj?.price ?? product.price) + (frameObj?.price ?? 0)

  const handleAddToCart = () => {
    addItem(product, { size: selectedSize, color: selectedColor, frame: selectedFrame })
    setAdded(true)
    openCart()
    setTimeout(() => setAdded(false), 2000)
  }

  const related = products
    .filter((p) => p.section === product.section && p.id !== product.id)
    .slice(0, 4)

  const sectionLabel = isArt ? 'Fine Art Print' : 'Object'

  // Theme tokens
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
        selectorLabel: 'text-ink',
        selectorSub: 'text-ink-muted',
        btnActive: 'border-ink text-ink bg-ink/5',
        btnInactive: 'border-paper-border text-ink-muted hover:border-ink-muted',
        addBtn: added
          ? 'bg-success text-white'
          : 'bg-ink text-white hover:bg-ink-secondary hover:scale-[1.01] active:scale-[0.99]',
        relatedBorder: 'border-t border-paper-border',
        relatedTitle: 'text-ink',
        relatedLink: 'text-ink-muted hover:text-ink',
        thumbnailActive: 'border-ink',
        thumbnailInactive: 'border-paper-border hover:border-ink-muted',
        imgBg: 'bg-paper',
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
        selectorLabel: 'text-text-primary',
        selectorSub: 'text-text-muted',
        btnActive: 'border-cream text-cream bg-cream/5',
        btnInactive: 'border-border text-text-secondary hover:border-border-light',
        addBtn: added
          ? 'bg-success text-white'
          : 'bg-cream text-black hover:bg-accent hover:scale-[1.01] active:scale-[0.99]',
        relatedBorder: 'border-t border-border',
        relatedTitle: 'text-cream',
        relatedLink: 'text-text-secondary hover:text-cream',
        thumbnailActive: 'border-cream',
        thumbnailInactive: 'border-border hover:border-border-light',
        imgBg: 'bg-surface-2',
      }

  return (
    <div className={cn('min-h-screen pt-24', t.page)}>
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

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* ── Images ── */}
          <div className="space-y-3">
            <div className={cn('aspect-[4/5] overflow-hidden', t.imgBg)}>
              <img
                src={product.images?.[activeImage] ?? product.image}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
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
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
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
              <span className={cn('text-ink-muted', isLight ? '' : 'text-text-muted')}>·</span>
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

            <p className={cn('text-2xl font-semibold mb-8', t.price)}>
              {formatPrice(totalPrice)}
              {selectedFrame && selectedFrame !== 'none' && (
                <span className={cn('text-sm font-normal ml-2', t.priceSub)}>
                  (incl. frame)
                </span>
              )}
            </p>

            {/* Variant selectors */}
            <div className="space-y-6 mb-8">
              {/* Size */}
              {product.sizes && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className={cn('text-xs font-semibold tracking-widest uppercase', t.selectorLabel)}>
                      Size
                    </p>
                    {sizeObj && (
                      <p className={cn('text-xs', t.selectorSub)}>
                        {sizeObj.label} · {formatPrice(sizeObj.price)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSize(s.id)}
                        className={cn(
                          'px-4 py-2.5 text-xs font-medium tracking-widest uppercase border transition-all duration-200',
                          selectedSize === s.id ? t.btnActive : t.btnInactive
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color (Objects) */}
              {product.colors && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className={cn('text-xs font-semibold tracking-widest uppercase', t.selectorLabel)}>
                      Color
                    </p>
                    {selectedColor && (
                      <p className={cn('text-xs capitalize', t.selectorSub)}>
                        {product.colors.find((c) => c.id === selectedColor)?.label}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {product.colors.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedColor(c.id)}
                        title={c.label}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all duration-200',
                          selectedColor === c.id
                            ? isLight ? 'border-ink scale-110' : 'border-cream scale-110'
                            : isLight ? 'border-paper-border hover:border-ink-muted' : 'border-border hover:border-border-light'
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Frame (Art prints) */}
              {product.frames && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className={cn('text-xs font-semibold tracking-widest uppercase', t.selectorLabel)}>
                      Frame
                    </p>
                    {frameObj && frameObj.price > 0 && (
                      <p className={cn('text-xs', t.selectorSub)}>+{formatPrice(frameObj.price)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.frames.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFrame(f.id)}
                        className={cn(
                          'px-4 py-2.5 text-xs font-medium tracking-widest uppercase border transition-all duration-200',
                          selectedFrame === f.id ? t.btnActive : t.btnInactive
                        )}
                      >
                        {f.label}
                        {f.price > 0 && ` +${formatPrice(f.price)}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add to cart */}
            <button
              onClick={handleAddToCart}
              disabled={!selectedSize}
              className={cn(
                'w-full flex items-center justify-center gap-3 py-4 text-sm font-semibold tracking-widest uppercase transition-all duration-300',
                t.addBtn,
                !selectedSize && 'opacity-50 cursor-not-allowed'
              )}
            >
              {added ? (
                <><Check size={16} />Added to Cart</>
              ) : (
                <>Add to Cart · {formatPrice(totalPrice)}</>
              )}
            </button>

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
                    Fulfilled by{' '}
                    <span className={isLight ? 'text-ink' : 'text-text-primary'}>Gelato</span>{' '}
                    — the world's largest print-on-demand network with 130+ local print partners worldwide.
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

      {/* Related products */}
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
              {related.map((p) => (
                <ProductCard key={p.id} product={p} light={isLight} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
