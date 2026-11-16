# RIPRENDI QUI — Zack the Duck su jayl.store

Scritto da Troy il 2026-11-16, a fine di una sessione lunga. Una sessione nuova parte da qui (poi `STATO.md`).

## In una riga
Da 15–16/11 jayl.store apre su **Zack the Duck** (la IP di punta di JAYL): home «Zack si veste» con 3 capi (tee, felpa Front/Back, girocollo) collegati a Gelato e vendibili. Lo store JAYL (Pokémon, drop) è su `/jayl`. Obiettivo: vendere per Natale e far crescere Zack come brand.

## Cosa è online (main, ultimo push `f72a7653`)
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

## PROSSIMO BUILD (deciso il 16/11, da fare in quest'ordine)
1. **Occhiolino nuovo**: prima guarda in camera (pupille al centro), poi le due palpebre di UN occhio si chiudono verso il centro (sopra giù, sotto su), come un vero occhiolino. **Fare 3 prove in video** (es. A palpebre al centro; B + l'altro occhio socchiude; C + piccolo rimbalzo della testa), Joshua sceglie. Poi in `ZackEyes.jsx` (`wink`).
2. **Occhiolino solo al clic su un capo** (home): Zack guarda in camera, occhiolino, poi si apre la scheda (~600 ms). **Non** allo swipe: allo swipe gli occhi seguono e basta. Dopo il cambio, l'espressione successiva parte subito (oggi >1 s: togliere i ritardi in `go()`/`lookAtBody`).
3. **Mobile, sotto il capo solo una riga**: `T-SHIRT  €25` (HOODIE, CREWNECK). Via: bottone Shop, tab, «Swipe to change his outfit», flash dei mockup. Solo il manichino. **La felpa parte dal retro**, con ↺ per girarla.
4. **Desktop**: niente bottoni (come Nike): si clicca il capo; sotto solo `CREWNECK  €39`. Swipe a **due dita** (wheel `deltaX`, con soglia e pausa). Cambio capo **fluido in profondità**: il capo nuovo viene avanti dal lato al centro (cresce), quello vecchio torna indietro al lato (rimpicciolisce): tre posizioni che si scambiano, non un fade.
5. **Animazioni occhi ai click**: sui social occhiolino (o occhi che si accendono d'oro / fascio d'oro) prima di aprire il link. Fare proposte nel video del punto 1.
6. **Schede**: la 2ª foto è il lato liscio (R1–R4) quando Joshua li genera, così si capisce che fronte e retro sono separati.
7. **Video**: desktop = video del brand al centro e ai lati le 7 presentazioni 3D scorrevoli; mobile = fila sotto il video. Ordine: Zack, gabbiano, gatto, piccione, tartaruga, falena, formica (`~/Desktop/zack the duck/EPISODI FINITI/Ep3d/presentazioni/presentazione_*.mp4`, da comprimere 480p). **Icona musica** che fa partire la sigla (`~/Desktop/zack the duck/music/sigla.mp3`, 1:46).
8. **Banner «Order by 12 Dec for Christmas»** (sottile, oro, sotto Free shipping).
9. **Cookie banner con una frase alla Zack** nel mondo Zack.

## Aperto (Joshua)
- Mockup R1–R4 (lati lisci). Sconto Black Friday −20% (27/11–1/12): codice o prezzo. Dominio `zacktheduck.com`: si collega allo stesso progetto Vercel e apre Zack (porta JAYL nascosta su quel dominio).
- Strategia Natale e futuro di zacktheduck.com: vedi la risposta di Troy del 16/11 riassunta in `STATO.md`.
