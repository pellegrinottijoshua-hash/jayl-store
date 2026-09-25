#!/usr/bin/env node
// Verifica la regola "tre colori per maglia" della scheda prodotto
// (src/lib/shownColors.js) sull'intero catalogo del sito:
//
// 1. mai piu' di MAX_SHOWN_COLORS colori;
// 2. il colore d'apertura (quello del drop, o il primo) e' sempre fra quelli
//    mostrati — altrimenti la scheda si aprirebbe su uno swatch invisibile e
//    "Add to cart" comprerebbe un colore che il cliente non ha visto;
// 3. la gallery non perde mai tutte le foto, e non tiene foto di un colore
//    nascosto quando il nome del file (o il pixel, via imageColors) lo dice.
//
// Il caso "heather-navy" vs "navy" e' coperto a parte: con i soli colori
// mostrati la sottostringa farebbe passare la foto sbagliata.
//
// Run: node scripts/test-shown-colors.js

import { adminProducts } from '../src/data/admin-products.js'
import { drop } from '../src/data/drop.js'
import { buildImageOwnership } from '../src/lib/colorImageMatch.js'
import { shownColors, imagesForShownColors, MAX_SHOWN_COLORS } from '../src/lib/shownColors.js'

let failures = 0
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`) }

const visible = new Set([...(drop.current?.productIds || []), ...(drop.released || [])])

for (const p of adminProducts.filter((x) => visible.has(x.id) && x.colors?.length)) {
  const wanted  = drop.current?.productIds?.includes(p.id) ? drop.current.defaults?.[p.id]?.color : null
  const opening = (wanted && p.colors.some((c) => c.id === wanted)) ? wanted : p.colors[0].id
  const shown   = shownColors(p.colors, opening)

  if (shown.length > MAX_SHOWN_COLORS) fail(`${p.id}: ${shown.length} colori mostrati`)
  if (!shown.some((c) => c.id === opening)) fail(`${p.id}: colore d'apertura "${opening}" nascosto`)

  const images = p.images || []
  const kept   = imagesForShownColors(images, p.colors, shown, null)
  if (images.length && !kept.length) fail(`${p.id}: gallery vuota`)
  const owners = buildImageOwnership(p.colors, kept)
  for (const img of kept) {
    const o = owners.get(img)
    if (o && !shown.includes(o)) fail(`${p.id}: foto di un colore nascosto rimasta (${o.id})`)
  }
}

// Sottostringa: "navy" mostrato, "heather-navy" nascosto.
{
  const colors = [{ id: 'navy', label: 'Navy' }, { id: 'black', label: 'Black' }, { id: 'white', label: 'White' }, { id: 'heather-navy', label: 'Heather Navy' }]
  const shown  = shownColors(colors, 'navy')
  const kept   = imagesForShownColors(['/x/tee-heather-navy-01.jpg', '/x/tee-navy-01.jpg', '/x/hero.jpg'], colors, shown, null)
  if (kept.includes('/x/tee-heather-navy-01.jpg')) fail('heather-navy passa come navy')
  if (!kept.includes('/x/tee-navy-01.jpg') || !kept.includes('/x/hero.jpg')) fail('navy/hero persi')
}

// imageColors: un mockup senza colore nel nome ma riconosciuto dai pixel.
{
  const colors = [{ id: 'red', label: 'Red' }, { id: 'black', label: 'Black' }, { id: 'white', label: 'White' }, { id: 'gold', label: 'Gold' }]
  const shown  = shownColors(colors, 'red')
  const kept   = imagesForShownColors(['/x/t-gelato-01.jpg', '/x/t-gelato-02.jpg'], colors, shown, { '/x/t-gelato-01.jpg': 'gold', '/x/t-gelato-02.jpg': 'red' })
  if (kept.length !== 1 || kept[0] !== '/x/t-gelato-02.jpg') fail(`imageColors ignorato: ${JSON.stringify(kept)}`)
}

if (failures) {
  console.error(`test-shown-colors: ${failures} errori`)
  process.exit(1)
}
console.log('test-shown-colors: ok')
