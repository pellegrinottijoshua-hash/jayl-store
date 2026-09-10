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
    "id": "drop-02",
    "number": 2,
    "title": "SLEEP MODE",
    "productIds": [
      "cool-snorlax-back-t-shirt",
      "altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him",
      "ursaring-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him"
    ],
    "startsAt": "2026-09-09T16:00:00Z",
    "endsAt": "2026-09-13T16:00:00Z",
    "cap": 20,
    "caps": {},
    "dropPrice": 2200,
    "bundlePrice": 5700,
    "heroImages": {
      "cool-snorlax-back-t-shirt": "/images/cool-snorlax-back-t-shirt/s-post-1.png",
      "altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him": "/images/altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him/hf_20260902_160750_689c4c08-c1db-4855-8612-24c038f06a38.png",
      "ursaring-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him": "/images/ursaring-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him/u-post1.png"
    }
  },
  "previous": {
    "number": 1,
    "title": "ORIGIN",
    "productIds": [
      "cool-mewtwo-back-t-shirt",
      "cool-charizard-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
      "psyduck-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000"
    ]
  },
  "past": [
    {
      "id": "drop-01-sleep-mode",
      "number": 1,
      "title": "ORIGIN",
      "productIds": [
        "cool-mewtwo-back-t-shirt",
        "cool-charizard-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
        "psyduck-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000"
      ],
      "startsAt": "2026-09-06T16:00:00Z",
      "endsAt": "2026-09-09T16:00:00Z"
    }
  ],
  "scheduled": [
    {
      "id": "drop-03",
      "number": 3,
      "title": "NO RUSH",
      "productIds": [
        "cool-ditto-back-t-shirt",
        "cool-slowpoke-back-t-shirt",
        "kangaskhan-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000"
      ],
      "startsAt": "2026-09-13T16:00:00Z",
      "endsAt": "2026-09-17T16:00:00Z",
      "cap": 20,
      "caps": {},
      "dropPrice": 2200,
      "bundlePrice": 5700,
      "heroImages": {
        "cool-ditto-back-t-shirt": "/images/cool-ditto-back-t-shirt/hf_20260626_145021_d64d9936-5038-4e94-8060-0910e953a4b0.png",
        "cool-slowpoke-back-t-shirt": "/images/slowpoke-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift/hf_20260629_132411_91169ddf-d023-4498-8189-882dc549ad0a.png",
        "kangaskhan-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000": "/images/kangaskhan-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000/hf_20260627_123012_3dc13ed8-ee97-4278-be2a-798f1db9799b.png"
      }
    }
  ],
  "next": null,
  "released": [
    "cool-mewtwo-back-t-shirt",
    "cool-charizard-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
    "psyduck-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000"
  ],
  "archivePrice": 2500
}
