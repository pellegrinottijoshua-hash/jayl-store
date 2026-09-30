// I mockup Gelato arrivano come URL S3 firmati (scadono dopo 24 ore) e poi
// vengono copiati nel repo: `…-gelato-01.jpg` (localizzati) o
// `…-<colore>-01.jpg` (importati). Nel pool degli editor comparivano tutte e
// due le versioni, quindi ogni mockup sembrava doppio, e dal giorno dopo gli
// originali diventavano riquadri rotti.
//
// Regola: se nella cartella del prodotto ci sono almeno tante copie quanti
// sono gli originali, gli originali non si mostrano piu'. Le immagini NBP
// (hf_…) non contano come copie.

const COPIA = /-\d{2}\.(jpe?g|png|webp)$/i

const nome = (img) => {
  if (typeof img === 'string') return img.split('/').pop().split('?')[0]
  return (img?.name || img?.path || img?.url || '').split('/').pop().split('?')[0]
}

/** Gli originali Gelato ancora da mostrare, dati quelli del repo. */
export function gelatoNonCopiati(originali, immaginiRepo) {
  const copie = (immaginiRepo || []).filter((img) => {
    const n = nome(img)
    return COPIA.test(n) && !/^hf_/i.test(n)
  }).length
  return copie >= (originali || []).length ? [] : originali
}
