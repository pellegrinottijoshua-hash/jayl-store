import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { products } from '@/data/products'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'

const artProducts = products.filter((p) => p.section === 'art')

const collections = artProducts.reduce((acc, p) => {
  const name = p.collection || 'Other'
  const existing = acc.find((c) => c.name === name)
  if (existing) existing.items.push(p)
  else acc.push({ name, items: [p] })
  return acc
}, [])

export default function ArtPage() {
  const { setPageTheme, setActiveSection } = useThemeStore()

  useEffect(() => {
    setPageTheme('light')
    setActiveSection('art')
    document.body.style.overflow = ''
    document.documentElement.style.setProperty('color-scheme', 'light')
    document.body.style.backgroundColor = '#f5f0e8'
    document.body.style.color = '#111111'
    return () => {
      document.documentElement.style.removeProperty('color-scheme')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [setPageTheme, setActiveSection])

  return (
    <div
      className="min-h-screen w-screen bg-paper pt-[84px]"
      style={{ colorScheme: 'light', backgroundColor: '#f5f0e8', color: '#111111' }}
    >
      {collections.map(({ name, items }) => (
        <section key={name} className="mb-4 last:mb-0">
          {/* Collection label */}
          <div className="px-6 sm:px-10 pt-10 pb-4">
            <p className="section-label-light">{name}</p>
            <div className="mt-3 h-px bg-paper-border" />
          </div>

          {/* Horizontal scroll row */}
          <div
            className="flex gap-3 px-6 sm:px-10 pb-8 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {items.map((product, i) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className={[
                  'flex-shrink-0 group',
                  i === 0
                    ? 'w-[calc(100vw-3rem)] sm:w-[55vw] lg:w-[42vw]'
                    : 'w-[72vw] sm:w-[38vw] lg:w-[28vw]',
                ].join(' ')}
              >
                <div
                  className="w-full overflow-hidden bg-paper-2"
                  style={{ aspectRatio: '3 / 4' }}
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
                  <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted mb-1">
                    {slugToTitle(product.movement)}
                  </p>
                  <h3 className="font-display text-base sm:text-lg text-ink leading-tight mb-1">
                    {product.name}
                  </h3>
                  <p className="text-sm text-ink-muted">from {formatPrice(product.price)}</p>
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
