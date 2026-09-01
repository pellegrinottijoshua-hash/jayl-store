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
import { adminProducts } from '../src/data/admin-products.js'
import {
  sendEmail,
  buildOrderConfirmationEmail,
  buildContactNotificationEmail,
  buildContactAutoReplyEmail,
  STORE_EMAIL_ADDRESS,
} from './_lib/email.js'
import { resolvePlacement, assertPrintable } from './_lib/placement.js'
import { ghGet, ghPut } from './_lib/github.js'
import { recordDropSale } from './_lib/drop-sales.js'

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

async function createGelatoOrder({ paymentIntent, items, shippingAddress, email }) {
  // No GELATO_STORE_ID here — see the comment on orderPayload below for why.
  const apiKey = (process.env.GELATO_API_KEY || '').trim()
  if (!apiKey) throw new Error('GELATO_API_KEY is not configured')

  const shippingPayload = {
    firstName:    shippingAddress.firstName,
    lastName:     shippingAddress.lastName,
    addressLine1: shippingAddress.address,
    city:         shippingAddress.city,
    state:        shippingAddress.state || '',
    postCode:     shippingAddress.zip,
    country:      shippingAddress.country || 'US',
    email:        email || '',
    phone:        shippingAddress.phone || '',
  }

  // Resolve the correct Gelato productUid for each item.
  // For every item we always use v4/orders with productUid + files[].
  // storeProductVariantId (ecommerce endpoint) is NOT used — it leaves orders
  // in "not_connected" state for direct API integrations.
  const resolvedItems = items.map((item) => {
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
    return { item, gelatoVariant, itemRef }
  })

  // ── Standard orders API v4 ─────────────────────────────────────────────────
  const mappedItems = resolvedItems.map(({ item, gelatoVariant, itemRef }) => {
    // gelatoVariantId is the full productUid (e.g. apparel_product_gca_t-shirt_..._gco_sand_...)
    // gelatoProductId is the fallback (either the same uid or a store product UUID)
    const productUid = gelatoVariant?.gelatoVariantId ?? item.product.gelatoProductId
    // Which side prints is decided by Gelato's own gpr_<front>-<back> segment in
    // the productUid, NOT by the collection name. See api/_lib/placement.js.
    const placement = resolvePlacement(item.product, productUid)
    // Throws when the print file is missing or is a mockup photo — front and back
    // alike. Never fall back to item.product.image: that is a photograph.
    const printFileUrl = assertPrintable(item.product, placement)
    console.log('[create-order] item', item.productId,
      'color:', item.color, 'size:', item.size,
      '→ productUid:', productUid?.slice(0, 80),
      '| placement:', placement.type, `(da ${placement.source}, gpr_${placement.gpr ?? 'n/a'})`,
      '| neckLabelUrl:', item.product.neckLabelUrl ? 'set' : 'none')
    return {
      itemReferenceId: itemRef,
      productUid,
      quantity:        item.quantity,
      files: [
        { type: placement.type, url: printFileUrl },
        ...(item.product.neckLabelUrl
          ? [{ type: 'neck-inner', url: item.product.neckLabelUrl }]
          : []),
      ],
    }
  })

  // storeId is deliberately NOT sent here. Attaching it routes the order through
  // Gelato's connected-store flow, which tries to match each item against a
  // pre-mapped SKU in the store catalog ("Connect product" in the Gelato
  // dashboard). Our products were never mapped that way — the whole point of
  // this direct productUid + files[] flow is to skip that mapping — so every
  // item comes back "not connected to Gelato", and for products with more than
  // one file (a back print + an inner-neck label) Gelato additionally refuses
  // with "Can't combine multiple files into production one", because the
  // store-catalog flow expects a single pre-attached production file per SKU,
  // not the per-order files[] array the direct v4 API supports. Confirmed live
  // on the Altaria order (2026-08-31 22:32): both symptoms disappear once
  // storeId is absent from this payload. GELATO_STORE_ID stays in use for the
  // read-only ecommerce.gelatoapis.com endpoints below (get-orders, get-order),
  // which are legitimately store-scoped listings — this is about CREATE only.
  const orderPayload = {
    orderReferenceId:    `jayl-${paymentIntent.id}`,
    customerReferenceId: email || 'unknown',
    currency:            CURRENCY.toUpperCase(),
    items:               mappedItems,
    shippingAddress:     shippingPayload,
  }

  console.log('[create-order] → orders API v4', JSON.stringify({
    ...orderPayload,
    items: orderPayload.items.map(i => ({ ...i, files: '[omitted]' }))
  }))

  const gelatoRes = await fetch('https://order.gelatoapis.com/v4/orders', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body:    JSON.stringify(orderPayload),
  })
  const body = await gelatoRes.json().catch(() => ({}))
  if (!gelatoRes.ok) {
    const err = new Error(`Gelato ${gelatoRes.status}: ${body.message || body.error || JSON.stringify(body)}`)
    err.status = gelatoRes.status; err.body = body
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

    // Contatore del drop. Non deve mai far fallire un ordine già pagato ed evaso:
    // se questa scrittura salta, il contatore è indietro, non il cliente senza maglietta.
    try {
      await recordDropSale(pi.id, items)
    } catch (err) {
      console.error('[create-order] recordDropSale failed:', err.message)
    }

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

const EMAILS_PATH   = 'src/data/emails.json'
const CARTS_PATH    = 'src/data/abandoned-carts.json'

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

// ── gmf — Google Merchant Center RSS 2.0 / Shopping feed ─────────────────────

function escapeXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function handleGmf(req, res) {
  const items = adminProducts.map(p => {
    const price      = ((p.price ?? 0) / 100).toFixed(2)
    const imageUrl   = p.image || (p.images?.[0] ?? '')
    const link       = `https://jayl.store/product/${p.id}`
    const extraImgs  = (p.images || []).slice(0, 10).filter(u => u && u !== imageUrl)
      .map(u => `    <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`).join('\n')
    const sizes      = (p.sizes || []).map(s => s.id || s.label).filter(Boolean)
    return `  <item>
    <g:id>${escapeXml(p.id)}</g:id>
    <g:title>${escapeXml(p.seoTitle || p.name)}</g:title>
    <g:description>${escapeXml((p.description || '').slice(0, 5000))}</g:description>
    <g:link>${link}</g:link>
    <g:image_link>${escapeXml(imageUrl)}</g:image_link>
${extraImgs ? extraImgs + '\n' : ''}    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>${price} EUR</g:price>
    <g:brand>JAYL</g:brand>
    <g:mpn>${escapeXml(p.id)}</g:mpn>
    <g:item_group_id>${escapeXml(p.id)}</g:item_group_id>
    <g:product_type>Apparel &amp; Accessories &gt; Clothing &gt; Shirts &amp; Tops</g:product_type>
    <g:google_product_category>212</g:google_product_category>
    <g:gender>unisex</g:gender>
    <g:age_group>adult</g:age_group>
    <g:material>cotton</g:material>
${sizes.length > 0 ? `    <g:size>${escapeXml(sizes.join(', '))}</g:size>\n` : ''}    <g:shipping><g:country>US</g:country><g:service>Free Shipping</g:service><g:price>0 EUR</g:price></g:shipping>
    ${p.collection ? `<g:custom_label_0>${escapeXml(p.collection)}</g:custom_label_0>` : ''}
  </item>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>JAYL — Premium Art &amp; Wearable Art</title>
  <link>https://jayl.store</link>
  <description>Premium print-on-demand art and apparel by JAYL. Free worldwide shipping.</description>
${items}
</channel>
</rss>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return res.status(200).send(xml)
}

// ── Prerender for social crawlers ──────────────────────────────────────────────
// The storefront is a client-rendered SPA, so bots that don't run JS (Facebook,
// Pinterest, Twitter, LinkedIn, WhatsApp…) only see the generic index.html meta.
// vercel.json rewrites ONLY crawler user-agents for /product/:id and
// /collection/:slug to this handler, which returns real per-page OG/Twitter tags
// + Product JSON-LD (price/availability → Pinterest Rich Pins). Real users are
// untouched — they keep hitting the static SPA on the CDN.
const SITE_URL       = 'https://jayl.store'
const PRERENDER_DESC = 'Premium print-on-demand art and wearable art by JAYL.'
const absUrl   = (u) => !u ? '' : (/^https?:\/\//i.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`)
// Must mirror CollectionPage.collectionSlug EXACTLY (no diacritics normalization)
// so prerendered /collection/:slug matches the same products the SPA routes to.
const colSlug  = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// Mirrors LEGACY_COLLECTION_SLUGS in CollectionPage.jsx — collection URLs the
// sitemap once built from the admin collection id instead of product.collection.
const LEGACY_COLLECTION_SLUGS = { 'cool-pok-mon-back': 'cool-pokemon-back' }
const ogImageFor = (p) => {
  const params = new URLSearchParams()
  params.set('title', p.seoTitle || p.name || 'JAYL')
  const img = absUrl(p.image || p.images?.[0] || '')
  if (img) params.set('image', img)
  return `${SITE_URL}/api/og?${params.toString()}`
}

function prerenderHtml({ title, description, image, url, jsonLd, ogType = 'website', h1 }) {
  const e = escapeXml
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''
  const img = image ? `<meta property="og:image" content="${e(image)}" /><meta name="twitter:image" content="${e(image)}" />` : ''
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(title)}</title>
<meta name="description" content="${e(description)}" />
<link rel="canonical" href="${e(url)}" />
<meta property="og:type" content="${e(ogType)}" />
<meta property="og:site_name" content="JAYL" />
<meta property="og:title" content="${e(title)}" />
<meta property="og:description" content="${e(description)}" />
<meta property="og:url" content="${e(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${e(title)}" />
<meta name="twitter:description" content="${e(description)}" />
${img}
${ld}
</head><body>
<h1>${e(h1 || title)}</h1>
<p>${e(description)}</p>
${image ? `<img src="${e(image)}" alt="${e(h1 || title)}" width="600" />` : ''}
<p><a href="${e(url)}">View on JAYL &rarr;</a></p>
</body></html>`
}

function handlePrerender(req, res) {
  const path = String(req.query.path || '/')
  let html = null

  if (path.startsWith('/product/')) {
    const id = decodeURIComponent(path.slice(9)).replace(/\/+$/, '')
    const p  = adminProducts.find(x => x.id === id)
    if (p) {
      const name        = p.seoTitle || p.name
      const description = (p.seoDescription || p.description || PRERENDER_DESC).replace(/\s+/g, ' ').trim().slice(0, 280)
      const url         = `${SITE_URL}/product/${p.id}`
      const images      = [absUrl(p.image), ...(p.images || []).map(absUrl)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6)
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type':    'Product',
        name,
        image:       images,
        description,
        brand:      { '@type': 'Brand', name: 'JAYL' },
        offers: {
          '@type':        'Offer',
          price:          ((p.price ?? 0) / 100).toFixed(2),
          priceCurrency:  'EUR',
          availability:   'https://schema.org/InStock',
          url,
        },
      }
      html = prerenderHtml({ title: `${name} — JAYL`, description, image: ogImageFor(p), url, jsonLd, ogType: 'product', h1: name })
    }
  } else if (path.startsWith('/collection/')) {
    const raw   = decodeURIComponent(path.slice(12)).replace(/\/+$/, '')
    const slug  = LEGACY_COLLECTION_SLUGS[raw] ?? raw
    const inCol = adminProducts.filter(p => colSlug(p.collection) === slug)
    if (inCol.length) {
      const name = inCol[0].collection || slug
      html = prerenderHtml({
        title:       `${name} — JAYL`,
        description: `Shop the ${name} collection at JAYL — ${inCol.length} pieces of premium print-on-demand wearable art.`.slice(0, 280),
        image:       ogImageFor(inCol[0]),
        // Always the canonical slug, so a legacy URL points crawlers at the real one
        url:         `${SITE_URL}/collection/${slug}`,
        h1:          name,
      })
    }
  }

  if (!html) {
    html = prerenderHtml({
      title:       'JAYL — Premium Art & Wearable Art',
      description: PRERENDER_DESC,
      image:       `${SITE_URL}/api/og`,
      url:         SITE_URL + path,
    })
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  return res.status(200).send(html)
}

// ── Router ────────────────────────────────────────────────────────────────────

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
  if (h === 'gmf')               return handleGmf(req, res)
  if (h === 'prerender')         return handlePrerender(req, res)

  return res.status(404).json({ error: `Unknown orders handler: ${h}` })
}
