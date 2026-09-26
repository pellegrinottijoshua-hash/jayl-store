/**
 * Stampa davanti o dietro sulla stessa maglia.
 *
 * Il lato di stampa sta dentro il codice Gelato della variante:
 * "…_gpr_0-4_…" = solo retro, "…_gpr_4-0_…" = solo fronte. Una maglia back
 * che il cliente vuole con la stampa davanti e' quindi lo stesso capo con il
 * segmento gpr invertito e un file di stampa diverso (altPrintFileUrl, lo
 * stesso disegno piccolo sul petto). Nessun secondo prodotto su Gelato.
 *
 * Colori con il codice fronte gia' passato per ordini veri (prodotti front
 * del catalogo, Gildan 64000). Un colore fuori lista non offre il fronte:
 * un codice Gelato inesistente fallirebbe dopo il pagamento.
 */
export const FRONT_OK_COLORS = new Set([
  'purple', 'black', 'white', 'navy', 'heather-navy', 'daisy', 'natural',
  'light-blue', 'red', 'military-green', 'sand', 'rs-sport-grey',
  'carolina-blue', 'cardinal-red', 'irish-green', 'azalea', 'royal',
  'heather-royal', 'maroon',
])

const GPR = /_gpr_(\d+)-(\d+)_/

/** 'back' | 'front' | null: il lato di stampa principale del prodotto, dal codice Gelato. */
export function mainSide(product) {
  const uid = product?.variants?.find((v) => v.gelatoVariantId)?.gelatoVariantId || ''
  const m = GPR.exec(uid)
  if (!m) return null
  const [f, b] = [Number(m[1]), Number(m[2])]
  if (f === 0 && b > 0) return 'back'
  if (b === 0 && f > 0) return 'front'
  return null
}

/** I lati offerti per un colore: sempre quello principale, l'altro se c'e' il file e il colore e' verificato. */
export function sidesFor(product, colorId) {
  const main = mainSide(product)
  if (!main) return []
  const alt = main === 'back' ? 'front' : 'back'
  const altOk = !!product?.altPrintFileUrl && (!colorId || FRONT_OK_COLORS.has(colorId))
  return altOk ? [main, alt] : [main]
}

/** Il codice Gelato per il lato scelto: inverte il segmento gpr quando serve. */
export function uidForSide(uid, side) {
  if (!uid || !side) return uid
  return uid.replace(GPR, (all, f, b) => {
    const n = Math.max(Number(f), Number(b))
    return side === 'front' ? `_gpr_${n}-0_` : `_gpr_0-${n}_`
  })
}
