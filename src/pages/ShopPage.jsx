import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { products, MOVEMENTS } from '@/data/products'
import ProductCard from '@/components/product/ProductCard'
import { slugToTitle, cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'art', label: 'Art Prints' },
  { id: 'streetwear', label: 'Streetwear' },
]

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeSection = searchParams.get('section') || 'all'
  const activeMovement = searchParams.get('movement') || 'all'

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'all' || !value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    setSearchParams(next)
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeSection !== 'all' && p.section !== activeSection) return false
      if (activeMovement !== 'all' && p.movement !== activeMovement) return false
      return true
    })
  }, [activeSection, activeMovement])

  const activeFilterCount = [
    activeSection !== 'all',
    activeMovement !== 'all',
  ].filter(Boolean).length

  return (
    <div className="min-h-screen pt-16">
      {/* Page header */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <p className="section-label mb-3">The Store</p>
          <h1 className="font-display text-4xl lg:text-6xl text-cream">Shop</h1>
        </div>
      </div>

      {/* Controls bar */}
      <div className="sticky top-16 z-30 bg-off-black/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-14">
            {/* Section tabs */}
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter('section', id)}
                  className={cn(
                    'px-4 py-2 text-xs font-medium tracking-widest uppercase whitespace-nowrap transition-colors duration-200 border-b-2',
                    activeSection === id
                      ? 'border-cream text-cream'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Right: result count + filter toggle */}
            <div className="flex items-center gap-4">
              <span className="text-xs text-text-muted hidden sm:block">
                {filtered.length} work{filtered.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={cn(
                  'flex items-center gap-2 text-xs font-medium tracking-widest uppercase transition-colors duration-200',
                  filtersOpen || activeFilterCount > 0
                    ? 'text-cream'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 bg-accent text-black text-2xs font-bold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Expanded filters */}
          {filtersOpen && (
            <div className="py-4 border-t border-border flex flex-wrap gap-6">
              {/* Movement filter */}
              {(activeSection === 'all' || activeSection === 'art') && (
                <div>
                  <p className="section-label mb-2">Movement</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilter('movement', 'all')}
                      className={cn(
                        'text-xs px-3 py-1.5 border tracking-widest uppercase transition-all duration-200',
                        activeMovement === 'all'
                          ? 'border-cream text-cream'
                          : 'border-border text-text-secondary hover:border-border-light'
                      )}
                    >
                      All
                    </button>
                    {MOVEMENTS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setFilter('movement', m)}
                        className={cn(
                          'text-xs px-3 py-1.5 border tracking-widest uppercase transition-all duration-200',
                          activeMovement === m
                            ? 'border-cream text-cream'
                            : 'border-border text-text-secondary hover:border-border-light'
                        )}
                      >
                        {slugToTitle(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSearchParams({})
                    setFiltersOpen(false)
                  }}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors self-end"
                >
                  <X size={12} />
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Product grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filtered.length === 0 ? (
          <div className="py-40 text-center">
            <p className="text-text-secondary">No works match your filters.</p>
            <button
              onClick={() => setSearchParams({})}
              className="btn-ghost mt-6 inline-flex"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
