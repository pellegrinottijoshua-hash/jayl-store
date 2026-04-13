import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { products, MOVEMENTS } from '@/data/products'
import ProductCard from '@/components/product/ProductCard'
import { slugToTitle, cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'

const SECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'art', label: 'Art Prints' },
  { id: 'objects', label: 'Objects' },
]

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { setPageTheme } = useThemeStore()

  const activeSection = searchParams.get('section') || 'all'
  const activeMovement = searchParams.get('movement') || 'all'

  // Objects section → dark theme; Art / All → light
  const isLight = activeSection !== 'objects'

  useEffect(() => {
    setPageTheme(isLight ? 'light' : 'dark')
  }, [isLight, setPageTheme])

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

  // Theme-aware class sets
  const t = isLight
    ? {
        page: 'bg-white',
        heading: 'text-ink',
        label: 'section-label-light',
        stickyBar: 'bg-white/95 backdrop-blur-md border-b border-paper-border',
        activeTab: 'border-ink text-ink',
        inactiveTab: 'border-transparent text-ink-muted hover:text-ink',
        count: 'text-ink-muted',
        filterToggleActive: 'text-ink',
        filterToggleInactive: 'text-ink-muted hover:text-ink',
        filterBorder: 'border-t border-paper-border',
        filterActive: 'border-ink text-ink',
        filterInactive: 'border-paper-border text-ink-muted hover:border-ink-muted',
        empty: 'text-ink-secondary',
        badge: 'bg-ink text-white',
        clearBtn: 'text-ink-muted hover:text-ink',
      }
    : {
        page: 'bg-off-black text-text-primary',
        heading: 'text-cream',
        label: 'section-label',
        stickyBar: 'bg-off-black/95 backdrop-blur-md border-b border-border',
        activeTab: 'border-cream text-cream',
        inactiveTab: 'border-transparent text-text-secondary hover:text-text-primary',
        count: 'text-text-muted',
        filterToggleActive: 'text-cream',
        filterToggleInactive: 'text-text-secondary hover:text-text-primary',
        filterBorder: 'border-t border-border',
        filterActive: 'border-cream text-cream',
        filterInactive: 'border-border text-text-secondary hover:border-border-light',
        empty: 'text-text-secondary',
        badge: 'bg-accent text-black',
        clearBtn: 'text-text-muted hover:text-text-primary',
      }

  const headerBorderClass = isLight ? 'border-b border-paper-border' : 'border-b border-border'

  return (
    <div className={cn('min-h-screen pt-16 transition-colors duration-300', t.page)}>
      {/* Page header */}
      <div className={headerBorderClass}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <p className={cn(t.label, 'mb-3')}>The Store</p>
          <h1 className={cn('font-display text-4xl lg:text-6xl', t.heading)}>Shop</h1>
        </div>
      </div>

      {/* Controls bar */}
      <div className={cn('sticky top-16 z-30', t.stickyBar)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-14">
            {/* Section tabs */}
            <div className="flex items-center gap-0 overflow-x-auto">
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter('section', id)}
                  className={cn(
                    'px-4 py-2 text-xs font-medium tracking-widest uppercase whitespace-nowrap transition-colors duration-200 border-b-2',
                    activeSection === id ? t.activeTab : t.inactiveTab
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <span className={cn('text-xs hidden sm:block', t.count)}>
                {filtered.length} work{filtered.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={cn(
                  'flex items-center gap-2 text-xs font-medium tracking-widest uppercase transition-colors duration-200',
                  filtersOpen || activeFilterCount > 0 ? t.filterToggleActive : t.filterToggleInactive
                )}
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className={cn('w-4 h-4 text-2xs font-bold rounded-full flex items-center justify-center', t.badge)}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className={cn('py-4 flex flex-wrap gap-6', t.filterBorder)}>
              {(activeSection === 'all' || activeSection === 'art') && (
                <div>
                  <p className={cn(t.label, 'mb-2')}>Movement</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilter('movement', 'all')}
                      className={cn(
                        'text-xs px-3 py-1.5 border tracking-widest uppercase transition-all duration-200',
                        activeMovement === 'all' ? t.filterActive : t.filterInactive
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
                          activeMovement === m ? t.filterActive : t.filterInactive
                        )}
                      >
                        {slugToTitle(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setSearchParams({}); setFiltersOpen(false) }}
                  className={cn('flex items-center gap-1.5 text-xs transition-colors self-end', t.clearBtn)}
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
            <p className={t.empty}>No works match your filters.</p>
            <button
              onClick={() => setSearchParams({})}
              className={cn('mt-6 inline-flex', isLight ? 'btn-ghost-light' : 'btn-ghost')}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                light={isLight || product.section === 'art'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
