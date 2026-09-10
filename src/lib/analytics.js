// Eventi ecommerce GA4 (view_item, add_to_cart, begin_checkout, purchase).
//
// Prima di questo modulo il sito mandava a GA4 solo `page_view`: bastava per
// sapere quanta gente arriva, non per sapere da dove arriva chi COMPRA. Meta
// Pixel e Pinterest Tag hanno i loro eventi (vedi ProductPage/CheckoutPage) ma
// ognuno vede solo il proprio canale — GA4 è l'unico posto in cui una vendita
// si può attribuire a una UTM, quindi al singolo video TikTok che l'ha portata.
//
// ── Due regole che qui non si violano ────────────────────────────────────────
//
// 1. I PREZZI DEL CATALOGO SONO IN CENTESIMI. GA4, come Meta e Pinterest,
//    vuole unità maggiori. Passare `2200` invece di `22` non dà errore da
//    nessuna parte: dà semplicemente un fatturato 100 volte più grande, e te
//    ne accorgi settimane dopo guardando un ROAS che non torna. Ogni valore
//    che esce da qui passa da toMajor().
//
// 2. IL PREZZO È QUELLO DEL DROP, NON QUELLO DEL PRODOTTO. `product.price` e
//    `cartStore.unitPrice` sono entrambi stale durante un drop: il prezzo
//    davvero addebitato lo risolve basePriceFor() dalla config del drop. Chi
//    chiama passa già il prezzo risolto — questo modulo non lo indovina mai
//    da solo, altrimenti l'analytics racconterebbe €23,99 dove Stripe ha
//    incassato €22.
//
// Nessuna funzione qui può lanciare: un errore di analytics dentro il flusso
// di pagamento costerebbe un ordine vero.

/** Centesimi → unità maggiori. `2200` → `22`. */
export function toMajor(cents) {
  const n = Number(cents)
  return Number.isFinite(n) ? Math.round(n) / 100 : 0
}

/**
 * Invia un evento a GA4, se gtag c'è.
 *
 * Non controlla il consenso di proposito: il CookieBanner configura Consent
 * Mode v2 (`analytics_storage` e compagni), ed è gtag stesso a decidere se
 * l'evento diventa un ping con o senza cookie. Stesso schema già usato dal
 * page_view in App.jsx — duplicare qui un controllo di consenso produrrebbe
 * due fonti di verità che prima o poi divergono.
 */
export function trackGA4(event, params) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  try {
    window.gtag('event', event, params)
  } catch {
    // Un evento perso non vale un checkout rotto.
  }
}

/**
 * Un item GA4 a partire da un prodotto del catalogo.
 *
 * @param product     record del catalogo
 * @param priceCents  prezzo DAVVERO addebitato, in centesimi (vedi regola 2)
 */
export function gaItem(product, priceCents, quantity = 1, extra = {}) {
  return {
    item_id:       product?.id,
    item_name:     product?.name,
    item_category: product?.collection || product?.section,
    price:         toMajor(priceCents),
    quantity,
    ...extra,
  }
}

/**
 * Righe di carrello → array di items GA4.
 *
 * @param priceOf  (item) => centesimi. Chi chiama passa il proprio
 *                 livePriceFor(item, cfg): la risoluzione del prezzo di drop
 *                 resta dov'è già, questo modulo non ne tiene una seconda copia.
 */
export function cartToGaItems(items, priceOf) {
  return (items || []).map((i) =>
    gaItem(i.product, priceOf(i), i.quantity || 1, {
      item_variant: [i.size, i.color].filter(Boolean).join(' / ') || undefined,
    })
  )
}
