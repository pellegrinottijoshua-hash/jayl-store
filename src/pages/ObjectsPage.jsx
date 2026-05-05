import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { products } from '@/data/products'
import { formatPrice } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'

const objectsProducts = products.filter((p) => p.section === 'objects')

const collectionNames = [...new Set(objectsProducts.map((p) => p.collection || 'Other'))]

const collectionSlug = (name) =>
  (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const collectionsByName = collectionNames.reduce((acc, name) => {
  acc[name] = objectsProducts.filter((p) => (p.collection || 'Other') === name)
  return acc
}, {})

export default function ObjectsPage() {
  const { setPageTheme, setActiveSection } = useThemeStore()
  const [activeCollection, setActiveCollection] = useState(null)
  const [sortBy, setSortBy]                     = useState('default')

  usePageMeta({
    title:       'Objects',
    description: 'Wearable art and objects — anime tees, hoodies, totes. Premium print quality, contemporary culture.',
  })

  useEffect(() => {
    setPageTheme('dark')
    setActiveSection('objects')
    document.body.style.overflow = ''
  }, [setPageTheme, setActiveSection])

  const isFiltered = activeCollection !== null || sortBy !== 'default'

  const filteredProducts = useMemo(() => {
    let list = activeCollection
      ? objectsProducts.filter((p) => (p.collection || 'Other') === activeCollection)
      : [...objectsProducts]
    if (sortBy === 'price-asc')  list = [...list].sort((a, b) => a.price - b.price)
    if (sortBy === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
    return list
  }, [activeCollection, sortBy])

  return (
    <div className="min-h-screen w-screen bg-off-black pt-[84px]">
      {/* ── Filter bar ───────────────────────────────────────────── */}
      <div className="sticky top-[84px] z-20 bg-off-black/95 backdrop-blur-sm border-b border-border px-6 sm:px-10 py-3 flex items-center gap-3 overflow-x-auto"
           style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setActiveCollection(null)}
          className={[
            'flex-shrink-0 text-2xs font-mono tracking-wider uppercase px-3 py-1.5 border transition-colors',
            activeCollection === null
              ? 'bg-cream text-black border-cream'
              : 'bg-transparent text-text-muted border-border hover:border-cream/60 hover:text-cream',
          ].join(' ')}
        >
          All
        </button>
        {collectionNames.map((name) => (
          <button
            key={name}
            onClick={() => setActiveCollection(activeCollection === name ? null : name)}
            className={[
              'flex-shrink-0 text-2xs font-mono tracking-wider uppercase px-3 py-1.5 border transition-colors',
              activeCollection === name
                ? 'bg-cream text-black border-cream'
                : 'bg-transparent text-text-muted border-border hover:border-cream/60 hover:text-cream',
            ].join(' ')}
          >
            {name}
          </button>
        ))}

        <div className="ml-auto flex-shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-2xs font-mono tracking-wider uppercase bg-transparent text-text-muted border border-border px-2 py-1.5 cursor-pointer focus:outline-none focus:border-cream/60"
          >
            <option value="default">Sort</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
        </div>
      </div>

      {isFiltered ? (
        /* ── Filtered grid view ──────────────────────────────────── */
        <div className="px-6 sm:px-10 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {filteredProducts.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`} className="group">
                <div
                  className="w-full overflow-hidden bg-surface mb-3"
                  style={{ aspectRatio: '1 / 1' }}
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <h3 className="font-display text-base text-cream leading-tight mb-1">{product.name}</h3>
                <p className="text-sm text-text-muted">from {formatPrice(product.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* ── Default horizontal-scroll by collection ─────────────── */
        collectionNames.map((name) => (
          <section key={name} className="mb-4 last:mb-0">
            <div className="px-6 sm:px-10 pt-10 pb-4">
              <Link
                to={`/collection/${collectionSlug(name)}`}
                className="section-label hover:opacity-70 transition-opacity"
              >
                {name}
              </Link>
              <div className="mt-3 h-px bg-border" />
            </div>
            <div
              className="flex gap-3 px-6 sm:px-10 pb-8 overflow-x-auto"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {collectionsByName[name].map((product, i) => (
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
                    className="w-full overflow-hidden bg-surface"
                    style={{ aspectRatio: '1 / 1' }}
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
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
        ))
      )}
      <div className="h-12" />
    </div>
  )
}
