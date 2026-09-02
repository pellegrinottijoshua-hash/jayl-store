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
// account. Testato qui contro la config REALE di src/data/drop.js, MA con un
// `now` iniettato (mai `new Date()` — vedi CRITICAL 1 sotto) derivato dalle
// date reali di quella config, non dall'orologio di sistema: il test resta
// corretto in qualsiasi momento venga eseguito, prebuild incluso durante la
// finestra live del drop.
//
// CRITICAL (re-review) — questo file testava il ramo "non ancora aperto" di
// GMF chiamando `isDropOpen(new Date(), cfg)` contro l'OROLOGIO REALE e la
// config REALE: dal momento in cui il drop reale apre (startsAt) a quando
// chiude (endsAt) — cioè per le 72 ore in cui il negozio è effettivamente
// live — quella precondizione diventa falsa, il test fallisce, `prebuild`
// abortisce e OGNI deploy Vercel (hotfix compresi, e ogni commit del pannello
// admin che triggera una rebuild) fallisce. Fix: `now` è sempre un valore
// esplicito derivato da cfg.current.startsAt/endsAt (mai `new Date()` in
// questo file), sia per il ramo "prima dell'apertura" sia per quello "dentro
// la finestra" — nessuna dipendenza dal momento in cui gira il test.
//
// Nessuna chiamata di rete reale: globalThis.fetch è mockato per simulare la
// GitHub Contents API, ripristinato dopo ogni caso. Run: node scripts/test-drop-orders.js
process.env.STRIPE_SECRET_KEY ||= 'sk_test_fake_for_drop_orders_tests'
process.env.GITHUB_TOKEN      ||= 'fake-token-for-drop-orders-tests'

const { default: handler, handleGmf, clearDropStatusMemoForTests } = await import('../api/orders.js')
const { getDrop } = await import('../api/_lib/drop.js')

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
// Usa il dropId REALE di src/data/drop.js — handleDropStatus/handleGmf
// chiamano getDrop() internamente, non è iniettabile dal test.
const DROP_ID = getDrop().current.id
const dataWith = (entry) => ({ [DROP_ID]: entry })
const originalFetch = globalThis.fetch

function installMockGithub({ getStatus = 200, entry = { counted: {}, products: {} } } = {}) {
  const state = { getCalls: 0 }
  globalThis.fetch = async (url, opts) => {
    const isGet = !opts || !opts.method || opts.method === 'GET'
    if (!isGet) throw new Error('test-drop-orders: nessuna scrittura attesa (drop-status/gmf sono di sola lettura)')
    state.getCalls++
    if (getStatus !== 200) {
      return { ok: false, status: getStatus, json: async () => ({ message: `mock ${getStatus}` }) }
    }
    const body = Buffer.from(JSON.stringify(dataWith(entry))).toString('base64')
    return { ok: true, status: 200, json: async () => ({ sha: 'sha-x', content: body }) }
  }
  return state
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

// Prodotto reale del drop corrente — vedi scripts/test-drop.js.
const ALTARIA = 'altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him'

async function main() {
  // ── 1. Il memo condivide UNA sola chiamata GitHub fra un burst di
  //       richieste concorrenti, a prescindere dalla querystring ──────────
  {
    clearDropStatusMemoForTests()
    const state = installMockGithub({
      entry: { counted: {}, products: { [ALTARIA]: { sold: 5, lastAt: 'x' } } },
    })
    const pairs = Array.from({ length: 12 }, (_, i) => {
      const req = makeReq({ handlerName: 'drop-status', ip: 'memo-burst', query: { _: String(i) } })
      return [req, makeRes()]
    })
    await Promise.all(pairs.map(([req, res]) => handler(req, res)))

    check('memo: 12 richieste concorrenti con querystring diverse → UNA sola ghGet', state.getCalls, 1)
    check('memo: ogni risposta comunque 200', pairs.every(([, res]) => res.statusCode === 200), true)
    check('memo: ogni risposta riporta i dati reali (sold 5), non un fallback vuoto',
      pairs.every(([, res]) => res.body?.products?.[ALTARIA]?.sold === 5), true)
    restoreFetch()
  }

  // ── 2. Un fallimento di lettura non resta cachato come un successo:
  //       la richiesta successiva, ben dentro il TTL, ritenta GitHub ───────
  {
    clearDropStatusMemoForTests()
    const failState = installMockGithub({ getStatus: 500 })
    const reqFail = makeReq({ handlerName: 'drop-status', ip: 'memo-fail' })
    const resFail = makeRes()
    await handler(reqFail, resFail)

    check('fallimento: l\'endpoint pubblico risponde comunque 200 (mai un errore al cliente)',
      resFail.statusCode, 200)
    check('fallimento: sold riportato come fallback 0, non i dati reali (illeggibili)',
      resFail.body?.products?.[ALTARIA]?.sold, 0)
    check('fallimento: una sola ghGet tentata per questa richiesta', failState.getCalls, 1)

    // Nuovo mock con dati reali: se il fallimento fosse stato cachato come
    // successo, questa richiesta (subito dopo, ben dentro i 15s di TTL) non
    // ritenterebbe GitHub e vedrebbe ancora sold 0.
    const okState = installMockGithub({
      entry: { counted: {}, products: { [ALTARIA]: { sold: 7, lastAt: 'y' } } },
    })
    const reqRetry = makeReq({ handlerName: 'drop-status', ip: 'memo-fail' })
    const resRetry = makeRes()
    await handler(reqRetry, resRetry)

    check('dopo il fallimento: la richiesta successiva RITENTA GitHub (nuova ghGet)', okState.getCalls, 1)
    check('dopo il fallimento: la richiesta successiva vede i dati reali (sold 7), non il fallback',
      resRetry.body?.products?.[ALTARIA]?.sold, 7)
    restoreFetch()
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
  //       out_of_stock, e in_stock (sotto cap) a finestra aperta — sul drop
  //       REALE (src/data/drop.js), MAI sull'orologio di sistema. `now` è
  //       iniettato in handleGmf (chiamata diretta, terzo argomento — il
  //       router lo invoca sempre a 2 argomenti in produzione, comportamento
  //       invariato) e derivato da cfg.current.startsAt, non da un valore
  //       sintetico né da `new Date()`: vero per costruzione in qualunque
  //       momento giri il test, live-window del drop reale inclusa. ────────
  {
    const cfg = getDrop()
    const startsAtMs = Date.parse(cfg.current.startsAt)
    const endsAtMs   = Date.parse(cfg.current.endsAt)
    check('precondizione: la config del drop corrente ha una finestra valida (startsAt < endsAt)',
      Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs) && startsAtMs < endsAtMs, true)

    const BEFORE_OPEN   = new Date(startsAtMs - 1000)
    const INSIDE_WINDOW = new Date(startsAtMs + 1000)

    // ── 4a. Prima dell'apertura → out_of_stock ──
    {
      clearDropStatusMemoForTests()
      installMockGithub({ entry: { counted: {}, products: {} } }) // sold 0 per tutti
      const req = makeReq({ method: 'GET', handlerName: 'gmf', ip: 'gmf-before' })
      const res = makeRes()
      await handleGmf(req, res, BEFORE_OPEN)

      check('gmf (prima dell’apertura): risponde 200', res.statusCode, 200)
      const xml = String(res.body || '')
      const itemMatch = new RegExp(`<g:id>${ALTARIA}</g:id>[\\s\\S]*?<g:availability>([a-z_]+)</g:availability>`)
        .exec(xml)
      check('gmf (prima dell’apertura): il prodotto DROP reale (Altaria) compare nel feed', !!itemMatch, true)
      check('gmf (prima dell’apertura): availability out_of_stock, non in_stock',
        itemMatch?.[1], 'out_of_stock')
      restoreFetch()
    }

    // ── 4b. Dentro la finestra, sotto cap → in_stock — dimostra che la
    //        logica risponde davvero al valore di `now`, non solo che il
    //        ramo "chiuso" funziona (un test che passasse sempre a
    //        out_of_stock, indipendentemente da `now`, sarebbe un falso
    //        verde) ─────────────────────────────────────────────────────
    {
      clearDropStatusMemoForTests()
      installMockGithub({ entry: { counted: {}, products: {} } }) // sold 0 per tutti
      const req = makeReq({ method: 'GET', handlerName: 'gmf', ip: 'gmf-inside' })
      const res = makeRes()
      await handleGmf(req, res, INSIDE_WINDOW)

      check('gmf (dentro la finestra): risponde 200', res.statusCode, 200)
      const xml = String(res.body || '')
      const itemMatch = new RegExp(`<g:id>${ALTARIA}</g:id>[\\s\\S]*?<g:availability>([a-z_]+)</g:availability>`)
        .exec(xml)
      check('gmf (dentro la finestra): availability in_stock (sotto cap)',
        itemMatch?.[1], 'in_stock')
      restoreFetch()
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
      entry: { counted: {}, products: { [ALTARIA]: { sold: 5, lastAt: 'x' } } },
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
