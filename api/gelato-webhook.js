/**
 * api/gelato-webhook.js
 *
 * Receives order status callbacks from Gelato and sends the customer
 * a shipping notification email (with tracking code + URL) when the
 * order is marked as shipped.
 *
 * Configure in Gelato dashboard → Store → Webhooks:
 *   URL:    https://jayl.store/api/gelato-webhook
 *   Events: order_status_updated
 *
 * Optional: set GELATO_WEBHOOK_SECRET in Vercel env vars to enable
 * HMAC-SHA256 signature verification (recommended for production).
 */

import { applyCors }         from './_lib/cors.js'
import { sendEmail, buildShippingEmail, STORE_EMAIL_ADDRESS } from './_lib/email.js'
import crypto                from 'crypto'

// Disable body parser — we need the raw body for HMAC verification
export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifySignature(rawBody, signature, secret) {
  if (!secret) return true  // skip if not configured
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature || '', 'hex'),
    Buffer.from(expected,       'hex')
  )
}

export default async function handler(req, res) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  let rawBody
  try { rawBody = await readRawBody(req) }
  catch { return res.status(400).json({ error: 'Failed to read body' }) }

  // ── Signature verification (optional) ────────────────────────────────────
  const secret    = process.env.GELATO_WEBHOOK_SECRET
  const signature = req.headers['x-gelato-signature'] || ''
  if (!verifySignature(rawBody, signature, secret)) {
    console.error('[gelato-webhook] Invalid signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let event
  try { event = JSON.parse(rawBody.toString('utf8')) }
  catch { return res.status(400).json({ error: 'Invalid JSON' }) }

  console.log('[gelato-webhook] event:', event?.event, '| status:', event?.data?.fulfillmentStatus)

  // ── Only act on shipped orders ────────────────────────────────────────────
  const data   = event?.data || {}
  const status = (data.fulfillmentStatus || data.status || '').toLowerCase()

  if (event?.event !== 'order_status_updated' || status !== 'shipped') {
    return res.status(200).json({ ok: true, skipped: true })
  }

  // ── Extract customer info & tracking ─────────────────────────────────────
  const customerEmail  = data.customerReferenceId || ''
  const orderId        = data.orderReferenceId    || data.id || ''
  const shipment       = data.shipment || data.shipments?.[0] || {}
  const trackingCode   = shipment.trackingCode   || shipment.tracking_code   || ''
  const trackingUrl    = shipment.trackingUrl    || shipment.tracking_url    || ''
  const shipmentMethod = shipment.shipmentMethodName || shipment.method_name || ''

  if (!customerEmail || !customerEmail.includes('@')) {
    console.warn('[gelato-webhook] No valid customer email in customerReferenceId:', customerEmail)
    return res.status(200).json({ ok: true, skipped: true, reason: 'no customer email' })
  }

  // ── Send shipping email ───────────────────────────────────────────────────
  const { subject, html } = buildShippingEmail({
    orderId,
    customerName: '',     // Gelato doesn't pass the name here; leave empty = "Hi there"
    trackingCode,
    trackingUrl,
    shipmentMethod,
  })

  const result = await sendEmail({ to: customerEmail, subject, html })
  console.log('[gelato-webhook] shipping email sent to', customerEmail, '— result:', result)

  // Also notify store owner (optional — remove if noisy)
  await sendEmail({
    to:      STORE_EMAIL_ADDRESS,
    subject: `[JAYL] Order shipped · ${orderId}`,
    html:    `<p>Order <strong>${orderId}</strong> has been shipped to <strong>${customerEmail}</strong>.<br>Tracking: ${trackingCode || 'N/A'} — <a href="${trackingUrl}">${trackingUrl}</a></p>`,
  }).catch(() => {})

  return res.status(200).json({ ok: true })
}
