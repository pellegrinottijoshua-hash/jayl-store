#!/usr/bin/env node
// Verifica strutturale di src/data/drop.js — il file che il pannello admin
// (tab Drop) rilegge e riscrive ad ogni get-drop/save-drop/close-drop/
// release-product.
//
// Alta conseguenza: get-drop, close-drop e release-product riparsano il file
// con `raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)` — non un import
// dinamico — perché lo stesso codice gira sotto Node per le funzioni
// serverless. Se un edit a mano introduce virgolette singole, una virgola
// finale o un commento dentro le graffe, quel parse lancia e le tre azioni
// falliscono al primo uso. Questo test lo scopre prima del deploy, non un
// admin a caso in produzione. Run: node scripts/test-drop-config.js

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { parseDropConfig, validateDropConfig } from '../api/_lib/drop-config.js'
import { drop as liveDrop } from '../src/data/drop.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DROP_PATH = resolve(__dirname, '../src/data/drop.js')

let passed = 0
const failures = []

function check(label, cond) {
  if (cond) { passed++; return }
  failures.push(label)
}

const raw = readFileSync(DROP_PATH, 'utf-8')

// ── Il file è ancora machine-parseable ──────────────────────────────────────
let cfg = null
try {
  cfg = parseDropConfig(raw)
  passed++
} catch (e) {
  failures.push(`src/data/drop.js non è parseable con parseDropConfig(): ${e.message}`)
}

if (cfg) {
  // ── Forma minima attesa ────────────────────────────────────────────────────
  // Stessa validateDropConfig() usata da save-drop (api/admin.js): id/number/
  // title, productIds array, startsAt < endsAt, cap e caps[*] interi
  // POSITIVI (mai 0 = "illimitato" col contatore nascosto, mai negativi —
  // con cap < 0 checkDropGate legge `total > cap` vero per ogni quantità
  // ≥ 1, e QUEL prodotto va in 409 permanentemente al checkout senza che
  // nessuna build lo segnali), prezzi interi, released array. Un'unica
  // definizione delle regole: se save-drop e questo test avessero due copie
  // separate potrebbero divergere, ed è esattamente quella divergenza che ha
  // lasciato passare un cap: -1 fino a qui nel primo giro di fix.
  const validation = validateDropConfig(cfg)
  check(
    validation.ok ? 'la struttura passa validateDropConfig()' : `struttura non valida: ${validation.error}`,
    validation.ok,
  )

  // ── Il parse del sorgente combacia esattamente con l'export reale del modulo ─
  // Se serializeDropConfig()/parseDropConfig() e l'import ESM del modulo
  // divergessero (es. un valore che JSON non può rappresentare — undefined, una
  // funzione, un Date), lo si scopre qui prima che l'admin lo scopra in
  // produzione.
  check('il parse del sorgente combacia con l\'export reale del modulo (deep-equal)',
    JSON.stringify(cfg) === JSON.stringify(liveDrop))
}

// ── N4 — un prezzo 0 non è "sintatticamente a posto" ────────────────────────
// dropPrice/bundlePrice/archivePrice controllavano solo Number.isInteger,
// quindi 0 passava: DropTab fa `parseInt(v, 10) || 0`, e un admin che svuota
// il campo prezzo e salva scriverebbe silenziosamente dropPrice: 0 — la
// vetrina mostrerebbe €0.00 mentre Stripe arrotonda comunque al minimo di 50
// centesimi. Config sintetica (non src/data/drop.js reale), per restare
// deterministico e non dipendere da cosa contiene il drop corrente.
{
  const validCfg = {
    current: {
      id: 'test-drop', number: 1, title: 'TEST',
      productIds: ['aaa'],
      startsAt: '2026-01-10T00:00:00Z',
      endsAt:   '2026-01-13T00:00:00Z',
      cap: 20, caps: {},
      dropPrice: 2200, bundlePrice: 5700,
    },
    released: [],
    archivePrice: 2500,
  }
  check('N4: config sintetica valida passa validateDropConfig() (baseline)',
    validateDropConfig(validCfg).ok === true)

  check('N4: current.dropPrice: 0 → rifiutato',
    validateDropConfig({ ...validCfg, current: { ...validCfg.current, dropPrice: 0 } }).ok === false)
  check('N4: current.bundlePrice: 0 → rifiutato',
    validateDropConfig({ ...validCfg, current: { ...validCfg.current, bundlePrice: 0 } }).ok === false)
  check('N4: archivePrice: 0 → rifiutato',
    validateDropConfig({ ...validCfg, archivePrice: 0 }).ok === false)
  check('N4: current.dropPrice negativo → rifiutato',
    validateDropConfig({ ...validCfg, current: { ...validCfg.current, dropPrice: -100 } }).ok === false)
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} controlli falliti (${passed} passati) su src/data/drop.js:\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
  console.error('')
  process.exit(1)
}
console.log(`✓ drop-config: ${passed} controlli passati su src/data/drop.js`)
