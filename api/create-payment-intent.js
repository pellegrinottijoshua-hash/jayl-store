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
import { readSales } from './_lib/drop-sales.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })

const METADATA_VALUE_LIMIT = 500

/**
 * Gate del drop — logica pura, nessun I/O. `soldByProduct` è una
 * Map<productId, sold> già popolata da UNA lettura del registro fatta dal
 * chiamante (vedi evaluateDropGate sotto), oppure `null` quando quella
 * lettura è fallita.
 *
 * Il tally locale (`running`) è quello che chiude il difetto critico trovato
 * in review: se leggessimo `sold` per riga di carrello, due righe dello
 * stesso prodotto (stessa maglietta in taglie diverse — cartStore chiave le
 * righe per `id__size__color__frame`, non per prodotto — o un carrello
 * abusivo con la stessa riga ripetuta N volte) verrebbero misurate ciascuna
 * contro lo stesso punto di partenza e il cap si bypasserebbe. Qui ogni riga
 * successiva dello stesso prodotto si somma al tally già accumulato in
 * *questo* carrello, non solo al valore del registro.
 *
 * `soldByProduct === null` disattiva SOLO il controllo del cap (fail-open,
 * osservabile via il log in evaluateDropGate): VAULT e finestra-chiusa non
 * dipendono dal registro vendite e restano sempre attivi.
 *
 * `now` è un parametro esplicito (mai `new Date()` qui dentro) per restare
 * deterministico nei test — vedi scripts/test-drop-gate.js.
 *
 * Ritorna `null` se il carrello passa il gate, altrimenti
 * `{ status, error }` da rispedire al client invariato.
 */
export function checkDropGate(items, cfg, now, soldByProduct) {
  const dropOpen = isDropOpen(now, cfg)
  const running = new Map() // productId → totale già contato in QUESTO carrello

  for (const item of items) {
    const state = productState(item.productId, cfg)

    if (state === VAULT) {
      return {
        status: 409,
        error: `"${item.product?.name || item.productId}" non è più disponibile. Rimuovilo dal carrello per completare l'ordine.`,
      }
    }

    if (state === DROP && !dropOpen) {
      // isDropOpen è false sia PRIMA di startsAt sia DOPO endsAt. Prima
      // dell'apertura il prossimo drop a cui il cliente ha accesso è quello
      // corrente (cfg.current.startsAt), non cfg.next — altrimenti, nella
      // finestra tra "adesso" e l'apertura del drop corrente, il messaggio
      // annuncia la data del drop SUCCESSIVO invece di quello che il
      // cliente sta effettivamente provando a comprare.
      const beforeOpen = cfg.current?.startsAt && now.getTime() < Date.parse(cfg.current.startsAt)
      const target = beforeOpen ? cfg.current?.startsAt : cfg.next?.startsAt
      const label = target
        ? new Date(target).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
        : null
      return {
        status: 409,
        error: label
          ? `Il drop è chiuso. Il prossimo apre il ${label}.`
          : 'Il drop è chiuso.',
      }
    }

    if (state === DROP) {
      const cap = capFor(item.productId, cfg)
      if (cap && soldByProduct) {
        const base  = running.has(item.productId) ? running.get(item.productId) : (soldByProduct.get(item.productId) ?? 0)
        const total = base + item.quantity
        if (total > cap) {
          return {
            status: 409,
            error: `"${item.product?.name || item.productId}" è esaurito: l'edizione è chiusa a ${cap} pezzi.`,
          }
        }
        running.set(item.productId, total)
      }
      // soldByProduct === null → registro irraggiungibile per l'intero
      // carrello: fail-open già loggato dal chiamante, nessun controllo cap.
    }
  }
  return null
}

/**
 * Wrapper con I/O: legge il registro vendite UNA VOLTA per l'intero carrello
 * (non una volta per riga — un carrello da 50 righe non deve fare 50
 * `ghGet` sequenziali: oltre a essere lento su una funzione senza
 * `maxDuration` esteso, ~100 richieste di quel tipo esauriscono il budget di
 * 5000/h di GitHub, dopo di che ogni lettura fallisce con 403 e il cap-check
 * si disattiva per chiunque — lo stesso attacco della vendita in eccesso,
 * chiuso dalla stessa lettura singola) e applica il gate puro sopra.
 * Fail-open SOLO sul cap: se il registro non è leggibile logghiamo e
 * lasciamo passare — vendere 21 pezzi su 20 è recuperabile, bloccare ogni
 * checkout perché GitHub ha singhiozzato non lo è.
 */
export async function evaluateDropGate(items, cfg, now) {
  const hasDropItem = items.some((item) => productState(item.productId, cfg) === DROP)

  let soldByProduct = new Map()
  if (hasDropItem) {
    try {
      const sales = await readSales(cfg.current.id)
      for (const [productId, entry] of Object.entries(sales.products || {})) {
        soldByProduct.set(productId, entry.sold ?? 0)
      }
    } catch (err) {
      console.error('[create-payment-intent] cap check unavailable, allowing:', err.message)
      soldByProduct = null
    }
  }

  return checkDropGate(items, cfg, now, soldByProduct)
}

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
    // Logica in checkDropGate/evaluateDropGate qui sopra — vedi lì per il perché.
    const cfg = getDrop()
    const gate = await evaluateDropGate(priced.items, cfg, new Date())
    if (gate) return res.status(gate.status).json({ error: gate.error })

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
          discountLabel,
          discountAmount: String(discountAmount),
          // Solo se un codice sconto reale è stato fornito dal cliente: uno
          // sconto bundle senza codice lascia `discountCode` undefined, e
          // String(undefined).toUpperCase() scriverebbe "UNDEFINED" nei
          // metadata Stripe.
          ...(discountCode?.trim() ? { discountCode: String(discountCode).trim().toUpperCase() } : {}),
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
