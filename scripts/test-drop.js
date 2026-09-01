#!/usr/bin/env node
// Unit test per api/_lib/drop.js — stato, prezzo e cap dei prodotti in drop.
//
// Alta conseguenza: un errore qui vende un prodotto nascosto, sfora un'edizione
// numerata, o applica il prezzo sbagliato. Run: node scripts/test-drop.js

import {
  productState, isDropOpen, basePriceFor, capFor, counterMode, bundleDiscount,
  DROP, LISTINO, VAULT,
} from '../api/_lib/drop.js'

let passed = 0
const failures = []

function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { passed++; return }
  failures.push(`${label}\n     atteso: ${e}\n     ottenuto: ${a}`)
}

const cfg = {
  current: {
    id: 'drop-test', number: 1, title: 'TEST',
    productIds: ['aaa', 'bbb', 'ccc'],
    startsAt: '2026-01-10T00:00:00Z',
    endsAt:   '2026-01-13T00:00:00Z',
    cap: 20, caps: { ccc: 10 },
    dropPrice: 2200, bundlePrice: 5700,
  },
  next: { number: 2, startsAt: '2026-01-14T00:00:00Z' },
  released: ['ddd'],
  archivePrice: 2500,
}

// ── Stato ───────────────────────────────────────────────────────────────────
check('prodotto nel drop → drop',     productState('aaa', cfg), DROP)
check('prodotto rilasciato → listino', productState('ddd', cfg), LISTINO)
check('prodotto sconosciuto → vault',  productState('zzz', cfg), VAULT)

// ── Finestra ────────────────────────────────────────────────────────────────
check('prima dell’apertura → chiuso', isDropOpen(new Date('2026-01-09T23:59:00Z'), cfg), false)
check('all’apertura → aperto',        isDropOpen(new Date('2026-01-10T00:00:00Z'), cfg), true)
check('dentro la finestra → aperto',  isDropOpen(new Date('2026-01-11T12:00:00Z'), cfg), true)
check('alla chiusura → chiuso',       isDropOpen(new Date('2026-01-13T00:00:00Z'), cfg), false)

// ── Prezzo — l’override ignora price e sizes[].price ────────────────────────
const prod = { id: 'aaa', price: 2399 }
const size = { id: 'L', price: 2399 }
check('drop → dropPrice, non il prezzo per taglia',
  basePriceFor('aaa', size, prod, cfg), 2200)
check('listino → archivePrice',
  basePriceFor('ddd', size, { id: 'ddd', price: 2399 }, cfg), 2500)

// ── Cap ─────────────────────────────────────────────────────────────────────
check('cap di default',          capFor('aaa', cfg), 20)
check('cap sovrascritto',        capFor('ccc', cfg), 10)
check('cap di un non-drop → 0',  capFor('zzz', cfg), 0)

// ── Contatore: si nasconde sotto il 30% ─────────────────────────────────────
check('0 su 20 → edizione',   counterMode(0, 20),  { mode: 'edition', cap: 20 })
check('5 su 20 → edizione',   counterMode(5, 20),  { mode: 'edition', cap: 20 })
check('6 su 20 → contatore',  counterMode(6, 20),  { mode: 'counter', sold: 6,  cap: 20 })
check('19 su 20 → contatore', counterMode(19, 20), { mode: 'counter', sold: 19, cap: 20 })
check('20 su 20 → sold out',  counterMode(20, 20), { mode: 'soldout', sold: 20, cap: 20 })
check('cap 0 → nascosto',     counterMode(0, 0),   { mode: 'hidden' })

// ── Bundle ──────────────────────────────────────────────────────────────────
const it = ids => ids.map(id => ({ productId: id }))
check('tutti e tre → sconto 900',
  bundleDiscount(it(['aaa', 'bbb', 'ccc']), cfg), 900)
check('due su tre → nessuno sconto',
  bundleDiscount(it(['aaa', 'bbb']), cfg), 0)
check('tre più un estraneo → sconto comunque',
  bundleDiscount(it(['aaa', 'bbb', 'ccc', 'ddd']), cfg), 900)
check('drop da due prodotti → nessun bundle',
  bundleDiscount(it(['aaa', 'bbb']), { ...cfg, current: { ...cfg.current, productIds: ['aaa', 'bbb'] } }), 0)

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} test falliti (${passed} passati):\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`))
  process.exit(1)
}
console.log(`✓ drop: ${passed} test passati`)
