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

// ── TikTok Pixel ────────────────────────────────────────────────────────────
//
// Stessa forma degli helper GA4 sopra, stesse due regole (centesimi → unità
// maggiori, prezzo risolto dal drop). Il pixel si carica solo dopo il consenso
// e solo se __jaylTiktokPixelId è valorizzato in index.html — finché non lo è,
// `window.ttq` non esiste e ogni chiamata qui è un no-op silenzioso. Gli eventi
// restano comunque scritti nei punti giusti: il giorno in cui l'id compare,
// iniziano a partire senza toccare altro codice.
//
// I nomi degli eventi sono quelli standard di TikTok e NON coincidono con
// quelli GA4: InitiateCheckout (non begin_checkout), CompletePayment (non
// purchase). Un nome fuori standard viene accettato dal pixel ma non è
// ottimizzabile in campagna, che è l'unico motivo per cui lo si installa.

/** Invia un evento al TikTok Pixel, se caricato. */
export function trackTikTok(event, params) {
  if (typeof window === 'undefined' || typeof window.ttq?.track !== 'function') return
  try {
    window.ttq.track(event, params)
  } catch {
    // Come per GA4: un evento perso non vale un checkout rotto.
  }
}

/**
 * Un `content` TikTok da un prodotto del catalogo.
 *
 * @param priceCents  prezzo DAVVERO addebitato, in centesimi
 */
export function ttContent(product, priceCents, quantity = 1) {
  return {
    content_id:   product?.id,
    content_type: 'product',
    content_name: product?.name,
    price:        toMajor(priceCents),
    quantity,
  }
}

/** Righe di carrello → array di `contents` TikTok. `priceOf` torna CENTESIMI. */
export function cartToTtContents(items, priceOf) {
  return (items || []).map((i) => ttContent(i.product, priceOf(i), i.quantity || 1))
}

// ── Umami (analitica senza cookie) ──────────────────────────────────────────
//
// GA4 e i pixel vedono solo chi accetta il banner: dei ~160 clic delle ads di
// settembre GA4 ne ha contati una manciata. Umami non usa cookie né
// localStorage e non salva IP, quindi gira per tutti senza consenso ed è
// l'unico posto in cui il percorso dopo il clic (scheda → carrello →
// checkout) si vede per intero, diviso per utm_campaign/utm_content.
//
// Lo script si carica da index.html solo se __jaylUmamiId è valorizzato, ed è
// `async`: su un atterraggio diretto da un'ad la scheda prodotto monta PRIMA
// che window.umami esista. Gli eventi di quel momento finiscono in coda e
// partono al `load` dello script, invece di perdersi proprio sulla visita che
// conta di più. NON si definisce uno stub window.umami: il tracker si
// inizializza solo se window.umami non esiste ancora.
//
// I dati degli eventi restano minimi: id prodotto, conteggi, importi. Niente
// che identifichi una persona.

const umamiQueue = []
let umamiListening = false

function flushUmami() {
  const umami = window.umami
  if (typeof umami?.track !== 'function') return
  while (umamiQueue.length) {
    const [event, data] = umamiQueue.shift()
    try { umami.track(event, data) } catch { /* evento perso, pagina salva */ }
  }
}

/** Invia un evento a Umami; se lo script non è ancora carico lo mette in coda. */
export function trackUmami(event, data) {
  if (typeof window === 'undefined') return
  try {
    if (typeof window.umami?.track === 'function') {
      window.umami.track(event, data)
      return
    }
    // Script non configurato (id null) o bloccato: non accumulare niente.
    const script = typeof document !== 'undefined' && document.getElementById('jayl-umami')
    if (!script) return
    umamiQueue.push([event, data])
    if (!umamiListening) {
      umamiListening = true
      script.addEventListener('load', flushUmami, { once: true })
    }
  } catch {
    // Come per GA4: un evento perso non vale un checkout rotto.
  }
}
