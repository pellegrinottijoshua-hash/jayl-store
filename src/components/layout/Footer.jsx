import { Link } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'
function JaylLogoPng({ isLight, height = 12, style }) {
  const src = isLight ? '/logo-light.svg' : '/logo-dark.svg'
  return (
    <img src={src} alt="JAYL" height={height}
      style={{ height, width: 'auto', display: 'block', ...style }}
      onError={e => { e.currentTarget.style.display = 'none' }} />
  )
}

export default function Footer() {
  const { pageTheme } = useThemeStore()
  const isLight = pageTheme === 'light'

  const t = isLight
    ? {
        bg:      'bg-paper border-t border-paper-border',
        heading: 'font-sans font-light text-[9px] uppercase text-ink-muted',
        link:    'block font-sans font-light text-sm text-ink-secondary transition-colors duration-200',
        muted:   'font-sans font-light text-xs text-ink-muted',
        dividerClass: 'border-paper-border',
      }
    : {
        bg:      'bg-off-black border-t border-border',
        heading: 'font-sans font-light text-[9px] uppercase text-text-muted',
        link:    'block font-sans font-light text-sm text-text-secondary transition-colors duration-200',
        muted:   'font-sans font-light text-xs text-text-muted',
        dividerClass: 'border-border',
      }

  return (
    <footer className={t.bg}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Gold top rule */}
        <div className="mb-14" style={{ height: '1px', background: 'var(--jayl-gold)', opacity: 0.25 }} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

          {/* Shop */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')} style={{ letterSpacing: '0.18em' }}>Shop</h4>
            <ul className="space-y-3">
              {[
                { to: '/art',     label: 'Art Prints' },
                { to: '/objects', label: 'Objects' },
                { to: '/collection/expressionist-landscapes', label: 'Expressionist Landscapes' },
                { to: '/collection/urban-movements',          label: 'Urban Movements' },
                { to: '/collection/wearables',                label: 'Wearables' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={t.link}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--jayl-gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '' }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Discover */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')} style={{ letterSpacing: '0.18em' }}>Discover</h4>
            <ul className="space-y-3">
              {[
                { to: '/artist',   label: "Artist's" },
                { to: '/wishlist', label: 'Wishlist' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={t.link}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--jayl-gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '' }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')} style={{ letterSpacing: '0.18em' }}>Support</h4>
            <ul className="space-y-3">
              {[
                { to: '/contact',  label: 'Contact Us' },
                { to: '/shipping', label: 'Shipping Info' },
                { to: '/returns',  label: 'Returns' },
                { to: '/track',    label: 'Track Order' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={t.link}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--jayl-gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '' }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')} style={{ letterSpacing: '0.18em' }}>Legal</h4>
            <ul className="space-y-3">
              {[
                { to: '/terms',   label: 'Terms of Use' },
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/cookies', label: 'Cookie Policy' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={t.link}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--jayl-gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '' }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Gold bottom separator + logo + copyright + payoff */}
        <div className="mt-14">
          <div style={{ height: '1px', background: 'var(--jayl-gold)', opacity: 0.25 }} />
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: logo + copyright */}
            <div className="flex items-center gap-4">
              <Link to="/" aria-label="JAYL — Home">
                <JaylLogoPng isLight={isLight} height={12} style={{ opacity: 0.65 }} />
              </Link>
              <span className={cn(t.muted, 'text-xs')}>© 2026 JAYL. All rights reserved.</span>
            </div>
            {/* Right: tagline */}
            <p className="font-display italic font-light text-sm" style={{ color: 'var(--jayl-gold)', opacity: 0.7 }}>
              Art finds a way.
            </p>
          </div>
        </div>

      </div>
    </footer>
  )
}
