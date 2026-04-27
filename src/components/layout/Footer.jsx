import { Link } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

export default function Footer() {
  const { pageTheme } = useThemeStore()
  const isLight = pageTheme === 'light'

  const t = isLight
    ? {
        bg: 'bg-paper border-t border-paper-border',
        heading: 'section-label-light',
        link: 'text-ink-secondary hover:text-ink transition-colors duration-200',
        muted: 'text-ink-muted',
        divider: 'border-t border-paper-border',
      }
    : {
        bg: 'bg-off-black border-t border-border',
        heading: 'section-label',
        link: 'text-text-secondary hover:text-text-primary transition-colors duration-200',
        muted: 'text-text-muted',
        divider: 'border-t border-border',
      }

  return (
    <footer className={t.bg}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Navigation */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')}>Navigation</h4>
            <ul className="space-y-3">
              {[
                { to: '/art', label: 'Art' },
                { to: '/objects', label: 'Objects' },
                { to: '/artist', label: "Artist's" },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={cn('text-sm', t.link)}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')}>Support</h4>
            <ul className="space-y-3">
              <li>
                  <Link to="/contact" className={cn('text-sm', t.link)}>Contact Us</Link>
              </li>
              <li>
                <Link to="/shipping" className={cn('text-sm', t.link)}>Shipping Info</Link>
              </li>
              <li>
                <Link to="/returns" className={cn('text-sm', t.link)}>Returns</Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')}>Legal</h4>
            <ul className="space-y-3">
              {[
                { to: '/terms', label: 'Terms of Use' },
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/cookies', label: 'Cookie Policy' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={cn('text-sm', t.link)}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={cn('mt-14 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2', t.divider)}>
          <p className={cn('text-xs', t.muted)}>© 2026 JAYL. All rights reserved.</p>
          <p className={cn('text-xs', t.muted)}>Fulfilled by Gelato</p>
        </div>
      </div>
    </footer>
  )
}
