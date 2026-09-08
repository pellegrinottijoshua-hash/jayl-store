// Serializzazione/parsing canonici di src/data/drop.js, condivisi dalle azioni
// admin get-drop / save-drop / close-drop / release-product in api/admin.js.
//
// src/data/drop.js resta un modulo .js (non .json) perché è importato sia da
// Vite (client) sia da Node (funzioni serverless) — vedi
// scripts/check-api-imports.js. Ma il corpo dell'oggetto che scriviamo è
// sempre JSON puro (chiavi e stringhe fra doppi apici, niente virgole finali,
// nessun commento dentro le graffe), così può essere riletto con
// `raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)` invece di richiedere
// un import dinamico del modulo. OGNI write path deve passare da
// serializeDropConfig — è l'unico punto che genera il testo del file — altrimenti
// il file smette di essere machine-parseable e get-drop/close-drop/
// release-product iniziano a fallire silenziosamente al prossimo giro.
// Verificato da scripts/test-drop-config.js.

export const DROP_CONFIG_PATH = 'src/data/drop.js'

const HEADER = `// Configurazione del drop corrente. Modificata dal pannello admin (tab Drop),
// che la committa su main via API GitHub.
//
// Modulo .js e non .json di proposito: questo file è importato sia dal client
// (Vite) sia dalle funzioni serverless (Node). Vedi scripts/check-api-imports.js.
//
// 'previous' è popolato da 'close-drop': tiene i pezzi del drop appena chiuso,
// così fra un drop e l'altro la home ha ancora qualcosa da mostrare invece di
// svuotarsi. Senza questo, DropPanels non renderizza niente.
//
// Il corpo dell'oggetto sotto è JSON puro (chiavi e stringhe fra doppi apici,
// niente virgole finali, nessun commento dentro le graffe): le azioni admin lo
// rigenerano con serializeDropConfig() e lo rileggono con parseDropConfig().
// Una modifica a mano che rompa questo formato blocca il pannello Drop — vedi
// scripts/test-drop-config.js.
`

/**
 * Serializza cfg nella forma canonica del modulo. Usata da OGNI write path
 * (save-drop, close-drop, release-product) — non duplicare questo template.
 */
export function serializeDropConfig(cfg) {
  return `${HEADER}export const drop = ${JSON.stringify(cfg, null, 2)}\n`
}

/**
 * Riparsa il sorgente del modulo come JSON puro. Lancia un errore leggibile
 * invece di restituire un oggetto silenziosamente sbagliato — chi la chiama
 * deve intercettare l'errore e rispondere con un errore chiaro al client, MAI
 * proseguire fino a un ghPut che scriverebbe sopra un file che non è
 * riuscito a rileggere.
 */
export function parseDropConfig(raw) {
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('src/data/drop.js: nessun oggetto letterale trovato nel sorgente')
  }
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch (e) {
    throw new Error(`src/data/drop.js non è machine-parseable: ${e.message}`)
  }
}

function isPositiveInteger(n) {
  return typeof n === 'number' && Number.isInteger(n) && n > 0
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Valida la FORMA di UNA voce drop — `current` o una delle voci in
 * `scheduled`. Le due condividono esattamente la stessa forma perché il cron
 * promuove una voce programmata copiandola in `current` così com'è (vedi
 * api/_lib/drop-schedule.js): regole diverse fra le due significherebbero
 * poter salvare dal pannello un drop futuro che diventa un `current` invalido
 * il giorno della promozione, cioè un prebuild rotto su un file scritto da un
 * cron alle 08:00 con nessuno a guardare.
 *
 * `label` finisce nel messaggio d'errore ("current.cap", "scheduled[1].cap")
 * così l'admin sa QUALE drop rifiutare, non solo quale campo.
 */
export function validateDropEntry(c, label = 'current') {
  if (!isPlainObject(c)) return { ok: false, error: `${label} is required and must be an object` }

  if (typeof c.id !== 'string' || !c.id.trim()) {
    return { ok: false, error: `${label}.id is required` }
  }
  if (!Number.isInteger(c.number)) {
    return { ok: false, error: `${label}.number must be an integer` }
  }
  if (typeof c.title !== 'string' || !c.title.trim()) {
    return { ok: false, error: `${label}.title is required` }
  }
  if (!Array.isArray(c.productIds) || !c.productIds.every((id) => typeof id === 'string')) {
    return { ok: false, error: `${label}.productIds must be an array of strings` }
  }

  const startsAt = Date.parse(c.startsAt)
  if (!Number.isFinite(startsAt)) {
    return { ok: false, error: `${label}.startsAt must be a parseable date` }
  }
  const endsAt = Date.parse(c.endsAt)
  if (!Number.isFinite(endsAt)) {
    return { ok: false, error: `${label}.endsAt must be a parseable date` }
  }
  if (!(startsAt < endsAt)) {
    return { ok: false, error: `${label}.startsAt must be before ${label}.endsAt` }
  }

  // Mai una stringa numerica ("20") o un float (1.5) accettati per coercizione:
  // sarebbero silenziosamente sbagliati altrove (capFor, il gate del checkout).
  if (!isPositiveInteger(c.cap)) {
    return { ok: false, error: `${label}.cap must be a positive integer` }
  }
  // Un prezzo 0 (o negativo) non è "gratis" per errore di forma: DropTab fa
  // `parseInt(v, 10) || 0`, quindi un admin che svuota il campo e salva scrive
  // silenziosamente dropPrice: 0 — la vetrina mostra €0.00 e Stripe arrotonda
  // comunque al minimo di 50 centesimi, cioè una maglietta a €0,50 addebitata
  // diversamente da quanto mostrato. Stesso trattamento di cap sopra:
  // intero positivo, mai una stringa numerica coercibile.
  if (!isPositiveInteger(c.dropPrice)) {
    return { ok: false, error: `${label}.dropPrice must be a positive integer` }
  }
  if (!isPositiveInteger(c.bundlePrice)) {
    return { ok: false, error: `${label}.bundlePrice must be a positive integer` }
  }

  if (!isPlainObject(c.caps)) {
    return { ok: false, error: `${label}.caps must be an object` }
  }
  for (const [productId, capOverride] of Object.entries(c.caps)) {
    if (!isPositiveInteger(capOverride)) {
      return { ok: false, error: `${label}.caps.${productId} must be a positive integer` }
    }
  }

  // heroImages è opzionale — assente del tutto per i drop creati prima di questo
  // campo, o per un admin che non ha ancora scelto un hero per nessuno dei tre
  // pezzi. Quando c'è, ogni voce deve essere una stringa non vuota (un URL o un
  // path relativo come quelli già in product.images): mai un booleano, un numero
  // o una stringa vuota che DropPanels finirebbe per passare a <img src>.
  if (c.heroImages !== undefined) {
    if (!isPlainObject(c.heroImages)) {
      return { ok: false, error: `${label}.heroImages must be an object` }
    }
    for (const [productId, url] of Object.entries(c.heroImages)) {
      if (typeof url !== 'string' || !url.trim()) {
        return { ok: false, error: `${label}.heroImages.${productId} must be a non-empty string` }
      }
    }
  }

  return { ok: true }
}

/**
 * Valida la FORMA minima di una configurazione drop prima di scriverla —
 * non la business logic (es. non controlla che i productIds esistano
 * davvero nel catalogo). Unica definizione delle regole, usata sia da
 * save-drop (api/admin.js) sia da scripts/test-drop-config.js, così le due
 * non possono divergere.
 *
 * Perché conta: un payload che scrive con successo ma non supera queste
 * regole passa comunque il prossimo `npm run prebuild` (che chiama
 * scripts/test-drop-config.js sullo stesso file) — bloccando ogni deploy
 * successivo finché qualcuno non ripara src/data/drop.js a mano via git, un
 * vicolo cieco per un admin che passa solo dal pannello. save-drop deve
 * rifiutare PRIMA di scrivere, non lasciare che il prebuild lo scopra dopo.
 *
 * Un cap non positivo è un caso a parte, non solo "sbagliato": capFor() lo
 * ritorna così com'è, e checkDropGate legge `total > cap`. Con cap 0
 * (illimitato, contatore nascosto) o negativo (`total > cap` vero per
 * qualunque quantità ≥ 1) il checkout per quel prodotto va in 409
 * permanentemente — nessuna build fallisce ad avvisare, perché tutto era
 * "sintatticamente" a posto. Per questo cap e ogni override in `caps` deve
 * essere un intero positivo, mai una stringa numerica coercibile.
 *
 * Ritorna { ok: true } oppure { ok: false, error } col nome del campo
 * incriminato nel messaggio.
 */
export function validateDropConfig(cfg) {
  if (!isPlainObject(cfg)) return { ok: false, error: 'drop config must be an object' }

  const currentCheck = validateDropEntry(cfg.current, 'current')
  if (!currentCheck.ok) return currentCheck

  // ── scheduled — i drop futuri, in attesa di promozione ────────────────────
  // Assente = valido: ogni drop config scritto prima dello scheduling deve
  // restare accettabile senza modifiche (retrocompatibilità, come heroImages).
  // Quando c'è, ogni voce ha ESATTAMENTE la stessa forma di `current`: il cron
  // la promuove copiandola in `current` così com'è, quindi una voce che non
  // passerebbe queste regole diventerebbe un `current` invalido — e a quel
  // punto il prossimo `npm run prebuild` fallirebbe su un file scritto da una
  // macchina, di notte, senza nessuno a guardare. Si rifiuta al salvataggio.
  if (cfg.scheduled !== undefined) {
    if (!Array.isArray(cfg.scheduled)) {
      return { ok: false, error: 'scheduled must be an array' }
    }
    for (let i = 0; i < cfg.scheduled.length; i++) {
      const entryCheck = validateDropEntry(cfg.scheduled[i], `scheduled[${i}]`)
      if (!entryCheck.ok) return entryCheck
    }

    // Gli id devono essere unici fra current e scheduled. Il registro vendite
    // (api/_lib/drop-sales.js) è indicizzato per `current.id`: due drop che
    // condividono un id condividerebbero anche i contatori, e il secondo
    // aprirebbe con i pezzi del primo già "venduti" — quindi sold-out al
    // primo checkout, senza che niente lo segnali. Nota: `previous` non
    // conserva l'id del drop chiuso, quindi qui si può controllare solo la
    // collisione fra current e i programmati; è comunque il caso che un
    // pannello admin può davvero produrre (duplicare una voce e cambiarle
    // solo la data).
    const ids = [cfg.current.id, ...cfg.scheduled.map((e) => e.id)]
    const seen = new Set()
    for (const id of ids) {
      if (seen.has(id)) {
        return { ok: false, error: `drop id duplicato: "${id}" — ogni drop deve avere un id unico (il registro vendite è indicizzato per id)` }
      }
      seen.add(id)
    }
  }

  if (!Array.isArray(cfg.released) || !cfg.released.every((id) => typeof id === 'string')) {
    return { ok: false, error: 'released must be an array of strings' }
  }

  if (!isPositiveInteger(cfg.archivePrice)) {
    return { ok: false, error: 'archivePrice must be a positive integer' }
  }

  return { ok: true }
}
