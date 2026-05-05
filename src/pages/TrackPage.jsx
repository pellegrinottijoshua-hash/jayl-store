import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { Package, ChevronRight, Check } from 'lucide-react'

const STATUS_STEPS = ['created', 'passed', 'printed', 'shipped', 'delivered']

const STATUS_LABEL = {
  created:   'Order received',
  passed:    'In production',
  printed:   'Printed',
  shipped:   'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  draft:     'Draft',
}

const STATUS_DESC = {
  created:   'Your order has been received and is awaiting production.',
  passed:    'Your order is being prepared for printing.',
  printed:   'Your item has been printed and is being prepared for dispatch.',
  shipped:   'Your order is on its way!',
  delivered: 'Your order has been delivered. Enjoy!',
  cancelled: 'This order was cancelled.',
  draft:     'This order is a draft.',
}

function StatusTimeline({ status }) {
  const isCancelled = status === 'cancelled'
  const activeIdx   = STATUS_STEPS.indexOf(status)

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
        Order cancelled
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {STATUS_STEPS.map((step, i) => {
        const done    = i < activeIdx
        const current = i === activeIdx
        const future  = i > activeIdx
        return (
          <div key={step} className="flex items-start gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                done    ? 'bg-green-500 border-green-500'    :
                current ? 'bg-cream border-cream'           :
                          'bg-transparent border-white/20'
              }`}>
                {done    && <Check size={12} className="text-black" strokeWidth={3} />}
                {current && <span className="w-2 h-2 rounded-full bg-off-black" />}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`w-0.5 h-8 mt-0.5 ${done ? 'bg-green-500/50' : 'bg-white/10'}`} />
              )}
            </div>
            <div className="pb-8">
              <p className={`text-sm font-medium leading-6 ${current ? 'text-cream' : done ? 'text-green-400' : 'text-white/30'}`}>
                {STATUS_LABEL[step]}
              </p>
              {current && (
                <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">{STATUS_DESC[step]}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TrackPage() {
  const { setPageTheme } = useThemeStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const [orderId,  setOrderId]  = useState(searchParams.get('id') || '')
  const [loading,  setLoading]  = useState(false)
  const [order,    setOrder]    = useState(null)
  const [error,    setError]    = useState('')

  useEffect(() => { setPageTheme('dark') }, [setPageTheme])

  // Auto-search if ?id= is in URL on load
  useEffect(() => {
    const id = searchParams.get('id')
    if (id) { setOrderId(id); handleSearch(id) }
  }, [])

  const handleSearch = async (id) => {
    const query = (id ?? orderId).trim()
    if (!query) return
    setLoading(true); setError(''); setOrder(null)
    try {
      const res  = await fetch(`/api/track-order?orderId=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Order not found')
      setOrder(data.order)
      setSearchParams({ id: query })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = e => { e.preventDefault(); handleSearch() }

  return (
    <div className="min-h-screen bg-off-black text-cream pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Package size={20} className="text-text-muted" />
          <h1 className="font-display text-3xl text-cream">Track your order</h1>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-10">
          <input
            type="text"
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            placeholder="Enter your order ID…"
            className="flex-1 bg-gray-900 border border-border text-cream px-4 py-3 text-sm focus:outline-none focus:border-border-light transition-colors placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={loading || !orderId.trim()}
            className="bg-cream text-off-black px-6 py-3 text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {loading ? 'Searching…' : 'Track'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-800/50 text-red-300 px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Result */}
        {order && (
          <div className="space-y-6">
            {/* Order summary card */}
            <div className="bg-gray-900/50 border border-border p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Order</p>
                  <p className="font-mono text-cream text-sm">{order.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Date</p>
                  <p className="text-cream text-sm">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>

              {order.shippingAddress && (
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Ship to</p>
                  <p className="text-cream text-sm">
                    {[order.shippingAddress.firstName, order.shippingAddress.lastName].filter(Boolean).join(' ')}
                    {order.shippingAddress.city && `, ${order.shippingAddress.city}`}
                    {order.shippingAddress.country && ` (${order.shippingAddress.country})`}
                  </p>
                </div>
              )}

              {order.items?.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Items</p>
                  <ul className="space-y-1">
                    {order.items.map((item, i) => (
                      <li key={i} className="text-cream/70 text-sm flex items-center gap-2">
                        <ChevronRight size={12} className="text-text-muted flex-shrink-0" />
                        {item.title || item.productTitle || item.sku || 'Item'}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tracking number */}
              {order.trackingCode && (
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Tracking number</p>
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-cream text-sm">{order.trackingCode}</p>
                    {order.trackingUrl && (
                      <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                        Track on carrier →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status timeline */}
            <div className="bg-gray-900/50 border border-border p-5">
              <p className="text-xs text-text-muted uppercase tracking-widest mb-6">Status</p>
              <StatusTimeline status={order.status} />
            </div>
          </div>
        )}

        {/* Help */}
        <div className="mt-10 border-t border-border pt-8 text-center">
          <p className="text-text-muted text-xs">
            Can't find your order?{' '}
            <Link to="/contact" className="text-cream/60 hover:text-cream underline underline-offset-2 transition-colors">
              Contact us
            </Link>
            {' '}— we'll help you track it down.
          </p>
        </div>
      </div>
    </div>
  )
}
