import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useWishlistStore } from '@/store/wishlistStore'
import { getProductById } from '@/data/products'
import ProductCard from '@/components/product/ProductCard'
import { useThemeStore } from '@/store/themeStore'
import { useEffect } from 'react'

export default function WishlistPage() {
  const { ids } = useWishlistStore()
  const { setPageTheme } = useThemeStore()

  useEffect(() => { setPageTheme('dark') }, [setPageTheme])

  const products = ids.map(id => getProductById(id)).filter(Boolean)

  return (
    <div className="min-h-screen bg-off-black text-cream pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Heart size={20} className="text-red-400" fill="currentColor" />
          <h1 className="font-display text-3xl text-cream">Wishlist</h1>
          {products.length > 0 && (
            <span className="text-text-muted text-sm">— {products.length} item{products.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
            <Heart size={40} className="text-text-muted/30" />
            <p className="text-text-secondary text-lg">Your wishlist is empty.</p>
            <p className="text-text-muted text-sm">Tap the heart on any product to save it here.</p>
            <div className="flex gap-4 mt-2">
              <Link to="/art"     className="text-xs tracking-widest uppercase text-text-secondary hover:text-cream border border-border hover:border-border-light px-5 py-2.5 transition-colors">Browse Art</Link>
              <Link to="/objects" className="text-xs tracking-widest uppercase text-text-secondary hover:text-cream border border-border hover:border-border-light px-5 py-2.5 transition-colors">Browse Objects</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <ProductCard key={p.id} product={p} light={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
