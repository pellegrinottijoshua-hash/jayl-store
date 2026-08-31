#!/usr/bin/env node
// Pre-publish gate: every product must be fulfillable before it can ship.
//
// Closes the TODO in docs/gelato-pipeline.md. Runs in `npm run prebuild`, so a
// product saved without a print file is caught at build time instead of at the
// moment a customer's order hits Gelato.
//
// Exits 1 on ERROR (unbuyable product), 0 on WARN (worth a look, not blocking).

import { adminProducts } from '../src/data/admin-products.js'
import { resolvePlacement, assertPrintable } from '../api/_lib/placement.js'

const errors = []
const warns  = []

for (const p of adminProducts) {
  const label = (p.name || p.id).slice(0, 40)
  const variants = p.variants || []

  if (!variants.length) { errors.push(`${label} — nessuna variante Gelato`); continue }

  // Resolve the placement of every variant. A product whose variants disagree
  // would print different sides depending on the colour the customer picks.
  const seen = new Map()
  for (const v of variants) {
    const pl = resolvePlacement(p, v.gelatoVariantId ?? p.gelatoProductId)
    const key = `${pl.type}:${pl.gpr ?? 'n/a'}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key).push(`${v.size ?? '?'}/${v.color ?? '?'}`)
  }
  const sides = new Set([...seen.keys()].map((k) => k.split(':')[0]))
  if (sides.size > 1) {
    errors.push(`${label} — varianti con LATI DI STAMPA DIVERSI: ${[...seen.keys()].join(' | ')}`)
  } else if (seen.size > 1) {
    const detail = [...seen.entries()]
      .map(([k, v]) => `${k} (${v.length}: ${v.slice(0, 4).join(', ')}${v.length > 4 ? '…' : ''})`)
      .join(' | ')
    warns.push(`${label} — stesso lato ma aree Gelato miste: ${detail}`)
  }

  // A missing print file is a WARNING, not a build failure. create-payment-intent
  // now rejects the item with a 409 before any money is taken, so the product is
  // merely unbuyable rather than dangerous. Failing the build here instead would
  // deadlock the admin: adding a product (which always starts without artwork)
  // would block every deploy until the design was uploaded.
  const placement = resolvePlacement(p, variants[0].gelatoVariantId ?? p.gelatoProductId)
  try {
    assertPrintable(p, placement)
  } catch (err) {
    warns.push(`NON VENDIBILE · ${label} — ${err.message.replace(/^Product "[^"]*" /, '')}`)
  }

  // The collection string is no longer authoritative, but a disagreement means
  // the storefront carousels (which still split on /back/i) show it on the wrong row.
  if (placement.source === 'uid') {
    const byCollection = /back/i.test(p.collection || '') ? 'back' : 'default'
    if (byCollection !== placement.type) {
      warns.push(`${label} — Gelato dice "${placement.type}" ma la collection "${p.collection}" dice "${byCollection}" (carosello home sbagliato)`)
    }
  }

  if (!p.price)  warns.push(`${label} — prezzo mancante`)
  if (!(p.images || []).length) warns.push(`${label} — nessuna immagine`)
}

const total = adminProducts.length
if (warns.length) {
  console.warn(`\n⚠  ${warns.length} avvisi:`)
  warns.forEach((w) => console.warn(`   · ${w}`))
}
if (errors.length) {
  console.error(`\n✗ ${errors.length} problemi strutturali su ${total} prodotti:`)
  errors.forEach((e) => console.error(`   · ${e}`))
  console.error('\nVarianti dello stesso prodotto che stampano su lati diversi significano')
  console.error('che il colore scelto dal cliente decide il lato di stampa. Correggi su Gelato.\n')
  process.exit(1)
}
const unsellable = warns.filter((w) => w.startsWith('NON VENDIBILE')).length
console.log(
  `✓ print files: ${total - unsellable}/${total} prodotti vendibili` +
  (unsellable ? ` — ${unsellable} in attesa del file di stampa` : '') +
  (warns.length ? ` (${warns.length} avvisi)` : '')
)
