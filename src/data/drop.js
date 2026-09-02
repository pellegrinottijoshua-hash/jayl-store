// Configurazione del drop corrente. Modificata dal pannello admin (tab Drop),
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
export const drop = {
  "current": {
    "id": "drop-01-sleep-mode",
    "number": 1,
    "title": "SLEEP MODE",
    "productIds": [
      "altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him",
      "cool-snorlax-back-t-shirt",
      "ursaring-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him"
    ],
    "startsAt": "2026-09-05T16:00:00Z",
    "endsAt": "2026-09-08T16:00:00Z",
    "cap": 20,
    "caps": {},
    "dropPrice": 2200,
    "bundlePrice": 5700
  },
  "previous": null,
  "next": {
    "number": 2,
    "startsAt": "2026-09-09T16:00:00Z"
  },
  "released": [],
  "archivePrice": 2500
}
