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
import { parseDropConfig } from '../api/_lib/drop-config.js'
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
  check('current.productIds è un array', Array.isArray(cfg.current?.productIds))

  check('current.cap è un intero', Number.isInteger(cfg.current?.cap))
  check('current.dropPrice è un intero (centesimi)', Number.isInteger(cfg.current?.dropPrice))
  check('current.bundlePrice è un intero (centesimi)', Number.isInteger(cfg.current?.bundlePrice))
  check('archivePrice è un intero (centesimi)', Number.isInteger(cfg.archivePrice))

  // 0 su cap è ambiguo con "illimitato" per capFor()/il gate del checkout — mai
  // in un file scritto dalle azioni admin (che lo rifiutano).
  check('current.cap non è 0 (0 = illimitato, non "chiuso")', cfg.current?.cap !== 0)

  check('released è un array', Array.isArray(cfg.released))

  // ── Finestra temporale coerente ────────────────────────────────────────────
  const startsAt = Date.parse(cfg.current?.startsAt)
  const endsAt   = Date.parse(cfg.current?.endsAt)
  check('current.startsAt è una data ISO valida', Number.isFinite(startsAt))
  check('current.endsAt è una data ISO valida',   Number.isFinite(endsAt))
  check('current.startsAt < current.endsAt', Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt < endsAt)

  // ── Il parse del sorgente combacia esattamente con l'export reale del modulo ─
  // Se serializeDropConfig()/parseDropConfig() e l'import ESM del modulo
  // divergessero (es. un valore che JSON non può rappresentare — undefined, una
  // funzione, un Date), lo si scopre qui prima che l'admin lo scopra in
  // produzione.
  check('il parse del sorgente combacia con l\'export reale del modulo (deep-equal)',
    JSON.stringify(cfg) === JSON.stringify(liveDrop))
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} controlli falliti (${passed} passati) su src/data/drop.js:\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
  console.error('')
  process.exit(1)
}
console.log(`✓ drop-config: ${passed} controlli passati su src/data/drop.js`)
