import Stripe from 'stripe'
import { decodeItemsFromMetadata, colorToSlug, CURRENCY } from './_lib/catalog.js'
import { sendEmail, buildOrderConfirmationEmail } from './_lib/email.js'

// Disable Vercel's default body parser — Stripe needs the raw body to verify the signature
export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end',   () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function fulfillIfNeeded(paymentIntent) {
  // Idempotency: skip if already fulfilled by /api/create-order or a previous webhook.
  if (paymentIntent.metadata?.gelatoOrderId) {
    console.log('[webhook] PI', paymentIntent.id, 'already fulfilled — skipping')
    return
  }

  const items = decodeItemsFromMetadata(paymentIntent.metadata?.items)
  if (!items.length) {
    console.warn('[webhook] No items in PI metadata — skipping')
    return
  }

  const missing = items.find((it) => !it.product?.gelatoProductId)
  if (missing) {
    console.error('[webhook] Missing gelatoProductId for', missing.productId, '— skipping')
    return
  }

  let shippingAddress
  try { shippingAddress = JSON.parse(paymentIntent.metadata?.shippingAddress || '{}') }
  catch { console.warn('[webhook] Bad shipping address — skipping'); return }
  if (!shippingAddress.firstName) {
    console.warn('[webhook] Empty shipping address — skipping')
    return
  }

  const apiKey  = (process.env.GELATO_API_KEY  || '').trim()
  const storeId = (process.env.GELATO_STORE_ID || '').trim()
  if (!apiKey) {
    console.error('[webhook] GELATO_API_KEY is not configured — skipping')
    return
  }

  const shippingPayload = {
    firstName:    shippingAddress.firstName || '',
    lastName:     shippingAddress.lastName  || '',
    addressLine1: shippingAddress.address   || '',
    city:         shippingAddress.city      || '',
    state:        shippingAddress.state     || '',
    postCode:     shippingAddress.zip       || '',
    country:      shippingAddress.country   || 'US',
    email:        paymentIntent.metadata?.email || '',
    phone:        shippingAddress.phone || '',
  }

  // Always use v4/orders with productUid + files[].
  // storeProductVariantId (ecommerce endpoint) leaves orders "not_connected" for direct API.
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
  const orderPayload = {
    orderReferenceId:    `jayl-${paymentIntent.id}`,
    customerReferenceId: paymentIntent.metadata?.email || 'unknown',
    currency:            CURRENCY.toUpperCase(),
    ...(storeId ? { storeId } : {}),
    items: resolvedItems.map(({ item, gelatoVariant, itemRef }) => {
      const productUid = gelatoVariant?.gelatoVariantId ?? item.product.gelatoProductId
      console.log('[webhook] item', item.productId,
        'color:', item.color, 'size:', item.size,
        '→ productUid:', productUid?.slice(0, 80),
        '| printFileUrl:', item.product.printFileUrl ? 'set' : 'MISSING',
        '| neckLabelUrl:', item.product.neckLabelUrl ? 'set' : 'none')
      return {
        itemReferenceId: itemRef,
        productUid,
        quantity:        item.quantity,
        files: [
          { type: 'default', url: item.product.printFileUrl || item.product.image },
          ...(item.product.neckLabelUrl
            ? [{ type: 'neck-inner', url: item.product.neckLabelUrl }]
            : []),
        ],
      }
    }),
    shippingAddress: shippingPayload,
  }
  console.log('[webhook] → orders API v4')
  const gelatoRes = await fetch('https://order.gelatoapis.com/v4/orders', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body:    JSON.stringify(orderPayload),
  })

  if (!gelatoRes.ok) {
    const text = await gelatoRes.text().catch(() => '')
    console.error('[webhook] Gelato order failed:', gelatoRes.status, text)
    return
  }

  const order = await gelatoRes.json()
  console.log('[webhook] Gelato order created from webhook fallback:', order.id)

  try {
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: { ...paymentIntent.metadata, gelatoOrderId: order.id || '' },
    })
  } catch (e) {
    console.error('[webhook] Failed to write gelatoOrderId back:', e.message)
  }

  // Send order confirmation email to customer — non-blocking, never throws
  const customerEmail = paymentIntent.metadata?.email || paymentIntent.receipt_email
  if (customerEmail) {
    try {
      const { subject, html } = buildOrderConfirmationEmail({
        orderId:         order.id || `jayl-${paymentIntent.id}`,
        items:           items.map(it => ({
          name:      it.product?.name      || it.productId,
          image:     it.product?.image     || null,
          color:     it.color              || null,
          size:      it.size               || null,
          quantity:  it.quantity,
          unitPrice: it.unitPrice,
        })),
        total:           parseInt(paymentIntent.metadata?.total  || '0', 10),
        shipping:        0,
        shippingAddress: shippingAddress,
      })
      await sendEmail({ to: customerEmail, subject, html })
    } catch (e) {
      console.error('[webhook] sendEmail failed:', e.message)
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed')

  const sig = req.headers['stripe-signature']
  if (!sig) return res.status(400).send('Missing stripe-signature header')

  const rawBody = await readRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object
      console.log('[webhook] payment_intent.succeeded:', pi.id)
      // Re-fetch in case the PI metadata was just updated by /api/create-order
      // racing the webhook delivery.
      try {
        const fresh = await stripe.paymentIntents.retrieve(pi.id)
        await fulfillIfNeeded(fresh)
      } catch (err) {
        console.error('[webhook] fulfillIfNeeded failed:', err.message)
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      console.warn('[webhook] payment_intent.payment_failed:', pi.id, pi.last_payment_error?.message)
      break
    }

    default:
      break
  }

  return res.status(200).json({ received: true })
}
