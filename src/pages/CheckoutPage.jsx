import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, cn } from '@/lib/utils'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#e8e0d4',
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: '14px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#6b6560' },
    },
    invalid: { color: '#e05c5c', iconColor: '#e05c5c' },
  },
}

function FormSection({ title, children }) {
  return (
    <div className="mb-8">
      <h3 className="text-xs font-semibold tracking-ultra uppercase text-text-muted mb-5 pb-3 border-b border-border">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, id, error, className, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium tracking-wide text-text-secondary uppercase">
        {label}
      </label>
      <input id={id} className={cn('input-field', error && 'border-error')} {...props} />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

function CheckoutForm() {
  const { items, clearCart } = useCartStore()
  const navigate = useNavigate()
  const stripe = useStripe()
  const elements = useElements()

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const shipping = 0

  // Discount state
  const [discountInput,   setDiscountInput]   = useState('')
  const [appliedCode,     setAppliedCode]     = useState(null)  // { code, amount, label }
  const [discountError,   setDiscountError]   = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)

  const discountAmount = appliedCode?.amount ?? 0
  const total          = Math.max(subtotal - discountAmount, 0)

  const handleApplyCode = async () => {
    const code = discountInput.trim().toUpperCase()
    if (!code) return
    setDiscountLoading(true); setDiscountError('')
    try {
      const res  = await fetch('/api/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      setAppliedCode({ code: data.code, amount: data.discountAmount, label: data.discountLabel })
      setDiscountInput('')
    } catch (e) {
      setDiscountError(e.message)
    } finally {
      setDiscountLoading(false)
    }
  }

  const handleRemoveCode = () => {
    setAppliedCode(null); setDiscountError(''); setDiscountInput('')
  }

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  })
  const [errors, setErrors] = useState({})
  const [processing, setProcessing] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.email.includes('@')) e.email = 'Valid email required'
    if (!form.firstName) e.firstName = 'Required'
    if (!form.lastName) e.lastName = 'Required'
    if (!form.address) e.address = 'Required'
    if (!form.city) e.city = 'Required'
    if (!form.zip) e.zip = 'Required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    if (!stripe || !elements) {
      setErrors({ payment: 'Stripe has not loaded yet. Please try again.' })
      return
    }

    setProcessing(true)
    setErrors({})

    try {
      // 1. Create a payment intent on the server.
      // Send only product identifiers — the server looks up real prices from
      // the catalog. Never send unitPrice / total here; they would be ignored.
      const piRes = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.product.id,
            size:     i.size  || null,
            frame:    i.frame || 'none',
            color:    i.color || null,
            quantity: i.quantity,
          })),
          shippingAddress: {
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
            address: form.address,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
          },
          ...(appliedCode ? { discountCode: appliedCode.code } : {}),
        }),
      })

      if (!piRes.ok) {
        const { error } = await piRes.json()
        setErrors({ payment: error || 'Could not initialize payment. Please try again.' })
        return
      }

      const { clientSecret } = await piRes.json()

      // 2. Confirm the card payment with Stripe.js — card data never touches our server
      const cardElement = elements.getElement(CardElement)
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${form.firstName} ${form.lastName}`,
            email: form.email,
            address: {
              line1: form.address,
              city: form.city,
              state: form.state,
              postal_code: form.zip,
              country: form.country,
            },
          },
        },
      })

      if (stripeError) {
        setErrors({ payment: stripeError.message })
        return
      }

      // 3. Create the Gelato order once payment is confirmed.
      // The server reads canonical items + address from PI metadata and ignores
      // anything else we'd send here, so just pass the paymentIntentId.
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      })

      const orderData = orderRes.ok ? await orderRes.json() : {}
      const orderId = orderData.orderId || `JAYL-${Date.now().toString(36).toUpperCase()}`

      clearCart()
      navigate(`/order-confirmation/${orderId}`, {
        state: {
          order: {
            id: orderId,
            items,
            subtotal,
            shipping,
            total,
            email: form.email,
            gelatoOrderId: orderData.orderId,
            trackingInfo: orderData.trackingInfo,
          },
        },
      })
    } catch (err) {
      console.error('Checkout error:', err)
      setErrors({ payment: 'An unexpected error occurred. Please try again.' })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid lg:grid-cols-5 gap-12">
        {/* ── Left: form ── */}
        <div className="lg:col-span-3">
          <FormSection title="Contact">
            <Field
              label="Email address"
              id="email"
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="you@example.com"
              error={errors.email}
              autoComplete="email"
            />
          </FormSection>

          <FormSection title="Shipping address">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="First name"
                id="firstName"
                value={form.firstName}
                onChange={update('firstName')}
                error={errors.firstName}
                autoComplete="given-name"
              />
              <Field
                label="Last name"
                id="lastName"
                value={form.lastName}
                onChange={update('lastName')}
                error={errors.lastName}
                autoComplete="family-name"
              />
            </div>
            <div className="mt-4">
              <Field
                label="Address"
                id="address"
                value={form.address}
                onChange={update('address')}
                placeholder="Street address"
                error={errors.address}
                autoComplete="street-address"
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Field
                label="City"
                id="city"
                value={form.city}
                onChange={update('city')}
                error={errors.city}
                autoComplete="address-level2"
                className="col-span-1"
              />
              <Field
                label="State / Province"
                id="state"
                value={form.state}
                onChange={update('state')}
                autoComplete="address-level1"
              />
              <Field
                label="ZIP / Postal"
                id="zip"
                value={form.zip}
                onChange={update('zip')}
                error={errors.zip}
                autoComplete="postal-code"
              />
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium tracking-wide text-text-secondary uppercase block mb-1.5">
                Country
              </label>
              <select
                value={form.country}
                onChange={update('country')}
                className="input-field"
              >
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="NL">Netherlands</option>
                <option value="SE">Sweden</option>
                <option value="NO">Norway</option>
                <option value="DK">Denmark</option>
                <option value="FI">Finland</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
                <option value="JP">Japan</option>
                <option value="SG">Singapore</option>
              </select>
            </div>
          </FormSection>

          <FormSection title="Payment">
            {!stripePromise ? (
              <div className="bg-surface-2 border border-border p-4 rounded-sm text-xs text-text-muted">
                Add <code className="text-text-secondary font-mono">VITE_STRIPE_PUBLISHABLE_KEY</code>{' '}
                to <code className="text-text-secondary font-mono">.env.local</code> to enable payments.
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                  Card details
                </label>
                <div className="input-field py-3">
                  <CardElement options={CARD_ELEMENT_OPTIONS} />
                </div>
              </div>
            )}
            {errors.payment && (
              <p className="text-xs text-error mt-3">{errors.payment}</p>
            )}
          </FormSection>

          <button
            type="submit"
            disabled={processing || !stripe}
            className={cn(
              'btn-primary w-full py-4 text-sm',
              (processing || !stripe) && 'opacity-70 cursor-not-allowed'
            )}
          >
            {processing ? 'Processing…' : `Pay ${formatPrice(total)}`}
          </button>

          <p className="text-xs text-text-muted text-center mt-4">
            By placing your order you agree to our{' '}
            <Link to="/terms" className="underline hover:text-text-secondary">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-text-secondary">Privacy Policy</Link>.
          </p>
        </div>

        {/* ── Right: order summary ── */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 bg-surface border border-border p-6">
            <h3 className="text-xs font-semibold tracking-ultra uppercase text-text-muted mb-6">
              Order Summary
            </h3>

            <ul className="space-y-4 mb-6">
              {items.map((item) => (
                <li key={item.variantKey} className="flex gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 bg-surface-2 overflow-hidden flex-shrink-0">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-surface-3 text-text-primary text-2xs font-bold rounded-full flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {item.size && item.product.sizes?.find((s) => s.id === item.size)?.label}
                      {item.frame && item.frame !== 'none' && ` · ${item.frame} frame`}
                      {item.color && ` · ${item.color}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-text-primary flex-shrink-0">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="divider" />

            {/* Discount code input */}
            <div className="mt-4 mb-2">
              {!appliedCode ? (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountInput}
                      onChange={e => { setDiscountInput(e.target.value.toUpperCase()); setDiscountError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
                      placeholder="Discount code"
                      className="input-field flex-1 text-sm py-2 placeholder:uppercase placeholder:tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCode}
                      disabled={discountLoading || !discountInput.trim()}
                      className="px-4 py-2 border border-border hover:border-border-light text-text-secondary hover:text-cream text-xs font-medium tracking-widest uppercase transition-colors disabled:opacity-40"
                    >
                      {discountLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                  {discountError && <p className="text-xs text-error">{discountError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-success/10 border border-success/30 px-3 py-2">
                  <div>
                    <span className="text-success text-xs font-semibold tracking-widest">{appliedCode.code}</span>
                    <span className="text-success/70 text-xs ml-2">— {appliedCode.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCode}
                    className="text-text-muted hover:text-text-primary text-sm leading-none transition-colors"
                  >×</button>
                </div>
              )}
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-text-primary">{formatPrice(subtotal)}</span>
              </div>
              {appliedCode && (
                <div className="flex justify-between text-sm">
                  <span className="text-success">Discount ({appliedCode.code})</span>
                  <span className="text-success font-medium">−{formatPrice(appliedCode.amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Shipping</span>
                <span className="text-success font-medium">Free</span>
              </div>
              <div className="divider" />
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-text-primary">Total</span>
                <div className="text-right">
                  {appliedCode && (
                    <span className="text-text-muted text-sm line-through mr-2">{formatPrice(subtotal)}</span>
                  )}
                  <span className="text-lg font-bold text-cream">{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-border space-y-2">
              {['Secure payment via Stripe', 'Fulfilled by Gelato worldwide', '100-year archival inks'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-xs text-text-muted">
                  <div className="w-1 h-1 bg-success rounded-full" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

export default function CheckoutPage() {
  const { items } = useCartStore()
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-display text-4xl text-cream mb-4">Your cart is empty</h1>
        <p className="text-text-secondary mb-8">Add some works before checking out.</p>
        <Link to="/art" className="btn-primary">Browse the Shop</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 bg-off-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link
            to="/art"
            className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors tracking-widest uppercase"
          >
            <ArrowLeft size={12} />
            Continue Shopping
          </Link>
          <Link to="/" className="font-display text-2xl text-cream tracking-widest">
            JAYL
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Lock size={12} />
            Secure checkout
          </div>
        </div>

        <Elements stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      </div>
    </div>
  )
}
