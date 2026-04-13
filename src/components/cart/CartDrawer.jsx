import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, slugToTitle } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity } = useCartStore()
  const drawerRef = useRef(null)

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeCart() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCart])

  // Trap scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-surface border-l border-border flex flex-col transition-transform duration-400 ease-smooth',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary tracking-wide">Cart</h2>
            {items.length > 0 && (
              <p className="text-xs text-text-muted mt-0.5">
                {items.reduce((s, i) => s + i.quantity, 0)} item{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={closeCart}
            className="btn-icon"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ShoppingBag size={40} className="text-text-muted" />
              <div>
                <p className="text-text-secondary font-medium">Your cart is empty</p>
                <p className="text-text-muted text-sm mt-1">Add something beautiful.</p>
              </div>
              <button onClick={closeCart} className="btn-ghost text-sm mt-2">
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.variantKey} className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 flex-shrink-0 bg-surface-2 overflow-hidden">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-text-primary truncate">
                          {item.product.name}
                        </p>
                        <div className="flex flex-wrap gap-x-3 mt-1">
                          {item.size && (
                            <span className="text-xs text-text-muted">
                              {item.product.section === 'art'
                                ? item.product.sizes?.find((s) => s.id === item.size)?.label
                                : item.size?.toUpperCase()}
                            </span>
                          )}
                          {item.color && (
                            <span className="text-xs text-text-muted capitalize">{item.color}</span>
                          )}
                          {item.frame && item.frame !== 'none' && (
                            <span className="text-xs text-text-muted capitalize">
                              {slugToTitle(item.frame)} frame
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.variantKey)}
                        className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                        aria-label="Remove item"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Qty controls */}
                      <div className="flex items-center gap-2 border border-border">
                        <button
                          onClick={() => updateQuantity(item.variantKey, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-sm font-medium w-5 text-center text-text-primary">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variantKey, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <span className="text-sm font-semibold text-text-primary">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-6 border-t border-border space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Subtotal</span>
              <span className="font-semibold text-text-primary">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-xs text-text-muted">
              Shipping and taxes calculated at checkout.
            </p>
            <Link
              to="/checkout"
              onClick={closeCart}
              className="btn-primary w-full"
            >
              Checkout
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
