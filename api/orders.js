/**
 * api/orders.js — consolidated orders hub
 *
 * Replaces 3 separate functions to stay within Vercel Hobby's 12-function limit.
 * Routed via vercel.json rewrites that append ?handler=<name>:
 *   /api/get-orders    → ?handler=get-orders
 *   /api/create-order  → ?handler=create-order
 *   /api/track-order   → ?handler=track-order
 */

import Stripe from 'stripe'
import { decodeItemsFromMetadata, colorToSlug, CURRENCY } from './_lib/catalog.js'
import { applyCors } from './_lib/cors.js'
import { rateLimit } from './_lib/rateLimit.js'
import {
  sendEmail,
  buildOrderConfirmationEmail,
  buildContactNotificationEmail,
  buildContactAutoReplyEmail,
  STORE_EMAIL_ADDRESS,
} from './_lib/email.js'

// ── Shared helpers ────────────────────────────────────────────────────────────

function cors(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') { res.status(allowed ? 200 : 403).end(); return false }
  if (!allowed)                 { res.status(403).json({ error: 'Forbidden' }); return false }
  return true
}

// ── get-orders ────────────────────────────────────────────────────────────────

async function handleGetOrders(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey  = process.env.GELATO_API_KEY
  const storeId = process.env.GELATO_STORE_ID
  if (!apiKey)  return res.status(500).json({ error: 'GELATO_API_KEY not configured' })
  if (!storeId) return res.status(500).json({ error: 'GELATO_STORE_ID not configured' })

  const page   = parseInt(req.query.page  || '1',  10)
  const limit  = parseInt(req.query.limit || '20', 10)
  const offset = (page - 1) * limit

  try {
    const gelatoRes = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/orders?offset=${offset}&limit=${limit}`,
      { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
    )
    if (!gelatoRes.ok) {
      const err = await gelatoRes.json().catch(() => ({}))
      throw new Error(`Gelato API ${gelatoRes.status}: ${err.message || gelatoRes.statusText}`)
    }
    const data    = await gelatoRes.json()
    const orders  = data.orders  || data.data || []
    const total   = data.total   || data.totalCount || orders.length
    const hasMore = offset + orders.length < total
    return res.status(200).json({ orders, total, hasMore, page })
  } catch (err) {
    console.error('[get-orders]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── create-order ──────────────────────────────────────────────────────────────

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
const GELATO_ORDER_URL = 'https://order.gelatoapis.com/v4/orders'

async function createGelatoOrder({ paymentIntent, items, shippingAddress, email }) {
  const apiKey = process.env.GELATO_API_KEY
  if (!apiKey) throw new Error('GELATO_API_KEY is not configured')

  const orderPayload = {
    orderReferenceId:    `jayl-${paymentIntent.id}`,
    customerReferenceId: email || 'unknown',
    currency: CURRENCY.toUpperCase(),
    items: items.map((item) => {
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

  const gelatoRes = await fetch(GELATO_ORDER_URL, {
    method:  'POST',
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

async function handleCreateOrder(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { paymentIntentId } = req.body || {}
    if (typeof paymentIntentId !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
      return res.status(400).json({ error: 'Invalid payment intent id' })
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status !== 'succeeded') {
      return res.status(403).json({ error: 'Payment not confirmed' })
    }

    if (pi.metadata?.gelatoOrderId) {
      return res.status(200).json({
        orderId:          pi.metadata.gelatoOrderId,
        orderReferenceId: `jayl-${pi.id}`,
        status:           'already_fulfilled',
        trackingInfo:     null,
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

    try {
      await stripe.paymentIntents.update(pi.id, {
        metadata: { ...pi.metadata, gelatoOrderId: gelatoOrder.id || '' },
      })
    } catch (e) {
      console.error('[create-order] Failed to update PI metadata', e.message)
    }

    // Send order confirmation email — non-blocking, never throws
    const customerEmail = pi.metadata?.email || pi.receipt_email
    if (customerEmail) {
      let shippingAddrForEmail = {}
      try { shippingAddrForEmail = JSON.parse(pi.metadata?.shippingAddress || '{}') } catch {}
      const { subject, html } = buildOrderConfirmationEmail({
        orderId:         gelatoOrder.id || `jayl-${pi.id}`,
        items:           items.map(it => ({
          name:      it.product?.name  || it.productId,
          image:     it.product?.image || null,
          color:     it.color          || null,
          size:      it.size           || null,
          quantity:  it.quantity,
          unitPrice: it.unitPrice,
        })),
        total:           parseInt(pi.metadata?.total || '0', 10),
        shipping:        0,
        shippingAddress: shippingAddrForEmail,
      })
      sendEmail({ to: customerEmail, subject, html }) // fire-and-forget
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

// ── track-order ───────────────────────────────────────────────────────────────

async function handleTrackOrder(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey  = process.env.GELATO_API_KEY
  const storeId = process.env.GELATO_STORE_ID
  if (!apiKey)  return res.status(500).json({ error: 'GELATO_API_KEY not configured' })
  if (!storeId) return res.status(500).json({ error: 'GELATO_STORE_ID not configured' })

  const { orderId } = req.query
  if (!orderId?.trim()) return res.status(400).json({ error: 'orderId required' })

  try {
    const gelatoRes = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/orders/${encodeURIComponent(orderId.trim())}`,
      { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
    )
    if (gelatoRes.status === 404) {
      return res.status(404).json({ error: 'Order not found. Check your order ID and try again.' })
    }
    if (!gelatoRes.ok) {
      const err = await gelatoRes.json().catch(() => ({}))
      throw new Error(`Gelato API ${gelatoRes.status}: ${err.message || gelatoRes.statusText}`)
    }
    const order = await gelatoRes.json()
    return res.status(200).json({ order })
  } catch (err) {
    console.error('[track-order]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── contact ───────────────────────────────────────────────────────────────────

async function handleContact(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, subject, message } = req.body || {}

  if (!name?.trim())    return res.status(400).json({ error: 'Name is required' })
  if (!email?.trim())   return res.status(400).json({ error: 'Email is required' })
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) return res.status(400).json({ error: 'Invalid email address' })

  try {
    // Notify store owner
    const notification = buildContactNotificationEmail({
      name:    name.trim(),
      email:   email.trim(),
      subject: subject?.trim() || '',
      message: message.trim(),
    })
    await sendEmail({ to: STORE_EMAIL_ADDRESS, ...notification, replyTo: email.trim() })

    // Auto-reply to customer
    const autoReply = buildContactAutoReplyEmail({ name: name.trim() })
    await sendEmail({ to: email.trim(), ...autoReply })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[contact]', err.message)
    return res.status(500).json({ error: 'Could not send message. Please try again.' })
  }
}

// ── Main router ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!cors(req, res)) return

  const h = req.query.handler
  if (h === 'track-order') {
    if (rateLimit(req, { max: 20, windowMs: 60_000 })) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }
    return handleTrackOrder(req, res)
  }

  if (h === 'get-orders')   return handleGetOrders(req, res)
  if (h === 'create-order') return handleCreateOrder(req, res)
  if (h === 'contact')      return handleContact(req, res)

  return res.status(404).json({ error: `Unknown orders handler: ${h}` })
}
