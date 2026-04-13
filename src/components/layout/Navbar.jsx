import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, Menu, X, Sun, Moon } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { items, toggleCart } = useCartStore()
  const { pageTheme, mode, setMode } = useThemeStore()
  const location = useLocation()
  const navigate = useNavigate()

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const isLight = pageTheme === 'light'
  // Homepage has black video hero — use light text when not scrolled regardless of pageTheme
  const onHomepage = location.pathname === '/'
  const useCreameText = !scrolled && (onHomepage || !isLight)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const navLinks = [
    { to: '/shop', label: 'Shop' },
    { to: '/shop?section=art', label: 'Art' },
    { to: '/shop?section=objects', label: 'Objects' },
    { to: '/artist', label: 'Artist' },
  ]

  const toggleMode = () => {
    const next = mode === 'art' ? 'objects' : 'art'
    setMode(next)
    navigate(next === 'art' ? '/shop?section=art' : '/shop?section=objects')
  }

  // Nav bg
  const navBg = scrolled
    ? isLight
      ? 'bg-white/95 backdrop-blur-md border-b border-paper-border'
      : 'bg-off-black/95 backdrop-blur-md border-b border-border'
    : 'bg-transparent'

  // Text colors — light/dark based on bg context
  const logoColor = useCreameText ? 'text-cream hover:text-accent' : 'text-ink hover:text-ink-secondary'
  const linkColor = (active) =>
    useCreameText
      ? active ? 'text-cream' : 'text-cream/50 hover:text-cream'
      : active ? 'text-ink' : 'text-ink-muted hover:text-ink'
  const iconColor = useCreameText
    ? 'border-cream/20 text-cream/70 hover:border-cream hover:text-cream'
    : 'border-paper-border text-ink-muted hover:border-ink hover:text-ink'
  const modeColor = useCreameText ? 'text-cream/50 hover:text-cream' : 'text-ink-muted hover:text-ink'

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          navBg
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className={cn(
                'font-display text-2xl font-bold tracking-widest transition-colors duration-200',
                logoColor
              )}
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
                      linkColor(isActive)
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <button
                onClick={toggleMode}
                className={cn(
                  'hidden md:inline-flex items-center justify-center w-10 h-10 transition-all duration-200 border',
                  iconColor
                )}
                aria-label={mode === 'art' ? 'Switch to Objects mode' : 'Switch to Art mode'}
                title={mode === 'art' ? 'Objects mode' : 'Art mode'}
              >
                {mode === 'art' ? <Moon size={14} /> : <Sun size={14} />}
              </button>

              {/* Cart */}
              <button
                onClick={toggleCart}
                className={cn(
                  'relative inline-flex items-center justify-center w-10 h-10 border transition-all duration-200',
                  iconColor
                )}
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
                className={cn(
                  'md:hidden inline-flex items-center justify-center w-10 h-10 border transition-all duration-200 ml-1',
                  iconColor
                )}
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
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />

        <div
          className={cn(
            'absolute top-16 left-0 right-0 border-b px-6 py-8 transition-transform duration-300',
            isLight
              ? 'bg-white border-paper-border'
              : 'bg-off-black border-border',
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
                    isLight
                      ? isActive ? 'text-ink' : 'text-ink-muted'
                      : isActive ? 'text-cream' : 'text-text-secondary'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
            <button
              onClick={() => { toggleMode(); setMobileOpen(false) }}
              className={cn(
                'flex items-center gap-2 text-sm tracking-widest uppercase',
                isLight ? 'text-ink-muted' : 'text-text-muted'
              )}
            >
              {mode === 'art' ? <Moon size={14} /> : <Sun size={14} />}
              {mode === 'art' ? 'Objects mode' : 'Art mode'}
            </button>
          </nav>
        </div>
      </div>
    </>
  )
}
