import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function ProductCard({ product, className, light = false }) {
  const defaultSize = product.sizes?.[Math.floor(product.sizes.length / 2)]
  const displayPrice = defaultSize?.price ?? product.price

  const sectionLabel = product.section === 'art' ? 'Print' : 'Object'

  return (
    <Link
      to={`/product/${product.id}`}
      className={cn(
        'group block relative overflow-hidden transition-all duration-500',
        light
          ? 'bg-white border border-paper-border hover:border-ink-muted'
          : 'bg-surface border border-border hover:border-border-light',
        className
      )}
    >
      {/* Image */}
      <div
        className={cn(
          'relative aspect-[3/4] overflow-hidden',
          light ? 'bg-paper' : 'bg-surface-2'
        )}
      >
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-500" />

        {/* Quick-view hint */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <span
            className={cn(
              'flex items-center gap-1.5 text-2xs font-bold tracking-widest uppercase px-3 py-2',
              light ? 'bg-ink text-white' : 'bg-cream text-black'
            )}
          >
            <Plus size={10} />
            View
          </span>
        </div>

        {/* Section badge */}
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              'text-2xs font-mono tracking-ultra uppercase px-2 py-1',
              light
                ? 'bg-white/80 text-ink-muted'
                : 'bg-black/60 backdrop-blur-sm text-text-muted'
            )}
          >
            {sectionLabel}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-xs mb-1 tracking-widest uppercase font-mono',
                light ? 'text-ink-muted' : 'text-text-muted'
              )}
            >
              {slugToTitle(product.movement)}
            </p>
            <h3
              className={cn(
                'text-sm font-semibold leading-snug transition-colors duration-200',
                light
                  ? 'text-ink group-hover:text-ink-secondary'
                  : 'text-text-primary group-hover:text-cream'
              )}
            >
              {product.name}
            </h3>
            {product.subtitle && (
              <p className={cn('text-xs mt-0.5', light ? 'text-ink-muted' : 'text-text-muted')}>
                {product.subtitle}
              </p>
            )}
          </div>
          <span
            className={cn(
              'text-sm font-semibold flex-shrink-0',
              light ? 'text-ink' : 'text-text-primary'
            )}
          >
            {formatPrice(displayPrice)}
          </span>
        </div>
      </div>
    </Link>
  )
}
