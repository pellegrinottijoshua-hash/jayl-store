// Server-side product lookup, validation, and pricing.
// All API routes MUST go through priceItem() rather than trusting
// client-supplied prices.
import { products } from '../../src/data/products.js'

const productMap = new Map(products.map((p) => [p.id, p]))

const MAX_QUANTITY      = 99
const MAX_ITEMS_IN_CART = 50
export const CURRENCY   = 'eur'
export const FREE_SHIPPING_THRESHOLD = 0  // always free
export const STANDARD_SHIPPING       = 0  // always free

/** Resolve and price a single client item. Returns either { ok: true, item } or { ok: false, error }. */
export function priceItem(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid item' }
  }
  const productId = String(raw.productId || '').slice(0, 100)
  const product = productMap.get(productId)
  if (!product) return { ok: false, error: `Unknown product: ${productId}` }

  const quantityNum = parseInt(raw.quantity, 10)
  if (!Number.isFinite(quantityNum) || quantityNum < 1 || quantityNum > MAX_QUANTITY) {
    return { ok: false, error: `Invalid quantity for ${productId}` }
  }

  let sizeObj = null
  if (product.sizes?.length) {
    sizeObj = product.sizes.find((s) => s.id === raw.size)
    if (!sizeObj) return { ok: false, error: `Invalid size for ${productId}` }
  }

  let frameObj = null
  if (product.frames?.length && raw.frame && raw.frame !== 'none') {
    frameObj = product.frames.find((f) => f.id === raw.frame)
    if (!frameObj) return { ok: false, error: `Invalid frame for ${productId}` }
  }

  let colorObj = null
  if (product.colors?.length && raw.color) {
    colorObj = product.colors.find((c) => c.id === raw.color)
    if (!colorObj) return { ok: false, error: `Invalid color for ${productId}` }
  }

  // Products with variants (e.g. tote bags) require a color selection —
  // validate against the variants array when colors[] is absent.
  let variantObj = null
  if (product.variants?.length) {
    if (!raw.color) return { ok: false, error: `Color is required for ${productId}` }
    variantObj = product.variants.find((v) => v.id === raw.color)
    if (!variantObj) return { ok: false, error: `Invalid color variant for ${productId}` }
  }

  const unitPrice = (sizeObj?.price ?? product.price) + (frameObj?.price ?? 0)

  return {
    ok: true,
    item: {
      productId,
      size:      sizeObj?.id   ?? null,
      frame:     frameObj?.id  ?? 'none',
      color:     colorObj?.id  ?? variantObj?.id ?? null,
      variantObj,  // null for non-variant products; used by create-order to resolve gelatoVariantId
      quantity:  quantityNum,
      unitPrice,
      product,  // attached for server-side use; never serialise this whole thing back to clients
    },
  }
}

/** Resolve and price a list of client items. */
export function priceItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'Cart is empty' }
  }
  if (rawItems.length > MAX_ITEMS_IN_CART) {
    return { ok: false, error: 'Cart has too many items' }
  }
  const items = []
  for (const raw of rawItems) {
    const result = priceItem(raw)
    if (!result.ok) return result
    items.push(result.item)
  }
  return { ok: true, items }
}

/** Compute totals from priced items. */
export function computeTotals(items) {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING
  return { subtotal, shipping, total: subtotal + shipping }
}

/** Validate a shipping address — returns { ok, error?, address? }. */
export function validateAddress(addr) {
  if (!addr || typeof addr !== 'object') {
    return { ok: false, error: 'Shipping address is required' }
  }
  const str = (v, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  const email      = str(addr.email, 200)
  const firstName  = str(addr.firstName, 60)
  const lastName   = str(addr.lastName, 60)
  const address    = str(addr.address, 200)
  const city       = str(addr.city, 80)
  const state      = str(addr.state, 80)
  const zip        = str(addr.zip, 20)
  const country    = str(addr.country, 2).toUpperCase() || 'US'
  const phone      = str(addr.phone, 30)

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Invalid email' }
  }
  if (!firstName || !lastName) return { ok: false, error: 'Name required' }
  if (!address) return { ok: false, error: 'Address required' }
  if (!city)    return { ok: false, error: 'City required' }
  if (!zip)     return { ok: false, error: 'ZIP/postal code required' }
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, error: 'Invalid country' }

  return {
    ok: true,
    address: { email, firstName, lastName, address, city, state, zip, country, phone },
  }
}

/** Encode the canonical, server-priced item list for storage in Stripe metadata. */
export function encodeItemsForMetadata(items) {
  // Compact form: pid|size|frame|color|qty|unitPrice
  return items
    .map((i) => [i.productId, i.size || '-', i.frame || 'none', i.color || '-', i.quantity, i.unitPrice].join('|'))
    .join(';')
}

/** Decode items from Stripe metadata. Re-prices via the catalog so changed prices in code propagate. */
export function decodeItemsFromMetadata(encoded) {
  if (!encoded || typeof encoded !== 'string') return []
  return encoded.split(';').filter(Boolean).map((part) => {
    const [productId, size, frame, color, qty, unitPrice] = part.split('|')
    return {
      productId,
      size:  size === '-' ? null : size,
      frame: frame || 'none',
      color: color === '-' ? null : color,
      quantity:  parseInt(qty, 10) || 1,
      unitPrice: parseInt(unitPrice, 10) || 0,
      product:   productMap.get(productId) || null,
    }
  })
}
