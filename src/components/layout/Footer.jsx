import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-off-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link
              to="/"
              className="font-display text-3xl font-bold tracking-widest text-cream block mb-4"
            >
              JAYL
            </Link>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
              Premium art prints and wearable art. AI-reinterpreted art movements applied to
              the subjects those movements never touched — technology, AI, urban life.
            </p>
            <p className="text-text-muted text-xs mt-4 tracking-wide">
              Fulfilled worldwide by Gelato.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="section-label mb-5">Shop</h4>
            <ul className="space-y-3">
              {[
                { to: '/shop', label: 'All Products' },
                { to: '/shop?section=art', label: 'Art Prints' },
                { to: '/shop?section=streetwear', label: 'Streetwear' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="section-label mb-5">Info</h4>
            <ul className="space-y-3">
              {[
                { to: '/shipping', label: 'Shipping & Returns' },
                { to: '/about', label: 'About' },
                { to: '/privacy', label: 'Privacy' },
                { to: '/terms', label: 'Terms' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-xs">
            © {year} JAYL. All rights reserved.
          </p>
          <p className="text-text-muted text-xs">
            Secure checkout via{' '}
            <span className="text-text-secondary">Stripe</span>
            {' '}· Fulfilled by{' '}
            <span className="text-text-secondary">Gelato</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
