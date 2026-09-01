import Stripe from 'stripe'
import {
  priceItems,
  computeTotals,
  validateAddress,
  encodeItemsForMetadata,
  applyDiscount,
  bundleAdjustment,
  CURRENCY,
} from './_lib/catalog.js'
import { resolvePlacement, assertPrintable } from './_lib/placement.js'
import { applyCors } from './_lib/cors.js'
import { productState, isDropOpen, capFor, getDrop, VAULT, DROP } from './_lib/drop.js'
import { soldFor } from './_lib/drop-sales.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })

const METADATA_VALUE_LIMIT = 500

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Key sanity check — logged on every call so we can confirm which mode is active
  const keyPrefix = (process.env.STRIPE_SECRET_KEY || '').slice(0, 12)
  console.log('[create-payment-intent] called — key prefix:', keyPrefix)

  try {
    const { items: rawItems, shippingAddress, discountCode } = req.body || {}

    // Server-side price lookup — never trust client-supplied unitPrice/total.
    const priced = priceItems(rawItems)
    if (!priced.ok) return res.status(400).json({ error: priced.error })

    // Fulfillment check BEFORE taking any money.
    //
    // create-order and the Stripe webhook both refuse to send an item to Gelato
    // without a real print file — but they run *after* the payment succeeds. Until
    // this check existed, a product saved without artwork could be paid for in full
    // and then silently fail to produce an order: the customer was charged, no
    // shirt was ever made, and the money sat in Stripe waiting for a manual refund.
    // Reject at the payment intent instead, so the charge never happens.
    for (const item of priced.items) {
      // priceItem already resolved the variant from colour+size — reuse it rather
      // than repeating the matching rules and risking a different answer here.
      const productUid = item.variantObj?.gelatoVariantId ?? item.product?.gelatoProductId
      try {
        assertPrintable(item.product, resolvePlacement(item.product, productUid))
      } catch (err) {
        console.error('[create-payment-intent] unfulfillable item blocked:', err.message)
        return res.status(409).json({
          error: `"${item.product?.name || item.productId}" non è al momento disponibile. Rimuovilo dal carrello per completare l'ordine.`,
        })
      }
    }

    // Gate del drop. Copre tre problemi con un solo controllo: prodotti nascosti
    // che sopravvivono in un carrello persistito (cartStore salva l'intero oggetto
    // prodotto in localStorage, non l'id), drop scaduti, ed edizioni esaurite.
    // Senza questo, "EDITION OF 20" sarebbe una dichiarazione falsa.
    const cfg = getDrop()
    const dropOpen = isDropOpen(new Date(), cfg)

    for (const item of priced.items) {
      const state = productState(item.productId, cfg)

      if (state === VAULT) {
        return res.status(409).json({
          error: `"${item.product?.name || item.productId}" non è più disponibile. Rimuovilo dal carrello per completare l'ordine.`,
        })
      }

      if (state === DROP && !dropOpen) {
        const next = cfg.next?.startsAt
          ? new Date(cfg.next.startsAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
          : null
        return res.status(409).json({
          error: next
            ? `Il drop è chiuso. Il prossimo apre il ${next}.`
            : 'Il drop è chiuso.',
        })
      }

      if (state === DROP) {
        const cap = capFor(item.productId, cfg)
        // Fail-open: se il registro non è leggibile lasciamo passare e logghiamo.
        // Vendere 21 pezzi su 20 è recuperabile; bloccare ogni checkout perché
        // GitHub ha singhiozzato non lo è.
        try {
          const sold = await soldFor(cfg.current.id, item.productId)
          if (cap && sold + item.quantity > cap) {
            return res.status(409).json({
              error: `"${item.product?.name || item.productId}" è esaurito: l'edizione è chiusa a ${cap} pezzi.`,
            })
          }
        } catch (err) {
          console.error('[create-payment-intent] cap check unavailable, allowing:', err.message)
        }
      }
    }

    const addrCheck = validateAddress(shippingAddress)
    if (!addrCheck.ok) return res.status(400).json({ error: addrCheck.error })
    const addr = addrCheck.address

    const { subtotal, total: rawTotal } = computeTotals(priced.items)

    // Apply discount code if provided
    let discountAmount = 0
    let discountLabel  = null
    if (discountCode?.trim()) {
      const disc = applyDiscount(subtotal, discountCode, priced.items)
      if (!disc.ok) return res.status(400).json({ error: disc.error })
      discountAmount = disc.amount
      discountLabel  = disc.label
    }

    // Sconto bundle automatico — nessun codice, si applica da solo e si somma.
    const bundle = bundleAdjustment(priced.items)
    if (bundle.amount > 0) {
      discountAmount += bundle.amount
      discountLabel   = discountLabel ? `${discountLabel} + ${bundle.label}` : bundle.label
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
    console.error('[create-payment-intent] ERROR:', err.message, err.type, err.code)
    return res.status(500).json({ error: err.message || 'Could not initialize payment' })
  }
}
