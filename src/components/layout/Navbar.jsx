import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ShoppingBag, Menu, X } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { items, toggleCart } = useCartStore()
  const location = useLocation()

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const navLinks = [
    { to: '/shop', label: 'Shop' },
    { to: '/shop?section=art', label: 'Art' },
    { to: '/shop?section=streetwear', label: 'Streetwear' },
  ]

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-off-black/95 backdrop-blur-md border-b border-border'
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="font-display text-2xl font-bold tracking-widest text-cream hover:text-accent transition-colors duration-200"
            >
              JAYL
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'text-xs font-medium tracking-ultra uppercase transition-colors duration-200',
                      isActive
                        ? 'text-cream'
                        : 'text-text-secondary hover:text-text-primary'
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Cart */}
              <button
                onClick={toggleCart}
                className="relative btn-icon"
                aria-label={`Open cart, ${itemCount} items`}
              >
                <ShoppingBag size={18} />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-black text-2xs font-bold rounded-full flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden btn-icon ml-1"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden transition-all duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />

        {/* Menu panel */}
        <div
          className={cn(
            'absolute top-16 left-0 right-0 bg-off-black border-b border-border px-6 py-8 transition-transform duration-300',
            mobileOpen ? 'translate-y-0' : '-translate-y-4'
          )}
        >
          <nav className="flex flex-col gap-6">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'text-lg font-medium tracking-widest uppercase transition-colors duration-200',
                    isActive ? 'text-cream' : 'text-text-secondary'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}
