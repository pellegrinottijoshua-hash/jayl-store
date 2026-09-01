#!/usr/bin/env node
// Unit test per api/_lib/drop-sales.js — il registro vendite di un drop: stato
// condiviso fra chiamate, osservabilità dei fallimenti di lettura, numerazione
// dei pezzi (mai clampata al cap), idempotenza sul payment intent.
//
// Alta conseguenza: lo spec chiama il cap reale "il vincolo da cui dipende la
// legittimità dell'intero meccanismo" ("EDIZIONE DI 20" deve essere un fatto,
// non solo una grafica). Un bug qui vende un pezzo che non esiste o ne perde
// uno già pagato — cinque difetti proprio in questo file (3 critici, 2
// importanti) sono passati indenni per due round di review perché questo test
// non esisteva ancora.
//
// Nessuna chiamata di rete reale: globalThis.fetch è mockato per simulare la
// GitHub Contents API, ripristinato dopo ogni caso così i test non si
// contaminano a vicenda. Run: node scripts/test-drop-sales.js

import { readSales, soldFor, recordDropSale } from '../api/_lib/drop-sales.js'

let passed = 0
const failures = []

function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { passed++; return }
  failures.push(`${label}\n     atteso: ${e}\n     ottenuto: ${a}`)
}

async function throwsAsync(label, fn, matcher) {
  try {
    await fn()
    failures.push(`${label}\n     atteso: throw\n     ottenuto: nessun errore`)
  } catch (err) {
    if (matcher && !matcher.test(err.message)) {
      failures.push(`${label}\n     messaggio inatteso: ${err.message}`)
      return
    }
    passed++
  }
}

const TOKEN   = 'fake-token'
const DROP_ID = 'drop-01-sleep-mode'                 // id reale, da src/data/drop.js
const PRODUCT = 'cool-snorlax-back-t-shirt'          // prodotto reale del drop corrente, cap 20

const originalFetch = globalThis.fetch

const dataWith  = (entry) => ({ [DROP_ID]: entry })
const fileWith  = (entry, sha = 'sha-0') => ({ sha, data: dataWith(entry) })

/**
 * Mock stateful della GitHub Contents API.
 * `state.file` è `null` finché non si scrive (→ 404 su GET), altrimenti
 * `{ sha, data }`. `getQueue`/`putQueue` forzano lo status delle prime N
 * chiamate GET/PUT nell'ordine in cui arrivano; esaurita la coda si torna al
 * comportamento di default (200 con lo stato corrente, o 404 se il file non
 * esiste ancora per un GET; 200 per un PUT).
 */
function installMockGithub({ initialFile = null, getQueue = [], putQueue = [] } = {}) {
  const state = { file: initialFile, getCalls: 0, putCalls: 0 }
  globalThis.fetch = async (url, opts) => {
    const isGet = !opts || !opts.method || opts.method === 'GET'
    if (isGet) {
      state.getCalls++
      const forced = getQueue.shift()
      const status = forced ?? (state.file ? 200 : 404)
      if (status !== 200) return { ok: false, status, json: async () => ({ message: `mock ${status}` }) }
      const body = Buffer.from(JSON.stringify(state.file.data)).toString('base64')
      return { ok: true, status: 200, json: async () => ({ sha: state.file.sha, content: body }) }
    }
    state.putCalls++
    const forced = putQueue.shift()
    const status = forced ?? 200
    if (status === 200 || status === 201) {
      const sentBody = JSON.parse(opts.body)
      const nextData = JSON.parse(Buffer.from(sentBody.content, 'base64').toString('utf-8'))
      state.file = { sha: `sha-${state.putCalls}`, data: nextData }
      return { ok: true, status, json: async () => ({ content: { sha: state.file.sha } }) }
    }
    return { ok: false, status, json: async () => ({ message: `mock ${status}` }) }
  }
  return state
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

async function main() {
  // ── 1. C1 — niente stato mutabile condiviso fra due drop ──────────────────
  // entry.products/entry.counted per un drop assente venivano ricavati da un
  // oggetto EMPTY riusato per riferimento (spread superficiale): scrivere
  // nell'entry di un drop "vuoto" mutava lo stato del modulo, e il prossimo
  // drop letto come vuoto nello stesso container caldo partiva già sporco.
  // recordDropSale ricava il proprio dropId da getDrop() (la config reale,
  // fissa in questo processo) e non lo accetta come parametro, quindi per
  // dimostrare l'isolamento fra due drop diversi usiamo readSales — che
  // accetta il dropId e usa la stessa fabbrica (emptyEntry) che recordDropSale
  // usa internamente.
  {
    installMockGithub({ initialFile: null })   // file assente: nessuna vendita di nessun drop, ancora
    const entryA = await readSales('drop-A', TOKEN)
    entryA.products['x'] = { sold: 99, lastAt: 'now' }
    entryA.counted['pi_X'] = { x: [99] }

    const entryB = await readSales('drop-B', TOKEN)
    check('C1: readSales(drop-B) dopo aver mutato readSales(drop-A) parte da zero',
      entryB, { counted: {}, products: {} })
    restoreFetch()
  }

  // ── 2. C2 — un fallimento di lettura è osservabile, non "letto come zero" ─
  {
    installMockGithub({ initialFile: null })   // 404 genuino: il registro non esiste ancora
    const empty = await readSales(DROP_ID, TOKEN)
    check('C2: 404 genuino → registro vuoto', empty, { counted: {}, products: {} })
    const sold0 = await soldFor(DROP_ID, PRODUCT, TOKEN)
    check('C2: 404 genuino → soldFor 0', sold0, 0)
    restoreFetch()
  }
  {
    installMockGithub({ getQueue: [500] })     // 500: non è "il file non esiste"
    await throwsAsync('C2: 500 → readSales rilancia, non legge come registro vuoto',
      () => readSales(DROP_ID, TOKEN), /: 500/)
    restoreFetch()
  }
  {
    installMockGithub({ getQueue: [500] })
    await throwsAsync('C2: 500 → soldFor rilancia, non torna 0 in silenzio',
      () => soldFor(DROP_ID, PRODUCT, TOKEN), /: 500/)
    restoreFetch()
  }

  // ── 3. C3 — niente clamp sul cap: il pagamento è già avvenuto ─────────────
  {
    const state = installMockGithub({
      initialFile: fileWith({ counted: {}, products: { [PRODUCT]: { sold: 19, lastAt: 'x' } } }),
    })
    const r = await recordDropSale('pi_C3', [{ productId: PRODUCT, quantity: 3 }], TOKEN)
    check('C3: qty 3 a prev 19 (cap 20) → [20,21,22], non clampato',
      r.numbers[PRODUCT], [20, 21, 22])
    check('C3: overCap:true quando si sfora', r.overCap, true)
    const sold = await soldFor(DROP_ID, PRODUCT, TOKEN)
    check('C3: sold effettivamente scritto a 22, non clampato a 20', sold, 22)
    void state
    restoreFetch()
  }

  // ── 4. N1 — numbers si accoda quando un prodotto compare in più righe ─────
  // Il carrello chiave le righe per variante (taglia/colore/cornice), non per
  // prodotto: la stessa maglietta in M e in L è lo stesso productId due volte
  // nello stesso ordine.
  {
    installMockGithub({
      initialFile: fileWith({ counted: {}, products: { [PRODUCT]: { sold: 5, lastAt: 'x' } } }),
    })
    const items = [
      { productId: PRODUCT, size: 'M', quantity: 1 },
      { productId: PRODUCT, size: 'L', quantity: 1 },
    ]
    const r = await recordDropSale('pi_N1', items, TOKEN)
    check('N1: stesso prodotto in due righe (M e L) da prev 5 → [6,7], non solo l\'ultimo',
      r.numbers[PRODUCT], [6, 7])

    const replay = await recordDropSale('pi_N1', items, TOKEN)
    check('N1: la replay idempotente ritorna [6,7], non troncata a [7]',
      replay.numbers[PRODUCT], [6, 7])
    check('N1: la replay è marcata alreadyCounted', replay.alreadyCounted, true)
    restoreFetch()
  }

  // ── 5. N2 — un 422 su una create in corsa ritenta; con uno sha reale no ───
  {
    // Il file non esiste ancora (prima vendita di sempre): il primo tentativo
    // è una create (sha:null). Un altro writer la vince nel frattempo — GitHub
    // risponde 422 ("sha" wasn't supplied), non 409 — e il retry deve
    // rileggere, trovare il file dell'altro writer, e ripartire dal suo sold
    // reale invece di continuare a numerare a vuoto.
    const state = installMockGithub({ initialFile: null, putQueue: [422] })
    const wrapped = globalThis.fetch
    let getCalls = 0
    globalThis.fetch = async (url, opts) => {
      const isGet = !opts || !opts.method || opts.method === 'GET'
      if (isGet) {
        getCalls++
        if (getCalls === 2) {
          // l'altro writer ha scritto fra la nostra prima e seconda lettura
          state.file = {
            sha: 'sha-other-writer',
            data: dataWith({ counted: { pi_OTHER: { [PRODUCT]: [6] } }, products: { [PRODUCT]: { sold: 6, lastAt: 'y' } } }),
          }
        }
      }
      return wrapped(url, opts)
    }
    const r = await recordDropSale('pi_N2A', [{ productId: PRODUCT, quantity: 1 }], TOKEN)
    check('N2: 422 su create in corsa (sha:null) → ritenta e ok:true', r.ok, true)
    check('N2: dopo il retry riparte dallo sha reale dell\'altro writer (sold 6 → [7])',
      r.numbers[PRODUCT], [7])
    restoreFetch()
  }
  {
    installMockGithub({
      initialFile: fileWith({ counted: {}, products: {} }),   // sha reale già fornito
      putQueue: [422],
    })
    const r = await recordDropSale('pi_N2B', [{ productId: PRODUCT, quantity: 1 }], TOKEN)
    check('N2: 422 con uno sha reale già fornito → non ritenta, ok:false', r.ok, false)
    restoreFetch()
  }

  // ── 6. Idempotenza — lo stesso paymentIntentId non conta due volte ────────
  {
    installMockGithub({
      initialFile: fileWith({ counted: {}, products: { [PRODUCT]: { sold: 2, lastAt: 'x' } } }),
    })
    const first = await recordDropSale('pi_IDEM', [{ productId: PRODUCT, quantity: 1 }], TOKEN)
    check('idempotenza: prima chiamata assegna il pezzo', first.numbers[PRODUCT], [3])

    const second = await recordDropSale('pi_IDEM', [{ productId: PRODUCT, quantity: 1 }], TOKEN)
    check('idempotenza: seconda chiamata → alreadyCounted:true', second.alreadyCounted, true)
    check('idempotenza: seconda chiamata ritorna i numeri memorizzati, non nuovi',
      second.numbers[PRODUCT], [3])

    const sold = await soldFor(DROP_ID, PRODUCT, TOKEN)
    check('idempotenza: sold incrementato una sola volta (3, non 4)', sold, 3)
    restoreFetch()
  }
}

try {
  await main()
} finally {
  restoreFetch()
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} test falliti (${passed} passati):\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`))
  process.exit(1)
}
console.log(`✓ drop-sales: ${passed} test passati`)
