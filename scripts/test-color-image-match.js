#!/usr/bin/env node
// Verifica che il matching colore→immagine sulla pagina prodotto non possa
// mai assegnare due colori DIVERSI alla STESSA foto nella galleria di un
// prodotto — è la classe di bug segnalata dall'utente l'8 settembre 2026:
// premere uno swatch mostrava la foto di un colore diverso.
//
// Root cause era duplice: `product.colors[].image` è un campo che nessun
// percorso del codice scrive più (verificato: né l'admin panel né
// import-gelato-images lo toccano), quindi invecchia a ogni reimport dei
// mockup Gelato; e il vecchio fallback era un `img.includes(slug)` a
// sottostringa pura, che confonde "Navy" con "Heather Navy" e "Red" con
// "Cardinal Red" — entrambe le coppie esistono davvero su questo catalogo.
//
// src/lib/colorImageMatch.js risolve assegnando ogni immagine al colore con
// lo slug più SPECIFICO (più lungo) che vi compare — corretto a prescindere
// da color.image, e a prescindere da QUALI nomi colore un prodotto usa: non
// serve conoscere in anticipo le coppie che collidono, la regola generalizza.
//
// Cosa NON verifica, deliberatamente: che ogni colore abbia una foto propria.
// Molti prodotti non hanno un mockup dedicato per ogni colorway (nota già in
// docs/gelato-pipeline.md) — quel caso ricade sull'immagine generica del
// prodotto, che è degradato ma non SBAGLIATO. L'errore vero è quando due
// colori diversi puntano alla stessa foto: quello, e solo quello, blocca la
// build.
//
// Run: node scripts/test-color-image-match.js

import { adminProducts } from '../src/data/admin-products.js'
import { buildImageOwnership, findColorImageIndex } from '../src/lib/colorImageMatch.js'

let passed = 0
const failures = []
const check = (label, cond) => { if (cond) passed++; else failures.push(label) }

// ── 1. Fixture sintetica — fissa la proprietà dell'algoritmo, non del catalogo ─
// Riproduce esattamente le due collisioni reali trovate sul catalogo (Navy vs
// Heather Navy, Red vs Cardinal Red) con dati inventati, così il controllo
// resta valido anche se quei prodotti specifici vengono rinominati o rimossi.
{
  const colors = [
    { id: 'navy', label: 'Navy' },
    { id: 'heather-navy', label: 'Heather Navy' },
    { id: 'red', label: 'Red' },
    { id: 'cardinal-red', label: 'Cardinal Red' },
    { id: 'white', label: 'White' }, // nessuna collisione — caso di controllo
  ]
  const images = [
    'product-navy-01.jpg',
    'product-heather-navy-01.jpg',
    'product-red-01.jpg',
    'product-cardinal-red-01.jpg',
    'product-white-01.jpg',
  ]
  const owners = buildImageOwnership(colors, images)

  check('Navy: possiede SOLO il file "navy", non "heather-navy"',
    owners.get('product-navy-01.jpg')?.id === 'navy')
  check('Heather Navy: possiede il file "heather-navy" (non ceduto a Navy nonostante la sottostringa)',
    owners.get('product-heather-navy-01.jpg')?.id === 'heather-navy')
  check('Red: possiede SOLO il file "red", non "cardinal-red"',
    owners.get('product-red-01.jpg')?.id === 'red')
  check('Cardinal Red: possiede il file "cardinal-red"',
    owners.get('product-cardinal-red-01.jpg')?.id === 'cardinal-red')
  check('White: nessuna collisione, matching diretto',
    owners.get('product-white-01.jpg')?.id === 'white')

  // La proprietà che conta davvero: findColorImageIndex non fa MAI puntare
  // due colori diversi allo stesso indice.
  const idxNavy       = findColorImageIndex(colors[0], colors, images)
  const idxHeatherNavy = findColorImageIndex(colors[1], colors, images)
  const idxRed        = findColorImageIndex(colors[2], colors, images)
  const idxCardinal   = findColorImageIndex(colors[3], colors, images)
  check('indice risolto per Navy ≠ indice risolto per Heather Navy', idxNavy !== idxHeatherNavy)
  check('indice risolto per Red ≠ indice risolto per Cardinal Red', idxRed !== idxCardinal)
  check('Navy risolve al file giusto (indice 0)', idxNavy === 0)
  check('Heather Navy risolve al file giusto (indice 1)', idxHeatherNavy === 1)

  // Nessuna immagine → nessun crash, indice -1, non un'eccezione.
  check('colore assente dalla gallery → -1, non un\'eccezione',
    findColorImageIndex({ id: 'gold', label: 'Gold' }, colors, images) === -1)
  check('lista immagini vuota → -1, non un\'eccezione',
    findColorImageIndex(colors[0], colors, []) === -1)
}

// ── 2. L'intero catalogo reale — l'invariante che conta ─────────────────────
// Per ogni prodotto con colori, due colori DIVERSI non possono mai risolvere
// allo stesso indice di galleria. Non serve sapere quali nomi collidono: è
// l'unica cosa che rende "premi uno swatch" affidabile, per costruzione, per
// qualunque combinazione di nomi colore un futuro prodotto porti con sé.
let productsChecked = 0
let colorsChecked   = 0
let colorsWithOwnImage = 0

for (const p of adminProducts) {
  if (!Array.isArray(p.colors) || !p.colors.length) continue
  const gallery = (p.heroImages?.length ? p.heroImages : p.images) || []
  if (!gallery.length) continue
  productsChecked++
  colorsChecked += p.colors.length

  const seenIndex = new Map() // index risolto → colore che lo ha preso per primo
  for (const c of p.colors) {
    const idx = findColorImageIndex(c, p.colors, gallery)
    if (idx < 0) continue // nessun mockup dedicato per questo colore — accettabile
    colorsWithOwnImage++
    const prior = seenIndex.get(idx)
    check(
      `${p.id}: "${c.label || c.id}" e "${prior?.label || prior?.id}" risolvono entrambi all'immagine ${idx} (${gallery[idx]})`,
      !prior,
    )
    if (!prior) seenIndex.set(idx, c)
  }
}

check('almeno un prodotto con colors[] è stato controllato', productsChecked > 0)

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`  ${productsChecked} prodotti con colori · ${colorsChecked} colori totali · ${colorsWithOwnImage} con una foto propria`)

if (failures.length) {
  console.error(`\n✗ ${failures.length} controlli falliti (${passed} passati) su color-image-match:\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
  console.error('')
  process.exit(1)
}
console.log(`✓ color-image-match: ${passed} controlli passati`)
