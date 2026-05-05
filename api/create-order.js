import Stripe from 'stripe'
import { decodeItemsFromMetadata, colorToSlug, CURRENCY } from './_lib/catalog.js'
import { applyCors } from './_lib/cors.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })

const GELATO_API_URL = 'https://order.gelatoapis.com/v4/orders'

async function createGelatoOrder({ paymentIntent, items, shippingAddress, email }) {
  const apiKey = process.env.GELATO_API_KEY
  if (!apiKey) throw new Error('GELATO_API_KEY is not configured')

  const orderPayload = {
    orderReferenceId:    `jayl-${paymentIntent.id}`,   // natural idempotency key
    customerReferenceId: email || 'unknown',
    currency: CURRENCY.toUpperCase(),
    items: items.map((item) => {
      // Resolve the Gelato variant UID for this specific color+size combination.
      // Admin variants use { uid, color: "Daisy", size: "S" }; item.color is a slug "daisy".
      const gelatoVariant = item.product.variants?.find((v) => {
        const colorMatch =
          (v.uid ?? v.id) === item.color ||
          colorToSlug(v.color) === colorToSlug(item.color)
        const sizeMatch =
          !item.size ||
          v.size === item.size ||
          v.size?.toUpperCase() === item.size?.toUpperCase()
        return colorMatch && sizeMatch
      })
      const productUid = gelatoVariant?.gelatoVariantId ?? item.product.gelatoProductId
      return {
        itemReferenceId: `${item.productId}__${item.size || '-'}__${item.frame || 'none'}__${item.color || '-'}`,
        productUid,
        quantity: item.quantity,
        files: [{ type: 'default', url: item.product.image }],
      }
    }),
    shippingAddress: {
      firstName:    shippingAddress.firstName,
      lastName:     shippingAddress.lastName,
      addressLine1: shippingAddress.address,
      city:         shippingAddress.city,
      state:        shippingAddress.state || '',
      postCode:     shippingAddress.zip,
      country:      shippingAddress.country || 'US',
      email:        email || '',
      phone:        shippingAddress.phone || '',
    },
  }

  const gelatoRes = await fetch(GELATO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body:    JSON.stringify(orderPayload),
  })
  const body = await gelatoRes.json().catch(() => ({}))
  if (!gelatoRes.ok) {
    const err = new Error('Gelato order failed')
    err.status = gelatoRes.status
    err.body   = body
    throw err
  }
  return body
}

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { paymentIntentId } = req.body || {}
    if (typeof paymentIntentId !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
      return res.status(400).json({ error: 'Invalid payment intent id' })
    }

    // Retrieve the PI as the source of truth — items, address, and amount all
    // live in metadata that was set at PI creation time and can't be tampered
    // with from the client.
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status !== 'succeeded') {
      return res.status(403).json({ error: 'Payment not confirmed' })
    }

    // Idempotency: if we've already fulfilled this PI, return the existing order.
    if (pi.metadata?.gelatoOrderId) {
      return res.status(200).json({
        orderId: pi.metadata.gelatoOrderId,
        orderReferenceId: `jayl-${pi.id}`,
        status: 'already_fulfilled',
        trackingInfo: null,
      })
    }

    const items = decodeItemsFromMetadata(pi.metadata?.items)
    if (!items.length) return res.status(500).json({ error: 'Order data missing' })

    const missing = items.find((it) => !it.product || !it.product.gelatoProductId)
    if (missing) {
      console.error('[create-order] Missing gelatoProductId', missing.productId)
      return res.status(500).json({ error: 'Product not configured for fulfillment' })
    }

    let shippingAddress
    try { shippingAddress = JSON.parse(pi.metadata?.shippingAddress || '{}') }
    catch { return res.status(500).json({ error: 'Order data missing' }) }

    const gelatoOrder = await createGelatoOrder({
      paymentIntent: pi,
      items,
      shippingAddress,
      email: pi.metadata?.email || pi.receipt_email || '',
    })

    // Persist gelatoOrderId back into the PI so future calls (and the webhook)
    // skip duplicate fulfillment.
    try {
      await stripe.paymentIntents.update(pi.id, {
        metadata: { ...pi.metadata, gelatoOrderId: gelatoOrder.id || '' },
      })
    } catch (e) {
      console.error('[create-order] Failed to update PI metadata', e.message)
    }

    return res.status(200).json({
      orderId:          gelatoOrder.id,
      orderReferenceId: gelatoOrder.orderReferenceId,
      status:           gelatoOrder.orderStatus,
      trackingInfo:     gelatoOrder.shipment || null,
    })
  } catch (err) {
    console.error('[create-order]', err.status || '', err.message, err.body || '')
    return res.status(500).json({ error: 'Could not create order' })
  }
}
