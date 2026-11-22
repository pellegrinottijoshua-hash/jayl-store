# STATO — jayl.store

Aggiornato: 2026-11-22 da Troy (split dei domini: zacktheduck.com online). Diagnosi di ottobre: `~/Desktop/jayl streetwear/DIAGNOSI-STORE-2026-10-30.md`.

## A che punto siamo
- **Due domini, un progetto Vercel:** zacktheduck.com = solo Zack, www.jayl.store = solo JAYL (home Pokémon su `/`). Il mondo lo sceglie il dominio (`src/lib/world.js`, `SITE`); redirect per host in `vercel.json` (www, schede/collezioni dell'altro mondo, `/jayl`). Admin unico su jayl.store/admin (zacktheduck.com/admin ci rimanda). Stripe, API e catalogo in comune; carrelli separati per dominio. DNS zacktheduck.com su Cloudflare (A → 76.76.21.21, proxy spento). In locale: launch `site-zack` / `site-jayl`.
- **Home Zack** (`src/pages/ZackHomePage.jsx`): occhi = testa, manichino = corpo. Sotto il capo solo «T-SHIRT €25» (niente Shop, tab, flash). Tocco sul capo = occhiolino veloce dal lato del tocco, poi la scheda. Swipe/frecce: gli occhi seguono e basta. ↺ su ogni capo = la 2ª foto della scheda (lato liscio R1–R4). Felpa: pillola «PRINT FRONT · BACK» sul capo (parte da BACK) → 4 viste; la scheda si apre sempre sulla copertina della versione. Desktop: tre posizioni in profondità, swipe a due dita. Saluto = occhiolino lento con la testa che rimbalza (1 volta a visita) e ogni tanto da fermo.
- **Occhiolino** (`ZackEyes.jsx`, scelto sulle prove `runs/zack-occhiolino/`): pupille in camera, poi le due palpebre di un occhio al centro. A = solo quello (social), B = l'altro socchiude (clic sul capo), C = testa che rimbalza (saluto, lento). Social: schermo nero, occhiolino veloce, poi il link.
- **Video:** brand al centro, le 7 presentazioni del cast ai lati che scorrono (mobile: fila sotto), tocco = voce; icona ♪ = sigla (`public/zack/audio/sigla.mp3`, 1,7 MB, solo al tocco). Cast in `public/zack/video/cast/` (1,6 MB in tutto, 480p).
- **Admin:** riquadro «# Galleria — ordine in scheda» nel pannello Hero (trascina, ◀ 2ª ▶; con F/B conta per lato). Sequenza riconosciuta per nome file (prima i path locali risultavano fuori sequenza). F/B attivi anche per la felpa Zack.
- **Natale:** riga d'oro «Order by 12 Dec for Christmas» sotto Free shipping, sparisce da sola il 13/12 (`--zk-xmas` alza scheda, collezione e home). **Cookie Zack:** «Zack doesn't care about cookies.» / «Fine.».
- **Capi Zack su Gelato:** tee 25 (64000 S–XL), felpa 49 (18500 S–3XL, Front/Back, `gco_black`), girocollo 39 (18000 S–5XL); etichetta colletto su tutti. Controllo: `node scripts/check-zack-orders.mjs` (OK il 16/11).
- **Drop JAYL:** drop 11 fino al 17/11 su `/jayl`. Misure: Umami senza cookie; GA4 e pixel Meta solo con consenso.

## Prossimi 3 passi
1. **Joshua, entro il 29/11:** rinnovare il token GitHub `jayl-store-admin` e incollarlo in Vercel → `GITHUB_TOKEN`, poi redeploy (senza, l'admin non salva).
2. **Joshua:** Stripe → Payment method domains → aggiungere zacktheduck.com (Apple/Google Pay); sconto Black Friday −20% (27/11–1/12). Da fare: anteprima social della home jayl.store mostra ancora i meta di Zack; mail ordini Zack ancora firmate JAYL. (Fondo delle R1–R4 portato a #111111 il 16/11: niente più riquadro in home.)
3. **Natale:** prime 20–50 vendite: ads piccole verso le schede, regalo «per l'amico mai impressionato», scadenza 12/12, mail, Zack anche su Etsy.

## Bloccato da
- TikTok a 1 clic: serve l'app TikTok approvata.

## Numeri (Umami, ottobre)
- 300 visitatori (USA 184, Italia 100), 4 carrelli, 3 checkout, vendite vere 0. Ads verso la scheda meglio che verso la home (30 s contro 6 s a visita).
