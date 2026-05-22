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
import { decodeItemsFromMetadata, colorToSlug, applyDiscount, CURRENCY } from './_lib/catalog.js'
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
  const apiKey  = (process.env.GELATO_API_KEY  || '').trim()
  const storeId = (process.env.GELATO_STORE_ID || '').trim()
  if (!apiKey) throw new Error('GELATO_API_KEY is not configured')

  // UUID v4 pattern — identifies a Gelato *store* product vs a catalog product UID
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const mappedItems = items.map((item) => {
    // Try to find the exact variant by color + size
    const gelatoVariant = item.product.variants?.find((v) => {
      const colorMatch =
        colorToSlug(v.color) === colorToSlug(item.color) ||
        (v.uid ?? v.id) === item.color
      const sizeMatch =
        !item.size ||
        v.size === item.size ||
        v.size?.toUpperCase() === item.size?.toUpperCase()
      return colorMatch && sizeMatch
    })

    const itemRef = `${item.productId}__${item.size || '-'}__${item.frame || 'none'}__${item.color || '-'}`

    // ── Store product approach (UUID gelatoProductId) ──────────────────────────
    // Products created via Gelato's store already have their design saved.
    // Use storeProductVariantId (variant.uid) — no files needed.
    const isStoreProduct = UUID_RE.test(item.product.gelatoProductId ?? '')
    if (isStoreProduct && gelatoVariant?.uid) {
      console.log('[create-order] item', item.productId,
        'color:', item.color, 'size:', item.size,
        '→ storeProductId:', item.product.gelatoProductId,
        '→ storeProductVariantId:', gelatoVariant.uid)
      return {
        itemReferenceId:       itemRef,
        storeProductId:        item.product.gelatoProductId,
        storeProductVariantId: gelatoVariant.uid,
        quantity:              item.quantity,
      }
    }

    // ── Catalog product approach (productUid + files) ─────────────────────────
    const productUid = gelatoVariant?.gelatoVariantId ?? item.product.gelatoProductId
    console.log('[create-order] item', item.productId,
      'color:', item.color, 'size:', item.size,
      '→ catalog productUid:', productUid?.slice(0, 60))

    return {
      itemReferenceId: itemRef,
      productUid,
      quantity: item.quantity,
      files: [
        { type: 'default', url: item.product.printFileUrl || item.product.image },
        ...(item.product.neckLabelUrl
          ? [{ type: 'neck-inner', url: item.product.neckLabelUrl }]
          : []),
      ],
    }
  })

  const orderPayload = {
    orderReferenceId:    `jayl-${paymentIntent.id}`,
    customerReferenceId: email || 'unknown',
    currency: CURRENCY.toUpperCase(),
    ...(storeId ? { storeId } : {}),
    items: mappedItems,
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

  console.log('[create-order] sending to Gelato →', JSON.stringify({
    ...orderPayload,
    items: orderPayload.items.map(i => ({ ...i, files: '[omitted]' }))
  }))

  const gelatoRes = await fetch(GELATO_ORDER_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body:    JSON.stringify(orderPayload),
  })
  const body = await gelatoRes.json().catch(() => ({}))
  if (!gelatoRes.ok) {
    const err = new Error(`Gelato ${gelatoRes.status}: ${body.message || body.error || JSON.stringify(body)}`)
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

    // Mark abandoned cart as converted — fire-and-forget
    if (customerEmail) {
      fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/capture-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cart-converted', email: customerEmail }),
      }).catch(e => console.warn('[create-order] cart-converted failed:', e.message))
    }
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
    console.error('[create-order] FAILED', err.status || '', err.message, JSON.stringify(err.body || {}))
    // Return the real Gelato error message so it's visible in logs + client
    return res.status(500).json({
      error: err.message || 'Could not create order',
      _gelatoBody: err.body || null,
    })
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

// ── capture-email (absorbed from api/capture-email.js) ───────────────────────

const GITHUB_OWNER  = 'pellegrinottijoshua-hash'
const GITHUB_REPO   = 'jayl-store'
const GITHUB_BRANCH = 'main'
const EMAILS_PATH   = 'src/data/emails.json'
const CARTS_PATH    = 'src/data/abandoned-carts.json'

async function ghGet(path, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`)
  return res.json()
}

async function ghPut(path, content, sha, message, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${JSON.stringify(err.message || err)}`)
  }
  return res.json()
}

async function readCarts(token) {
  try {
    const file = await ghGet(CARTS_PATH, token)
    return { carts: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')), sha: file.sha }
  } catch {
    return { carts: [], sha: null }
  }
}

async function writeCarts(carts, sha, message, token) {
  await ghPut(CARTS_PATH, JSON.stringify(carts, null, 2) + '\n', sha, message, token)
}

async function handleCaptureEmail(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (rateLimit(req, { max: 20, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const { email, action } = req.body || {}

  // ── Cart capture ────────────────────────────────────────────────────────────
  if (action === 'cart') {
    const { cartItems } = req.body || {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email?.trim() || !emailRegex.test(email.trim())) {
      return res.status(400).json({ ok: false })
    }
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return res.status(200).json({ ok: true })
    try {
      const { carts, sha } = await readCarts(githubToken)
      const normalised = email.trim().toLowerCase()
      const idx = carts.findIndex(c => c.email === normalised)
      const entry = {
        id: idx >= 0 ? carts[idx].id : `cart_${Date.now()}`,
        email:      normalised,
        cartItems:  cartItems || [],
        capturedAt: new Date().toISOString(),
        sent:       false,
        converted:  false,
      }
      if (idx >= 0) carts[idx] = entry; else carts.push(entry)
      carts.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
      carts.splice(500)
      await writeCarts(carts, sha, `[cart] capture ${normalised} [skip ci]`, githubToken)
    } catch (e) {
      console.warn('[capture-email] cart capture error:', e.message)
    }
    return res.status(200).json({ ok: true })
  }

  // ── Mark cart converted ─────────────────────────────────────────────────────
  if (action === 'cart-converted') {
    const githubToken = process.env.GITHUB_TOKEN
    if (email?.trim() && githubToken) {
      try {
        const normalised = email.trim().toLowerCase()
        const { carts, sha } = await readCarts(githubToken)
        const idx = carts.findIndex(c => c.email === normalised)
        if (idx >= 0 && !carts[idx].converted) {
          carts[idx].converted = true
          await writeCarts(carts, sha, `[cart] converted ${normalised} [skip ci]`, githubToken)
        }
      } catch (e) {
        console.warn('[capture-email] cart-converted error:', e.message)
      }
    }
    return res.status(200).json({ ok: true })
  }

  // ── Newsletter capture ──────────────────────────────────────────────────────
  if (!email?.trim()) return res.status(400).json({ error: 'email required' })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) return res.status(400).json({ error: 'Invalid email' })

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    return res.status(503).json({ error: 'Email capture not available. Please try again later.' })
  }

  try {
    let emails = []; let sha = null
    try {
      const file = await ghGet(EMAILS_PATH, githubToken)
      sha = file.sha
      emails = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'))
    } catch { /* File doesn't exist yet */ }

    const normalised = email.trim().toLowerCase()
    if (emails.find(e => e.email === normalised)) {
      return res.status(200).json({ ok: true, duplicate: true })
    }

    emails.push({ email: normalised, subscribedAt: new Date().toISOString() })
    await ghPut(
      EMAILS_PATH,
      JSON.stringify(emails, null, 2) + '\n',
      sha,
      `newsletter: new subscriber ${normalised}`,
      githubToken
    )
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[capture-email]', err.message)
    return res.status(200).json({ ok: true })
  }
}

// ── validate-discount (absorbed from api/validate-discount.js) ────────────────

async function handleValidateDiscount(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (rateLimit(req, { max: 15, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const { code, subtotal } = req.body || {}
  if (!code?.trim()) return res.status(400).json({ error: 'code required' })
  if (!subtotal || subtotal < 1) return res.status(400).json({ error: 'subtotal required' })

  const result = applyDiscount(Number(subtotal), code)
  if (!result.ok) return res.status(400).json({ error: result.error })

  return res.status(200).json({
    valid:          true,
    code:           String(code).trim().toUpperCase(),
    discountAmount: result.amount,
    discountLabel:  result.label,
  })
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

  if (h === 'get-orders')        return handleGetOrders(req, res)
  if (h === 'create-order')      return handleCreateOrder(req, res)
  if (h === 'contact')           return handleContact(req, res)
  if (h === 'capture-email')     return handleCaptureEmail(req, res)
  if (h === 'validate-discount') return handleValidateDiscount(req, res)

  return res.status(404).json({ error: `Unknown orders handler: ${h}` })
}
