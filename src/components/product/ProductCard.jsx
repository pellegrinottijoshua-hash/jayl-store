import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function ProductCard({ product, className }) {
  const defaultSize = product.sizes?.[Math.floor(product.sizes.length / 2)]
  const defaultColor = product.colors?.[0]

  const displayPrice = defaultSize?.price ?? product.price

  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        'group block bg-surface border border-border card-hover relative overflow-hidden',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500" />

        {/* Quick-add hint */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <span className="flex items-center gap-1.5 bg-cream text-black text-2xs font-bold tracking-widest uppercase px-3 py-2">
            <Plus size={10} />
            View
          </span>
        </div>

        {/* Section badge */}
        <div className="absolute top-3 left-3">
          <span className="section-label bg-black/60 backdrop-blur-sm px-2 py-1 text-text-muted">
            {product.section === 'art' ? 'Print' : 'Wearable'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-text-muted mb-1 tracking-widest uppercase">
              {slugToTitle(product.movement)}
            </p>
            <h3 className="text-sm font-semibold text-text-primary leading-snug group-hover:text-cream transition-colors duration-200">
              {product.name}
            </h3>
            {product.subtitle && (
              <p className="text-xs text-text-muted mt-0.5">{product.subtitle}</p>
            )}
          </div>
          <span className="text-sm font-semibold text-text-primary flex-shrink-0">
            {formatPrice(displayPrice)}
          </span>
        </div>
      </div>
    </Link>
  )
}
