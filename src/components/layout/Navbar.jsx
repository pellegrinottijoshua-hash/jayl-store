import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingBag, Menu, X, Heart } from 'lucide-react'
import { useWishlistStore } from '@/store/wishlistStore'
import { useCartStore } from '@/store/cartStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'
import { SOCIAL_LINKS } from '@/data/social-links'
// Logo: uses PNG files /public/logo-light.svg (dark logo, light bg) and /public/logo-dark.svg (light logo, dark bg)
// Place your logo PNG files in /public/ with those names.
function JaylLogoPng({ isLight, height = 16 }) {
  const src = isLight ? '/logo-light.svg' : '/logo-dark.svg'
  return (
    <img
      src={src}
      alt="JAYL"
      height={height}
      style={{ height, width: 'auto', display: 'block' }}
      onError={e => { e.currentTarget.style.display = 'none' }}
    />
  )
}

// ── Social icons (inline SVG, 16×16 viewBox) ─────────────────────────────────
function InstagramIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4.5"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function TikTokIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.74a4.85 4.85 0 01-1.01-.05z"/>
    </svg>
  )
}
function PinterestIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.43 7.63 11.18-.1-.95-.2-2.4.04-3.44.22-.92 1.46-6.18 1.46-6.18s-.37-.75-.37-1.85c0-1.74 1.01-3.03 2.26-3.03 1.07 0 1.58.8 1.58 1.76 0 1.07-.68 2.67-1.04 4.16-.3 1.24.62 2.25 1.84 2.25 2.2 0 3.9-2.32 3.9-5.67 0-2.96-2.13-5.03-5.17-5.03-3.52 0-5.59 2.64-5.59 5.37 0 1.06.41 2.2.92 2.82a.37.37 0 01.09.35c-.09.39-.3 1.24-.34 1.41-.05.23-.18.27-.4.16-1.5-.7-2.43-2.88-2.43-4.64 0-3.77 2.74-7.24 7.9-7.24 4.15 0 7.37 2.96 7.37 6.9 0 4.12-2.6 7.43-6.2 7.43-1.21 0-2.35-.63-2.74-1.37l-.75 2.79c-.27 1.04-1 2.35-1.49 3.15.93.28 1.9.44 2.92.44 6.63 0 12-5.37 12-12S18.63 0 12 0z"/>
    </svg>
  )
}

const SOCIAL_ICONS = [
  { key: 'instagram', Icon: InstagramIcon, label: 'Instagram' },
  { key: 'tiktok',    Icon: TikTokIcon,    label: 'TikTok'    },
  { key: 'pinterest', Icon: PinterestIcon, label: 'Pinterest' },
]

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
  // HIDDEN - re-enable for Art launch
  // { id: 'art',    label: 'art',    to: '/art' },
  { id: 'objects',label: 'objects',to: '/objects' },
  { id: 'artist', label: null,     to: '/artist' },  // uses FallingS render
]

const ART_DROPDOWN = [
  { label: 'All Art Prints',           to: '/art',                                    divider: true },
  { label: 'Expressionist Landscapes', to: '/collection/expressionist-landscapes' },
  { label: 'Urban Movements',          to: '/collection/urban-movements' },
]

const OBJECTS_DROPDOWN = [
  { label: 'All Objects',   to: '/objects',                 divider: true },
  { label: 'Cool Pokémon',  to: '/collection/cool-pok-mon' },
]

export default function Navbar() {
  const { items, toggleCart } = useCartStore()
  const { pageTheme, activeSection } = useThemeStore()

  useLocation() // trigger re-render on navigation

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredNav, setHoveredNav]         = useState(null)
  const closeTimer = useRef(null)

  const itemCount    = items.reduce((s, i) => s + i.quantity, 0)
  const wishlistIds  = useWishlistStore(s => s.ids)
  const isLight      = pageTheme === 'light'

  useEffect(() => {
    if (mobileMenuOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMobileMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
          <p className="font-sans font-light text-[9px] uppercase select-none" style={{ letterSpacing: '0.20em' }}>
            Free worldwide shipping on all orders
          </p>
        </div>

        {/* Navbar row */}
        <div className="h-14 flex items-center justify-between px-5 sm:px-8">

          {/* ── Left: JAYL logo ───────────────────────────────────────── */}
          <div className="w-24 sm:w-36 pointer-events-auto">
            <Link to="/" aria-label="JAYL — Home">
              <JaylLogoPng isLight={isLight} height={40} />
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
                      'font-sans transition-all duration-300 leading-none',
                      active
                        ? cn('font-normal text-xs sm:text-sm', textBase)
                        : cn('font-light text-xs sm:text-xs', textMuted)
                    )}
                    style={{
                      letterSpacing: '0.12em',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--jayl-gold)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = '' }}
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
                      <p className={cn('font-sans font-light text-[9px] uppercase mb-4', dropMuted)} style={{ letterSpacing: '0.20em' }}>
                        {dropLabel}
                      </p>
                      {/* Gold separator under label */}
                      <div className="h-px mb-4" style={{ background: 'var(--jayl-gold)', opacity: 0.3 }} />
                      <ul className="space-y-3">
                        {dropItems.map((d, idx) => (
                          <li key={d.to}>
                            {idx > 0 && dropItems[idx - 1].divider && (
                              <div className={cn('h-px mb-3', isLight ? 'bg-paper-border' : 'bg-border')} />
                            )}
                            <Link
                              to={d.to}
                              className={cn(
                                'block font-sans text-xs transition-colors duration-150',
                                d.divider ? 'font-normal' : 'font-light',
                                dropText
                              )}
                              style={{ letterSpacing: '0.06em' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--jayl-gold)' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '' }}
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

          {/* ── Right: social icons (desktop) + cart + hamburger ────────── */}
          <div className="w-24 sm:w-36 flex justify-end items-center gap-4 pointer-events-auto">

            {/* Social icons — hidden on mobile, shown on sm+ only if link is set */}
            <div className="hidden sm:flex items-center gap-3">
              {SOCIAL_ICONS.map(({ key, Icon, label }) =>
                SOCIAL_LINKS[key] ? (
                  <a
                    key={key}
                    href={SOCIAL_LINKS[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={cn('transition-opacity duration-200 hover:opacity-60', textMuted)}
                  >
                    <Icon size={15} />
                  </a>
                ) : null
              )}
            </div>

            {/* Wishlist icon — desktop */}
            <Link
              to="/wishlist"
              className={cn('relative transition-colors duration-500 hidden sm:block', textBase)}
              aria-label={`Wishlist — ${wishlistIds.length} item${wishlistIds.length !== 1 ? 's' : ''}`}
            >
              <Heart size={17} strokeWidth={1.5} fill={wishlistIds.length > 0 ? 'currentColor' : 'none'} />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-2xs font-bold rounded-full flex items-center justify-center leading-none">
                  {wishlistIds.length > 9 ? '9+' : wishlistIds.length}
                </span>
              )}
            </Link>

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
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-black text-2xs font-bold rounded-full flex items-center justify-center leading-none" style={{ backgroundColor: 'var(--jayl-gold)' }}>
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
          <Link to="/" onClick={() => setMobileMenuOpen(false)} aria-label="JAYL — Home">
            <JaylLogoPng isLight={isLight} height={32} />
          </Link>
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
            // HIDDEN - re-enable for Art launch
            // { id: 'art',    label: 'art',     to: '/art' },
            { id: 'objects',label: 'objects',  to: '/objects' },
            { id: 'artist', label: null,       to: '/artist' },
          ].map(({ id, label, to }) => (
            <Link
              key={id}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'font-display font-light tracking-wide transition-colors',
                isLight ? 'text-ink' : 'text-cream'
              )}
              style={{ fontSize: 'clamp(2.5rem, 10vw, 4rem)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--jayl-gold)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '' }}
            >
              {id === 'artist' ? <>artist'<FallingS /></> : label}
            </Link>
          ))}

          {/* Wishlist link */}
          <Link
            to="/wishlist"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 font-display text-2xl font-light tracking-wide transition-opacity hover:opacity-60',
              isLight ? 'text-ink' : 'text-cream'
            )}
          >
            <Heart size={20} fill={wishlistIds.length > 0 ? 'currentColor' : 'none'} className={wishlistIds.length > 0 ? 'text-red-400' : ''} />
            Wishlist
            {wishlistIds.length > 0 && (
              <span className="text-sm text-red-400">({wishlistIds.length})</span>
            )}
          </Link>
        </nav>

        {/* Social icons — mobile menu footer */}
        {SOCIAL_ICONS.some(({ key }) => SOCIAL_LINKS[key]) && (
          <div className="flex items-center gap-6 px-8 pb-10">
            {SOCIAL_ICONS.map(({ key, Icon, label }) =>
              SOCIAL_LINKS[key] ? (
                <a
                  key={key}
                  href={SOCIAL_LINKS[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn('transition-opacity hover:opacity-60', isLight ? 'text-ink-muted' : 'text-cream/50')}
                >
                  <Icon size={20} />
                </a>
              ) : null
            )}
          </div>
        )}
      </div>
    </>
  )
}
