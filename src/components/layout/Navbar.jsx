import { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag, Menu, X } from 'lucide-react'
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

const ART_DROPDOWN = [
  { label: 'Impressionism', to: '/art?movement=impressionism' },
  { label: 'Surrealism',    to: '/art?movement=surrealism' },
  { label: 'Cubism',        to: '/art?movement=cubism' },
  { label: 'Expressionism', to: '/art?movement=expressionism' },
  { label: 'Art Nouveau',   to: '/art?movement=art-nouveau' },
  { label: 'Bauhaus',       to: '/art?movement=bauhaus' },
]

const OBJECTS_DROPDOWN = [
  { label: 'T-Shirts',  to: '/objects?type=tee' },
  { label: 'Hoodies',   to: '/objects?type=hoodie' },
  { label: 'Mugs',      to: '/objects?type=mug' },
  { label: 'Tote Bags', to: '/objects?type=tote' },
]

export default function Navbar() {
  const { items, toggleCart } = useCartStore()
  const { pageTheme, activeSection } = useThemeStore()

  useLocation() // trigger re-render on navigation

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredNav, setHoveredNav]         = useState(null)
  const closeTimer = useRef(null)

  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  const isLight   = pageTheme === 'light'

  // Text colours adapt to whatever page is behind the transparent nav
  const textBase  = isLight ? 'text-ink'       : 'text-cream'
  const textMuted = isLight ? 'text-ink-muted'  : 'text-white/40'
  const pipeFade  = isLight ? 'text-ink-muted/30' : 'text-white/15'

  // Dropdown panel colours
  const dropBg    = isLight ? 'bg-paper border-paper-border' : 'bg-surface border-border'
  const dropText  = isLight ? 'text-ink'                      : 'text-cream'
  const dropMuted = isLight ? 'text-ink-muted'                : 'text-cream-muted'

  // Hover helpers — small delay prevents dropdown closing when moving mouse to it
  const openDropdown = (id) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setHoveredNav(id)
  }
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setHoveredNav(null), 120)
  }
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  return (
    <>
      {/* ── Fixed header: announcement bar + navbar ───────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">

        {/* Announcement bar */}
        <div
          className={cn(
            'w-full h-7 flex items-center justify-center pointer-events-auto transition-colors duration-500',
            isLight
              ? 'bg-paper-2 text-ink-muted'
              : 'bg-surface text-cream-muted'
          )}
        >
          <p className="text-[10px] tracking-[0.18em] font-sans uppercase select-none">
            Free worldwide shipping on all orders
          </p>
        </div>

        {/* Navbar row */}
        <div className="h-14 flex items-center justify-between px-5 sm:px-8">

          {/* ── Left: JAYL logo ───────────────────────────────────────── */}
          <div className="w-14 sm:w-20 pointer-events-auto">
            <Link
              to="/"
              className={cn(
                'font-display text-xl font-bold tracking-widest transition-colors duration-500',
                textBase
              )}
            >
              JAYL
            </Link>
          </div>

          {/* ── Center: section links ─────────────────────────────────── */}
          <nav className="flex items-baseline gap-0 pointer-events-auto" aria-label="Sections">
            {NAV_ITEMS.map((item, i) => {
              const active       = activeSection === item.id
              const hasDropdown  = item.id === 'art' || item.id === 'objects'
              const dropItems    = item.id === 'art' ? ART_DROPDOWN : OBJECTS_DROPDOWN
              const dropLabel    = item.id === 'art' ? 'Collections' : 'Shop by type'
              const isOpen       = hoveredNav === item.id

              return (
                <span
                  key={item.id}
                  className="flex items-baseline relative"
                  onMouseEnter={() => hasDropdown && openDropdown(item.id)}
                  onMouseLeave={() => hasDropdown && scheduleClose()}
                >
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

                  {/* Desktop mega-menu dropdown */}
                  {hasDropdown && (
                    <div
                      className={cn(
                        'absolute top-full left-1/2 -translate-x-1/2 mt-3',
                        'hidden md:block',
                        'border min-w-[168px] py-5 px-5',
                        'transition-all duration-150',
                        dropBg,
                        isOpen
                          ? 'opacity-100 translate-y-0 pointer-events-auto'
                          : 'opacity-0 -translate-y-1 pointer-events-none'
                      )}
                      onMouseEnter={cancelClose}
                      onMouseLeave={scheduleClose}
                    >
                      <p className={cn('text-[9px] tracking-[0.22em] uppercase font-medium mb-3', dropMuted)}>
                        {dropLabel}
                      </p>
                      <ul className="space-y-2.5">
                        {dropItems.map((d) => (
                          <li key={d.to}>
                            <Link
                              to={d.to}
                              className={cn(
                                'block text-sm font-light tracking-wide transition-opacity duration-150 hover:opacity-60',
                                dropText
                              )}
                              onClick={() => setHoveredNav(null)}
                            >
                              {d.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </span>
              )
            })}
          </nav>

          {/* ── Right: cart + hamburger ───────────────────────────────── */}
          <div className="w-14 sm:w-20 flex justify-end items-center gap-4 pointer-events-auto">
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

            {/* Hamburger — mobile only */}
            <button
              className={cn(
                'md:hidden transition-colors duration-500',
                textBase
              )}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
          </div>

        </div>
      </header>

      {/* ── Mobile full-screen menu overlay ──────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-[60] flex flex-col transition-opacity duration-300 md:hidden',
          isLight ? 'bg-paper' : 'bg-off-black',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Close row */}
        <div className="flex items-center justify-between px-5 pt-5 h-14">
          <span
            className={cn(
              'font-display text-xl font-bold tracking-widest',
              isLight ? 'text-ink' : 'text-cream'
            )}
          >
            JAYL
          </span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'transition-colors duration-200',
              isLight ? 'text-ink' : 'text-cream'
            )}
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Large serif links */}
        <nav className="flex-1 flex flex-col items-start justify-center px-8 gap-8">
          {[
            { id: 'art',    label: 'art',     to: '/art' },
            { id: 'objects',label: 'objects',  to: '/objects' },
            { id: 'artist', label: null,       to: '/artist' },
          ].map(({ id, label, to }) => (
            <Link
              key={id}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'font-display text-5xl font-light tracking-wide transition-opacity hover:opacity-60',
                isLight ? 'text-ink' : 'text-cream'
              )}
            >
              {id === 'artist' ? <>artist'<FallingS /></> : label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
