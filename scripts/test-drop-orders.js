#!/usr/bin/env node
// Unit test per gli endpoint pubblici drop-aware di api/orders.js:
// drop-status (memo + rate limit), gmf (memo + rate limit + disponibilità), e
// l'isolamento fra i bucket del rate limit condiviso da tutti gli endpoint di
// questo file.
//
// Alta conseguenza — BLOCKING 1 della review finale: /api/drop-status era un
// amplificatore GitHub-API non autenticato che disattivava il cap. Ogni
// querystring diversa è una chiave di cache CDN diversa, quindi
// `s-maxage=30` non protegge da un burst cache-busting: 5000 richieste così
// esauriscono il budget orario di GITHUB_TOKEN, dopo di che GitHub risponde
// 403 a tutto ed evaluateDropGate (create-payment-intent) fallisce aperto per
// ogni checkout — il cap che questo intero sistema esiste per far rispettare
// smette di contare. Il fix ha due metà, entrambe testate qui: un memo di
// modulo che condivide UNA lettura fra un burst di richieste concorrenti (a
// prescindere dalla querystring, e senza mai cachare un fallimento come
// successo), e un rate limit sulla rotta drop-status del router.
//
// CRITICAL (re-review) — /api/gmf riapriva lo stesso vettore: leggeva il
// registro vendite con `readSales` diretta (non memoizzata) a OGNI invocazione
// e non aveva alcun rate limit. Stesso fix, stesso schema: memo condiviso con
// drop-status (chiave: dropId) + rate limit 60/min sulla rotta gmf del
// router, con bucket proprio (vedi test 5 sotto).
//
// IMPORTANT (re-review) — il rate limiter (api/_lib/rateLimit.js) era keyato
// solo sull'IP, mai sull'endpoint: i quattro consumer di questo file
// (track-order, capture-email, validate-discount, drop-status, +gmf ora)
// condividevano UN SOLO contatore per IP. Dietro un CGNAT/IP d'ufficio
// condiviso, un giro di polling su drop-status poteva esaurire il budget e
// far scattare 429 su validate-discount per qualcun altro sullo stesso IP.
// Fix: ogni rateLimit() ora passa `key` (vedi test 6 sotto).
//
// N8 — il feed GMF (Google Merchant Center) annunciava in_stock anche un
// prodotto DROP la cui finestra non è ancora aperta: un'inserzione che il
// checkout rifiuta con 409 è esattamente il disallineamento
// disponibilità/pagina-di-atterraggio per cui Merchant Center sospende gli
// account.
//
// CRITICAL (re-review) — questo file testava il ramo "non ancora aperto" di
// GMF chiamando `isDropOpen(new Date(), cfg)` contro l'OROLOGIO REALE e la
// config REALE: dal momento in cui il drop reale apre (startsAt) a quando
// chiude (endsAt) — cioè per le 72 ore in cui il negozio è effettivamente
// live — quella precondizione diventa falsa, il test fallisce, `prebuild`
// abortisce e OGNI deploy Vercel (hotfix compresi, e ogni commit del pannello
// admin che triggera una rebuild) fallisce. Fix: `now` è sempre un valore
// esplicito iniettato (mai `new Date()` in questo file), sia per il ramo
// "prima dell'apertura" sia per quello "dentro la finestra" — nessuna
// dipendenza dal momento in cui gira il test.
//
// BLOCKING (review finale) — quel fix copriva l'OROLOGIO ma non il
// CONTENUTO: il test 4 (sotto) e i test 1-2 di drop-status leggevano ancora
// `getDrop()` reale e assumevano che il prodotto Altaria fosse — ORA, nel
// momento in cui gira il test — dentro `cfg.current.productIds`.
// `close-drop` (api/admin.js), un'azione admin normale e attesa, svuota
// `current.productIds` e sposta quegli id in `released`: nel momento in cui
// un admin chiude il drop 01, Altaria diventa LISTINO, quelle assertion
// falliscono, `prebuild` abortisce, e il commit stesso che ha chiuso il drop
// (fatto da close-drop via GitHub API, che triggera una build Vercel) non
// arriva mai in produzione — lo store resta bloccato a mostrare un drop
// chiuso senza via d'uscita se non una riparazione manuale via git. Stessa
// classe di bug del CRITICAL sopra, vestita diversa: non più l'orologio, i
// dati mutabili di src/data/drop.js.
//
// Fix: dove la funzione sotto test legge `getDrop()` internamente invece di
// accettare un parametro `cfg` (a differenza delle funzioni pure di
// api/_lib/drop.js, che lo accettano già tutte come ultimo argomento
// opzionale — vedi scripts/test-drop.js), l'oggetto che `getDrop()`
// restituisce resta comunque un riferimento MUTABILE, non uno snapshot
// congelato: iniettare una config sintetica vuol dire mutare
// `liveDrop.current` sul posto per la durata del singolo caso di test e
// ripristinare l'originale in un `finally` (vedi `withSyntheticCurrent`
// sotto) — nessuna firma di produzione cambia, il router chiama sempre
// `handleGmf`/`handleDropStatus` esattamente come in produzione. Il prodotto
// usato dal test GMF resta comunque un id REALE del catalogo (handleGmf
// itera `adminProducts` per costruire il feed: un id inventato non
// comparirebbe mai), ma QUALE prodotto e QUALI date non contano più — presi
// al volo dal catalogo e da una finestra sintetica fissa, mai da ciò che il
// pannello admin ha live in questo momento in src/data/drop.js.
//
// La validità STRUTTURALE di src/data/drop.js (che parsi, che sia ben
// formato) resta compito di scripts/test-drop-config.js — non duplicata qui.
//
// Nessuna chiamata di rete reale: globalThis.fetch è mockato per simulare la
// GitHub Contents API, ripristinato dopo ogni caso. Run: node scripts/test-drop-orders.js
process.env.STRIPE_SECRET_KEY ||= 'sk_test_fake_for_drop_orders_tests'
process.env.GITHUB_TOKEN      ||= 'fake-token-for-drop-orders-tests'

const { default: handler, handleGmf, clearDropStatusMemoForTests } = await import('../api/orders.js')
const { getDrop } = await import('../api/_lib/drop.js')
const { adminProducts } = await import('../src/data/admin-products.js')

let passed = 0
const failures = []

function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { passed++; return }
  failures.push(`${label}\n     atteso: ${e}\n     ottenuto: ${a}`)
}

// ── Mock req/res minimi, in stile Vercel Node handler ───────────────────────
function makeReq({ method = 'GET', handlerName, ip = '203.0.113.1', query = {} } = {}) {
  return {
    method,
    query: { handler: handlerName, ...query },
    headers: { 'x-forwarded-for': ip },
    socket: { remoteAddress: ip },
  }
}

function makeRes() {
  const res = {
    statusCode: null,
    headersSent: {},
    body: null,
    setHeader(k, v) { res.headersSent[k] = v; return res },
    status(code) { res.statusCode = code; return res },
    json(obj) { res.body = obj; return res },
    send(str) { res.body = str; return res },
    end() { return res },
  }
  return res
}

// ── Mock della GitHub Contents API per src/data/drop-sales.json ────────────
// `dropId` di default = il dropId REALE di src/data/drop.js in questo
// momento — usato dai test (3, 5b, 6) che esercitano solo rate limit/memo e
// non controllano il CONTENUTO della risposta: passano un `entry` con
// `products: {}`, quindi quale dropId chiavi il mock è irrilevante per loro.
// I test che controllano dati per-prodotto (1, 2, 4 sotto) passano invece
// esplicitamente `dropId: SYNTHETIC_DROP_ID`, così restano corretti a
// prescindere da quale sia il dropId reale nel momento in cui girano.
const DROP_ID = getDrop().current.id
const originalFetch = globalThis.fetch

function installMockGithub({ getStatus = 200, entry = { counted: {}, products: {} }, dropId = DROP_ID } = {}) {
  const state = { getCalls: 0 }
  globalThis.fetch = async (url, opts) => {
    const isGet = !opts || !opts.method || opts.method === 'GET'
    if (!isGet) throw new Error('test-drop-orders: nessuna scrittura attesa (drop-status/gmf sono di sola lettura)')
    state.getCalls++
    if (getStatus !== 200) {
      return { ok: false, status: getStatus, json: async () => ({ message: `mock ${getStatus}` }) }
    }
    const body = Buffer.from(JSON.stringify({ [dropId]: entry })).toString('base64')
    return { ok: true, status: 200, json: async () => ({ sha: 'sha-x', content: body }) }
  }
  return state
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

// ── Config drop sintetica, iniettata mutando l'oggetto VIVO che getDrop()
//    restituisce ───────────────────────────────────────────────────────────
// handleGmf e handleDropStatus chiamano `getDrop()` internamente — a
// differenza delle funzioni pure di api/_lib/drop.js, non accettano una
// `cfg` come parametro, quindi non è possibile passargliene una sintetica
// come fa scripts/test-drop.js. Ma `getDrop()` non torna una copia: torna
// `dropConfig`, lo stesso identico oggetto importato da src/data/drop.js —
// un binding `const`, ma un OGGETTO, quindi mutabile. `withSyntheticCurrent`
// sfrutta esattamente questo: sostituisce `liveDrop.current` con una config
// di test per la durata di un caso, poi lo ripristina in un `finally` (mai
// lasciato sporco, nemmeno se il caso lancia) — lo stesso oggetto che il
// resto del processo (compresi i test 3, 5, 6, che girano fuori da questo
// wrapper e devono continuare a vedere la config reale) osserva invariato un
// istante dopo. Nessuna riga di src/data/drop.js viene toccata: la mutazione
// vive solo nell'oggetto JS già in memoria di questo processo.
const liveDrop = getDrop()
const originalCurrent = liveDrop.current

async function withSyntheticCurrent(current, fn) {
  liveDrop.current = current
  try {
    return await fn()
  } finally {
    liveDrop.current = originalCurrent
  }
}

const SYNTHETIC_DROP_ID    = 'test-drop-orders-synthetic-drop'
const SYNTHETIC_PRODUCT_ID = 'test-drop-orders-synthetic-item'

// Stessa forma di src/data/drop.js / scripts/test-drop-gate.js, isolata dal
// drop reale. Il `productIds` di default è un id sintetico che non ha
// bisogno di esistere nel catalogo: drop-status legge solo `c.productIds` e
// il registro vendite mockato, mai adminProducts.
function syntheticCurrent(overrides = {}) {
  return {
    id: SYNTHETIC_DROP_ID,
    number: 1,
    title: 'TEST',
    productIds: [SYNTHETIC_PRODUCT_ID],
    startsAt: '2026-01-10T00:00:00Z',
    endsAt:   '2026-01-13T00:00:00Z',
    cap: 20,
    caps: {},
    dropPrice: 2200,
    bundlePrice: 5700,
    ...overrides,
  }
}

async function main() {
  // ── 1. Il memo condivide UNA sola chiamata GitHub fra un burst di
  //       richieste concorrenti, a prescindere dalla querystring — su una
  //       config drop SINTETICA (vedi withSyntheticCurrent sopra):
  //       drop-status popola `products[id]` solo per gli id presenti in
  //       `cfg.current.productIds`, quindi verificare "sold 5" per un
  //       prodotto specifico richiede che quel prodotto sia DAVVERO nel drop
  //       nel momento in cui gira il test — cosa che il drop REALE smette di
  //       garantire nel momento esatto in cui un admin chiude il drop (vedi
  //       BLOCKING in cima al file) ────────────────────────────────────────
  {
    await withSyntheticCurrent(syntheticCurrent(), async () => {
      clearDropStatusMemoForTests()
      const state = installMockGithub({
        dropId: SYNTHETIC_DROP_ID,
        entry: { counted: {}, products: { [SYNTHETIC_PRODUCT_ID]: { sold: 5, lastAt: 'x' } } },
      })
      const pairs = Array.from({ length: 12 }, (_, i) => {
        const req = makeReq({ handlerName: 'drop-status', ip: 'memo-burst', query: { _: String(i) } })
        return [req, makeRes()]
      })
      await Promise.all(pairs.map(([req, res]) => handler(req, res)))

      check('memo: 12 richieste concorrenti con querystring diverse → UNA sola ghGet', state.getCalls, 1)
      check('memo: ogni risposta comunque 200', pairs.every(([, res]) => res.statusCode === 200), true)
      check('memo: ogni risposta riporta i dati reali (sold 5), non un fallback vuoto',
        pairs.every(([, res]) => res.body?.products?.[SYNTHETIC_PRODUCT_ID]?.sold === 5), true)
      restoreFetch()
    })
  }

  // ── 2. Un fallimento di lettura non resta cachato come un successo:
  //       la richiesta successiva, ben dentro il TTL, ritenta GitHub —
  //       stessa config sintetica del test 1, per lo stesso motivo ─────────
  {
    await withSyntheticCurrent(syntheticCurrent(), async () => {
      clearDropStatusMemoForTests()
      const failState = installMockGithub({ getStatus: 500 })
      const reqFail = makeReq({ handlerName: 'drop-status', ip: 'memo-fail' })
      const resFail = makeRes()
      await handler(reqFail, resFail)

      check('fallimento: l\'endpoint pubblico risponde comunque 200 (mai un errore al cliente)',
        resFail.statusCode, 200)
      check('fallimento: sold riportato come fallback 0, non i dati reali (illeggibili)',
        resFail.body?.products?.[SYNTHETIC_PRODUCT_ID]?.sold, 0)
      check('fallimento: una sola ghGet tentata per questa richiesta', failState.getCalls, 1)

      // Nuovo mock con dati reali: se il fallimento fosse stato cachato come
      // successo, questa richiesta (subito dopo, ben dentro i 15s di TTL) non
      // ritenterebbe GitHub e vedrebbe ancora sold 0.
      const okState = installMockGithub({
        dropId: SYNTHETIC_DROP_ID,
        entry: { counted: {}, products: { [SYNTHETIC_PRODUCT_ID]: { sold: 7, lastAt: 'y' } } },
      })
      const reqRetry = makeReq({ handlerName: 'drop-status', ip: 'memo-fail' })
      const resRetry = makeRes()
      await handler(reqRetry, resRetry)

      check('dopo il fallimento: la richiesta successiva RITENTA GitHub (nuova ghGet)', okState.getCalls, 1)
      check('dopo il fallimento: la richiesta successiva vede i dati reali (sold 7), non il fallback',
        resRetry.body?.products?.[SYNTHETIC_PRODUCT_ID]?.sold, 7)
      restoreFetch()
    })
  }

  // ── 3. Rate limit: max 60/min sulla rotta drop-status, stesso schema di
  //       track-order nello stesso file ──────────────────────────────────
  {
    clearDropStatusMemoForTests()
    installMockGithub({ entry: { counted: {}, products: {} } })
    const ip = 'rate-limit-test-ip'
    let ok200 = 0, blocked429 = 0
    let last429Body = null
    for (let i = 0; i < 65; i++) {
      const req = makeReq({ handlerName: 'drop-status', ip })
      const res = makeRes()
      await handler(req, res)
      if (res.statusCode === 200) ok200++
      if (res.statusCode === 429) { blocked429++; last429Body = res.body }
    }
    check('rate limit: le prime 60 richieste dallo stesso IP passano', ok200, 60)
    check('rate limit: dalla 61ª richiesta in poi → 429', blocked429, 5)
    check('rate limit: il 429 porta un messaggio di errore', typeof last429Body?.error, 'string')
    restoreFetch()
  }

  // ── 4. GMF: un prodotto DROP con finestra non ancora aperta è
  //       out_of_stock, e in_stock (sotto cap) a finestra aperta — su una
  //       config drop SINTETICA iniettata via withSyntheticCurrent (vedi
  //       sopra): handleGmf chiama getDrop() internamente e non accetta una
  //       `cfg`, quindi la config va mutata sul posto, non passata a
  //       parametro. Il prodotto dev'essere comunque un id REALE del
  //       catalogo — handleGmf itera `adminProducts` per costruire il feed,
  //       un id inventato non comparirebbe mai — ma QUALE prodotto non
  //       conta: preso al volo dal catalogo, non un id specifico (Altaria)
  //       che smette di essere vero il giorno in cui quel prodotto lascia il
  //       drop reale (vedi BLOCKING in cima al file). Le date sono anch'esse
  //       sintetiche e fisse, mai derivate da src/data/drop.js: `now` resta
  //       comunque un valore esplicito iniettato in handleGmf (chiamata
  //       diretta, terzo argomento — il router lo invoca sempre a 2
  //       argomenti in produzione, comportamento invariato), mai
  //       `new Date()`. ───────────────────────────────────────────────────
  {
    const GMF_PRODUCT_ID = adminProducts[0]?.id
    check('precondizione: il catalogo ha almeno un prodotto da usare nel test GMF',
      typeof GMF_PRODUCT_ID, 'string')

    if (typeof GMF_PRODUCT_ID === 'string') {
      const gmfIdPattern = GMF_PRODUCT_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const current = syntheticCurrent({ productIds: [GMF_PRODUCT_ID] })
      const BEFORE_OPEN   = new Date(Date.parse(current.startsAt) - 1000)
      const INSIDE_WINDOW = new Date(Date.parse(current.startsAt) + 1000)

      // ── 4a. Prima dell'apertura → out_of_stock ──
      await withSyntheticCurrent(current, async () => {
        clearDropStatusMemoForTests()
        installMockGithub({ dropId: SYNTHETIC_DROP_ID, entry: { counted: {}, products: {} } }) // sold 0 per tutti
        const req = makeReq({ method: 'GET', handlerName: 'gmf', ip: 'gmf-before' })
        const res = makeRes()
        await handleGmf(req, res, BEFORE_OPEN)

        check('gmf (prima dell’apertura): risponde 200', res.statusCode, 200)
        const xml = String(res.body || '')
        const itemMatch = new RegExp(`<g:id>${gmfIdPattern}</g:id>[\\s\\S]*?<g:availability>([a-z_]+)</g:availability>`)
          .exec(xml)
        check('gmf (prima dell’apertura): il prodotto DROP sintetico compare nel feed', !!itemMatch, true)
        check('gmf (prima dell’apertura): availability out_of_stock, non in_stock',
          itemMatch?.[1], 'out_of_stock')
        restoreFetch()
      })

      // ── 4b. Dentro la finestra, sotto cap → in_stock — dimostra che la
      //        logica risponde davvero al valore di `now`, non solo che il
      //        ramo "chiuso" funziona (un test che passasse sempre a
      //        out_of_stock, indipendentemente da `now`, sarebbe un falso
      //        verde) ─────────────────────────────────────────────────────
      await withSyntheticCurrent(current, async () => {
        clearDropStatusMemoForTests()
        installMockGithub({ dropId: SYNTHETIC_DROP_ID, entry: { counted: {}, products: {} } }) // sold 0 per tutti
        const req = makeReq({ method: 'GET', handlerName: 'gmf', ip: 'gmf-inside' })
        const res = makeRes()
        await handleGmf(req, res, INSIDE_WINDOW)

        check('gmf (dentro la finestra): risponde 200', res.statusCode, 200)
        const xml = String(res.body || '')
        const itemMatch = new RegExp(`<g:id>${gmfIdPattern}</g:id>[\\s\\S]*?<g:availability>([a-z_]+)</g:availability>`)
          .exec(xml)
        check('gmf (dentro la finestra): availability in_stock (sotto cap)',
          itemMatch?.[1], 'in_stock')
        restoreFetch()
      })
    }
  }

  // ── 5. GMF: stesso schema di drop-status (test 1 e 3) — un burst
  //       cache-busted condivide UNA sola ghGet (memo) ed è rate limited a
  //       60/min sulla rotta del router, con bucket proprio — CRITICAL
  //       (re-review): prima del fix, handleGmf chiamava readSales() diretta
  //       a OGNI richiesta e non aveva alcun rate limit, riaprendo lo stesso
  //       amplificatore GitHub-API non autenticato di cui drop-status era
  //       l'esempio originale. ───────────────────────────────────────────
  {
    // 5a. Memo: 12 richieste concorrenti con querystring diverse → UNA sola
    //     ghGet — passa dal router (`handler`), come in produzione.
    clearDropStatusMemoForTests()
    const state = installMockGithub({
      entry: { counted: {}, products: { [SYNTHETIC_PRODUCT_ID]: { sold: 5, lastAt: 'x' } } },
    })
    const pairs = Array.from({ length: 12 }, (_, i) => {
      const req = makeReq({ handlerName: 'gmf', ip: 'gmf-memo-burst', query: { _: String(i) } })
      return [req, makeRes()]
    })
    await Promise.all(pairs.map(([req, res]) => handler(req, res)))

    check('gmf memo: 12 richieste concorrenti con querystring diverse → UNA sola ghGet', state.getCalls, 1)
    check('gmf memo: ogni risposta comunque 200', pairs.every(([, res]) => res.statusCode === 200), true)
    restoreFetch()

    // 5b. Rate limit: max 60/min sulla rotta gmf, bucket proprio (key: 'gmf').
    clearDropStatusMemoForTests()
    installMockGithub({ entry: { counted: {}, products: {} } })
    const ip = 'gmf-rate-limit-test-ip'
    let ok200 = 0, blocked429 = 0
    for (let i = 0; i < 65; i++) {
      const req = makeReq({ handlerName: 'gmf', ip })
      const res = makeRes()
      await handler(req, res)
      if (res.statusCode === 200) ok200++
      if (res.statusCode === 429) blocked429++
    }
    check('gmf rate limit: le prime 60 richieste dallo stesso IP passano', ok200, 60)
    check('gmf rate limit: dalla 61ª richiesta in poi → 429', blocked429, 5)
    restoreFetch()
  }

  // ── 6. Isolamento dei bucket: saturare drop-status (60/min) sullo stesso
  //       IP non deve far scattare 429 su validate-discount (15/min) —
  //       IMPORTANT (re-review): prima del fix, api/_lib/rateLimit.js keyava
  //       il contatore solo sull'IP, mai sull'endpoint, quindi i quattro
  //       consumer di questo file (track-order, capture-email,
  //       validate-discount, drop-status — +gmf ora) condividevano UN SOLO
  //       bucket per IP. Dietro un CGNAT/IP d'ufficio condiviso, una manciata
  //       di polling su drop-status poteva far arrivare 429 a chi applicava
  //       uno sconto dallo stesso IP. ─────────────────────────────────────
  {
    clearDropStatusMemoForTests()
    installMockGithub({ entry: { counted: {}, products: {} } })
    const ip = 'shared-ip-isolation-test'

    // Satura il bucket di drop-status (60/min): 60 richieste, tutte 200.
    let dropStatus200 = 0
    for (let i = 0; i < 60; i++) {
      const req = makeReq({ handlerName: 'drop-status', ip })
      const res = makeRes()
      await handler(req, res)
      if (res.statusCode === 200) dropStatus200++
    }
    check('isolamento: le 60 richieste drop-status dallo stesso IP passano tutte', dropStatus200, 60)

    // Stesso IP, validate-discount (bucket separato, limite 15/min più
    // basso): deve rispondere nel merito (400, codice sconto inesistente),
    // non 429 — il burst su drop-status non deve aver toccato il suo bucket.
    const reqDiscount = makeReq({ method: 'POST', handlerName: 'validate-discount', ip })
    reqDiscount.body = { code: 'NONEXISTENT', subtotal: 1000, items: [] }
    const resDiscount = makeRes()
    await handler(reqDiscount, resDiscount)

    check('isolamento: validate-discount sullo stesso IP NON è 429 dopo il burst su drop-status',
      resDiscount.statusCode !== 429, true)
    check('isolamento: validate-discount risponde nel merito (400, codice inesistente)',
      resDiscount.statusCode, 400)
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
console.log(`✓ drop-orders: ${passed} test passati`)
