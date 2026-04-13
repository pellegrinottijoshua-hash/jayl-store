import Stripe from 'stripe'

// Disable Vercel's default body parser — Stripe needs the raw body to verify the signature
export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const GELATO_API_URL = 'https://order.gelatoapis.com/v4/orders'

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function createGelatoOrderFromIntent(paymentIntent) {
  const { metadata } = paymentIntent

  let shippingAddress
  try {
    shippingAddress = metadata.shippingAddress ? JSON.parse(metadata.shippingAddress) : null
  } catch {
    shippingAddress = null
  }

  if (!shippingAddress) {
    console.warn('[webhook] No shipping address in payment intent metadata — skipping Gelato order')
    return
  }

  // Reconstruct minimal items list from the compact summary stored in metadata.
  // Format: "variantKey:quantity:unitPrice,variantKey:quantity:unitPrice,..."
  // This is a best-effort reconstruction; the frontend call to /api/create-order
  // is the primary path. The webhook is a safety net.
  const items = (metadata.itemsSummary || '')
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [variantKey, quantity, unitPrice] = part.split(':')
      return {
        variantKey,
        quantity: parseInt(quantity, 10) || 1,
        product: {
          gelatoProductId: null, // cannot recover without DB; Gelato will reject productUid
          image: '',
        },
      }
    })

  if (!items.length) {
    console.warn('[webhook] Could not reconstruct items — skipping Gelato order')
    return
  }

  const orderPayload = {
    orderReferenceId: `jayl-${paymentIntent.id}`,
    customerReferenceId: metadata.email || 'unknown',
    currency: 'USD',
    items: items.map((item) => ({
      itemReferenceId: item.variantKey,
      productUid: item.product.gelatoProductId || 'photobook_softcover_portrait_a4',
      quantity: item.quantity,
      files: [],
    })),
    shippingAddress: {
      firstName: shippingAddress.firstName || '',
      lastName: shippingAddress.lastName || '',
      addressLine1: shippingAddress.address || '',
      city: shippingAddress.city || '',
      state: shippingAddress.state || '',
      postCode: shippingAddress.zip || '',
      country: shippingAddress.country || 'US',
      email: metadata.email || '',
      phone: '',
    },
  }

  const gelatoRes = await fetch(GELATO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': process.env.VITE_GELATO_API_KEY,
    },
    body: JSON.stringify(orderPayload),
  })

  if (!gelatoRes.ok) {
    const text = await gelatoRes.text()
    console.error('[webhook] Gelato order failed:', gelatoRes.status, text)
    return
  }

  const order = await gelatoRes.json()
  console.log('[webhook] Gelato order created:', order.id)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed')

  const sig = req.headers['stripe-signature']
  if (!sig) return res.status(400).send('Missing stripe-signature header')

  const rawBody = await readRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object
      console.log('[webhook] payment_intent.succeeded:', paymentIntent.id)
      // Best-effort: create Gelato order from metadata. The primary path is the
      // frontend calling /api/create-order immediately after payment confirmation.
      createGelatoOrderFromIntent(paymentIntent).catch((err) =>
        console.error('[webhook] createGelatoOrderFromIntent failed:', err)
      )
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      console.warn('[webhook] payment_intent.payment_failed:', pi.id, pi.last_payment_error?.message)
      break
    }

    default:
      // Unhandled event type — acknowledge receipt
      break
  }

  return res.status(200).json({ received: true })
}
