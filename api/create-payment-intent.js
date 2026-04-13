import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { items, shippingAddress } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' })
    }

    // Recalculate total server-side — never trust client totals
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const shipping = subtotal >= 10000 ? 0 : 799
    const total = subtotal + shipping

    if (total < 50) {
      return res.status(400).json({ error: 'Order total is too low' })
    }

    // Store a compact order snapshot in metadata for the webhook fallback
    const itemsSummary = items
      .map((i) => `${i.variantKey}:${i.quantity}:${i.unitPrice}`)
      .join(',')
      .slice(0, 500)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        email: shippingAddress?.email || '',
        customerName: shippingAddress
          ? `${shippingAddress.firstName} ${shippingAddress.lastName}`
          : '',
        shippingAddress: JSON.stringify({
          firstName: shippingAddress?.firstName,
          lastName: shippingAddress?.lastName,
          address: shippingAddress?.address,
          city: shippingAddress?.city,
          state: shippingAddress?.state,
          zip: shippingAddress?.zip,
          country: shippingAddress?.country || 'US',
        }).slice(0, 500),
        itemsSummary,
      },
    })

    return res.status(200).json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    console.error('[create-payment-intent]', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
