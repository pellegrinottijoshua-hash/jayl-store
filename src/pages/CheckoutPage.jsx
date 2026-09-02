import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, PaymentRequestButtonElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, cn } from '@/lib/utils'
import { getDrop, basePriceFor, bundleDiscount, productState, DROP } from '../../api/_lib/drop.js'

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

// cartStore persists the whole product object at add-to-cart time, so a tee
// added before a drop opens (or before the admin edits src/data/drop.js)
// still carries whatever price was live back then. Re-resolve it against the
// CURRENT drop config on every render instead of trusting item.unitPrice —
// the persisted cart is a snapshot, not a price quote. Never write the result
// back into the store. (Same helper as src/components/cart/CartDrawer.jsx.)
function livePriceFor(item, cfg) {
  const sizeObj  = item.product.sizes?.find((s) => s.id === item.size)
  const frameObj = item.product.frames?.find((f) => f.id === item.frame)
  return basePriceFor(item.product.id, sizeObj, item.product, cfg) + (frameObj?.price ?? 0)
}

function CheckoutForm() {
  const { items, clearCart } = useCartStore()
  const navigate = useNavigate()
  const stripe = useStripe()
  const elements = useElements()

  const cfg      = getDrop()
  const subtotal = items.reduce((sum, i) => sum + livePriceFor(i, cfg) * i.quantity, 0)
  const shipping = 0

  // Discount state
  const [discountInput,   setDiscountInput]   = useState('')
  const [appliedCode,     setAppliedCode]     = useState(null)  // { code, amount, label }
  const [discountError,   setDiscountError]   = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)

  // The server is authoritative once it has priced the cart (after
  // create-payment-intent responds): its total/discountAmount/discountLabel
  // are what Stripe will actually charge. Until then these are null and every
  // figure below falls back to the local pre-flight estimate — which is why
  // that estimate has to be right too (see localBundleDiscount): it's what
  // the Apple/Google Pay sheet shows the customer BEFORE any server call.
  const [serverPricing, setServerPricing] = useState(null)

  // Automatic bundle discount, computed the same way the server will
  // (bundleDiscount is pure and depends only on the drop config + which
  // product ids are present) — not a separate "informational" estimate that
  // can drift from what create-payment-intent actually applies.
  const localBundleDiscount = bundleDiscount(items.map((i) => ({ productId: i.product.id })), cfg)
  const localDiscountAmount = (appliedCode?.amount ?? 0) + localBundleDiscount
  const localDiscountLabel  = appliedCode
    ? (localBundleDiscount > 0 ? `${appliedCode.label} + Bundle drop` : appliedCode.label)
    : (localBundleDiscount > 0 ? 'Bundle drop — tutti e tre' : null)
  const localTotal = Math.max(subtotal - localDiscountAmount, 0)

  const discountAmount = serverPricing?.discountAmount ?? localDiscountAmount
  const discountLabel  = serverPricing?.discountLabel  ?? localDiscountLabel
  const total          = serverPricing?.total          ?? localTotal

  const handleApplyCode = async () => {
    const code = discountInput.trim().toUpperCase()
    if (!code) return
    setDiscountLoading(true); setDiscountError('')

    // `applyDiscount` (api/_lib/catalog.js) refuses any code once the cart
    // holds a drop item — mirror that check here so it's rejected in the
    // discount box, before the customer has filled in card details, instead
    // of surfacing as a generic payment error at the very last step.
    const hasDropItem = items.some((i) => productState(i.product.id, cfg) === DROP)
    if (hasDropItem) {
      setDiscountError('I codici sconto non sono validi sui pezzi in drop.')
      setDiscountLoading(false)
      return
    }

    try {
      const res  = await fetch('/api/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          subtotal,
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        }),
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

  // Apple Pay / Google Pay
  const [paymentRequest, setPaymentRequest] = useState(null)

  // The `pr.on('paymentmethod', …)` handler below is bound ONCE, inside an effect
  // that only reruns on [stripe, localTotal] — so it closes over whatever `form`,
  // `items`, `appliedCode` were AT MOUNT TIME, not what the user has since typed.
  // That stale closure is why a fully-filled shipping form still failed
  // validate() with "Required" after a real Apple/Google Pay authorization:
  // the handler was reading the empty initial `form`, frozen from first render.
  // Refs mirror the latest values on every render without re-registering the
  // handler (which would otherwise re-trigger canMakePayment() on every
  // keystroke and flicker the button).
  const formRef        = useRef(form)
  const itemsRef        = useRef(items)
  const appliedCodeRef  = useRef(appliedCode)
  formRef.current       = form
  itemsRef.current      = items
  appliedCodeRef.current = appliedCode

  useEffect(() => {
    if (!stripe || !localTotal) return
    const pr = stripe.paymentRequest({
      country: 'IT',
      currency: 'eur',
      // `localTotal` is already in cents (it's the sum of livePriceFor(item),
      // itself in cents — see formatPrice in src/lib/utils.js). Multiplying by
      // 100 again is what turned a 23.99€ tee into a 2,399.00€ line in the
      // Apple/Google Pay sheet. This is the PRE-FLIGHT estimate (subtotal minus
      // the local bundle-discount estimate) — the only number available before
      // create-payment-intent has run, so it has to already be right: it's what
      // the Apple/Google Pay sheet shows the customer before any server call.
      total: { label: 'JAYL', amount: Math.round(localTotal) },
      requestPayerName: true,
      requestPayerEmail: true,
    })
    pr.canMakePayment().then(result => {
      if (result) setPaymentRequest(pr)
    })
    pr.on('paymentmethod', async (e) => {
      const form        = formRef.current
      const items        = itemsRef.current
      const appliedCode  = appliedCodeRef.current
      try {
        // The shipping address form on this page is filled before the Apple/Google
        // Pay button is usable (Payment section renders after it), so reuse it —
        // same validation the card flow applies. Pass the ref'd form explicitly:
        // validate()'s default param would still resolve to this closure's own
        // stale `form`, same bug one level down.
        const errs = validate(form)
        if (Object.keys(errs).length) {
          setErrors(errs)
          e.complete('fail')
          return
        }

        // Send items + shippingAddress, exactly like the card flow. The server
        // prices from the catalog and ignores client-supplied amounts — sending
        // {amount, metadata} here (the previous shape) doesn't match what
        // create-payment-intent reads (`items`, `shippingAddress`), so priceItems()
        // always rejected with 400 before a PaymentIntent was even created. That is
        // also why no customer could have been charged the wrong (x100) amount:
        // the request failed before Stripe was involved.
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
              email: e.payerEmail || form.email,
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
          const { error } = await piRes.json().catch(() => ({}))
          setErrors({ payment: error || 'Could not initialize payment. Please try again.' })
          e.complete('fail')
          return
        }
        // Shadows the outer `total`/`discountAmount`/`discountLabel` (the local
        // pre-flight estimate used above to size the payment sheet) with the
        // server's authoritative numbers for everything below — analytics,
        // the order-confirmation state, and the on-screen summary via
        // setServerPricing. The PaymentIntent Stripe just confirmed was
        // created for exactly this `total`; the estimate above was only ever
        // a stand-in for showing the Apple/Google Pay sheet before this
        // response existed.
        const { clientSecret, total, discountAmount, discountLabel } = await piRes.json()
        setServerPricing({ total, discountAmount, discountLabel })
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: e.paymentMethod.id },
          { handleActions: false }
        )
        if (confirmError) {
          setErrors({ payment: confirmError.message })
          e.complete('fail')
          return
        }
        e.complete('success')

        // Create the Gelato order now, same as the card flow — previously this
        // block never called create-order, leaving the 10s-delayed webhook as the
        // only fulfiller for every Apple/Google Pay purchase.
        const orderRes = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        })
        const orderData = orderRes.ok ? await orderRes.json() : {}
        const orderId = orderData.orderId || paymentIntent.id

        // Fire analytics events. `total` is cents; ad platforms expect major units.
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'Purchase', {
            value: total / 100,
            currency: 'EUR',
            content_ids: items.map(i => i.id),
            content_type: 'product',
            num_items: items.reduce((s, i) => s + (i.quantity || 1), 0),
          })
        }
        if (typeof window.pintrk === 'function') {
          window.pintrk('track', 'checkout', {
            value: total / 100,
            order_quantity: items.reduce((s, i) => s + (i.quantity || 1), 0),
            currency: 'EUR',
          })
        }
        clearCart()
        navigate(`/order-confirmation/${orderId}`, {
          state: {
            order: {
              id: orderId,
              items,
              subtotal,
              shipping,
              total,
              email: e.payerEmail || form.email,
              gelatoOrderId: orderData.orderId,
              trackingInfo: orderData.trackingInfo,
            },
          },
        })
      } catch (err) {
        console.error('Apple/Google Pay checkout error:', err)
        e.complete('fail')
      }
    })
  }, [stripe, localTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // Accepts an explicit form so the Apple/Google Pay handler (bound once inside
  // an effect, see formRef above) can validate the LATEST form via formRef.current
  // instead of the stale `form` this closure would otherwise capture at mount.
  const validate = (f = form) => {
    const e = {}
    if (!f.email.includes('@')) e.email = 'Valid email required'
    if (!f.firstName) e.firstName = 'Required'
    if (!f.lastName) e.lastName = 'Required'
    if (!f.address) e.address = 'Required'
    if (!f.city) e.city = 'Required'
    if (!f.zip) e.zip = 'Required'
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

      // Shadows the outer `total`/`discountAmount`/`discountLabel` (the local
      // pre-flight estimate) with the server's authoritative numbers for
      // everything below — this PaymentIntent was created for exactly this
      // `total`. setServerPricing also updates the on-screen Order Summary,
      // in case it re-renders before navigation.
      const { clientSecret, total, discountAmount, discountLabel } = await piRes.json()
      setServerPricing({ total, discountAmount, discountLabel })

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

      // Meta Pixel — Purchase. `total` is cents; ad platforms expect major units —
      // same fix applied to the Apple/Google Pay block above, same root cause.
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', {
          value: total / 100,
          currency: 'EUR',
          content_ids: items.map(i => i.id),
          content_type: 'product',
          num_items: items.reduce((s, i) => s + (i.quantity || 1), 0),
        })
      }
      // Pinterest Tag — Checkout
      if (typeof window.pintrk === 'function') {
        window.pintrk('track', 'checkout', {
          value: total / 100,
          order_quantity: items.reduce((s, i) => s + (i.quantity || 1), 0),
          currency: 'EUR',
        })
      }
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
              onBlur={() => {
                const em = form.email.trim()
                if (!em.includes('@') || !items.length) return
                fetch('/api/capture-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action:    'cart',
                    email:     em,
                    cartItems: items.map(it => ({
                      name:  it.product?.name  || it.productId,
                      image: it.product?.image || null,
                      color: it.color || null,
                      size:  it.size  || null,
                      quantity: it.quantity,
                    })),
                  }),
                }).catch(() => {}) // fire-and-forget, never block checkout
              }}
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
              <div className="space-y-4">
                {paymentRequest && (
                  <div>
                    <PaymentRequestButtonElement
                      options={{
                        paymentRequest,
                        style: {
                          paymentRequestButton: {
                            theme: 'dark',
                            height: '48px',
                          },
                        },
                      }}
                    />
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-text-muted tracking-wide">— or pay by card —</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                    Card details
                  </label>
                  <div className="input-field py-3">
                    <CardElement options={CARD_ELEMENT_OPTIONS} />
                  </div>
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
                    {formatPrice(livePriceFor(item, cfg) * item.quantity)}
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
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-success">
                    Discount{appliedCode ? ` (${appliedCode.code})` : discountLabel ? ` (${discountLabel})` : ''}
                  </span>
                  <span className="text-success font-medium">−{formatPrice(discountAmount)}</span>
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
                  {discountAmount > 0 && (
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
          <Link to="/" aria-label="JAYL — Home">
            <img src="/logo-dark.svg" alt="JAYL" style={{ height: 40, width: 'auto', display: 'block', opacity: 0.9 }} />
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
