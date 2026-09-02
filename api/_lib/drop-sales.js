// Registro delle vendite di un drop. Vive in src/data/drop-sales.json e viene
// letto e scritto a runtime via API GitHub — mai importato, altrimenti sarebbe
// congelato al deploy, che è esattamente ciò che un contatore non deve essere.
//
// Si legge dall'API autenticata e non da raw.githubusercontent: quest'ultima ha
// cache CDN di alcuni minuti e permetterebbe di sforare il cap.
import { ghGet, ghPut } from './github.js'
import { capFor, productState, getDrop, DROP } from './drop.js'

const SALES_PATH = 'src/data/drop-sales.json'

// Fabbrica, non costante condivisa: un `const EMPTY = {...}` riusato via spread
// (`{...EMPTY}`) fa una copia solo superficiale, quindi `entry.products` sarebbe
// letteralmente `EMPTY.products` e una scrittura successiva mutasse lo stato del
// modulo — su un container Vercel caldo questo avvelena i contatori tra un drop
// e l'altro e salta il pezzo #1. Ogni chiamata a `emptyEntry()` crea oggetti
// nuovi, quindi non c'è nulla da condividere.
const emptyEntry = () => ({ counted: {}, products: {} })

function isNotFound(err) {
  return err instanceof Error && /:\s*404\b/.test(err.message)
}

function isRetryable(err, attemptSha) {
  // ghPut lancia `GitHub PUT ${path}: ${status} — ...`.
  if (!(err instanceof Error)) return false
  // 409: qualcun altro ha scritto una versione più recente del file — vero
  // conflitto di sha, sempre da rileggere e ritentare.
  if (/:\s*409\b/.test(err.message)) return true
  // 422 ("sha" wasn't supplied) capita SOLO quando questo tentativo era una
  // create (attemptSha === null, cioè readFile aveva preso un 404 e pensavamo
  // che il file non esistesse ancora — vedi isNotFound) e nel frattempo un
  // altro writer lo ha creato per primo: GitHub non ha un vecchio sha da
  // confrontare, quindi risponde 422 invece di 409, ma è la stessa identica
  // contesa. Va ritentato allo stesso modo: alla prossima iterazione readFile
  // rilegge, trova il file reale e ottiene uno sha vero. Un 422 quando invece
  // avevamo già fornito uno sha reale non è contesa: è un errore vero (payload
  // non valido, branch sbagliata, ...) e non va ritentato.
  if (attemptSha === null && /:\s*422\b/.test(err.message)) return true
  return false
}

async function readFile(token) {
  try {
    const file = await ghGet(SALES_PATH, token)
    return {
      sha: file.sha,
      data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')),
    }
  } catch (err) {
    // Il file "non esiste ancora" SOLO se GitHub risponde 404 (prima vendita mai
    // registrata per l'intero store): è l'unico caso da trattare come vuoto.
    // Qualsiasi altro errore (401/403 di token, 5xx, JSON corrotto) deve
    // propagare — se lo inghiottissimo qui, soldFor tornerebbe silenziosamente 0
    // durante un'interruzione reale (il cap-check al checkout fallirebbe aperto
    // senza che nessuno lo sappia), e una scrittura successiva con
    // `nextData = { ...data, [dropId]: entry }` collasserebbe l'intero registro
    // — tutti gli altri drop — a una sola chiave.
    if (isNotFound(err)) return { sha: null, data: {} }
    throw err
  }
}

/**
 * Stato del registro per un drop. Torna vuoto solo se manca il token o se il
 * file non esiste ancora; qualsiasi altro errore di lettura si propaga (vedi il
 * commento in readFile) — il chiamante (il cap-check al checkout) lo intercetta
 * ed è lì che vive il fail-open, in modo osservabile invece che silenzioso.
 */
export async function readSales(dropId, token = process.env.GITHUB_TOKEN) {
  // A missing token isn't "no sales yet" — it's the cap-check silently
  // disabled (sold reads as 0 for every product, forever). Unlike a real
  // read failure (which evaluateDropGate catches and logs as fail-open),
  // this branch used to return empty with no signal at all. This env var
  // never mattered to create-payment-intent before this branch.
  if (!token) {
    console.error('[drop-sales] GITHUB_TOKEN not configured — cap check disabled, reporting 0 sold for every product')
    return emptyEntry()
  }
  const { data } = await readFile(token)
  return data[dropId] ? { ...emptyEntry(), ...data[dropId] } : emptyEntry()
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
 *
 * Il cap NON blocca qui: si applica al checkout (Task 4). A questo punto il
 * pagamento è già avvenuto, quindi il registro deve riportare la verità anche in
 * caso di sforamento — vedi `overCap` nel risultato — invece di far sparire un
 * pezzo pagato dietro un clamp silenzioso.
 *
 * Riprova fino a 5 volte con backoff con jitter, solo sulla contesa causata da
 * vendite simultanee (anche l'admin panel scrive sullo stesso file): un 409, o
 * un 422 quando due create sullo stesso file (prima vendita di sempre) sono
 * partite in corsa — vedi isRetryable. Qualsiasi altro errore di lettura o
 * scrittura torna subito come { ok: false, error } senza ritentare.
 */
export async function recordDropSale(paymentIntentId, items, token = process.env.GITHUB_TOKEN) {
  const dropItems = (items || []).filter((i) => productState(i.productId) === DROP)
  if (dropItems.length === 0) return { ok: true, numbers: {} }

  if (!token) return { ok: false, error: 'GITHUB_TOKEN not configured' }
  if (!paymentIntentId) return { ok: false, error: 'paymentIntentId required' }

  const dropId = getDrop().current.id

  for (let attempt = 0; attempt < 5; attempt++) {
    let sha, data
    try {
      ;({ sha, data } = await readFile(token))
    } catch (err) {
      console.error('[drop-sales] read failed:', err.message)
      return { ok: false, error: err.message }
    }
    const entry = data[dropId] ? { ...emptyEntry(), ...data[dropId] } : emptyEntry()

    if (entry.counted[paymentIntentId]) {
      return { ok: true, alreadyCounted: true, numbers: entry.counted[paymentIntentId] }
    }

    const numbers = {}
    const now = new Date().toISOString()
    let overCap = false
    // Un productId può comparire più volte in questo stesso ordine — il
    // carrello chiave le righe per variante (taglia/colore/cornice), non per
    // prodotto, quindi la stessa maglietta in M e in L sono due item con lo
    // stesso productId. entry.products[id] viene letto e scritto a ogni
    // iterazione (sold si accumula correttamente), ma numbers[id] va accodato,
    // non sovrascritto: chi compra M e L nello stesso ordine deve ricevere
    // entrambi i numeri, non solo l'ultimo.
    for (const item of dropItems) {
      const prev = entry.products[item.productId]?.sold ?? 0
      const qty  = Math.max(1, parseInt(item.quantity, 10) || 1)
      const cap  = capFor(item.productId)
      const next = prev + qty   // mai clampato: il pagamento è già avvenuto
      if (cap && next > cap) overCap = true
      entry.products[item.productId] = { sold: next, lastAt: now }
      // i numeri assegnati a questa riga, es. qty 3 da prev 5 → [6, 7, 8]
      const pieces = Array.from({ length: qty }, (_, i) => prev + i + 1)
      numbers[item.productId] = [...(numbers[item.productId] || []), ...pieces]
    }
    entry.counted = { ...entry.counted, [paymentIntentId]: numbers }

    const nextData = { ...data, [dropId]: entry }
    try {
      await ghPut(
        SALES_PATH,
        JSON.stringify(nextData, null, 2) + '\n',
        sha,
        `[drop] sale ${paymentIntentId} [skip ci]`,
        token,
      )
      return { ok: true, numbers, ...(overCap ? { overCap: true } : {}) }
    } catch (err) {
      if (!isRetryable(err, sha)) {
        console.error('[drop-sales] write failed (not retryable):', err.message)
        return { ok: false, error: err.message }
      }
      if (attempt === 4) {
        console.error('[drop-sales] record failed after 5 attempts:', err.message)
        return { ok: false, error: err.message }
      }
      // contesa (409, o 422 su una create battuta sul tempo): un'altra vendita
      // ha scritto nel frattempo, rileggi con backoff con jitter per non
      // ripresentarsi tutti allo stesso istante
      await new Promise((r) => setTimeout(r, 100 * 2 ** attempt + Math.random() * 100))
    }
  }
  return { ok: false, error: 'unreachable' }
}
