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
