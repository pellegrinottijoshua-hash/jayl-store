// Logica pura dello scheduling dei drop: quale voce di `scheduled` è dovuta,
// e come diventa il nuovo `current`. Nessun I/O — l'unico chiamante che scrive
// è il ramo cron di api/admin.js, che legge/committa src/data/drop.js via
// GitHub Contents API. Tenerla pura è ciò che la rende testabile con un
// orologio finto (scripts/test-drop-schedule.js) invece che con quello vero.
//
// ── Perché il cron e non un semplice controllo a runtime ─────────────────────
// Il plugin `storefront-products` in vite.config.js decide AL MOMENTO DELLA
// BUILD quali prodotti finiscono nel bundle del client. Un drop che diventasse
// `current` solo a runtime mostrerebbe pannelli per prodotti che nel bundle
// non esistono. La promozione deve quindi produrre un COMMIT (che fa partire
// il deploy, che rigenera il bundle con i prodotti giusti) — non un cambio di
// stato in memoria.
//
// ── Perché promuovere in anticipo non mette in vendita ───────────────────────
// Il cron gira una volta al giorno, un drop apre quando vuole. Promuovere
// PRIMA di startsAt è sicuro perché il drop entra nello stato BEFORE
// (dropWindowState): la home mostra l'anteprima, e checkDropGate in
// api/create-payment-intent.js rifiuta qualunque checkout fino a startsAt.
// Le ore di anticipo non sono un effetto collaterale da tollerare, sono la
// vetrina d'attesa.
//
// ── Perché il cron gira alle 16:00 UTC (vercel.json) ─────────────────────────
// Girava alle 08:00, e con drop contigui quell'ora è la peggiore possibile.
// Il guardrail qui sotto rifiuta di promuovere sopra un drop ancora in corso
// (giustamente: i pezzi passerebbero a prezzo pieno mentre qualcuno li sta
// comprando a prezzo drop). Con un drop che chiude alle 16:00 e il successivo
// che apre alle 16:00, il giro delle 08:00 vede il corrente ancora aperto e
// rimanda — e il giro utile diventa quello del giorno DOPO: il drop nuovo
// parte con 16 ore di ritardo e la home resta su "DROP CLOSED" per tutta la
// sera. Allineare il cron all'ora di cambio riduce quel ritardo alla finestra
// di jitter del cron (Vercel lo fa partire entro l'ora schedulata, mai prima).
// Se un giorno l'ora dei drop cambia, questa va cambiata con lei.
//
// Il percorso manuale non dipende da questo: 'close-drop' in api/admin.js fa
// subentrare da sé il programmato dovuto, nello stesso commit della chiusura.

/**
 * Finestra di anticipo: una voce è "dovuta" quando manca al massimo questo
 * tempo alla sua apertura. 24 ore, non meno: il cron gira una sola volta al
 * giorno, quindi una finestra più stretta lascerebbe scoperti i drop che
 * aprono a un'ora del giorno che il cron non incrocia mai. Con 24h esatte
 * ogni drop viene sempre preso da uno e un solo giro di cron prima di aprire.
 */
export const PROMOTION_LEAD_MS = 24 * 60 * 60 * 1000

/**
 * La voce di `scheduled` da promuovere adesso, se ce n'è una.
 *
 * Ritorna sempre un `reason` leggibile anche quando non promuove nulla: il
 * cron lo logga, ed è l'unico modo per capire dal log perché un drop atteso
 * NON è partito — un cron che risponde `{promoted: null}` e basta non è
 * diagnosticabile la mattina dopo.
 *
 * @returns {{ entry: object|null, index: number, reason: string }}
 */
export function pickDueDrop(cfg, now = new Date()) {
  const t = now.getTime()
  const scheduled = Array.isArray(cfg?.scheduled) ? cfg.scheduled : []
  if (!scheduled.length) {
    return { entry: null, index: -1, reason: 'nessun drop programmato' }
  }

  // Il drop corrente ha la precedenza assoluta finché non è finito. Promuovere
  // sopra un drop ancora aperto (o ancora in anteprima) lo cancellerebbe a
  // metà: i pezzi passerebbero in listino a prezzo pieno mentre qualcuno li
  // sta comprando a prezzo drop. Se le date si accavallano, il programmato
  // aspetta e riprova al giro dopo — un drop che parte in ritardo è un
  // inconveniente, un drop chiuso a metà è una vendita persa e un cliente
  // confuso.
  const currentIds = cfg?.current?.productIds || []
  const currentEndsAt = Date.parse(cfg?.current?.endsAt)
  if (currentIds.length > 0 && Number.isFinite(currentEndsAt) && t < currentEndsAt) {
    return {
      entry: null,
      index: -1,
      reason: `drop corrente ancora in corso fino a ${cfg.current.endsAt} — promozione rimandata`,
    }
  }

  // Candidati: non ancora scaduti (una voce il cui endsAt è già passato
  // nascerebbe morta) e dentro la finestra di anticipo. Le voci scadute NON
  // vengono rimosse: restano in `scheduled` dove l'admin le vede e decide,
  // invece di sparire di notte senza lasciare traccia.
  const candidates = scheduled
    .map((entry, index) => ({ entry, index, startsAt: Date.parse(entry?.startsAt), endsAt: Date.parse(entry?.endsAt) }))
    .filter((c) => Number.isFinite(c.startsAt) && Number.isFinite(c.endsAt) && c.endsAt > t)
    .sort((a, b) => a.startsAt - b.startsAt)

  if (!candidates.length) {
    return { entry: null, index: -1, reason: 'nessun drop programmato ancora valido (tutti scaduti o con date non parseabili)' }
  }

  const first = candidates[0]
  if (first.startsAt - t > PROMOTION_LEAD_MS) {
    return { entry: null, index: -1, reason: `il prossimo drop apre il ${first.entry.startsAt}, fuori dalla finestra di anticipo` }
  }

  return { entry: first.entry, index: first.index, reason: `${first.entry.id} apre il ${first.entry.startsAt}` }
}

/**
 * Aggiunge un drop concluso all'archivio storico `past`, se non c'è già.
 *
 * `previous` conserva SOLO l'ultimo drop chiuso, perché serve a una cosa sola:
 * dare alla home qualcosa da mostrare nel buco fra due drop. `past` è un'altra
 * cosa — è la cronologia completa, quella che il pannello admin elenca sotto
 * "Drop passati" così che un drop concluso non resti a occupare la sezione
 * "Drop corrente" facendo credere che stia ancora vendendo.
 *
 * Idempotente per id: close-drop e la promozione del cron possono toccare lo
 * stesso drop uscente a pochi minuti di distanza (chiusura manuale seguita dal
 * giro di cron), e due voci identiche nell'archivio sarebbero solo rumore.
 */
export function archiveDrop(cfg, outgoing) {
  const past = Array.isArray(cfg.past) ? cfg.past : []
  const ids = outgoing?.productIds || []
  // Un drop già svuotato (chiuso a mano prima) è già stato archiviato al
  // momento della chiusura: archiviarlo di nuovo scriverebbe una voce senza
  // pezzi sopra quella buona.
  if (!outgoing?.id || ids.length === 0) return past
  if (past.some((p) => p.id === outgoing.id)) return past

  return [
    ...past,
    {
      id: outgoing.id,
      number: outgoing.number,
      title: outgoing.title,
      productIds: ids,
      startsAt: outgoing.startsAt,
      endsAt: outgoing.endsAt,
    },
  ]
}

/**
 * Applica la promozione: restituisce una NUOVA config, senza mutare quella
 * passata (il chiamante deve poter abortire senza aver sporcato nulla).
 *
 * Fa esattamente ciò che fa il bottone "Chiudi drop → listino" del pannello,
 * più il subentro del programmato:
 *   1. i pezzi del drop uscente entrano in `released` (listino, prezzo pieno)
 *   2. `previous` conserva il drop uscente, così la home ha ancora qualcosa da
 *      mostrare nel buco fra i due (senza, DropPanels non renderizza niente)
 *   3. il drop uscente entra in `past`, l'archivio che il pannello elenca
 *   4. il programmato diventa `current` così com'è — stessa forma, nessuna
 *      trasformazione, nessun campo inventato al volo
 *   5. esce da `scheduled`
 */
export function promoteDrop(cfg, index) {
  const scheduled = Array.isArray(cfg.scheduled) ? cfg.scheduled : []
  const entry = scheduled[index]
  if (!entry) throw new Error(`promoteDrop: nessuna voce programmata all'indice ${index}`)

  const outgoingIds = cfg.current?.productIds || []

  return {
    ...cfg,
    // Un drop già chiuso a mano dall'admin ha productIds vuoto: sovrascrivere
    // `previous` con quel vuoto distruggerebbe il fallback della home, che è
    // l'unico motivo per cui `previous` esiste. Stessa cautela del no-op
    // idempotente in close-drop (api/admin.js).
    previous: outgoingIds.length > 0
      ? { number: cfg.current?.number, title: cfg.current?.title, productIds: outgoingIds }
      : (cfg.previous ?? null),
    past: archiveDrop(cfg, cfg.current),
    released: [...new Set([...(cfg.released || []), ...outgoingIds])],
    current: entry,
    scheduled: scheduled.filter((_, i) => i !== index),
  }
}

/**
 * La data di apertura del PROSSIMO drop, per i countdown della vetrina.
 *
 * Preferisce il primo drop programmato non ancora scaduto: è quello che il
 * cron promuoverà davvero, quindi è l'unica data che non può mentire. Il
 * vecchio `cfg.next` ({ number, startsAt }) resta come fallback per le config
 * scritte prima dello scheduling — ma appena `scheduled` è popolato non va più
 * mantenuto a mano, altrimenti si finisce con due date che si contraddicono:
 * quella scritta nel teaser e quella su cui il cron agisce.
 *
 * @returns {string|null} una data ISO, o null se non c'è niente da annunciare
 */
export function nextDropStartsAt(cfg, now = new Date()) {
  const t = now.getTime()
  const upcoming = (Array.isArray(cfg?.scheduled) ? cfg.scheduled : [])
    .map((e) => ({ startsAt: e?.startsAt, t: Date.parse(e?.startsAt) }))
    .filter((e) => Number.isFinite(e.t) && e.t > t)
    .sort((a, b) => a.t - b.t)

  return upcoming[0]?.startsAt ?? cfg?.next?.startsAt ?? null
}
