#!/usr/bin/env node
// Unit test per api/_lib/drop.js — stato, prezzo e cap dei prodotti in drop.
//
// Alta conseguenza: un errore qui vende un prodotto nascosto, sfora un'edizione
// numerata, o applica il prezzo sbagliato. Run: node scripts/test-drop.js

import {
  productState, isDropOpen, basePriceFor, capFor, counterMode, bundleDiscount,
  DROP, LISTINO, VAULT,
} from '../api/_lib/drop.js'
import { applyDiscount, bundleAdjustment } from '../api/_lib/catalog.js'

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

const vaultSize = { id: 'M', price: 1999 }
const vaultProd = { id: 'zzz', price: 2599 }
check('vault con taglia → prezzo della taglia (precedenza su product.price)',
  basePriceFor('zzz', vaultSize, vaultProd, cfg), 1999)
check('vault senza taglia → prezzo del prodotto',
  basePriceFor('zzz', null, vaultProd, cfg), 2599)
check('vault senza taglia né prodotto → 0',
  basePriceFor('zzz', null, null, cfg), 0)

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

// ── Integrazione con catalog.js ─────────────────────────────────────────────
// Questi test usano la configurazione REALE di src/data/drop.js, non `cfg`.
const ALTARIA = 'altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him'
const SNORLAX = 'cool-snorlax-back-t-shirt'
const NON_DROP = 'zzz-non-esiste'

check('sconto percentuale su carrello senza pezzi in drop → valido',
  applyDiscount(10000, 'JAYL10', [{ productId: NON_DROP }]).ok, true)

check('sconto percentuale con un pezzo in drop → rifiutato',
  applyDiscount(10000, 'JAYL10', [{ productId: ALTARIA }]).ok, false)

check('senza lista items il codice resta valido (retrocompatibilità)',
  applyDiscount(10000, 'JAYL10').ok, true)

check('codice inesistente resta invalido anche senza items',
  applyDiscount(10000, 'NONESISTE').ok, false)

// Il drop reale ha 2 prodotti: il bundle ne richiede 3, quindi qui è sempre 0.
check('bundleAdjustment sul drop reale a due prodotti → 0',
  bundleAdjustment([{ productId: ALTARIA }, { productId: SNORLAX }]).amount, 0)

check('bundleAdjustment senza sconto → label null',
  bundleAdjustment([{ productId: ALTARIA }]).label, null)

// Il ramo con sconto si prova con una cfg sintetica a tre prodotti.
const cfg3 = {
  current: { productIds: ['aaa', 'bbb', 'ccc'], dropPrice: 2200, bundlePrice: 5700 },
  released: [], archivePrice: 2500,
}
check('bundleAdjustment con tre pezzi → 900',
  bundleAdjustment([{ productId: 'aaa' }, { productId: 'bbb' }, { productId: 'ccc' }], cfg3).amount, 900)

check('bundleAdjustment con tre pezzi → label presente',
  typeof bundleAdjustment([{ productId: 'aaa' }, { productId: 'bbb' }, { productId: 'ccc' }], cfg3).label, 'string')

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} test falliti (${passed} passati):\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`))
  process.exit(1)
}
console.log(`✓ drop: ${passed} test passati`)
