import { useLocation, useParams, Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, Package, MailOpen } from 'lucide-react'
import { useCurrencyStore, SYMBOL } from '@/store/currencyStore'
import { amountOnly } from '@/lib/money'
import { usePageMeta } from '@/hooks/usePageMeta'
import TrustBox from '@/components/TrustBox'
import { getDrop, basePriceFor } from '../../api/_lib/drop.js'

// `order.items` is the cart's own item list, carried straight through from
// checkout — it still has the cartStore-snapshot `unitPrice` (see
// CartDrawer.jsx / CheckoutPage.jsx for why that's stale during a drop), and
// the server never returns a per-item price breakdown, only the aggregate
// `total`. So there is no server-sourced per-item price to prefer here;
// resolve the display price from the drop config at render time instead,
// same as the cart and checkout pages. Never mutate anything persisted.
function livePriceFor(item, cfg) {
  const sizeObj  = item.product.sizes?.find((s) => s.id === item.size)
  const frameObj = item.product.frames?.find((f) => f.id === item.frame)
  return basePriceFor(item.product.id, sizeObj, item.product, cfg) + (frameObj?.price ?? 0)
}

export default function OrderConfirmationPage() {
  const { orderId } = useParams()
  const { state } = useLocation()

  const order = state?.order  // null if user refreshed — show graceful fallback
  const cfg   = getDrop()
  // La valuta con cui si e' appena pagato (scelta al checkout): niente €/$
  // alternati qui, e' una ricevuta — il simbolo deve dire quello che e' stato addebitato.
  const money = (cents) => SYMBOL[useCurrencyStore.getState().currency] + amountOnly(cents)

  usePageMeta({ title: 'Order Confirmed' })

  return (
    <div className="min-h-screen pt-24 flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <CheckCircle size={64} className="text-success" strokeWidth={1.5} />
        </div>

        {/* Heading */}
        <p className="section-label text-success mb-4">Order Confirmed</p>
        <h1 className="font-display text-4xl lg:text-5xl text-cream mb-3">
          Thank you.
        </h1>
        <p className="text-text-secondary text-lg mb-2">Your order is being prepared.</p>
        <p className="text-text-muted text-sm mb-8">
          Order ID:{' '}
          <span className="font-mono text-text-secondary">{orderId}</span>
        </p>

        {/* Order summary — only when state survives (first load, not refresh) */}
        {order ? (
          <div className="bg-surface border border-border p-6 text-left mb-8">
            <h3 className="section-label mb-4">Order Summary</h3>

            {order.items && (
              <ul className="space-y-3 mb-4">
                {order.items.map((item) => (
                  <li key={item.variantKey} className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-surface-2 overflow-hidden flex-shrink-0">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-text-muted">Qty {item.quantity}</p>
                    </div>
                    <span className="text-sm text-text-primary">
                      {money(livePriceFor(item, cfg) * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-border pt-4 space-y-2">
              {order.shipping === 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Shipping</span>
                  <span className="text-text-primary">Free</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Shipping</span>
                  <span className="text-text-primary">{money(order.shipping)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-text-primary">Total</span>
                <span className="font-bold text-cream">{money(order.total)}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Fallback when page is refreshed and state is lost */
          <div className="bg-surface border border-border p-6 text-left mb-8 flex gap-4 items-start">
            <MailOpen size={20} className="text-text-muted flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">Check your inbox</p>
              <p className="text-xs text-text-muted leading-relaxed">
                A receipt was sent to your email address. It includes your order details and a tracking link once your order ships.
              </p>
            </div>
          </div>
        )}

        {/* Trustpilot Review Collector — qui e non in pagina prodotto: chiede
            una recensione a chi ha appena comprato, che è l'unico momento in
            cui la domanda ha senso.
            Il widget Collector ha uno stile chiaro fisso e ignora data-theme,
            quindi invece di subire un rettangolo bianco in mezzo al nero lo
            mettiamo dentro una card crema: così lo stacco sembra una scelta. */}
        <div className="bg-cream/95 p-5 mb-8 text-left">
          <p className="section-label text-ink-muted mb-3">Got a minute?</p>
          <TrustBox variant="collector" theme="light" />
        </div>

        {/* What happens next */}
        <div className="bg-surface border border-border p-6 text-left mb-8">
          <h3 className="section-label mb-4">What happens next</h3>
          <div className="space-y-4">
            {[
              {
                step: '01',
                title: 'Order sent to Gelato',
                desc: 'Your order is sent to the nearest Gelato print partner.',
              },
              {
                step: '02',
                title: 'Production begins',
                desc: 'Printing and production typically takes 2–4 business days.',
              },
              {
                step: '03',
                title: 'Shipped to you',
                desc: `Tracking info will be sent to${order?.email ? ` ${order.email}` : ' your email'} once dispatched.`,
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4">
                <span className="font-mono text-xs text-text-muted flex-shrink-0 mt-0.5">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-muted mt-1">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/art" className="btn-primary">
            Continue Shopping
            <ArrowRight size={16} />
          </Link>
          <Link to={`/track?id=${orderId}`} className="btn-ghost">
            <Package size={15} /> Track Order
          </Link>
          <Link to="/" className="btn-ghost">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
