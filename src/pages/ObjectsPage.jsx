import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { products } from '@/data/products'
import { formatPrice } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'

const objectsProducts = products.filter((p) => p.section === 'objects')

const collections = objectsProducts.reduce((acc, p) => {
  const name = p.collection || 'Other'
  const existing = acc.find((c) => c.name === name)
  if (existing) existing.items.push(p)
  else acc.push({ name, items: [p] })
  return acc
}, [])

export default function ObjectsPage() {
  const { setPageTheme, setActiveSection } = useThemeStore()

  useEffect(() => {
    setPageTheme('dark')
    setActiveSection('objects')
    document.body.style.overflow = ''
  }, [setPageTheme, setActiveSection])

  return (
    <div className="min-h-screen w-screen bg-off-black pt-[84px]">
      {collections.map(({ name, items }) => (
        <section key={name} className="mb-4 last:mb-0">
          {/* Collection label */}
          <div className="px-6 sm:px-10 pt-10 pb-4">
            <p className="section-label">{name}</p>
            <div className="mt-3 h-px bg-border" />
          </div>

          {/* Horizontal scroll row */}
          <div
            className="flex gap-3 px-6 sm:px-10 pb-8 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {items.map((product, i) => (
              <Link
                key={product.id}
                to={`/product/${product.slug}`}
                className={[
                  'flex-shrink-0 group',
                  i === 0
                    ? 'w-[calc(100vw-3rem)] sm:w-[55vw] lg:w-[42vw]'
                    : 'w-[72vw] sm:w-[38vw] lg:w-[28vw]',
                ].join(' ')}
              >
                <div
                  className="w-full overflow-hidden bg-surface"
                  style={{ aspectRatio: '1 / 1' }}
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <div className="mt-3">
                  <h3 className="font-display text-base sm:text-lg text-cream leading-tight mb-1">
                    {product.name}
                  </h3>
                  <p className="text-sm text-text-muted">from {formatPrice(product.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <div className="h-12" />
    </div>
  )
}
