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
    "title": "ORIGIN",
    "productIds": [
      "cool-mewtwo-back-t-shirt",
      "cool-charizard-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
      "psyduck-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000"
    ],
    "startsAt": "2026-09-05T16:00:00Z",
    "endsAt": "2026-09-08T16:00:00Z",
    "cap": 20,
    "caps": {},
    "dropPrice": 2200,
    "bundlePrice": 5700,
    "heroImages": {
      "cool-mewtwo-back-t-shirt": "/images/images/cool-mewtwo-back-t-shirt/hf_20260902_221831_3b5deca1-89a4-42d6-88a8-bb52d5c82c5b.png",
      "cool-charizard-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000": "/images/images/cool-charizard-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000/c-post-1.png",
      "psyduck-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000": "/images/images/psyduck-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000/hf_20260902_214600_9948bad5-e6e0-4d4d-98cc-5becbeb19d78.png"
    }
  },
  "previous": null,
  "next": {
    "number": 2,
    "startsAt": "2026-09-09T16:00:00Z"
  },
  "released": [],
  "archivePrice": 2500
}
