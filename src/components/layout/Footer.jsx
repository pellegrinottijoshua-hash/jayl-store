import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

export default function Footer() {
  const year = new Date().getFullYear()
  const { pageTheme } = useThemeStore()
  const isLight = pageTheme === 'light'

  const t = isLight
    ? {
        bg: 'bg-paper border-t border-paper-border',
        logo: 'text-ink',
        body: 'text-ink-secondary',
        muted: 'text-ink-muted',
        heading: 'section-label-light',
        link: 'text-ink-secondary hover:text-ink',
        bottom: 'border-t border-paper-border',
      }
    : {
        bg: 'bg-off-black border-t border-border',
        logo: 'text-cream',
        body: 'text-text-secondary',
        muted: 'text-text-muted',
        heading: 'section-label',
        link: 'text-text-secondary hover:text-text-primary',
        bottom: 'border-t border-border',
      }

  return (
    <footer className={t.bg}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link
              to="/"
              className={cn('font-display text-3xl font-bold tracking-widest block mb-4', t.logo)}
            >
              JAYL
            </Link>
            <p className={cn('text-sm leading-relaxed max-w-xs', t.body)}>
              Art movements reimagined. Six great visual languages applied to the subjects,
              emotions, and landscapes they never reached.
            </p>
            <p className={cn('text-xs mt-4 tracking-wide', t.muted)}>
              Fulfilled worldwide by Gelato.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')}>Shop</h4>
            <ul className="space-y-3">
              {[
                { to: '/art', label: 'Art Prints' },
                { to: '/objects', label: 'Objects' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={cn('text-sm transition-colors duration-200', t.link)}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')}>Info</h4>
            <ul className="space-y-3">
              {[
                { to: '/artist', label: 'The Artist' },
                { to: '/shipping', label: 'Shipping & Returns' },
                { to: '/privacy', label: 'Privacy' },
                { to: '/terms', label: 'Terms' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={cn('text-sm transition-colors duration-200', t.link)}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={cn('mt-16 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4', t.bottom)}>
          <p className={cn('text-xs', t.muted)}>© {year} JAYL. All rights reserved.</p>
          <p className={cn('text-xs', t.muted)}>
            Secure checkout via{' '}
            <span className={isLight ? 'text-ink-secondary' : 'text-text-secondary'}>Stripe</span>
            {' '}· Fulfilled by{' '}
            <span className={isLight ? 'text-ink-secondary' : 'text-text-secondary'}>Gelato</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
