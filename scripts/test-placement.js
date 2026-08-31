#!/usr/bin/env node
// Unit tests for api/_lib/placement.js — the logic that decides whether an order
// item prints on the front or the back of the garment.
//
// This is the highest-consequence branch in the codebase: get it wrong and Gelato
// physically prints the wrong side of a shirt that a customer paid for. Run with:
//   node scripts/test-placement.js

import { resolvePlacement, assertPrintable, GPR_RE } from '../api/_lib/placement.js'

let passed = 0
const failures = []

function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { passed++; return }
  failures.push(`${label}\n     atteso: ${e}\n     ottenuto: ${a}`)
}

function throws(label, fn, matcher) {
  try {
    fn()
    failures.push(`${label}\n     atteso: throw\n     ottenuto: nessun errore`)
  } catch (err) {
    if (matcher && !matcher.test(err.message)) {
      failures.push(`${label}\n     messaggio inatteso: ${err.message}`)
      return
    }
    passed++
  }
}

const uid = (gpr) =>
  `apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_${gpr}_inlbl_gildan_64000`

// ── The Gelato UID is authoritative ─────────────────────────────────────────
// gpr_<front>-<back> declares how many print colors each area has. 0 means the
// area does not exist on that product at all.

check('gpr_0-4 → back',
  resolvePlacement({ collection: 'whatever' }, uid('0-4')),
  { type: 'back', source: 'uid', gpr: '0-4' })

check('gpr_4-0 → default',
  resolvePlacement({ collection: 'whatever' }, uid('4-0')),
  { type: 'default', source: 'uid', gpr: '4-0' })

// The UID must beat the collection string even when they disagree. This is the
// whole point of the change: renaming a collection must never move a print.
check('uid batte collection (collection dice back, uid dice front)',
  resolvePlacement({ collection: 'cool pokemon back' }, uid('4-0')),
  { type: 'default', source: 'uid', gpr: '4-0' })

check('uid batte collection (collection non dice back, uid dice back)',
  resolvePlacement({ collection: 'Pokemon Built Different' }, uid('0-4')),
  { type: 'back', source: 'uid', gpr: '0-4' })

// ── Ambiguous and unreadable UIDs fall back to the collection ────────────────
// gpr_4-4 has BOTH areas, so the UID cannot decide on its own.

check('gpr_4-4 ambiguo → fallback su collection (back)',
  resolvePlacement({ collection: 'cool pokemon back' }, uid('4-4')),
  { type: 'back', source: 'collection', gpr: '4-4' })

check('gpr_4-4 ambiguo → fallback su collection (front)',
  resolvePlacement({ collection: 'cool Pokèmon' }, uid('4-4')),
  { type: 'default', source: 'collection', gpr: '4-4' })

check('uid senza gpr → fallback su collection',
  resolvePlacement({ collection: 'cool pokemon back' }, 'store-product-uuid-1234'),
  { type: 'back', source: 'collection', gpr: null })

check('uid assente → fallback su collection',
  resolvePlacement({ collection: 'cool Pokèmon' }, null),
  { type: 'default', source: 'collection', gpr: null })

check('nessun segnale → default (fronte), mai back per sbaglio',
  resolvePlacement({}, null),
  { type: 'default', source: 'collection', gpr: null })

// ── The guard is symmetric ──────────────────────────────────────────────────
// The old guard only protected back products; a front product with no print file
// silently fell back to the mockup photo and got printed onto the garment.

throws('back senza printFileUrl → throw',
  () => assertPrintable({ id: 'x', collection: 'back', image: '/m.jpg' }, { type: 'back' }),
  /print file/i)

throws('FRONT senza printFileUrl → throw (era il buco)',
  () => assertPrintable({ id: 'x', collection: 'front', image: '/m.jpg' }, { type: 'default' }),
  /print file/i)

throws('printFileUrl che punta a un mockup → throw',
  () => assertPrintable({ id: 'x', printFileUrl: '/images/x/mockup.jpg' }, { type: 'back' }),
  /mockup|images/i)

check('printFileUrl valido → nessun errore, ritorna l’url',
  assertPrintable({ id: 'x', printFileUrl: 'https://raw.../public/designs/x/design.png' }, { type: 'back' }),
  'https://raw.../public/designs/x/design.png')

// ── Regex sanity ────────────────────────────────────────────────────────────
check('GPR_RE estrae il codice', GPR_RE.exec(uid('0-4'))?.[1], '0-4')

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} test falliti (${passed} passati):\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`))
  process.exit(1)
}
console.log(`✓ placement: ${passed} test passati`)
