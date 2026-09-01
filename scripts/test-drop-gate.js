#!/usr/bin/env node
// Unit test per il gate del checkout in api/create-payment-intent.js
// (checkDropGate + evaluateDropGate) — VAULT, finestra chiusa, cap esaurito.
//
// Alta conseguenza: questo è il punto in cui "EDITION OF 20" smette di essere
// una grafica e diventa un fatto. Un difetto critico trovato in review 1 non
// aveva copertura qui: leggere `sold` per riga di carrello (invece che una
// volta per l'intero carrello, con un tally locale) permetteva di sforare il
// cap ripetendo lo stesso prodotto su più righe — la stessa classe di bug che
// api/_lib/drop-sales.js copre già lato scrittura (vedi il suo commento su "la
// stessa maglietta in M e in L").
//
// checkDropGate è puro (nessun I/O): la maggior parte dei casi sotto lo
// esercita direttamente con `now` e `soldByProduct` fissi, senza mock di
// rete. Solo il caso del registro irraggiungibile (fail-open) passa da
// evaluateDropGate con globalThis.fetch stubbato, per verificare anche la
// lettura vera e il log.
//
// STRIPE_SECRET_KEY dev'essere valorizzata PRIMA che il modulo sotto test
// venga valutato: costruisce `new Stripe(...)` a livello di modulo, e con
// apiKey assente la costruzione stessa lancia (vedi
// scripts/check-api-imports.js, che tollera questo specifico errore solo lì,
// dov'è innocuo perché nessun handler viene invocato). Un `import` statico
// in cima al file non basta: gli import ESM sono hoistati ed eseguiti prima
// di qualsiasi riga locale, indipendentemente dall'ordine nel sorgente, quindi
// `process.env.STRIPE_SECRET_KEY = …` scritto sopra l'import non farebbe in
// tempo. Da qui il dynamic import dentro main(): non è codice server (questo
// script non è sotto api/, non lo tocca scripts/check-api-imports.js), quindi
// non viola la regola "solo import statici" che vale per il codice servito in
// produzione. Una chiave finta basta: Stripe non la valida finché non la usa
// per una chiamata reale, che questo test non fa mai.
//
// Run: node scripts/test-drop-gate.js
process.env.STRIPE_SECRET_KEY ||= 'sk_test_fake_for_drop_gate_tests'
// readSales() prende il default `token = process.env.GITHUB_TOKEN` e torna
// silenziosamente un registro vuoto (senza mai chiamare fetch) quando quel
// token manca — con GITHUB_TOKEN assente il test 8 sotto non eserciterebbe
// affatto lo stub di rete, e il gate vedrebbe un sold falso di 0 invece del
// vero fallimento di lettura che vogliamo simulare.
process.env.GITHUB_TOKEN ||= 'fake-token-for-drop-gate-tests'
const { checkDropGate, evaluateDropGate } = await import('../api/create-payment-intent.js')

let passed = 0
const failures = []

function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { passed++; return }
  failures.push(`${label}\n     atteso: ${e}\n     ottenuto: ${a}`)
}

function checkMatch(label, actual, pattern) {
  if (typeof actual === 'string' && pattern.test(actual)) { passed++; return }
  failures.push(`${label}\n     atteso pattern: ${pattern}\n     ottenuto: ${JSON.stringify(actual)}`)
}

// Config drop di test — stessa forma di src/data/drop.js ma isolata dai dati
// reali, così i test restano deterministici indipendentemente da come cambia
// il drop corrente sul repo.
const CFG = {
  current: {
    id: 'test-drop',
    productIds: ['drop-item-a', 'drop-item-b'],
    startsAt: '2026-09-05T16:00:00Z',
    endsAt:   '2026-09-08T16:00:00Z',
    cap: 20,
    caps: {},
  },
  next:     { startsAt: '2026-09-09T16:00:00Z' },
  released: ['listino-item'],
}

const INSIDE_WINDOW = new Date('2026-09-06T00:00:00Z')
const BEFORE_OPEN   = new Date('2026-09-01T00:00:00Z')
const AFTER_CLOSE   = new Date('2026-09-10T00:00:00Z')

const item = (productId, quantity, name) => ({ productId, quantity, product: { name: name || productId } })

// ── 1. Cap 20, sold 19, una riga qty 1 → ammesso ────────────────────────────
{
  const sold = new Map([['drop-item-a', 19]])
  const r = checkDropGate([item('drop-item-a', 1)], CFG, INSIDE_WINDOW, sold)
  check('1: sold 19 + qty 1 = 20 (= cap) → ammesso', r, null)
}

// ── 2. Cap 20, sold 19, una riga qty 2 → respinto ───────────────────────────
{
  const sold = new Map([['drop-item-a', 19]])
  const r = checkDropGate([item('drop-item-a', 2)], CFG, INSIDE_WINDOW, sold)
  check('2: sold 19 + qty 2 = 21 (> cap) → status 409', r?.status, 409)
  checkMatch('2: messaggio "esaurito ... chiusa a 20 pezzi"', r?.error, /esaurito.*chiusa a 20 pezzi/)
}

// ── 3. IL CRITICO: cap 20, sold 19, due righe dello stesso prodotto qty 1
//       ciascuna (es. la stessa maglietta in M e in L) → respinto ──────────
{
  const sold = new Map([['drop-item-a', 19]])
  const items = [item('drop-item-a', 1, 'Tee M'), item('drop-item-a', 1, 'Tee L')]
  const r = checkDropGate(items, CFG, INSIDE_WINDOW, sold)
  check('3 (CRITICO): due righe stesso prodotto, 19+1+1=21 > 20 → status 409', r?.status, 409)
  checkMatch('3 (CRITICO): messaggio esaurito sulla seconda riga', r?.error, /esaurito.*chiusa a 20 pezzi/)
}

// ── 4. Cap 20, sold 0, venti righe dello stesso prodotto qty 20 ciascuna →
//       la prima riga da sola già sfora, ma verifichiamo che il tally
//       accumuli correttamente riga dopo riga e non si azzeri mai ─────────
{
  const sold = new Map([['drop-item-a', 0]])
  const items = Array.from({ length: 20 }, () => item('drop-item-a', 20))
  const r = checkDropGate(items, CFG, INSIDE_WINDOW, sold)
  check('4: 20 righe da 20 pezzi (cap 20) → status 409 già sulla prima riga', r?.status, 409)
  checkMatch('4: messaggio esaurito', r?.error, /esaurito.*chiusa a 20 pezzi/)
}
{
  // Variante che dimostra l'accumulo vero e proprio: due righe da 15 (cap 20).
  // La prima (15) passa da sola; è la SECONDA riga che deve essere respinta
  // sul tally 15+15=30, non su un confronto isolato "15 vs 20" che passerebbe.
  const sold = new Map([['drop-item-a', 0]])
  const items = [item('drop-item-a', 15), item('drop-item-a', 15)]
  const r = checkDropGate(items, CFG, INSIDE_WINDOW, sold)
  check('4b: due righe da 15 (cap 20) → la seconda riga fa scattare il 409 sul tally 30', r?.status, 409)
}

// ── 5. Prodotto VAULT → respinto con "non è più disponibile" ───────────────
{
  const r = checkDropGate([item('vault-item', 1, 'Vault Tee')], CFG, INSIDE_WINDOW, new Map())
  check('5: prodotto VAULT → status 409', r?.status, 409)
  checkMatch('5: messaggio "non è più disponibile"', r?.error, /non è più disponibile/)
}

// ── 6. Prima di startsAt → respinto, messaggio con la data del drop
//       CORRENTE (non del prossimo) ────────────────────────────────────────
{
  const r = checkDropGate([item('drop-item-a', 1)], CFG, BEFORE_OPEN, new Map())
  check('6: prima dell\'apertura → status 409', r?.status, 409)
  checkMatch('6: messaggio nomina il 5 settembre (apertura del drop CORRENTE)', r?.error, /5 settembre/)
  check('6: NON nomina il 9 settembre (quello sarebbe il prossimo drop, sbagliato qui)',
    /9 settembre/.test(r?.error || ''), false)
}

// ── 7. Dopo endsAt → respinto, messaggio con la data del PROSSIMO drop ─────
{
  const r = checkDropGate([item('drop-item-a', 1)], CFG, AFTER_CLOSE, new Map())
  check('7: dopo la chiusura → status 409', r?.status, 409)
  checkMatch('7: messaggio nomina il 9 settembre (apertura del PROSSIMO drop)', r?.error, /9 settembre/)
}

// ── 8. Registro vendite irraggiungibile → fail-open: l'ordine passa, e viene
//       loggato. Passa da evaluateDropGate (I/O vero, fetch stubbato) per
//       coprire anche la lettura, non solo la logica pura. ─────────────────
{
  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error
  let loggedCapUnavailable = false

  globalThis.fetch = async (url, opts) => {
    const isGet = !opts || !opts.method || opts.method === 'GET'
    if (!isGet) throw new Error('test 8: nessuna scrittura attesa')
    // 500 genuino, non 404: il registro esiste ma è irraggiungibile in questo
    // momento — è il caso che deve fallire aperto, non "il file non esiste
    // ancora" (che tornerebbe legittimamente sold 0).
    return { ok: false, status: 500, json: async () => ({ message: 'mock 500' }) }
  }
  console.error = (...args) => {
    if (args.some((a) => typeof a === 'string' && a.includes('cap check unavailable, allowing'))) {
      loggedCapUnavailable = true
    }
    originalConsoleError('       [log catturato]', ...args)
  }

  // Quantità enorme contro un cap di 20: se il fail-open non funzionasse
  // davvero, questo sforerebbe in modo vistoso.
  const items = [item('drop-item-a', 999)]
  const r = await evaluateDropGate(items, CFG, INSIDE_WINDOW)

  globalThis.fetch = originalFetch
  console.error = originalConsoleError

  check('8: registro irraggiungibile → il gate NON blocca (ammesso)', r, null)
  check('8: il fallimento è stato loggato', loggedCapUnavailable, true)
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} test falliti (${passed} passati):\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`))
  process.exit(1)
}
console.log(`✓ drop-gate: ${passed} test passati`)
