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
    "id": "drop-08",
    "number": 8,
    "title": "EEVEES",
    "productIds": [
      "cool-sylveon-t-shirt",
      "cool-leafeon-t-shirt",
      "cool-glaceon-t-shirt"
    ],
    "startsAt": "2026-10-12T16:00:00Z",
    "endsAt": "2026-10-22T16:00:00Z",
    "cap": 20,
    "caps": {},
    "dropPrice": 1999,
    "bundlePrice": 4999,
    "heroImages": {},
    "defaults": {},
    "heroVideos": {
      "cool-sylveon-t-shirt": "/images/cool-sylveon-t-shirt/home-1791907067310.mp4"
    }
  },
  "previous": {
    "number": 7,
    "title": "ANCIENT",
    "productIds": [
      "rampardos-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-rock-pokemon-gift-for-him",
      "cool-kabutops-t-shirt",
      "aerodactyl-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-rock-pokemon-gift-for-him"
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
    },
    {
      "id": "drop-05",
      "number": 5,
      "title": "LEGENDARY",
      "productIds": [
        "entei-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him",
        "cool-suicune-back-shirt",
        "raikou-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-electric-pokemon-gift-for-him"
      ],
      "startsAt": "2026-09-24T16:00:00Z",
      "endsAt": "2026-10-01T16:00:00Z"
    },
    {
      "id": "drop-06",
      "number": 6,
      "title": "SHINY",
      "productIds": [
        "gyarados-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-water-pokemon-gift-for-him",
        "shiny-dragonite-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him",
        "shiny-charizard-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-fire-pokemon-gift-for-him"
      ],
      "startsAt": "2026-10-01T16:00:00Z",
      "endsAt": "2026-10-07T16:00:00Z"
    },
    {
      "id": "drop-07",
      "number": 7,
      "title": "ANCIENT",
      "productIds": [
        "rampardos-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-rock-pokemon-gift-for-him",
        "cool-kabutops-t-shirt",
        "aerodactyl-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-rock-pokemon-gift-for-him"
      ],
      "startsAt": "2026-10-07T16:00:00Z",
      "endsAt": "2026-10-12T16:00:00Z"
    }
  ],
  "scheduled": [
    {
      "id": "drop-09",
      "number": 9,
      "title": "DAY & NIGHT",
      "productIds": [
        "cool-eevee-t-shirt",
        "umbreon-t-shirt-dark-type-pok-mon-fan-art-tee-gamer-gift",
        "cool-espeon-t-shirt"
      ],
      "startsAt": "2026-10-22T16:00:00Z",
      "endsAt": "2026-10-28T16:00:00Z",
      "cap": 20,
      "caps": {},
      "dropPrice": 2000,
      "bundlePrice": 4999,
      "heroImages": {},
      "defaults": {
        "umbreon-t-shirt-dark-type-pok-mon-fan-art-tee-gamer-gift": {
          "color": "black"
        },
        "cool-eevee-t-shirt": {
          "color": "white"
        },
        "cool-espeon-t-shirt": {
          "color": "black"
        }
      },
      "defaultSide": "front",
      "heroVideos": {}
    }
  ],
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
    "cool-vileplume-back-t-shirt",
    "entei-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-pokemon-gift-for-him",
    "cool-suicune-back-shirt",
    "raikou-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-electric-pokemon-gift-for-him",
    "gyarados-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-water-pokemon-gift-for-him",
    "shiny-dragonite-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-dragon-pokemon-gift-for-him",
    "shiny-charizard-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-fire-pokemon-gift-for-him",
    "rampardos-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-rock-pokemon-gift-for-him",
    "cool-kabutops-t-shirt",
    "aerodactyl-back-print-shirt-funny-retro-90s-anime-graphic-tee-large-back-design-unisex-cotton-t-shirt-rock-pokemon-gift-for-him"
  ],
  "archivePrice": 2499
}
