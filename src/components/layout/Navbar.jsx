import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

/** The 's' in "artist's" — smaller, dropped, slightly rotated clockwise */
function FallingS() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        fontSize: '0.68em',
        transform: 'rotate(14deg) translateY(0.18em)',
        transformOrigin: 'center bottom',
        opacity: 0.88,
        lineHeight: 1,
      }}
    >
      s
    </span>
  )
}

const NAV_ITEMS = [
  { id: 'art',    label: 'art',    to: '/art' },
  { id: 'objects',label: 'objects',to: '/objects' },
  { id: 'artist', label: null,     to: '/artist' },  // uses FallingS render
]

export default function Navbar() {
  const { items, toggleCart } = useCartStore()
  const { pageTheme, activeSection } = useThemeStore()

  const { pathname } = useLocation()
  const onHomepage = pathname === '/'

  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  const isLight = pageTheme === 'light'

  // Text colours adapt to whatever page is behind the transparent nav
  const textBase   = isLight ? 'text-ink'       : 'text-cream'
  const textMuted  = isLight ? 'text-ink-muted'  : 'text-white/40'
  const pipeFade   = isLight ? 'text-ink-muted/30' : 'text-white/15'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 pointer-events-none">
      <div className="flex items-center justify-between h-full px-5 sm:px-8">

        {/* ── Left: JAYL logo — visible only on homepage ───────────────── */}
        <div className="w-14 sm:w-20 pointer-events-auto">
          {onHomepage && (
            <Link
              to="/"
              className={cn(
                'font-display text-xl font-bold tracking-widest transition-colors duration-500',
                textBase
              )}
            >
              JAYL
            </Link>
          )}
        </div>

        {/* ── Center: section links ─────────────────────────────────────── */}
        <nav className="flex items-baseline gap-0 pointer-events-auto" aria-label="Sections">
          {NAV_ITEMS.map((item, i) => {
            const active = activeSection === item.id
            return (
              <span key={item.id} className="flex items-baseline">
                {i > 0 && (
                  <span
                    className={cn(
                      'mx-2 sm:mx-3 select-none text-xs transition-colors duration-500',
                      pipeFade
                    )}
                    aria-hidden
                  >
                    |
                  </span>
                )}
                <Link
                  to={item.to}
                  className={cn(
                    'font-sans tracking-wide transition-all duration-400 leading-none',
                    active
                      ? cn('font-semibold text-sm sm:text-base', textBase)
                      : cn('font-light text-xs sm:text-xs', textMuted, 'hover:opacity-80')
                  )}
                >
                  {item.id === 'artist' ? (
                    <>artist'<FallingS /></>
                  ) : (
                    item.label
                  )}
                </Link>
              </span>
            )
          })}
        </nav>

        {/* ── Right: cart ───────────────────────────────────────────────── */}
        <div className="w-14 sm:w-20 flex justify-end pointer-events-auto">
          <button
            onClick={toggleCart}
            className={cn(
              'relative transition-colors duration-500',
              textBase
            )}
            aria-label={`Cart — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
          >
            <ShoppingBag size={18} strokeWidth={1.5} />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-accent text-black text-2xs font-bold rounded-full flex items-center justify-center leading-none">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>
        </div>

      </div>
    </header>
  )
}
