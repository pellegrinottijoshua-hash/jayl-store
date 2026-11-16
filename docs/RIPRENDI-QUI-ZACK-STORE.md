# RIPRENDI QUI — Zack the Duck su jayl.store

Scritto da Troy il 2026-11-16, a fine di una sessione lunga. Una sessione nuova parte da qui (poi `STATO.md`).

## In una riga
Da 15–16/11 jayl.store apre su **Zack the Duck** (la IP di punta di JAYL): home «Zack si veste» con 3 capi (tee, felpa Front/Back, girocollo) collegati a Gelato e vendibili. Lo store JAYL (Pokémon, drop) è su `/jayl`. Obiettivo: vendere per Natale e far crescere Zack come brand.

## Cosa è online (main; il giro del 16/11 sotto è pushato dopo l'ok di Joshua)
- **Due mondi** (`src/lib/world.js`): `/` e schede `section: 'zack'` = Zack (header, footer, palette #111111 / #F5F0E8 / #C4A35A, font Montserrat via `html[data-world=zack]`); il resto = JAYL. Porte nei menu: «What else?» + segno JAYL oro (Zack → `/jayl`), voce «zack» col simbolo (JAYL → `/`).
- **Home** `src/pages/ZackHomePage.jsx`: occhi (`src/components/zack/ZackEyes.jsx`, motore della home-occhi; dati da `node scripts/zack-eyes-sync.mjs`) = testa; manichino del capo = corpo; swipe/tab/frecce cambiano capo; felpa ↺. Poi badge Etsy, video unico 9:16 (`public/zack/video/zack-spotted.mp4`), perks.
- **Header**: luccichio d'oro uno alla volta (scritta, poi IG, YT, TikTok, 3–4 s), mai menu/carrello (`useGoldTurn` in `ZackNavbar.jsx`).
- **Popup email Zack** (`EmailCapturePopup.jsx`, prop `zack`). **Guide taglie** 64000 / 18500 / 18000 (`src/data/sizeGuides.js`).
- **Admin**: sezione `zack`, ruoli B/F nascosti per Zack, bottone «🦆 Logo Zack» nel colletto.

## Dati da non rompere
- Capi (`src/data/admin-products.js`, rilasciati in `drop.js` → `released`, prezzo = `archivePrice`):
  - `zack-the-duck-tee` 25 €, Gildan 64000, S–XL, Gelato `21178c71-24f8-4296-a94a-ead145d8f8c2`;
  - `zack-the-duck-hoodie` 49 €, Gildan 18500, S–3XL, Gelato `a9f73a56-0b9b-4cb1-92bc-5a71aae6a9c2`. **Varianti `gco_black`** (Joshua ha confermato il nero). Front = `design.png`, Back = `altPrintFileUrl` = `design-front.png` (nome dato dall'admin, è il RETRO). Ordine retro → `gpr_0-4`.
  - `zack-the-duck-crewneck` 39 €, Gildan 18000, S–5XL, Gelato `683f685f-417b-48b1-af04-961a1b3028c1`.
  - Tutti: `inlbl` → `neckLabelUrl` = `public/designs/zack-neck-label.png`.
- Foto: `image` = manichino M1; `images` = galleria; `homeImages` = mockup su nero per la home; felpa `imageSides` front/back (in scheda Front e Back mostrano solo le loro).
- Verifica in 1 comando: `node scripts/check-zack-orders.mjs` (deve dire OK).
- Prompt NBP: `docs/zack-mockup-prompts.md` (M1–M5 mockup, L1–L3 lifestyle, R1–R4 lati lisci). Foto in `~/Desktop/zack the duck/merch/{tshirt,girocollo,felpa davanti,felpa dietro}/`.

## Regole
- Push solo con l'ok di Joshua; prima `/sync-main` (l'admin committa su main: risolvere `admin-products.js` tenendo il remoto e riapplicando), dopo `/verify-live`.
- Mai Pokémon nel mondo Zack. Ai clienti mai «drop»: «new». Ads Zack separate dalle Pokémon, verso le schede.

## BUILD DEL 16/11 — FATTO (verificato in locale su telefono e desktop; push solo con l'ok di Joshua)
1. **Occhiolino vero** (`ZackEyes.jsx`, `wink(eye, { style, slow })`): pupille in camera, poi le due palpebre di UN occhio al centro. Prove video e script in `runs/zack-occhiolino/` (`node render.mjs`). Joshua: «usiamo tutti e tre», destro o sinistro dal lato del clic. Regola: **veloce (~0,5 s) quando l'utente aspetta** (clic su capo = B, social = A), **lento (~1 s) quando non aspetta niente** (saluto all'arrivo = C con rimbalzo della testa, 1 volta a visita; da fermo, ogni 5 espressioni).
2. **Occhiolino solo al clic sul capo**, poi la scheda (~0,5 s). Allo swipe gli occhi seguono subito (glance + sguardo sul capo a 220 ms), niente occhiolino.
3. **Mobile:** sotto il capo solo `T-SHIRT €25` (via Shop, tab, scritta swipe, flash). Felpa parte dal retro (`backFrames[0]`), ↺ la gira; occhi aperti anche di spalle.
4. **Desktop:** niente bottoni; clic sul capo al centro, clic sui lati = cambio. Tre posizioni in profondità (centro scala 1, lati 0,6; chi passa da un lato all'altro va dietro al centro). Swipe a due dita (wheel `deltaX`, soglia 60, fermo finché la scia d'inerzia non si spegne). Occhi e capo scalano con l'altezza della finestra.
5. **Social** (`ZackSocials` in `ZackNavbar.jsx`, vale anche per footer e menu): schermo nero, occhiolino veloce dal lato del clic, poi `window.open` (se bloccato, stessa scheda). Cmd-clic e movimento ridotto: link diretto.
7. **Video:** brand al centro, cast ai lati che scorre (`zk-marquee`), mobile fila sotto; parte solo ciò che si vede; tocco = voce. ♪ = sigla. File: `public/zack/video/cast/*.mp4|jpg` (480p), `public/zack/audio/sigla.mp3`.
8. **Banner Natale** in `ZackNavbar.jsx` (`XMAS_END` = 13/12 00:00 Roma), altezza in `--zk-xmas`.
9. **Cookie Zack** (`CookieBanner` prop `zack`): «Zack doesn't care about cookies.» / «Fine.», occhi che sbattono.
6. **Lati lisci R1–R4** (Joshua li ha caricati in admin il 16/11): 2ª foto di ogni scheda (felpa: R3 = F2, R4 = B2). In home ↺ su ogni capo mostra la 2ª foto della scheda (si cambia in admin); felpa con pillola «PRINT FRONT · BACK» (parte da BACK): 4 viste. La scheda si apre sempre sulla copertina. La home legge tutto da `images` + `imageSides` (non da `homeImages`, che alla build non viene rinominato).
- **Admin:** `src/components/admin/GalleryOrder.jsx` nel pannello Hero: ordine della galleria (trascina, ◀ 2ª ▶). La sequenza si confronta per nome file (`mediaKey`).
- Nota per le prove: nel pannello browser nascosto `requestAnimationFrame` è fermo (occhi e framer immobili): verificare le animazioni nel Chrome di chrome-devtools.

## Aperto (Joshua)
- Mockup R1–R4 (lati lisci). Sconto Black Friday −20% (27/11–1/12): codice o prezzo. Dominio `zacktheduck.com`: si collega allo stesso progetto Vercel e apre Zack (porta JAYL nascosta su quel dominio).
- Strategia Natale e futuro di zacktheduck.com: vedi la risposta di Troy del 16/11 riassunta in `STATO.md`.
