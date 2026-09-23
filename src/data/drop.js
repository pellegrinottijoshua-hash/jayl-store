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
    "id": "drop-04",
    "number": 4,
    "title": "ICONIC",
    "productIds": [
      "cool-arcanine-back-shirt",
      "blastoise-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000",
      "cool-vileplume-back-t-shirt"
    ],
    "startsAt": "2026-09-19T16:00:00Z",
    "endsAt": "2026-09-24T16:00:00Z",
    "cap": 20,
    "caps": {},
    "dropPrice": 2200,
    "bundlePrice": 5700,
    "heroImages": {
      "cool-arcanine-back-shirt": "/images/cool-arcanine-back-shirt/hf_20260904_142002_f3b2b89e-4334-4afa-8016-d2931d2d5310.png",
      "blastoise-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000": "/images/blastoise-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000/hf_20260904_152245_967412b1-adc0-4cd5-8815-9b66ad07fe4a.png",
      "cool-vileplume-back-t-shirt": "/images/cool-vileplume-back-t-shirt/hf_20260907_115923_f5785daa-be32-4143-953c-c74549e04aa4.png"
    },
    "defaults": {
      "cool-arcanine-back-shirt": { "color": "red", "size": "M" },
      "blastoise-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000": { "color": "royal", "size": "M" },
      "cool-vileplume-back-t-shirt": { "color": "military-green", "size": "M" }
    }
  },
  "previous": {
    "number": 3,
    "title": "NO RUSH",
    "productIds": [
      "cool-ditto-back-t-shirt",
      "cool-slowpoke-back-t-shirt",
      "kangaskhan-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000"
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
    "kangaskhan-pok-mon-back-t-shirt-cool-anime-fan-art-gift-retro-90s-style-funny-pok-mon-lover-gift-gildan-64000"
  ],
  "archivePrice": 2500
}
