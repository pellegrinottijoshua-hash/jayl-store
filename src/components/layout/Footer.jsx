import { useState } from 'react'
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

function NewsletterForm({ t, isLight }) {
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | done | error

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    try {
      const res  = await fetch('/api/capture-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok && !data.ok) throw new Error(data.error || 'Error')
      setStatus('done')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  const inputBorder = isLight ? 'border-ink/20 text-ink placeholder:text-ink-muted/50 focus:border-ink/50' : 'border-white/15 text-cream placeholder:text-white/25 focus:border-white/40'

  return (
    <div className="mb-14">
      <h4 className={cn(t.heading, 'mb-4')} style={{ letterSpacing: '0.18em' }}>Stay in the loop</h4>
      {status === 'done' ? (
        <p className={cn(t.muted, 'text-xs')} style={{ color: 'var(--jayl-gold)' }}>✓ You're on the list.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-0 max-w-xs">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={status === 'sending'}
            className={`flex-1 bg-transparent border-b text-xs py-2 focus:outline-none transition-colors ${inputBorder}`}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="ml-3 text-xs font-sans uppercase tracking-widest disabled:opacity-40 transition-opacity hover:opacity-70 whitespace-nowrap"
            style={{ color: 'var(--jayl-gold)' }}
          >
            {status === 'sending' ? '…' : 'Join'}
          </button>
        </form>
      )}
      {status === 'error' && (
        <p className={cn(t.muted, 'text-xs mt-1')}>Something went wrong — try again.</p>
      )}
    </div>
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

        {/* Newsletter */}
        <NewsletterForm t={t} isLight={isLight} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

          {/* Shop */}
          <div>
            <h4 className={cn(t.heading, 'mb-5')} style={{ letterSpacing: '0.18em' }}>Shop</h4>
            <ul className="space-y-3">
              {[
                { to: '/objects',                   label: 'Objects' },
                { to: '/collection/cool-pok-mon',   label: 'Cool Pokémon' },
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
                <JaylLogoPng isLight={isLight} height={20} style={{ opacity: 0.75 }} />
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
