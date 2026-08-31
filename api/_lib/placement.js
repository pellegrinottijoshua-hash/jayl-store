// Decides which side of the garment an order item prints on, and refuses to
// fulfil anything that would print garbage.
//
// WHY THIS EXISTS
// The placement used to be decided by `/back/i.test(product.collection)` —
// duplicated verbatim in orders.js and webhook.js. That made the physical print
// side depend on a free-text string typed into the admin panel: renaming the
// collection (e.g. "cool pokemon back" → "Pokemon Built Different") silently
// turned 19 back products into front products, sending `type:'default'` to
// Gelato products that have no front print area at all. Nothing would surface
// the mistake until a real order failed or shipped wrong.
//
// Gelato already carries the answer, per variant, inside the productUid:
//
//   apparel_product_..._gpr_0-4_inlbl_gildan_64000
//                          ^^^
//   gpr_<front>-<back> = number of print colors per area. 0 = the area does not
//   exist on this product. So 4-0 is front-only, 0-4 is back-only, 4-4 is both.
//
// We trust that first and fall back to the collection string only when the UID
// cannot decide (4-4, or a store-UUID style id with no gpr segment).

export const GPR_RE = /_gpr_(\d+-\d+)_/

/** Legacy heuristic. Kept as the fallback, never as the primary signal. */
const backByCollection = (product) => /back/i.test(product?.collection || '')

/**
 * Resolve the Gelato file placement for an item.
 *
 * @param {object} product   the catalog product record
 * @param {string} productUid the resolved Gelato variant uid (may be null)
 * @returns {{type:'back'|'default', source:'uid'|'collection', gpr:string|null}}
 *          `source` is reported so the order log shows which signal decided.
 */
export function resolvePlacement(product, productUid) {
  const gpr = GPR_RE.exec(productUid || '')?.[1] ?? null

  if (gpr) {
    const [front, back] = gpr.split('-').map(Number)
    // Only decide from the UID when exactly one area exists. 4-4 declares both
    // and tells us nothing about intent.
    if (front === 0 && back > 0) return { type: 'back',    source: 'uid', gpr }
    if (back === 0 && front > 0) return { type: 'default', source: 'uid', gpr }
  }

  // Fallback. Defaults to the front when there is no signal at all — printing a
  // front design on the back is a visible, refundable mistake; the reverse ships
  // a shirt with a giant graphic where the customer expected a small one.
  return { type: backByCollection(product) ? 'back' : 'default', source: 'collection', gpr }
}

/**
 * Refuse to fulfil an item whose print file is missing or is actually a mockup
 * photo. Returns the print file url when it is safe to use.
 *
 * The old guard ran only for back products, and the call site fell back to
 * `product.image` — the mockup photograph — for everything else. A front product
 * saved without a print file would therefore have a photo of a t-shirt printed
 * onto a t-shirt. Both sides are checked here.
 *
 * @throws {Error} when the item must not be sent to Gelato
 */
export function assertPrintable(product, placement) {
  const side = placement?.type === 'back' ? 'back' : 'front'
  const url  = product?.printFileUrl

  if (!url) {
    throw new Error(
      `Product "${product?.id}" has no ${side} print file (printFileUrl) — ` +
      `refusing to send the mockup image to Gelato as artwork`
    )
  }
  // Print files live in public/designs/<id>/design.png. Anything under
  // public/images/ is a mockup or gallery shot that must never be printed.
  if (/\/images\//.test(url) || /mockup/i.test(url)) {
    throw new Error(
      `Product "${product?.id}" has a ${side} printFileUrl pointing at a mockup ` +
      `(${url}) — refusing to print it on the garment`
    )
  }
  return url
}
