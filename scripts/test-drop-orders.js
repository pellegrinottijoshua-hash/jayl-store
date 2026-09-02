#!/usr/bin/env node
// Unit test per gli endpoint pubblici drop-aware di api/orders.js:
// drop-status (memo + rate limit) e gmf (disponibilità).
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
// N8 — il feed GMF (Google Merchant Center) annunciava in_stock anche un
// prodotto DROP la cui finestra non è ancora aperta: un'inserzione che il
// checkout rifiuta con 409 è esattamente il disallineamento
// disponibilità/pagina-di-atterraggio per cui Merchant Center sospende gli
// account. Testato qui contro la config REALE di src/data/drop.js — che oggi
// ha un drop non ancora aperto (startsAt 2026-09-05T16:00Z), quindi non è uno
// scenario ipotetico.
//
// Nessuna chiamata di rete reale: globalThis.fetch è mockato per simulare la
// GitHub Contents API, ripristinato dopo ogni caso. Run: node scripts/test-drop-orders.js
process.env.STRIPE_SECRET_KEY ||= 'sk_test_fake_for_drop_orders_tests'
process.env.GITHUB_TOKEN      ||= 'fake-token-for-drop-orders-tests'

const { default: handler, clearDropStatusMemoForTests } = await import('../api/orders.js')
const { getDrop, isDropOpen } = await import('../api/_lib/drop.js')

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
  //       out_of_stock, non in_stock — sul drop REALE, non uno sintetico ──
  {
    const cfg = getDrop()
    const dropCurrentlyOpen = isDropOpen(new Date(), cfg)
    check(
      'precondizione: il drop reale (src/data/drop.js) non è ancora aperto ora — ' +
      'altrimenti questo test non eserciterebbe il ramo "non ancora aperto" che deve provare',
      dropCurrentlyOpen, false,
    )

    installMockGithub({ entry: { counted: {}, products: {} } }) // sold 0 per tutti
    const req = makeReq({ method: 'GET', handlerName: 'gmf', ip: 'gmf-test' })
    const res = makeRes()
    await handler(req, res)

    check('gmf: risponde 200', res.statusCode, 200)
    const xml = String(res.body || '')
    const itemMatch = new RegExp(`<g:id>${ALTARIA}</g:id>[\\s\\S]*?<g:availability>([a-z_]+)</g:availability>`)
      .exec(xml)
    check('gmf: il prodotto DROP reale (Altaria) compare nel feed', !!itemMatch, true)
    check('gmf: drop non ancora aperto → availability out_of_stock, non in_stock',
      itemMatch?.[1], 'out_of_stock')
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
