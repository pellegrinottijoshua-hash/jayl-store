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
    "id": "drop-05",
    "number": 5,
    "title": "LEGENDARY",
    "productIds": [
      "entei-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him",
      "cool-suicune-back-shirt",
      "raikou-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-electric-pokemon-gift-for-him"
    ],
    "startsAt": "2026-09-24T16:00:00Z",
    "endsAt": "2026-09-29T16:00:00Z",
    "cap": 20,
    "caps": {},
    "dropPrice": 2200,
    "bundlePrice": 5700,
    "heroImages": {
      "raikou-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-electric-pokemon-gift-for-him": "/images/raikou-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-electric-pokemon-gift-for-him/hf_20260827_162124_925c2ff3-1afd-4c4c-a1d4-69599a07afbb.png",
      "cool-suicune-back-shirt": "/images/cool-suicune-back-shirt/hf_20260829_174020_a35373b4-93e5-4e12-bb52-2093515ecfa8.png",
      "entei-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him": "/images/entei-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him/hf_20260828_225151_b4573516-1cd4-4a9b-a6e1-0b61620876d9.png"
    },
    "defaults": {
      "raikou-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-electric-pokemon-gift-for-him": {
        "color": "black"
      },
      "cool-suicune-back-shirt": {
        "color": "navy"
      },
      "entei-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him": {
        "color": "cardinal-red"
      }
    }
  },
  "previous": {
    "number": 4,
    "title": "ICONIC",
    "productIds": [
      "cool-arcanine-back-shirt",
      "blastoise-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
      "cool-vileplume-back-t-shirt"
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
    },
    {
      "id": "drop-02",
      "number": 2,
      "title": "SLEEP MODE",
      "productIds": [
        "cool-snorlax-back-t-shirt",
        "altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him",
        "ursaring-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him"
      ],
      "startsAt": "2026-09-09T16:00:00Z",
      "endsAt": "2026-09-13T16:00:00Z"
    },
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
      "endsAt": "2026-09-19T16:00:00Z"
    },
    {
      "id": "drop-04",
      "number": 4,
      "title": "ICONIC",
      "productIds": [
        "cool-arcanine-back-shirt",
        "blastoise-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
        "cool-vileplume-back-t-shirt"
      ],
      "startsAt": "2026-09-19T16:00:00Z",
      "endsAt": "2026-09-24T16:00:00Z"
    }
  ],
  "scheduled": [],
  "next": null,
  "released": [
    "cool-mewtwo-back-t-shirt",
    "cool-charizard-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
    "psyduck-pok-mon-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
    "cool-snorlax-back-t-shirt",
    "altaria-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him",
    "ursaring-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him",
    "cool-ditto-back-t-shirt",
    "cool-slowpoke-back-t-shirt",
    "kangaskhan-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
    "cool-arcanine-back-shirt",
    "blastoise-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
    "cool-vileplume-back-t-shirt"
  ],
  "archivePrice": 2500
}
