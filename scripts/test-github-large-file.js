#!/usr/bin/env node
// Riproduce il guasto dell'8 settembre 2026, in cui src/data/admin-products.js
// è passato da 43 prodotti a 1 senza un errore in nessun log.
//
// La catena esatta:
//   1. il catalogo supera 1 MB (1.060.504 byte al 43° prodotto)
//   2. la Contents API di GitHub, sopra 1 MB, NON dà errore: risponde 200 OK
//      con `encoding: "none"`, `content: ""` e uno `sha` valido
//   3. readAdminProducts non guardava `encoding`: leggeva "" , il regex non
//      matchava, e ritornava `{ products: [], sha }` — cioè "catalogo vuoto"
//   4. save-product aggiungeva a quel vuoto il solo prodotto in corso
//   5. writeAdminProducts scriveva, e lo sha ERA valido: la PUT riusciva
//
// Nessuno dei cinque passaggi produceva un errore. Il punto in cui la catena
// si rompe è il 2→3: una lettura fallita che si traveste da lettura riuscita.
//
// Il test non parla con GitHub: simula la sua risposta. Serve a fissare il
// comportamento, non la rete. Run: node scripts/test-github-large-file.js

let passed = 0
const failures = []
const check = (label, cond) => { if (cond) passed++; else failures.push(label) }

// ── La risposta reale di GitHub sopra 1 MB ──────────────────────────────────
// Verificata sul repo l'8 settembre 2026, ref 721700d4:
//   { size: 1060504, encoding: "none", content: "", sha: "36b88e01…" }
const OVERSIZE_RESPONSE = {
  size: 1060504,
  encoding: 'none',
  content: '',
  sha: '36b88e01087d34c3b523156cdd86b672bcf6fa78',
}

const CATALOG_43 = `// This file is managed by the JAYL admin panel. Do not edit manually.
export const adminProducts = ${JSON.stringify(
  Array.from({ length: 43 }, (_, i) => ({ id: `prodotto-${i}`, title: `Prodotto ${i}` })),
  null, 2,
)}
`

// ── Il vecchio comportamento, per fissare cosa NON deve più succedere ───────
function readAdminProducts_ROTTA(file) {
  const content = Buffer.from(file.content, 'base64').toString('utf8')
  const match = content.match(/export const adminProducts = (\[[\s\S]*\])/)
  if (!match) return { products: [], sha: file.sha }
  return { products: JSON.parse(match[1]), sha: file.sha }
}

{
  const rotta = readAdminProducts_ROTTA(OVERSIZE_RESPONSE)
  check('la vecchia lettura ritornava 0 prodotti su un file da 43',
    rotta.products.length === 0)
  check('…e con uno sha VALIDO, cioè con cui la scrittura sarebbe riuscita',
    typeof rotta.sha === 'string' && rotta.sha.length === 40)
}

// ── ghGet: sopra il MB rilegge dalla Blobs API ──────────────────────────────
// Stessa logica di api/_lib/github.js, con fetch simulata: il modulo vero
// prende owner/repo da costanti e non è iniettabile, e un test che parlasse
// con GitHub sul serio fallirebbe in CI senza token e a ogni rate limit.
async function ghGetLike(fetchImpl) {
  const res = await fetchImpl('contents')
  const file = await res.json()
  if (Array.isArray(file) || file?.encoding !== 'none') return file

  const blobRes = await fetchImpl('blob', file.sha)
  if (!blobRes.ok) throw new Error(`file oltre 1 MB e blob ${file.sha} non leggibile (${blobRes.status})`)
  const blob = await blobRes.json()
  if (blob?.encoding !== 'base64' || typeof blob.content !== 'string') {
    throw new Error(`blob ${file.sha} in un encoding inatteso (${blob?.encoding})`)
  }
  return { ...file, content: blob.content, encoding: 'base64' }
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body })

{
  const fetchOk = async (kind) => kind === 'contents'
    ? ok(OVERSIZE_RESPONSE)
    : ok({ encoding: 'base64', content: Buffer.from(CATALOG_43).toString('base64'), size: 1060504 })

  const file = await ghGetLike(fetchOk)
  const content = Buffer.from(file.content, 'base64').toString('utf8')
  const products = JSON.parse(content.match(/export const adminProducts = (\[[\s\S]*\])/)[1])

  check('ghGet: sopra 1 MB recupera il contenuto vero dalla Blobs API',
    products.length === 43)
  check('ghGet: lo sha resta quello del file (serve alla PUT successiva)',
    file.sha === OVERSIZE_RESPONSE.sha)

  // Un file sotto il MB non deve fare la seconda chiamata: la Blobs API costa
  // una richiesta in più su ogni lettura, e le letture qui sono tante.
  let blobCalls = 0
  const fetchSmall = async (kind) => {
    if (kind === 'blob') blobCalls++
    return ok({ encoding: 'base64', content: Buffer.from(CATALOG_43).toString('base64'), size: 900000 })
  }
  await ghGetLike(fetchSmall)
  check('ghGet: sotto 1 MB non chiama la Blobs API', blobCalls === 0)
}

{
  // Se anche la Blobs API fallisce, si LANCIA. Ricadere sul `file` con content
  // vuoto sarebbe tornare esattamente al bug: è quel valore che fa scrivere
  // sopra un catalogo integro credendolo vuoto.
  const fetchBlobFails = async (kind) => kind === 'contents'
    ? ok(OVERSIZE_RESPONSE)
    : ({ ok: false, status: 502, json: async () => ({}) })

  let threw = false
  try { await ghGetLike(fetchBlobFails) } catch { threw = true }
  check('ghGet: blob illeggibile → lancia, mai un content vuoto con sha valido', threw)
}

// ── Il guard di scrittura ───────────────────────────────────────────────────
// Stessa regola di writeAdminProducts in api/admin.js.
function guardWrite(products, previousCount) {
  if (previousCount != null && products.length < previousCount - 1) {
    throw new Error(`RIFIUTATA: da ${previousCount} a ${products.length}`)
  }
  return true
}

{
  let threw = false
  try { guardWrite([{ id: 'entei' }], 43) } catch { threw = true }
  check('guard: 43 → 1 prodotto viene rifiutato (lo scenario dell\'8 settembre)', threw)

  check('guard: 43 → 44 (aggiunta) passa', guardWrite(new Array(44).fill({}), 43) === true)
  check('guard: 43 → 43 (modifica) passa', guardWrite(new Array(43).fill({}), 43) === true)
  check('guard: 43 → 42 (delete-product, una sola rimozione) passa',
    guardWrite(new Array(42).fill({}), 43) === true)

  let threwTwo = false
  try { guardWrite(new Array(41).fill({}), 43) } catch { threwTwo = true }
  check('guard: 43 → 41 rifiutato — nessuna azione admin ne toglie due insieme', threwTwo)

  check('guard: senza previousCount non blocca nulla (percorsi che non leggono prima)',
    guardWrite([], null) === true)
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} controlli falliti (${passed} passati) su github-large-file:\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
  console.error('')
  process.exit(1)
}
console.log(`✓ github-large-file: ${passed} controlli passati`)
