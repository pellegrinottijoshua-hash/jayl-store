// Registro delle vendite di un drop. Vive in src/data/drop-sales.json e viene
// letto e scritto a runtime via API GitHub — mai importato, altrimenti sarebbe
// congelato al deploy, che è esattamente ciò che un contatore non deve essere.
//
// Si legge dall'API autenticata e non da raw.githubusercontent: quest'ultima ha
// cache CDN di alcuni minuti e permetterebbe di sforare il cap.
import { ghGet, ghPut } from './github.js'
import { capFor, productState, getDrop, DROP } from './drop.js'

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

  const dropId = getDrop().current.id

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
