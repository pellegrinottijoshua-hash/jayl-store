import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { getProductBySlug, products } from '@/data/products'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, slugToTitle, cn } from '@/lib/utils'
import ProductCard from '@/components/product/ProductCard'

// Collapsible details accordion
function Accordion({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-4 text-sm font-medium text-text-primary hover:text-cream transition-colors"
      >
        {title}
        {open ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
      </button>
      {open && (
        <div className="pb-4 text-sm text-text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}

export default function ProductPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const product = getProductBySlug(slug)

  const { addItem, openCart } = useCartStore()

  const isArt = product?.section === 'art'

  const defaultSize = product?.sizes?.[isArt ? 1 : 2]?.id // md for art, M for apparel
  const defaultColor = product?.colors?.[0]?.id
  const defaultFrame = 'none'

  const [selectedSize, setSelectedSize] = useState(defaultSize)
  const [selectedColor, setSelectedColor] = useState(defaultColor)
  const [selectedFrame, setSelectedFrame] = useState(defaultFrame)
  const [activeImage, setActiveImage] = useState(0)
  const [added, setAdded] = useState(false)

  if (!product) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-display text-4xl text-cream mb-4">Not Found</h1>
        <p className="text-text-secondary mb-8">This work doesn't exist (yet).</p>
        <Link to="/shop" className="btn-primary">Back to Shop</Link>
      </div>
    )
  }

  // Calculate price
  const sizeObj = product.sizes?.find((s) => s.id === selectedSize)
  const frameObj = product.frames?.find((f) => f.id === selectedFrame)
  const totalPrice = (sizeObj?.price ?? product.price) + (frameObj?.price ?? 0)

  const handleAddToCart = () => {
    addItem(product, {
      size: selectedSize,
      color: selectedColor,
      frame: selectedFrame,
    })
    setAdded(true)
    openCart()
    setTimeout(() => setAdded(false), 2000)
  }

  // Related: same section, different product
  const related = products
    .filter((p) => p.section === product.section && p.id !== product.id)
    .slice(0, 4)

  return (
    <div className="min-h-screen pt-16">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors tracking-widest uppercase"
        >
          <ArrowLeft size={12} />
          Back
        </button>
      </div>

      {/* Main product layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* ── Images ── */}
          <div className="space-y-3">
            {/* Main image */}
            <div className="aspect-[4/5] bg-surface-2 overflow-hidden">
              <img
                src={product.images?.[activeImage] ?? product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Thumbnails */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      'w-20 h-20 overflow-hidden border-2 transition-all duration-200 flex-shrink-0',
                      i === activeImage ? 'border-cream' : 'border-border hover:border-border-light'
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div className="lg:pt-4">
            {/* Movement + section tag */}
            <div className="flex items-center gap-3 mb-4">
              <span className="section-label text-accent">{slugToTitle(product.movement)}</span>
              <span className="text-text-muted">·</span>
              <span className="section-label text-text-muted">
                {isArt ? 'Fine Art Print' : 'Wearable Art'}
              </span>
            </div>

            {/* Name */}
            <h1 className="font-display text-3xl lg:text-5xl text-cream leading-tight mb-2">
              {product.name}
            </h1>
            {product.subtitle && (
              <p className="text-text-secondary text-lg italic font-display mb-6">
                {product.subtitle}
              </p>
            )}

            {/* Price */}
            <p className="text-2xl font-semibold text-text-primary mb-8">
              {formatPrice(totalPrice)}
              {selectedFrame && selectedFrame !== 'none' && (
                <span className="text-sm text-text-muted font-normal ml-2">
                  (incl. frame)
                </span>
              )}
            </p>

            {/* ── Variant selectors ── */}
            <div className="space-y-6 mb-8">
              {/* Size */}
              {product.sizes && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold tracking-widest uppercase text-text-primary">
                      {isArt ? 'Size' : 'Size'}
                    </p>
                    {sizeObj && (
                      <p className="text-xs text-text-muted">
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
                          selectedSize === s.id
                            ? 'border-cream text-cream bg-cream/5'
                            : 'border-border text-text-secondary hover:border-border-light'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color (streetwear) */}
              {product.colors && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold tracking-widest uppercase text-text-primary">Color</p>
                    {selectedColor && (
                      <p className="text-xs text-text-muted capitalize">
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
                          selectedColor === c.id ? 'border-cream scale-110' : 'border-border hover:border-border-light'
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Frame (art prints) */}
              {product.frames && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold tracking-widest uppercase text-text-primary">Frame</p>
                    {frameObj && frameObj.price > 0 && (
                      <p className="text-xs text-text-muted">+{formatPrice(frameObj.price)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.frames.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFrame(f.id)}
                        className={cn(
                          'px-4 py-2.5 text-xs font-medium tracking-widest uppercase border transition-all duration-200',
                          selectedFrame === f.id
                            ? 'border-cream text-cream bg-cream/5'
                            : 'border-border text-text-secondary hover:border-border-light'
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
                added
                  ? 'bg-success text-white'
                  : 'bg-cream text-black hover:bg-accent hover:scale-[1.01] active:scale-[0.99]',
                !selectedSize && 'opacity-50 cursor-not-allowed'
              )}
            >
              {added ? (
                <>
                  <Check size={16} />
                  Added to Cart
                </>
              ) : (
                <>
                  Add to Cart · {formatPrice(totalPrice)}
                </>
              )}
            </button>

            {/* Details accordions */}
            <div className="mt-8">
              <Accordion title="About this work">
                <p className="text-text-secondary leading-relaxed">{product.description}</p>
              </Accordion>
              <Accordion title="Details & Materials">
                <ul className="space-y-2">
                  {product.details?.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-accent flex-shrink-0 mt-0.5">—</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </Accordion>
              <Accordion title="Shipping & Fulfillment">
                <div className="space-y-3 text-text-secondary">
                  <p>
                    Fulfilled by{' '}
                    <span className="text-text-primary">Gelato</span> — the world's largest
                    print-on-demand network with 130+ local print partners worldwide.
                  </p>
                  <p>
                    Orders are printed and shipped from the facility nearest to you, minimizing
                    transit time and carbon footprint. Typical production time is 2–4 business days.
                  </p>
                  <p>Shipping times vary by location. Free shipping on orders over $100.</p>
                </div>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="flex items-center justify-between mb-10">
              <h2 className="font-display text-2xl text-cream">You May Also Like</h2>
              <Link
                to={`/shop?section=${product.section}`}
                className="text-xs text-text-secondary hover:text-cream transition-colors tracking-widest uppercase flex items-center gap-2"
              >
                View All <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
