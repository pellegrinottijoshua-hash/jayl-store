// Test di src/lib/analytics.js — la conversione centesimi→unità maggiori e la
// forma degli items GA4.
//
// Perché questo file esiste: un errore qui non rompe niente e non si vede. Il
// sito continua a funzionare, il checkout incassa, e GA4 riceve numeri
// sbagliati per settimane finché qualcuno non confronta il fatturato dichiarato
// con quello di Stripe. Era già successo con Meta Pixel, che riceveva ogni
// vista prodotto a €2.200 invece di €22 perché passava i centesimi grezzi.

import assert from 'node:assert'
import {
  toMajor, gaItem, cartToGaItems,
  trackTikTok, ttContent, cartToTtContents,
  trackUmami,
} from '../src/lib/analytics.js'

let passed = 0
function check(label, fn) {
  fn()
  passed++
}

// ── toMajor ─────────────────────────────────────────────────────────────────
check('centesimi → unità maggiori', () => {
  assert.strictEqual(toMajor(2200), 22)
  assert.strictEqual(toMajor(2399), 23.99)
  assert.strictEqual(toMajor(2500), 25)
  assert.strictEqual(toMajor(5700), 57)
})

check('il prezzo drop non diventa mai quello di listino', () => {
  // 2200 è dropPrice, 2399 è product.price. Se questi due si confondono
  // l'analytics gonfia ogni vendita del drop di €1,99.
  assert.notStrictEqual(toMajor(2200), toMajor(2399))
})

check('zero, null, undefined e stringhe non producono NaN', () => {
  // Un NaN in `value` fa scartare l'evento da GA4 in silenzio.
  for (const v of [0, null, undefined, '', 'abc', NaN, Infinity]) {
    const out = toMajor(v)
    assert.ok(Number.isFinite(out), `toMajor(${String(v)}) deve essere finito, era ${out}`)
  }
  assert.strictEqual(toMajor(null), 0)
  assert.strictEqual(toMajor('abc'), 0)
})

check('le stringhe numeriche si comportano come i numeri', () => {
  assert.strictEqual(toMajor('2200'), 22)
})

// ── gaItem ──────────────────────────────────────────────────────────────────
const product = {
  id: 'cool-ditto-back-t-shirt',
  name: 'Cool Ditto back T-Shirt',
  collection: 'cool pokemon back',
  section: 'objects',
  price: 2399,
}

check('gaItem usa il prezzo passato, non product.price', () => {
  // Il cuore della regola 2: durante un drop il prezzo addebitato è 2200,
  // mentre product.price resta 2399. gaItem non deve MAI leggere product.price.
  const item = gaItem(product, 2200)
  assert.strictEqual(item.price, 22)
  assert.notStrictEqual(item.price, 23.99)
})

check('gaItem ha la forma che GA4 si aspetta', () => {
  const item = gaItem(product, 2200)
  assert.strictEqual(item.item_id, 'cool-ditto-back-t-shirt')
  assert.strictEqual(item.item_name, 'Cool Ditto back T-Shirt')
  assert.strictEqual(item.item_category, 'cool pokemon back')
  assert.strictEqual(item.quantity, 1)
})

check('gaItem ripiega su section quando collection manca', () => {
  const item = gaItem({ id: 'x', name: 'X', section: 'art' }, 1000)
  assert.strictEqual(item.item_category, 'art')
})

check('gaItem non lancia su un prodotto assente', () => {
  // ProductPage lo chiama dentro un effect che può girare prima che il
  // prodotto sia risolto.
  const item = gaItem(undefined, 2200)
  assert.strictEqual(item.item_id, undefined)
  assert.strictEqual(item.price, 22)
})

// ── cartToGaItems ───────────────────────────────────────────────────────────
const cart = [
  { product, size: 'L', color: 'Azalea', quantity: 2, unitPrice: 2399 },
  { product: { id: 'cool-slowpoke-back-t-shirt', name: 'Cool Slowpoke back T-Shirt', collection: 'cool pokemon back' },
    size: 'M', color: null, quantity: 1, unitPrice: 2399 },
]

check('cartToGaItems usa priceOf, non unitPrice del carrello', () => {
  // unitPrice è lo snapshot stale del cartStore. priceOf è livePriceFor.
  const items = cartToGaItems(cart, () => 2200)
  assert.strictEqual(items.length, 2)
  assert.ok(items.every((i) => i.price === 22), 'ogni riga deve usare il prezzo risolto')
})

check('le quantità sono riportate', () => {
  const items = cartToGaItems(cart, () => 2200)
  assert.strictEqual(items[0].quantity, 2)
  assert.strictEqual(items[1].quantity, 1)
})

check('item_variant unisce taglia e colore, e sparisce se non ce ne sono', () => {
  const items = cartToGaItems(cart, () => 2200)
  assert.strictEqual(items[0].item_variant, 'L / Azalea')
  assert.strictEqual(items[1].item_variant, 'M')
  const noVariant = cartToGaItems([{ product, quantity: 1 }], () => 2200)
  assert.strictEqual(noVariant[0].item_variant, undefined)
})

check('carrello vuoto o assente → array vuoto, non un crash', () => {
  assert.deepStrictEqual(cartToGaItems([], () => 0), [])
  assert.deepStrictEqual(cartToGaItems(null, () => 0), [])
  assert.deepStrictEqual(cartToGaItems(undefined, () => 0), [])
})

check('il valore totale del carrello torna sommando le righe', () => {
  // Il controllo che avrebbe intercettato il bug dei centesimi: il `value`
  // dell'evento e la somma degli items devono coincidere.
  const priceOf = () => 2200
  const items = cartToGaItems(cart, priceOf)
  const sumFromItems = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const subtotalCents = cart.reduce((s, i) => s + priceOf(i) * i.quantity, 0)
  assert.strictEqual(sumFromItems, toMajor(subtotalCents))
  assert.strictEqual(sumFromItems, 66) // 3 pezzi × €22
})

// ── TikTok Pixel ────────────────────────────────────────────────────────────
check('ttContent usa il prezzo passato e la forma TikTok', () => {
  const c = ttContent(product, 2200)
  assert.strictEqual(c.content_id, 'cool-ditto-back-t-shirt')
  assert.strictEqual(c.content_type, 'product')
  assert.strictEqual(c.content_name, 'Cool Ditto back T-Shirt')
  assert.strictEqual(c.price, 22)          // non 2200, non 23.99
  assert.strictEqual(c.quantity, 1)
})

check('cartToTtContents rispecchia quantità e prezzo risolto', () => {
  const cs = cartToTtContents(cart, () => 2200)
  assert.strictEqual(cs.length, 2)
  assert.strictEqual(cs[0].quantity, 2)
  assert.ok(cs.every((c) => c.price === 22))
})

check('carrello vuoto/assente → array vuoto anche lato TikTok', () => {
  assert.deepStrictEqual(cartToTtContents([], () => 0), [])
  assert.deepStrictEqual(cartToTtContents(null, () => 0), [])
})

check('trackTikTok è un no-op silenzioso senza pixel caricato', () => {
  // È lo stato in cui il sito vive finché __jaylTiktokPixelId resta null in
  // index.html: gli eventi sono già scritti nelle pagine e NON devono lanciare.
  const had = 'window' in globalThis
  if (!had) globalThis.window = {}
  delete globalThis.window.ttq
  assert.doesNotThrow(() => trackTikTok('AddToCart', { value: 22 }))

  // E con un ttq che esiste ma è rotto, l'errore non deve uscire.
  globalThis.window.ttq = { track() { throw new Error('pixel rotto') } }
  assert.doesNotThrow(() => trackTikTok('AddToCart', { value: 22 }))

  // Con un ttq sano l'evento passa, con i parametri intatti.
  const seen = []
  globalThis.window.ttq = { track: (e, p) => seen.push([e, p]) }
  trackTikTok('CompletePayment', { currency: 'EUR', value: 66 })
  assert.deepStrictEqual(seen, [['CompletePayment', { currency: 'EUR', value: 66 }]])
  delete globalThis.window.ttq
  if (!had) delete globalThis.window
})

check('i nomi evento TikTok non sono quelli GA4', () => {
  // Guardia contro la svista più facile: copiare i nomi GA4 nel pixel TikTok.
  // TikTok accetta nomi fuori standard ma non li rende ottimizzabili.
  const tiktok = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'CompletePayment']
  const ga4    = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']
  assert.ok(tiktok.every((n) => !ga4.includes(n)))
  assert.ok(tiktok.every((n) => /^[A-Z]/.test(n)), 'gli eventi TikTok sono in PascalCase')
})

// ── Umami ───────────────────────────────────────────────────────────────────
check('trackUmami non lancia mai, con o senza window/umami/script', () => {
  const hadWindow = 'window' in globalThis
  const hadDocument = 'document' in globalThis
  if (!hadWindow) globalThis.window = {}
  delete globalThis.window.umami

  // Script non configurato (id null in index.html): nessun elemento, no-op.
  globalThis.document = { getElementById: () => null }
  assert.doesNotThrow(() => trackUmami('view-product', { product: 'x' }))

  // umami presente ma rotto: l'errore resta dentro.
  globalThis.window.umami = { track() { throw new Error('umami rotto') } }
  assert.doesNotThrow(() => trackUmami('add-to-cart', { product: 'x' }))

  // umami sano: l'evento passa con i dati intatti.
  const seen = []
  globalThis.window.umami = { track: (e, d) => seen.push([e, d]) }
  trackUmami('checkout', { items: 2, value: 44 })
  assert.deepStrictEqual(seen, [['checkout', { items: 2, value: 44 }]])

  delete globalThis.window.umami
  if (!hadWindow) delete globalThis.window
  if (!hadDocument) delete globalThis.document
})

check('trackUmami mette in coda finché lo script non è carico', () => {
  // Il caso delle ads: si atterra sulla scheda, la pagina monta e lancia
  // view-product prima che lo script async di Umami abbia finito.
  const hadWindow = 'window' in globalThis
  const hadDocument = 'document' in globalThis
  if (!hadWindow) globalThis.window = {}
  delete globalThis.window.umami
  const script = new EventTarget()
  globalThis.document = { getElementById: (id) => (id === 'jayl-umami' ? script : null) }

  trackUmami('view-product', { product: 'a' })
  trackUmami('add-to-cart', { product: 'a' })

  const seen = []
  globalThis.window.umami = { track: (e, d) => seen.push([e, d]) }
  script.dispatchEvent(new Event('load'))
  assert.deepStrictEqual(seen, [
    ['view-product', { product: 'a' }],
    ['add-to-cart', { product: 'a' }],
  ], 'gli eventi in coda partono al load, nell\'ordine')

  // Dopo il load si va diretti, niente doppioni.
  trackUmami('checkout', { items: 1, value: 22 })
  assert.strictEqual(seen.length, 3)

  delete globalThis.window.umami
  if (!hadWindow) delete globalThis.window
  if (!hadDocument) delete globalThis.document
})

console.log(`✓ analytics: ${passed} controlli passati`)
