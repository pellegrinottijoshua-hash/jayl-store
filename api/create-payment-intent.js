import Stripe from 'stripe'
import {
  priceItems,
  computeTotals,
  validateAddress,
  encodeItemsForMetadata,
  applyDiscount,
  CURRENCY,
} from './_lib/catalog.js'
import { applyCors } from './_lib/cors.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })

const METADATA_VALUE_LIMIT = 500

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { items: rawItems, shippingAddress, discountCode } = req.body || {}

    // Server-side price lookup — never trust client-supplied unitPrice/total.
    const priced = priceItems(rawItems)
    if (!priced.ok) return res.status(400).json({ error: priced.error })

    const addrCheck = validateAddress(shippingAddress)
    if (!addrCheck.ok) return res.status(400).json({ error: addrCheck.error })
    const addr = addrCheck.address

    const { subtotal, shipping, total: rawTotal } = computeTotals(priced.items)

    // Apply discount code if provided
    let discountAmount = 0
    let discountLabel  = null
    if (discountCode?.trim()) {
      const disc = applyDiscount(subtotal, discountCode)
      if (!disc.ok) return res.status(400).json({ error: disc.error })
      discountAmount = disc.amount
      discountLabel  = disc.label
    }

    const total = Math.max(rawTotal - discountAmount, 50) // minimum 50 cents
    if (total < 50) return res.status(400).json({ error: 'Order total is too low' })

    const itemsEncoded     = encodeItemsForMetadata(priced.items)
    const shippingEncoded  = JSON.stringify({
      firstName: addr.firstName, lastName: addr.lastName, address: addr.address,
      city: addr.city, state: addr.state, zip: addr.zip, country: addr.country,
    })

    if (itemsEncoded.length    > METADATA_VALUE_LIMIT) return res.status(400).json({ error: 'Cart too large' })
    if (shippingEncoded.length > METADATA_VALUE_LIMIT) return res.status(400).json({ error: 'Address too long' })

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   total,
      currency: CURRENCY,
      automatic_payment_methods: { enabled: true },
      receipt_email: addr.email,
      metadata: {
        email:           addr.email,
        customerName:    `${addr.firstName} ${addr.lastName}`.slice(0, 200),
        shippingAddress: shippingEncoded,
        items:           itemsEncoded,
        total:           String(total),
        currency:        CURRENCY,
        ...(discountLabel ? {
          discountCode:   String(discountCode).trim().toUpperCase(),
          discountAmount: String(discountAmount),
          discountLabel,
        } : {}),
      },
    })

    return res.status(200).json({
      clientSecret:   paymentIntent.client_secret,
      total,
      discountAmount,
      discountLabel,
    })
  } catch (err) {
    console.error('[create-payment-intent]', err)
    return res.status(500).json({ error: 'Could not initialize payment' })
  }
}
