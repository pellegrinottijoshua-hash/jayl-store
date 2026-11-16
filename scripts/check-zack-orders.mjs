// Controllo degli ordini dei capi Zack the Duck, senza toccare Stripe o Gelato.
//
//   node scripts/check-zack-orders.mjs
//
// Per ogni capo Zack e ogni taglia: prezzo calcolato dal server, codice Gelato
// del capo nero, lato di stampa, file di stampa ed etichetta del colletto.
// Per i capi con altPrintFileUrl (felpa Front/Back) prova anche il retro.
import { priceItems } from '../api/_lib/catalog.js'
import { resolveItemPrint } from '../api/_lib/placement.js'
import { adminProducts } from '../src/data/admin-products.js'

let bad = 0
for (const p of adminProducts.filter((x) => x.section === 'zack')) {
  const sides = p.altPrintFileUrl ? [undefined, 'back'] : [undefined]
  for (const s of p.sizes) {
    for (const print of sides) {
      const r = priceItems([{ productId: p.id, size: s.id, color: 'black', quantity: 1, print }])
      if (!r.ok) { bad++; console.log('KO', p.id, s.id, print || '', r.error); continue }
      const it = r.items[0]
      const uid = it.variantObj?.gelatoVariantId
      try {
        const out = resolveItemPrint(it.product, uid, it.print)
        const wantBack = print === 'back'
        if (!/_gco_black_/.test(out.productUid) || (out.placement.type === 'back') !== wantBack || !it.product.neckLabelUrl) {
          bad++; console.log('KO', p.id, s.id, print || 'front', out.productUid)
        }
      } catch (e) { bad++; console.log('KO', p.id, s.id, print || '', e.message) }
    }
  }
  console.log(`${p.id}: €${p.price / 100}, taglie ${p.sizes.map((s) => s.id).join(',')}${p.altPrintFileUrl ? ', Front + Back' : ''}`)
}
console.log(bad ? `PROBLEMI: ${bad}` : 'OK: ogni taglia ha prezzo, capo nero, lato giusto, file di stampa ed etichetta colletto')
process.exit(bad ? 1 : 0)
