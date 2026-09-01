# Sistema Drop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare jayl.store in un negozio a drop — tre magliette alla volta a €22 in edizione numerata da 20 pezzi con cap reale imposto lato server, il resto del catalogo nascosto e rilasciato progressivamente a €25.

**Architecture:** Un modulo di configurazione (`src/data/drop.js`) è l'unica fonte di verità; da lì si derivano tre stati per prodotto (DROP / LISTINO / VAULT) senza aggiungere campi a `admin-products.js`. La logica pura vive in `api/_lib/drop.js`, condivisa fra client e server. Il contatore delle vendite è un file JSON letto e scritto a runtime via API GitHub, mai importato. La visibilità si applica in build; il divieto d'acquisto si applica al checkout.

**Tech Stack:** Vite + React SPA, funzioni serverless Node su Vercel, Stripe, API GitHub Contents. Nessun framework di test: si usa lo stile a script Node già presente in `scripts/test-placement.js`.

**Spec:** `docs/superpowers/specs/2026-09-01-jayl-drop-system-design.md`

## Scope

Questo piano copre **solo il negozio**. La §6 della spec — carosello e storie su `api/publish-social.js` — è un sottosistema indipendente che non condivide codice con il drop: va in un piano separato, dopo questo.

## Global Constraints

- **Nessuna nuova serverless function.** `vercel.json` instrada gli endpoint su pochi handler per restare sotto il limite Vercel. Le azioni nuove entrano in `api/orders.js` e `api/admin.js`.
- **Il codice server non importa mai moduli Vite-only.** Niente `src/data/products.js`, niente alias `@/`, niente specifier risolti da plugin. `scripts/check-api-imports.js` gira in prebuild e fa fallire la build. È per questo che `src/data/drop.js` è un `.js` e non un `.json`.
- **`src/data/admin-products.js` non si modifica.** 860 KB che transitano interi dall'API GitHub a ogni salvataggio admin.
- **Prezzi in centesimi, interi.** DROP 2200, LISTINO 2500, bundle 5700, sconto bundle 900.
- **Cap default 20.** Soglia di rivelazione del contatore: 30% del cap, cioè 6 pezzi su 20.
- **La password admin non compare mai nel client né nei commit.** Vive solo in `ADMIN_PASSWORD` su Vercel.
- **Nessun dato di urgenza inventato.** Ogni numero mostrato deriva da un fatto verificabile.
- **`npm run lint` non deve introdurre errori nuovi.** C'è un backlog noto di ~45 warning; non silenziare regole per farne sparire una.
- **Prima di ogni push: `git pull --rebase --autostash origin main`** — il pannello admin committa direttamente su remote main.

## File Structure

**Nuovi:**
- `src/data/drop.js` — configurazione del drop. Unica fonte di verità sugli stati.
- `api/_lib/drop.js` — logica pura: stato, prezzo base, apertura finestra, cap, modalità contatore, sconto bundle. Nessun I/O.
- `api/_lib/github.js` — `ghGet` / `ghPut` estratti dalle copie duplicate in `orders.js` e `admin.js`.
- `api/_lib/drop-sales.js` — lettura e scrittura del registro vendite. Idempotente sul payment intent id.
- `src/components/drop/DropBadge.jsx` — badge disponibilità (edizione / contatore / sold out).
- `src/components/drop/DropCountdown.jsx` — countdown.
- `src/components/drop/DropPanels.jsx` — i tre quadrati della home.
- `src/components/admin/DropTab.jsx` — pannello admin del drop.
- `src/hooks/useDropStatus.js` — fetch del contatore live.
- `scripts/test-drop.js` — test della logica pura, stile `test-placement.js`.

**Modificati:**
- `api/_lib/catalog.js` — override di prezzo in `priceItem`, sconto bundle e blocco sconti in `applyDiscount`.
- `api/create-payment-intent.js` — gate vault / drop chiuso / cap esaurito.
- `api/orders.js` — usa `_lib/github.js`, registra la vendita in `create-order`, nuovo handler `drop-status`, prerender consapevole del vault.
- `api/webhook.js` — registra la vendita nel percorso di fallback.
- `api/admin.js` — usa `_lib/github.js`, quattro azioni nuove.
- `vite.config.js` — il plugin `storefront-products` elimina i prodotti VAULT.
- `scripts/generate-sitemap.js` — esclude i VAULT.
- `vercel.json` — rewrite di `/api/drop-status`.
- `src/pages/HomePage.jsx` — home a tre schermi.
- `src/pages/ProductPage.jsx` — blocco drop, stati LISTINO e VAULT.
- `src/pages/AdminPage.jsx` — registrazione del tab Drop.
- `src/components/cart/` — spinta bundle.
- `src/components/EmailCapturePopup.jsx` — testo lista d'attesa.
- `package.json` — `test-drop.js` in `test` e `prebuild`.

---

### Task 1: Logica pura del drop

Fondamenta. Nessun I/O, tutto testabile in isolamento. Ogni task successivo dipende da qui.

**Files:**
- Create: `src/data/drop.js`
- Create: `api/_lib/drop.js`
- Create: `scripts/test-drop.js`
- Modify: `package.json` (script `test` e `prebuild`)

**Interfaces:**
- Consumes: niente.
- Produces:
  - `getDrop() → cfg`
  - `productState(productId, cfg?) → 'drop' | 'listino' | 'vault'`
  - `isDropOpen(now?, cfg?) → boolean`
  - `basePriceFor(productId, sizeObj, product, cfg?) → number` (centesimi)
  - `capFor(productId, cfg?) → number`
  - `counterMode(sold, cap) → { mode: 'hidden'|'edition'|'counter'|'soldout', sold?, cap? }`
  - `bundleDiscount(items, cfg?) → number` — `items` sono oggetti con almeno `productId`
  - costanti `DROP`, `LISTINO`, `VAULT`

- [ ] **Step 1: Creare la configurazione del drop**

`src/data/drop.js`. Gli id prodotto vanno presi da `src/data/admin-products.js`: cercare gli id che contengono `altaria` e `snorlax` nella collection `cool pokemon back`. **Ursaring non esiste ancora in catalogo**: lasciare `productIds` con i due id reali finché il terzo prodotto non è stato creato — il codice deve funzionare con 2 o 3 elementi, e `bundleDiscount` si attiva solo con 3.

```js
// Configurazione del drop corrente. Modificata dal pannello admin (tab Drop),
// che la committa su main via API GitHub.
//
// Modulo .js e non .json di proposito: questo file è importato sia dal client
// (Vite) sia dalle funzioni serverless (Node). Vedi scripts/check-api-imports.js.
export const drop = {
  current: {
    id: 'drop-01-sleep-mode',
    number: 1,
    title: 'SLEEP MODE',
    productIds: [],
    startsAt: '2026-09-05T16:00:00Z',
    endsAt:   '2026-09-08T16:00:00Z',
    cap: 20,
    caps: {},
    dropPrice: 2200,
    bundlePrice: 5700,
  },
  // Popolato da 'close-drop': tiene i pezzi del drop appena chiuso, così fra un
  // drop e l'altro la home ha ancora qualcosa da mostrare invece di svuotarsi.
  previous: null,
  next: { number: 2, startsAt: '2026-09-09T16:00:00Z' },
  released: [],
  archivePrice: 2500,
}
```

- [ ] **Step 2: Scrivere il test che fallisce**

`scripts/test-drop.js`. Lo stile è quello di `scripts/test-placement.js`: helper `check`, contatore, uscita con codice 1.

```js
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
```

- [ ] **Step 3: Eseguire il test per verificare che fallisca**

Run: `node scripts/test-drop.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` — `api/_lib/drop.js` non esiste.

- [ ] **Step 4: Scrivere l'implementazione minima**

`api/_lib/drop.js`:

```js
// Logica pura del sistema drop: stato, prezzo, finestra, cap, contatore, bundle.
// Nessun I/O. Il registro vendite vive in api/_lib/drop-sales.js.
//
// Importato sia dal client (Vite) sia dalle funzioni serverless (Node), quindi
// tutto qui deve restare risolvibile da Node puro.
import { drop as dropConfig } from '../../src/data/drop.js'

export const DROP    = 'drop'
export const LISTINO = 'listino'
export const VAULT   = 'vault'

/** Configurazione corrente. */
export function getDrop() {
  return dropConfig
}

/** Stato di vendita di un prodotto. Tutto ciò che non è esplicito è VAULT. */
export function productState(productId, cfg = dropConfig) {
  if (cfg?.current?.productIds?.includes(productId)) return DROP
  if (cfg?.released?.includes(productId)) return LISTINO
  return VAULT
}

/** La finestra è [startsAt, endsAt): all'istante di chiusura il drop è già chiuso. */
export function isDropOpen(now = new Date(), cfg = dropConfig) {
  const c = cfg?.current
  if (!c?.startsAt || !c?.endsAt) return false
  const t = now.getTime()
  return t >= Date.parse(c.startsAt) && t < Date.parse(c.endsAt)
}

/**
 * Prezzo base in centesimi, prima di eventuali supplementi cornice.
 * L'override per stato ignora sia product.price sia sizes[].price: un drop ha un
 * prezzo unico, non una scala per taglia.
 */
export function basePriceFor(productId, sizeObj, product, cfg = dropConfig) {
  const state = productState(productId, cfg)
  if (state === DROP)    return cfg.current.dropPrice
  if (state === LISTINO) return cfg.archivePrice
  return sizeObj?.price ?? product?.price ?? 0
}

/** Cap dell'edizione. 0 per i prodotti che non sono nel drop corrente. */
export function capFor(productId, cfg = dropConfig) {
  if (productState(productId, cfg) !== DROP) return 0
  return cfg.current?.caps?.[productId] ?? cfg.current?.cap ?? 0
}

/**
 * Come mostrare la disponibilità.
 * Sotto il 30% venduto si mostra solo la dimensione dell'edizione: al lancio,
 * "19 disponibili su 20" non comunica scarsità, dimostra che non compra nessuno.
 */
export function counterMode(sold, cap) {
  if (!cap) return { mode: 'hidden' }
  if (sold >= cap) return { mode: 'soldout', sold, cap }
  if (sold < cap * 0.3) return { mode: 'edition', cap }
  return { mode: 'counter', sold, cap }
}

/** Sconto bundle in centesimi se il carrello contiene tutti e tre i pezzi del drop. */
export function bundleDiscount(items, cfg = dropConfig) {
  const ids = cfg?.current?.productIds || []
  if (ids.length !== 3) return 0
  const inCart = new Set((items || []).map(i => i.productId))
  if (!ids.every(id => inCart.has(id))) return 0
  return ids.length * cfg.current.dropPrice - cfg.current.bundlePrice
}
```

- [ ] **Step 5: Eseguire il test per verificare che passi**

Run: `node scripts/test-drop.js`
Expected: PASS — `✓ drop: 22 test passati`

- [ ] **Step 6: Agganciare il test alla pipeline**

In `package.json`, aggiungere `node scripts/test-drop.js` a `test` e a `prebuild`:

```json
"prebuild": "node scripts/check-api-imports.js && node scripts/test-placement.js && node scripts/test-drop.js && node scripts/check-print-files.js && node scripts/generate-sitemap.js",
"test": "node scripts/test-placement.js && node scripts/test-drop.js && node scripts/check-print-files.js",
```

- [ ] **Step 7: Verificare che le API importino ancora pulite**

Run: `node scripts/check-api-imports.js`
Expected: PASS — conferma che `src/data/drop.js` è risolvibile da Node.

- [ ] **Step 8: Commit**

```bash
git add src/data/drop.js api/_lib/drop.js scripts/test-drop.js package.json
git commit -m "feat(drop): logica pura di stato, prezzo e cap"
```

---

### Task 2: Override di prezzo e sconto bundle

**Files:**
- Modify: `api/_lib/catalog.js` (`priceItem` riga ~82, `applyDiscount` riga ~165)
- Modify: `scripts/test-drop.js`

**Interfaces:**
- Consumes: `basePriceFor`, `bundleDiscount`, `productState`, `DROP` da `api/_lib/drop.js`.
- Produces: `applyDiscount(subtotal, code, items?)` — terzo parametro nuovo, opzionale, retrocompatibile. `bundleAdjustment(items) → { amount, label }`.

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere in fondo a `scripts/test-drop.js`, **prima** del blocco `── Report ──`:

```js
// ── Integrazione con catalog.js ─────────────────────────────────────────────
import { applyDiscount, bundleAdjustment } from '../api/_lib/catalog.js'

check('sconto percentuale su carrello senza pezzi in drop → valido',
  applyDiscount(10000, 'JAYL10', [{ productId: 'zzz' }]).ok, true)

check('sconto percentuale con un pezzo in drop → rifiutato',
  applyDiscount(10000, 'JAYL10', [{ productId: 'aaa' }]).ok, false)

check('senza lista items il codice resta valido (retrocompatibilità)',
  applyDiscount(10000, 'JAYL10').ok, true)

check('bundleAdjustment con i tre pezzi → 900',
  bundleAdjustment([{ productId: 'aaa' }, { productId: 'bbb' }, { productId: 'ccc' }]).amount, 900)

check('bundleAdjustment con due pezzi → 0',
  bundleAdjustment([{ productId: 'aaa' }, { productId: 'bbb' }]).amount, 0)
```

> I test su `applyDiscount` e `bundleAdjustment` usano la configurazione **reale** di `src/data/drop.js`, non `cfg`. Perché passino, `src/data/drop.js` deve avere `productIds: ['aaa','bbb','ccc']` durante lo sviluppo di questo task — oppure, meglio, sostituire `'aaa'/'bbb'/'ccc'` con i tre id reali del drop 01 una volta popolati. Scegliere la seconda strada e usare gli id reali.

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `node scripts/test-drop.js`
Expected: FAIL — `bundleAdjustment` non è esportata da `catalog.js`.

- [ ] **Step 3: Applicare l'override di prezzo**

In `api/_lib/catalog.js`, aggiungere l'import in cima, sotto quello di `admin-products.js`:

```js
import { basePriceFor, bundleDiscount, productState, DROP } from './drop.js'
```

Sostituire la riga del prezzo unitario in `priceItem` (attualmente `const unitPrice = (sizeObj?.price ?? product.price) + (frameObj?.price ?? 0)`):

```js
  // Il prezzo di stato (drop / listino) sovrascrive sia product.price sia
  // sizes[].price: un drop ha un prezzo unico, non una scala per taglia.
  const unitPrice = basePriceFor(productId, sizeObj, product) + (frameObj?.price ?? 0)
```

- [ ] **Step 4: Bloccare gli sconti percentuali sui pezzi in drop e aggiungere il bundle**

Sostituire `applyDiscount` e aggiungere `bundleAdjustment` subito dopo:

```js
/**
 * Valida un codice sconto e calcola l'importo.
 * Ritorna { ok: true, amount, label } oppure { ok: false, error }.
 * amount in centesimi, sempre ≥ 0.
 *
 * `items` è opzionale per retrocompatibilità, ma va passato ovunque sia
 * disponibile: un -10% su un'edizione limitata a €22 produce €19,80 e scioglie
 * la scala di prezzo su cui si regge il drop.
 */
export function applyDiscount(subtotal, code, items = []) {
  if (!code) return { ok: false, error: 'No discount code provided' }
  const entry = DISCOUNT_CODES[String(code).trim().toUpperCase()]
  if (!entry) return { ok: false, error: 'Invalid discount code' }

  const hasDropItem = items.some((i) => productState(i.productId) === DROP)
  if (hasDropItem) {
    return { ok: false, error: 'I codici sconto non sono validi sui pezzi in drop.' }
  }

  if (entry.type === 'percent') {
    return { ok: true, amount: Math.round(subtotal * entry.value / 100), label: entry.label }
  }
  if (entry.type === 'fixed') {
    return { ok: true, amount: Math.min(entry.value, subtotal), label: entry.label }
  }
  return { ok: false, error: 'Invalid discount type' }
}

/**
 * Sconto bundle automatico: nessun codice, nessuno SKU dedicato. Se il carrello
 * contiene tutti e tre i pezzi del drop, si applica da solo.
 */
export function bundleAdjustment(items) {
  const amount = bundleDiscount(items)
  return amount > 0 ? { amount, label: 'Bundle drop — tutti e tre' } : { amount: 0, label: null }
}
```

- [ ] **Step 5: Eseguire i test**

Run: `node scripts/test-drop.js && node scripts/check-api-imports.js`
Expected: PASS su entrambi.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/catalog.js scripts/test-drop.js
git commit -m "feat(drop): prezzo per stato, sconto bundle, blocco codici in drop"
```

---

### Task 3: Registro vendite

**Files:**
- Create: `api/_lib/github.js`
- Create: `api/_lib/drop-sales.js`
- Modify: `api/orders.js:346-380` (rimuove le copie locali, importa dal lib)
- Modify: `api/admin.js:7-…` (idem)

**Interfaces:**
- Consumes: `capFor`, `productState`, `getDrop`, `DROP` da `api/_lib/drop.js`.
- Produces:
  - `ghGet(path, token) → { content, sha, … }`, `ghPut(path, content, sha, message, token) → json` da `api/_lib/github.js`
  - `readSales(dropId) → { counted: string[], products: { [id]: { sold, lastAt } } }`
  - `soldFor(dropId, productId) → Promise<number>`
  - `recordDropSale(paymentIntentId, items) → Promise<{ ok, numbers?: { [productId]: number } }>`

- [ ] **Step 1: Estrarre gli helper GitHub**

`ghGet` e `ghPut` sono oggi duplicati identici in `api/orders.js` e `api/admin.js`; il registro vendite sarebbe il terzo consumatore. Creare `api/_lib/github.js` spostando il codice **verbatim**:

```js
// Helper condivisi per l'API GitHub Contents. Erano duplicati in api/orders.js e
// api/admin.js; api/_lib/drop-sales.js è il terzo consumatore.
const GITHUB_OWNER  = 'pellegrinottijoshua-hash'
const GITHUB_REPO   = 'jayl-store'
const GITHUB_BRANCH = 'main'

export async function ghGet(path, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`)
  return res.json()
}

export async function ghPut(path, content, sha, message, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${JSON.stringify(err.message || err)}`)
  }
  return res.json()
}
```

In `api/orders.js` e `api/admin.js`: cancellare le definizioni locali di `ghGet`/`ghPut` e le costanti `GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH` **solo se non sono usate altrove nel file** (verificare con `grep -n GITHUB_ api/orders.js api/admin.js`; se lo sono, lasciare le costanti e togliere solo le funzioni), e aggiungere in cima:

```js
import { ghGet, ghPut } from './_lib/github.js'
```

- [ ] **Step 2: Verificare che nulla si sia rotto**

Run: `node scripts/check-api-imports.js && npm run lint`
Expected: import puliti; nessun errore ESLint nuovo (i ~45 warning preesistenti restano).

- [ ] **Step 3: Commit dell'estrazione, isolata**

```bash
git add api/_lib/github.js api/orders.js api/admin.js
git commit -m "refactor(api): estrae ghGet/ghPut in _lib/github.js"
```

- [ ] **Step 4: Scrivere il registro vendite**

`api/_lib/drop-sales.js`:

```js
// Registro delle vendite di un drop. Vive in src/data/drop-sales.json e viene
// letto e scritto a runtime via API GitHub — mai importato, altrimenti sarebbe
// congelato al deploy, che è esattamente ciò che un contatore non deve essere.
//
// Si legge dall'API autenticata e non da raw.githubusercontent: quest'ultima ha
// cache CDN di alcuni minuti e permetterebbe di sforare il cap.
import { ghGet, ghPut } from './github.js'
import { capFor, productState, DROP } from './drop.js'

const SALES_PATH = 'src/data/drop-sales.json'
const EMPTY = { counted: [], products: {} }

async function readFile(token) {
  try {
    const file = await ghGet(SALES_PATH, token)
    return {
      sha: file.sha,
      data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')),
    }
  } catch {
    return { sha: null, data: {} }   // il file non esiste ancora
  }
}

/** Stato del registro per un drop. Non lancia: senza token o senza file torna vuoto. */
export async function readSales(dropId, token = process.env.GITHUB_TOKEN) {
  if (!token) return { ...EMPTY }
  const { data } = await readFile(token)
  return data[dropId] ? { counted: [], products: {}, ...data[dropId] } : { ...EMPTY }
}

/** Pezzi venduti di un prodotto. */
export async function soldFor(dropId, productId, token = process.env.GITHUB_TOKEN) {
  const sales = await readSales(dropId, token)
  return sales.products[productId]?.sold ?? 0
}

/**
 * Registra una vendita e assegna i numeri dei pezzi.
 * Idempotente sul payment intent id: create-order e il webhook chiamano entrambi
 * questa funzione, e il webhook è solo un fallback che parte 10 s dopo.
 * Riprova fino a 3 volte sul conflitto di sha causato da vendite simultanee.
 */
export async function recordDropSale(paymentIntentId, items, token = process.env.GITHUB_TOKEN) {
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not configured' }
  if (!paymentIntentId) return { ok: false, error: 'paymentIntentId required' }

  const dropItems = (items || []).filter((i) => productState(i.productId) === DROP)
  if (dropItems.length === 0) return { ok: true, numbers: {} }

  const dropId = (await import('./drop.js')).getDrop().current.id

  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha, data } = await readFile(token)
    const entry = data[dropId] ? { counted: [], products: {}, ...data[dropId] } : { ...EMPTY }

    if (entry.counted.includes(paymentIntentId)) {
      return { ok: true, alreadyCounted: true, numbers: {} }
    }

    const numbers = {}
    const now = new Date().toISOString()
    for (const item of dropItems) {
      const prev = entry.products[item.productId]?.sold ?? 0
      const qty  = Math.max(1, parseInt(item.quantity, 10) || 1)
      const cap  = capFor(item.productId)
      const next = cap ? Math.min(prev + qty, cap) : prev + qty
      entry.products[item.productId] = { sold: next, lastAt: now }
      numbers[item.productId] = next          // il numero del pezzo: "#7/20"
    }
    entry.counted = [...entry.counted, paymentIntentId]

    const nextData = { ...data, [dropId]: entry }
    try {
      await ghPut(
        SALES_PATH,
        JSON.stringify(nextData, null, 2) + '\n',
        sha,
        `[drop] sale ${paymentIntentId} [skip ci]`,
        token,
      )
      return { ok: true, numbers }
    } catch (err) {
      if (attempt === 2) {
        console.error('[drop-sales] record failed after 3 attempts:', err.message)
        return { ok: false, error: err.message }
      }
      // conflitto di sha: un'altra vendita ha scritto nel frattempo, rileggi
    }
  }
  return { ok: false, error: 'unreachable' }
}
```

- [ ] **Step 5: Verificare gli import**

Run: `node scripts/check-api-imports.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/drop-sales.js
git commit -m "feat(drop): registro vendite idempotente con numerazione dei pezzi"
```

---

### Task 4: Gate al checkout

Il punto in cui il cap smette di essere una grafica e diventa un fatto.

**Files:**
- Modify: `api/create-payment-intent.js:42-52` (il ciclo `assertPrintable`) e `:63-70` (sconto)

**Interfaces:**
- Consumes: `productState`, `isDropOpen`, `capFor`, `getDrop`, `VAULT`, `DROP`; `soldFor`; `bundleAdjustment`.
- Produces: niente per i task successivi.

- [ ] **Step 1: Aggiungere gli import**

```js
import { productState, isDropOpen, capFor, getDrop, VAULT, DROP } from './_lib/drop.js'
import { soldFor } from './_lib/drop-sales.js'
import { bundleAdjustment } from './_lib/catalog.js'   // aggiungere alla import list esistente
```

- [ ] **Step 2: Inserire il gate subito dopo il ciclo `assertPrintable`**

```js
    // Gate del drop. Copre tre problemi con un solo controllo: prodotti nascosti
    // che sopravvivono in un carrello persistito (cartStore salva l'intero oggetto
    // prodotto in localStorage, non l'id), drop scaduti, ed edizioni esaurite.
    // Senza questo, "EDITION OF 20" sarebbe una dichiarazione falsa.
    const cfg = getDrop()
    const dropOpen = isDropOpen(new Date(), cfg)

    for (const item of priced.items) {
      const state = productState(item.productId, cfg)

      if (state === VAULT) {
        return res.status(409).json({
          error: `"${item.product?.name || item.productId}" non è più disponibile. Rimuovilo dal carrello per completare l'ordine.`,
        })
      }

      if (state === DROP && !dropOpen) {
        const next = cfg.next?.startsAt
          ? new Date(cfg.next.startsAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
          : null
        return res.status(409).json({
          error: next
            ? `Il drop è chiuso. Il prossimo apre il ${next}.`
            : 'Il drop è chiuso.',
        })
      }

      if (state === DROP) {
        const cap = capFor(item.productId, cfg)
        // Fail-open: se il registro non è leggibile lasciamo passare e logghiamo.
        // Vendere 21 pezzi su 20 è recuperabile; bloccare ogni checkout perché
        // GitHub ha singhiozzato non lo è.
        try {
          const sold = await soldFor(cfg.current.id, item.productId)
          if (cap && sold + item.quantity > cap) {
            return res.status(409).json({
              error: `"${item.product?.name || item.productId}" è esaurito: l'edizione è chiusa a ${cap} pezzi.`,
            })
          }
        } catch (err) {
          console.error('[create-payment-intent] cap check unavailable, allowing:', err.message)
        }
      }
    }
```

- [ ] **Step 3: Passare gli items ad `applyDiscount` e aggiungere il bundle**

Sostituire il blocco sconto esistente:

```js
    let discountAmount = 0
    let discountLabel  = null
    if (discountCode?.trim()) {
      const disc = applyDiscount(subtotal, discountCode, priced.items)
      if (!disc.ok) return res.status(400).json({ error: disc.error })
      discountAmount = disc.amount
      discountLabel  = disc.label
    }

    // Sconto bundle automatico — nessun codice, si applica da solo e si somma.
    const bundle = bundleAdjustment(priced.items)
    if (bundle.amount > 0) {
      discountAmount += bundle.amount
      discountLabel   = discountLabel ? `${discountLabel} + ${bundle.label}` : bundle.label
    }
```

- [ ] **Step 4: Verificare**

Run: `node scripts/check-api-imports.js && npm run lint`
Expected: import puliti, nessun errore nuovo.

- [ ] **Step 5: Verifica manuale del gate**

Popolare `src/data/drop.js` con `productIds: []` (tutto vault), avviare `vercel dev`, e provare un checkout con un prodotto qualsiasi.
Expected: HTTP 409 con *"non è più disponibile"*. Rimettere poi gli id reali.

- [ ] **Step 6: Commit**

```bash
git add api/create-payment-intent.js
git commit -m "feat(drop): gate al checkout — vault, drop chiuso, cap esaurito"
```

---

### Task 5: Registrazione della vendita

**Files:**
- Modify: `api/orders.js` (in `handleCreateOrder`, dopo la creazione dell'ordine Gelato)
- Modify: `api/webhook.js` (in `fulfillIfNeeded`, dopo la creazione dell'ordine Gelato)

**Interfaces:**
- Consumes: `recordDropSale` da `api/_lib/drop-sales.js`.
- Produces: niente.

- [ ] **Step 1: Registrare dal percorso primario**

In `api/orders.js`, dentro `handleCreateOrder`, subito dopo che l'ordine Gelato è stato creato con successo e prima della risposta:

```js
  // Contatore del drop. Non deve mai far fallire un ordine già pagato ed evaso:
  // se questa scrittura salta, il contatore è indietro, non il cliente senza maglietta.
  try {
    const { recordDropSale } = await import('./_lib/drop-sales.js')
    await recordDropSale(paymentIntentId, priced.items)
  } catch (err) {
    console.error('[create-order] recordDropSale failed:', err.message)
  }
```

> Usare il nome della variabile che in quello scope contiene l'id del payment intent e la lista items già prezzata — verificarli leggendo `handleCreateOrder` prima di scrivere.

- [ ] **Step 2: Registrare dal fallback**

In `api/webhook.js`, dentro `fulfillIfNeeded`, dopo la creazione dell'ordine Gelato:

```js
  // Stesso registro del percorso primario. recordDropSale è idempotente sul
  // payment intent id, quindi la doppia chiamata non conta due volte.
  try {
    const { recordDropSale } = await import('./_lib/drop-sales.js')
    await recordDropSale(paymentIntent.id, resolvedItems.map(({ item }) => item))
  } catch (err) {
    console.error('[webhook] recordDropSale failed:', err.message)
  }
```

- [ ] **Step 3: Verificare l'idempotenza**

Run: `node scripts/check-api-imports.js`

Poi, con `GITHUB_TOKEN` in ambiente, uno script usa e getta nella scratchpad che chiama `recordDropSale('pi_test_dup', [{ productId: '<id reale in drop>', quantity: 1 }])` **due volte**.
Expected: la prima torna `{ ok: true, numbers: { … } }`, la seconda `{ ok: true, alreadyCounted: true }`, e `sold` in `drop-sales.json` è aumentato di 1, non di 2. Rimuovere poi l'entry di test dal file.

- [ ] **Step 4: Commit**

```bash
git add api/orders.js api/webhook.js
git commit -m "feat(drop): registra la vendita da create-order e dal webhook"
```

---

### Task 6: Endpoint del contatore live

**Files:**
- Modify: `api/orders.js` (nuovo `handleDropStatus`, registrato nello switch a `:704-710`)
- Modify: `vercel.json` (rewrite)
- Create: `src/hooks/useDropStatus.js`

**Interfaces:**
- Consumes: `getDrop`, `capFor`; `readSales`.
- Produces:
  - `GET /api/drop-status` → `{ dropId, number, title, startsAt, endsAt, archivePrice, dropPrice, bundlePrice, products: { [id]: { sold, cap, lastAt } } }`
  - `useDropStatus() → { status, loading }`

- [ ] **Step 1: Scrivere l'handler**

In `api/orders.js`:

```js
// ── drop-status — pubblico, senza password ────────────────────────────────────
// Il conteggio dev'essere runtime: al build sarebbe congelato al deploy.
async function handleDropStatus(req, res) {
  const { getDrop, capFor } = await import('./_lib/drop.js')
  const { readSales } = await import('./_lib/drop-sales.js')

  const cfg = getDrop()
  const c   = cfg.current || {}
  let sales = { products: {} }
  try {
    sales = await readSales(c.id)
  } catch (err) {
    console.error('[drop-status] readSales failed:', err.message)
  }

  const products = {}
  for (const id of c.productIds || []) {
    products[id] = {
      sold:   sales.products?.[id]?.sold   ?? 0,
      lastAt: sales.products?.[id]?.lastAt ?? null,
      cap:    capFor(id, cfg),
    }
  }

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
  return res.status(200).json({
    dropId: c.id, number: c.number, title: c.title,
    startsAt: c.startsAt, endsAt: c.endsAt,
    dropPrice: c.dropPrice, bundlePrice: c.bundlePrice,
    archivePrice: cfg.archivePrice,
    next: cfg.next ?? null,
    products,
  })
}
```

Registrarlo accanto agli altri:

```js
  if (h === 'drop-status')       return handleDropStatus(req, res)
```

- [ ] **Step 2: Aggiungere il rewrite**

In `vercel.json`, nell'array `rewrites`, accanto agli altri `/api/orders`:

```json
{ "source": "/api/drop-status", "destination": "/api/orders?handler=drop-status" },
```

> Va inserito **prima** della regola generica `"/api/(.*)" → "/api/$1"`, altrimenti non viene mai raggiunto.

- [ ] **Step 3: Verificare l'endpoint**

Run: `vercel dev`, poi `curl -s localhost:3000/api/drop-status | head -20`
Expected: JSON con `dropId`, `endsAt` e un oggetto `products` con una entry per ogni id del drop.

- [ ] **Step 4: Scrivere l'hook client**

`src/hooks/useDropStatus.js`:

```js
import { useEffect, useState } from 'react'

/**
 * Contatore live del drop. Il conteggio non può venire dal bundle: sarebbe
 * congelato al deploy. Fallisce in silenzio — senza dati la UI mostra la
 * dimensione dell'edizione, che è sempre vera.
 */
export function useDropStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/drop-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setStatus(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { status, loading }
}
```

- [ ] **Step 5: Commit**

```bash
git add api/orders.js vercel.json src/hooks/useDropStatus.js
git commit -m "feat(drop): endpoint pubblico drop-status e hook client"
```

---

### Task 7: Nascondere i prodotti VAULT

**Files:**
- Modify: `vite.config.js` (plugin `storefront-products`, righe 22-42)
- Modify: `scripts/generate-sitemap.js`
- Modify: `api/orders.js` (`handlePrerender`)

**Interfaces:**
- Consumes: `productState`, `VAULT` da `api/_lib/drop.js`.
- Produces: `src/data/products.js` non contiene più i prodotti VAULT.

- [ ] **Step 1: Filtrare in build**

In `vite.config.js`, dentro `load()` del plugin `storefront-products`, sostituire il `.map` con filtro più map:

```js
      const { drop } = await import('./src/data/drop.js')
      const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])
      const stripped = JSON.parse(match[1])
        // I prodotti VAULT non sono nascosti via CSS: non entrano proprio nel bundle.
        .filter((product) => visible.has(product.id))
        .map((product) => {
          const out = { ...product }
          for (const field of ADMIN_ONLY_FIELDS) delete out[field]
          return out
        })
```

> `load()` va reso `async` se non lo è già. In alternativa importare `drop` in cima al file con un import statico — è la strada più semplice e va bene, perché `vite.config.js` gira sotto Node.

- [ ] **Step 2: Verificare che il bundle si restringa**

Run: `npm run build`, poi confrontare la dimensione di `dist/assets/` prima e dopo, e:

```bash
grep -c "gengar" dist/assets/*.js || echo "gengar assente dal bundle — corretto"
```

Expected: se Gengar non è nel drop né in `released`, non compare nel bundle.

- [ ] **Step 3: Escludere i VAULT dalla sitemap**

In `scripts/generate-sitemap.js`, filtrare la lista prodotti con lo stesso criterio prima di generare le URL:

```js
import { drop } from '../src/data/drop.js'

const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])
// … dove oggi si itera sui prodotti:
const sitemapProducts = products.filter((p) => visible.has(p.id))
```

> Leggere il file prima di modificarlo: mantenere la regola esistente per cui le URL di collezione derivano dalla stringa `collection` del prodotto e mai dall'id della collezione admin.

- [ ] **Step 4: Rendere il prerender consapevole del vault**

In `api/orders.js`, in `handlePrerender`, prima di generare l'HTML del prodotto:

```js
  const { productState, VAULT } = await import('./_lib/drop.js')
  if (productState(productId) === VAULT) {
    // Niente 404: la pagina esiste ma non è indicizzabile né acquistabile.
    return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(
      `<!doctype html><html lang="it"><head><meta name="robots" content="noindex"><title>Coming soon — JAYL</title></head><body></body></html>`
    )
  }
```

> Adattare al modo in cui `handlePrerender` ricava l'id dal path e restituisce l'HTML: leggerlo prima.

- [ ] **Step 5: Verificare**

Run: `npm run build && node scripts/generate-sitemap.js && grep -c "<url>" public/sitemap.xml`
Expected: il numero di URL scende al numero di prodotti visibili più le pagine statiche.

- [ ] **Step 6: Commit**

```bash
git add vite.config.js scripts/generate-sitemap.js api/orders.js
git commit -m "feat(drop): i prodotti vault escono da bundle, sitemap e prerender"
```

---

### Task 8: Home a tre schermi

**Files:**
- Create: `src/components/drop/DropCountdown.jsx`
- Create: `src/components/drop/DropBadge.jsx`
- Create: `src/components/drop/DropPanels.jsx`
- Modify: `src/pages/HomePage.jsx` (sezioni 3-6, righe 253-440)

**Interfaces:**
- Consumes: `useDropStatus`; `counterMode`, `getDrop` da `api/_lib/drop.js`; `products`, `getProductById` da `@/data/products`.
- Produces: `<DropCountdown to={iso} label="finisce tra" />`, `<DropBadge sold={n} cap={n} />`, `<DropPanels />`.

- [ ] **Step 1: Countdown**

`src/components/drop/DropCountdown.jsx`:

```jsx
import { useEffect, useState } from 'react'

function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}
const pad = (n) => String(n).padStart(2, '0')

/** Countdown a una data ISO. Chiama onExpire una sola volta allo scadere. */
export default function DropCountdown({ to, label, onExpire, className = '' }) {
  const [left, setLeft] = useState(() => Date.parse(to) - Date.now())

  useEffect(() => {
    setLeft(Date.parse(to) - Date.now())
    const id = setInterval(() => setLeft(Date.parse(to) - Date.now()), 1000)
    return () => clearInterval(id)
  }, [to])

  useEffect(() => { if (left <= 0 && onExpire) onExpire() }, [left <= 0])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!to) return null
  const { d, h, m, s } = parts(left)
  return (
    <span className={className}>
      {label ? `${label} ` : ''}{pad(d)} : {pad(h)} : {pad(m)} : {pad(s)}
    </span>
  )
}
```

- [ ] **Step 2: Badge disponibilità**

`src/components/drop/DropBadge.jsx`:

```jsx
import { counterMode } from '../../../api/_lib/drop.js'

/**
 * Sotto il 30% venduto mostra solo la dimensione dell'edizione: al lancio,
 * "19 disponibili su 20" non comunica scarsità, dimostra che non compra nessuno.
 */
export default function DropBadge({ sold = 0, cap = 0, className = '' }) {
  const state = counterMode(sold, cap)
  if (state.mode === 'hidden') return null

  if (state.mode === 'soldout') {
    return <span className={`text-xs tracking-widest uppercase text-white/60 ${className}`}>Sold out · {state.cap}/{state.cap}</span>
  }
  if (state.mode === 'edition') {
    return <span className={`text-xs tracking-widest uppercase text-white/60 ${className}`}>Edition of {state.cap}</span>
  }
  const pct = Math.round((state.sold / state.cap) * 100)
  return (
    <span className={`inline-flex items-center gap-2 text-xs tracking-widest uppercase text-amber-300 ${className}`}>
      {state.sold} / {state.cap} claimed
      <span className="inline-block h-1 w-16 rounded bg-white/15 align-middle">
        <span className="block h-1 rounded bg-amber-300" style={{ width: `${pct}%` }} />
      </span>
    </span>
  )
}
```

> L'import di `counterMode` attraversa `src/` → `api/_lib/`. Verificare che l'alias `@/` non sia richiesto e che Vite risolva il path relativo; se dà problemi, spostare `counterMode` in un modulo condiviso sotto `src/lib/` importato anche da `api/_lib/drop.js` — ma provare prima il path relativo, che è la soluzione senza duplicazione.

- [ ] **Step 3: I tre pannelli**

`src/components/drop/DropPanels.jsx`:

```jsx
import { Link } from 'react-router-dom'
import { getProductById } from '@/data/products'
import { getDrop } from '../../../api/_lib/drop.js'
import { useDropStatus } from '@/hooks/useDropStatus'
import DropCountdown from './DropCountdown'
import DropBadge from './DropBadge'
import { formatPrice } from '@/lib/utils'

/**
 * Primo schermo della home: i pezzi del drop, tutti visibili insieme.
 * Niente hero a rotazione — su un negozio da tre prodotti nasconderebbe due
 * terzi del catalogo in ogni istante.
 */
export default function DropPanels() {
  const cfg = getDrop()
  const { status } = useDropStatus()

  // Fra un drop e l'altro `current.productIds` è vuoto: si mostrano i pezzi del
  // drop appena chiuso, marcati, con il countdown all'apertura del prossimo.
  // Lo schermo non resta mai vuoto.
  const live  = (cfg.current?.productIds || []).length > 0
  const shown = live ? cfg.current.productIds : (cfg.previous?.productIds || [])
  const head  = live ? cfg.current : (cfg.previous || cfg.current)
  const open  = live && Date.now() < Date.parse(cfg.current?.endsAt || 0)
  const items = shown.map(getProductById).filter(Boolean)
  if (items.length === 0) return null

  return (
    <section className="min-h-screen w-screen bg-off-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 text-cream">
        <span className="text-xs tracking-[0.2em] uppercase">
          Drop {String(head.number).padStart(2, '0')} · {head.title}
        </span>
        {open
          ? <DropCountdown to={cfg.current.endsAt} label="finisce tra" className="text-xs tabular-nums" />
          : cfg.next?.startsAt
            ? <DropCountdown to={cfg.next.startsAt} label="prossimo drop tra" className="text-xs tabular-nums" />
            : null}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
        {items.map((p) => {
          const s = status?.products?.[p.id]
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="relative group overflow-hidden bg-off-black">
              <img
                src={p.heroImage ?? p.image}
                alt={p.altText || p.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                <h2 className="text-cream text-lg leading-tight">{p.name}</h2>
                <p className="text-white/70 text-sm mb-1">
                  {formatPrice(live ? cfg.current.dropPrice : cfg.archivePrice)}
                </p>
                {live
                  ? <DropBadge sold={s?.sold ?? 0} cap={s?.cap ?? cfg.current.cap} />
                  : <span className="text-xs tracking-widest uppercase text-white/60">
                      Drop chiuso · ora in listino
                    </span>}
              </div>
            </Link>
          )
        })}
      </div>

      {live && items.length === 3 && (
        <p className="px-5 py-4 text-center text-xs tracking-[0.2em] uppercase text-white/60">
          tutti e tre · {formatPrice(cfg.current.bundlePrice)}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Ricomporre la home**

In `src/pages/HomePage.jsx`: rimuovere le sezioni 3, 4, 5 e 6 e mettere al loro posto `<DropPanels />`, poi la sezione lista d'attesa, poi la sezione Artist's esistente. Aggiornare `SECTION_THEMES` al numero di schermi effettivo.

Il carosello archivio torna solo quando ci sono abbastanza prodotti rilasciati:

```jsx
{releasedProducts.length >= 6 && (
  <CollectionCarousel
    title="The Archive"
    viewAllTo="/objects"
    products={releasedProducts}
    imagePick={carouselImagePick}
  />
)}
```

dove `releasedProducts` deriva da `getDrop().released`. La soglia di 6 replica la regola già usata da "New In" ed evita il difetto di `CollectionCarousel`, che duplica la lista per il loop infinito e con pochi elementi mostra la ripetizione.

- [ ] **Step 5: Verificare nel browser**

Avviare la preview e controllare: i tre pannelli si vedono su mobile e desktop, il countdown scorre, il badge mostra `EDITION OF 20`, il tap porta alla pagina prodotto, la console è pulita.

- [ ] **Step 6: Commit**

```bash
git add src/components/drop src/pages/HomePage.jsx
git commit -m "feat(drop): home a tre pannelli con countdown e badge edizione"
```

---

### Task 9: Pagina prodotto

**Files:**
- Modify: `src/pages/ProductPage.jsx` — nuovo `DropBlock` accanto a `UrgencyBadge` (`:286`), reso nei due punti d'uso (`:1116` mobile, `:1499` desktop)

**Interfaces:**
- Consumes: `useDropStatus`, `DropBadge`, `DropCountdown`, `productState`, `getDrop`.
- Produces: niente.

- [ ] **Step 1: Scrivere il blocco**

In `src/pages/ProductPage.jsx`, accanto a `UrgencyBadge`:

```jsx
function DropBlock({ productId, isLight }) {
  const cfg = getDrop()
  const { status } = useDropStatus()
  const state = productState(productId, cfg)
  if (state === 'vault') return null

  if (state === 'listino') {
    return (
      <p className={`text-xs tracking-[0.15em] uppercase mb-3 ${isLight ? 'text-ink-muted' : 'text-white/60'}`}>
        Drop {String(cfg.current?.number ?? 1).padStart(2, '0')} · sold out — ora in listino permanente
      </p>
    )
  }

  const s    = status?.products?.[productId]
  const open = Date.now() < Date.parse(cfg.current?.endsAt || 0)
  const hrs  = s?.lastAt ? Math.floor((Date.now() - Date.parse(s.lastAt)) / 3_600_000) : null

  return (
    <div className={`mb-4 space-y-1 ${isLight ? 'text-ink' : 'text-cream'}`}>
      <p className="text-xs tracking-[0.2em] uppercase">
        Drop {String(cfg.current.number).padStart(2, '0')} · {cfg.current.title}
      </p>
      {open && <DropCountdown to={cfg.current.endsAt} label="finisce tra" className="block text-sm tabular-nums" />}
      <DropBadge sold={s?.sold ?? 0} cap={s?.cap ?? cfg.current.cap} className="block" />
      {hrs !== null && hrs < 48 && (
        <p className="text-xs opacity-60">
          ultimo pezzo preso {hrs === 0 ? 'meno di un’ora fa' : `${hrs} ${hrs === 1 ? 'ora' : 'ore'} fa`}
        </p>
      )}
    </div>
  )
}
```

> Nessuna riga sul prezzo futuro: la pagina non annuncia il passaggio a €25. Decisione della spec.

- [ ] **Step 2: Renderlo nei due layout**

Sostituire `<UrgencyBadge text={product.urgency} isLight={isLight} />` alle righe ~1116 e ~1499 con:

```jsx
<DropBlock productId={product.id} isLight={isLight} />
<UrgencyBadge text={product.urgency} isLight={isLight} />
```

- [ ] **Step 3: Gestire i prodotti VAULT nella SPA**

Il Task 7 copre il prerender per i crawler, ma un umano che apre `/product/<id-vault>` nella SPA
arriva a `getProductById` che torna `undefined` — pagina bianca o crash. All'inizio di
`ProductPage`, dove oggi si gestisce il prodotto non trovato:

```jsx
  // I prodotti vault non esistono nel bundle: getProductById torna undefined.
  // Non un 404 — la pagina esiste, semplicemente non è ancora in vendita.
  if (!product) {
    return (
      <div className="min-h-screen bg-off-black flex flex-col items-center justify-center text-center px-6">
        <Helmet><meta name="robots" content="noindex" /></Helmet>
        <p className="text-xs tracking-[0.3em] uppercase text-white/50 mb-3">Coming soon</p>
        <h1 className="text-cream text-2xl mb-6">Questo pezzo non è ancora uscito.</h1>
        <p className="text-white/60 text-sm mb-8 max-w-sm">
          Entra nella lista: ti avvisiamo quando entra in un drop.
        </p>
        <Link to="/" className="text-cream underline text-sm">Vedi il drop in corso</Link>
      </div>
    )
  }
```

> Se il progetto non usa `react-helmet`, impostare il meta robots con un `useEffect` che scrive
> in `document.head` — verificare come le altre pagine gestiscono i meta prima di scegliere.

- [ ] **Step 4: Bloccare l'acquisto a edizione esaurita**

Dove si calcola lo stato disabilitato del bottone Add to Cart, aggiungere la condizione: se `status.products[product.id]` ha `sold >= cap`, disabilitare e mostrare `SOLD OUT` al posto dell'etichetta. Il gate server resta comunque la difesa vera — questo evita solo di far arrivare il cliente fino all'errore.

- [ ] **Step 5: Verificare nel browser**

Aprire la pagina di un prodotto in drop: countdown, `EDITION OF 20`, prezzo €22. Aprire un prodotto in `released`: prezzo €25 e la riga "ora in listino permanente". Console pulita.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProductPage.jsx
git commit -m "feat(drop): blocco drop nella buy-box e stato listino"
```

---

### Task 10: Spinta bundle nel carrello

**Files:**
- Modify: il componente del carrello sotto `src/components/cart/` che elenca gli articoli (individuarlo con `ls src/components/cart/`)

**Interfaces:**
- Consumes: `getDrop` da `api/_lib/drop.js`; `useCartStore`; `formatPrice` da `@/lib/utils`.
- Produces: niente.

- [ ] **Step 1: Aggiungere la riga**

Nel componente carrello, sotto la lista articoli:

```jsx
const cfg  = getDrop()
const ids  = cfg.current?.productIds || []
const have = new Set(items.map(i => i.product.id))
const missing = ids.filter(id => !have.has(id))
const saving  = ids.length * (cfg.current?.dropPrice ?? 0) - (cfg.current?.bundlePrice ?? 0)

{ids.length === 3 && missing.length > 0 && missing.length < 3 && saving > 0 && (
  <p className="text-xs text-amber-300 px-4 py-2">
    aggiungi {missing.length === 1 ? 'l’ultimo pezzo' : `${missing.length} pezzi`} del drop → {formatPrice(saving)} in meno
  </p>
)}
{ids.length === 3 && missing.length === 0 && (
  <p className="text-xs text-amber-300 px-4 py-2">
    bundle drop applicato — {formatPrice(saving)} in meno
  </p>
)}
```

> Lo sconto lo calcola il server in `create-payment-intent`. Questa riga è solo informativa: non modificare i totali lato client, o divergerebbero da quelli addebitati.

- [ ] **Step 2: Verificare**

Aggiungere due dei tre pezzi al carrello → compare la spinta. Aggiungere il terzo → compare "bundle applicato". Arrivare al checkout e verificare che il totale Stripe sia inferiore di €9.

- [ ] **Step 3: Commit**

```bash
git add src/components/cart
git commit -m "feat(drop): spinta bundle nel carrello"
```

---

### Task 11: Pannello admin

**Files:**
- Create: `src/components/admin/DropTab.jsx`
- Modify: `src/pages/AdminPage.jsx` (liste tab a `:4612-4628`, titolo a `:4647`, render)
- Modify: `api/admin.js` (quattro azioni nuove nello switch)

**Interfaces:**
- Consumes: `getAdminPassword()`; `ghGet`/`ghPut` da `api/_lib/github.js`.
- Produces: azioni `get-drop`, `save-drop`, `close-drop`, `release-product`.

- [ ] **Step 1: Aggiungere le azioni server**

In `api/admin.js`, nello switch delle azioni, dopo aver verificato la password come fanno le altre:

```js
    case 'get-drop': {
      const file = await ghGet('src/data/drop.js', githubToken)
      const raw  = Buffer.from(file.content, 'base64').toString('utf-8')
      return res.status(200).json({ ok: true, source: raw, sha: file.sha })
    }

    case 'save-drop': {
      // Il client manda l'oggetto completo; qui lo riscriviamo come modulo .js.
      // Deve restare un .js: è importato sia da Vite sia da Node. Vedi
      // scripts/check-api-imports.js.
      const { drop, sha } = req.body
      if (!drop || typeof drop !== 'object') {
        return res.status(400).json({ error: 'drop object required' })
      }
      const source =
        '// Configurazione del drop corrente. Gestita dal pannello admin.\n' +
        '// Modulo .js e non .json: importato sia dal client (Vite) sia dalle API (Node).\n' +
        `export const drop = ${JSON.stringify(drop, null, 2)}\n`
      await ghPut('src/data/drop.js', source, sha, `[drop] update ${drop.current?.id || ''}`, githubToken)
      return res.status(200).json({ ok: true })
    }

    case 'close-drop': {
      const file = await ghGet('src/data/drop.js', githubToken)
      const raw  = Buffer.from(file.content, 'base64').toString('utf-8')
      const cfg  = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
      const ids  = cfg.current?.productIds || []
      cfg.released = [...new Set([...(cfg.released || []), ...ids])]
      // Conserva il drop chiuso: fra un drop e l'altro la home lo mostra marcato
      // invece di svuotarsi. Senza questo, DropPanels non renderizza niente.
      cfg.previous = { number: cfg.current?.number, title: cfg.current?.title, productIds: ids }
      cfg.current  = { ...cfg.current, productIds: [] }
      const source =
        '// Configurazione del drop corrente. Gestita dal pannello admin.\n' +
        '// Modulo .js e non .json: importato sia dal client (Vite) sia dalle API (Node).\n' +
        `export const drop = ${JSON.stringify(cfg, null, 2)}\n`
      await ghPut('src/data/drop.js', source, file.sha, '[drop] close drop → listino', githubToken)
      return res.status(200).json({ ok: true, released: cfg.released })
    }

    case 'release-product': {
      const { productId } = req.body
      if (!productId) return res.status(400).json({ error: 'productId required' })
      const file = await ghGet('src/data/drop.js', githubToken)
      const raw  = Buffer.from(file.content, 'base64').toString('utf-8')
      const cfg  = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
      cfg.released = [...new Set([...(cfg.released || []), productId])]
      const source =
        '// Configurazione del drop corrente. Gestita dal pannello admin.\n' +
        '// Modulo .js e non .json: importato sia dal client (Vite) sia dalle API (Node).\n' +
        `export const drop = ${JSON.stringify(cfg, null, 2)}\n`
      await ghPut('src/data/drop.js', source, file.sha, `[drop] release ${productId}`, githubToken)
      return res.status(200).json({ ok: true, released: cfg.released })
    }
```

> Il parsing `raw.slice(indexOf('{'), lastIndexOf('}') + 1)` funziona perché il file è scritto solo da qui, sempre con `JSON.stringify`. Se qualcuno lo modifica a mano introducendo commenti dentro l'oggetto o virgolette singole, il parse fallisce: è la ragione per cui il file dichiara in testa di essere gestito dal pannello.

- [ ] **Step 2: Costruire il tab**

`src/components/admin/DropTab.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { products as allProducts } from '@/data/products-full'
import { getAdminPassword } from '@/components/generate-assets/constants'

const post = (action, body = {}) =>
  fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: getAdminPassword(), ...body }),
  }).then((r) => r.json())

const parseSource = (src) => JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1))

export default function DropTab() {
  const [cfg, setCfg]       = useState(null)
  const [sha, setSha]       = useState(null)
  const [status, setStatus] = useState(null)
  const [msg, setMsg]       = useState('')
  const [q, setQ]           = useState('')

  useEffect(() => {
    post('get-drop').then((r) => {
      if (!r.ok) return setMsg(r.error || 'errore nel caricamento')
      setCfg(parseSource(r.source))
      setSha(r.sha)
    })
    fetch('/api/drop-status').then((r) => r.json()).then(setStatus).catch(() => {})
  }, [])

  if (!cfg) return <p className="text-gray-500 text-sm">{msg || 'Caricamento…'}</p>

  const setCurrent = (patch) => setCfg((c) => ({ ...c, current: { ...c.current, ...patch } }))

  const toggleProduct = (id) => setCurrent({
    productIds: cfg.current.productIds.includes(id)
      ? cfg.current.productIds.filter((x) => x !== id)
      : [...cfg.current.productIds, id].slice(0, 3),
  })

  const save = async () => {
    setMsg('Salvataggio…')
    const r = await post('save-drop', { drop: cfg, sha })
    setMsg(r.ok ? 'Salvato — il deploy parte da solo' : (r.error || 'errore'))
  }

  const closeDrop = async () => {
    if (!confirm('Chiudere il drop? I tre pezzi passano in listino a prezzo pieno.')) return
    const r = await post('close-drop')
    setMsg(r.ok ? 'Drop chiuso' : (r.error || 'errore'))
    if (r.ok) post('get-drop').then((x) => { setCfg(parseSource(x.source)); setSha(x.sha) })
  }

  const release = async (id) => {
    const r = await post('release-product', { productId: id })
    if (r.ok) setCfg((c) => ({ ...c, released: r.released }))
  }

  const field = (label, value, onChange, type = 'text') => (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
    </label>
  )

  const filtered = allProducts.filter((p) =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-8 text-white">
      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-3">Drop corrente</h3>
        <div className="grid grid-cols-2 gap-x-4">
          {field('Numero', cfg.current.number, (v) => setCurrent({ number: parseInt(v, 10) || 1 }), 'number')}
          {field('Titolo', cfg.current.title, (v) => setCurrent({ title: v }))}
          {field('Apre (ISO UTC)',  cfg.current.startsAt, (v) => setCurrent({ startsAt: v }))}
          {field('Chiude (ISO UTC)', cfg.current.endsAt,  (v) => setCurrent({ endsAt: v }))}
          {field('Cap per pezzo', cfg.current.cap, (v) => setCurrent({ cap: parseInt(v, 10) || 0 }), 'number')}
          {field('Prezzo drop (cent)', cfg.current.dropPrice, (v) => setCurrent({ dropPrice: parseInt(v, 10) || 0 }), 'number')}
          {field('Prezzo bundle (cent)', cfg.current.bundlePrice, (v) => setCurrent({ bundlePrice: parseInt(v, 10) || 0 }), 'number')}
          {field('Prezzo listino (cent)', cfg.archivePrice, (v) => setCfg((c) => ({ ...c, archivePrice: parseInt(v, 10) || 0 })), 'number')}
        </div>
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-1">
          I tre pezzi — {cfg.current.productIds.length}/3
        </h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto…"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm mb-2" />
        <div className="max-h-64 overflow-y-auto border border-gray-800 rounded">
          {filtered.map((p) => {
            const on = cfg.current.productIds.includes(p.id)
            const s  = status?.products?.[p.id]
            return (
              <button key={p.id} onClick={() => toggleProduct(p.id)}
                className={`w-full text-left px-3 py-2 text-sm flex justify-between ${on ? 'bg-emerald-900/40 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                <span>{on ? '✓ ' : ''}{p.name}</span>
                {s && <span className="text-xs opacity-70">{s.sold}/{s.cap} venduti</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex gap-3">
        <button onClick={save} className="px-4 py-2 bg-white text-black rounded text-sm">Salva</button>
        <button onClick={closeDrop} className="px-4 py-2 border border-red-700 text-red-400 rounded text-sm">
          Chiudi drop → listino
        </button>
        {msg && <span className="text-xs text-gray-400 self-center">{msg}</span>}
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-3">
          Vault — {allProducts.length - cfg.released.length - cfg.current.productIds.length} nascosti
        </h3>
        <div className="max-h-64 overflow-y-auto border border-gray-800 rounded">
          {allProducts
            .filter((p) => !cfg.released.includes(p.id) && !cfg.current.productIds.includes(p.id))
            .map((p) => (
              <div key={p.id} className="flex justify-between items-center px-3 py-2 text-sm text-gray-400">
                <span>{p.name}</span>
                <button onClick={() => release(p.id)} className="text-xs underline hover:text-white">
                  Attiva in listino
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}
```

> Import verificati: `getAdminPassword` sta in `src/components/generate-assets/constants.js` e
> legge `sessionStorage('jaylAdminPw')`; `@/data/products-full` esporta `products` e
> `getProductById`. Entrambi sono corretti così come scritti.

- [ ] **Step 3: Registrare il tab**

In `src/pages/AdminPage.jsx`: aggiungere `{ id: 'drop', label: 'Drop' }` alle due liste di tab (`:4612` e `:4622`), aggiungere `: tab === 'drop' ? '🎯 Drop'` alla catena dei titoli a `:4647`, e renderizzare `<DropTab />` quando `tab === 'drop'`.

- [ ] **Step 4: Verificare il giro completo**

In admin: aprire il tab Drop, cambiare `endsAt`, salvare. Verificare che il commit compaia su GitHub e che `src/data/drop.js` sia ancora un modulo valido:

```bash
git pull --rebase --autostash origin main && node -e "import('./src/data/drop.js').then(m => console.log(m.drop.current))"
```

Expected: stampa l'oggetto aggiornato.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/DropTab.jsx src/pages/AdminPage.jsx api/admin.js
git commit -m "feat(drop): pannello admin del drop"
```

---

### Task 12: Testo della lista d'attesa

**Files:**
- Modify: `src/components/EmailCapturePopup.jsx`

- [ ] **Step 1: Cambiare l'offerta**

Sostituire il testo e rimuovere la promessa di sconto: il popup offre l'accesso alla lista drop, non `JAYL10`. Il codice sconto resta definito in `catalog.js` per gli ordini fuori drop, ma non va più promosso — `applyDiscount` lo rifiuta comunque quando il carrello contiene pezzi in drop, e promettere uno sconto che il checkout rifiuta è la peggiore combinazione possibile.

Testo: `Drop 02 · [data]` come titolo, *"entra nella lista: i pezzi sono 20 per design"* come sottotitolo, `AVVISAMI` come bottone. Prendere la data da `getDrop().next?.startsAt`.

- [ ] **Step 2: Verificare**

Aprire il sito in finestra anonima, accettare i cookie, scorrere oltre metà pagina → compare il popup con il testo nuovo. Iscriversi e verificare che `src/data/emails.json` venga creato sul repo.

- [ ] **Step 3: Commit**

```bash
git add src/components/EmailCapturePopup.jsx
git commit -m "feat(drop): il popup offre la lista d'attesa, non lo sconto"
```

---

## Verifica finale

- [ ] `npm test` — verde
- [ ] `npm run lint` — nessun errore nuovo
- [ ] `npm run build` — verde, e nessun prodotto vault nel bundle
- [ ] `node scripts/check-api-imports.js` — verde
- [ ] Un ordine reale di prova va a buon fine e incrementa `drop-sales.json` di 1
- [ ] Un secondo ordine con lo stesso payment intent non incrementa niente
- [ ] Con `sold` forzato a `cap`, il checkout risponde 409 con il messaggio dell'edizione chiusa
- [ ] Con `endsAt` nel passato, il checkout risponde 409 con la data del prossimo drop
- [ ] `/sync-main` prima del push, `/verify-live` dopo il deploy

## Fuori da questo piano

- **Carosello e storie su `api/publish-social.js`** (spec §6) — piano separato.
- **Resend Audiences** (spec §3.5) — richiede `RESEND_AUDIENCE_ID` su Vercel; verificare prima con `vercel env ls` se `RESEND_API_KEY` esiste.
- **Ursaring** — non esiste in catalogo, né front né back. Il drop 01 parte con due prodotti su tre finché non viene creato. Nessun task qui lo risolve.
