# STATO — jayl.store

Aggiornato: 2026-11-16 da Troy (Zack online; felpa Front/Back, scena desktop, occhiolino). Diagnosi di ottobre: `~/Desktop/jayl streetwear/DIAGNOSI-STORE-2026-10-30.md`.

## A che punto siamo
- **Due mondi (online dal 16/11):** `/` = Zack the Duck (header, footer e palette nero/panna/oro suoi), `/jayl` = lo store JAYL di prima (drop, NEW, Pokémon). Porte nei due menu (vedi sotto) e il segno JAYL in fondo al footer Zack; verso JAYL gli occhi fanno un battito. Logica in `src/lib/world.js`; il mondo segue l'indirizzo e, per le schede, `section: 'zack'`.
- **Home Zack** (`src/pages/ZackHomePage.jsx`): occhi grandi in alto (la testa) e sotto i capi (il corpo), carosello infinito; allo swipe le pupille fanno un balzo, dopo 3 swipe di fila occhi a spirale e testa che scuote; flash dei mockup su fondo nero (`homeImages`: hover desktop, un giro al centro su mobile); luccichio d'oro uno alla volta: scritta, poi IG, YT, TikTok a 3-4 s (`useGoldTurn` in `ZackNavbar.jsx`). Sotto, badge Etsy e un solo video 9:16 coi tre clip (`public/zack/video/zack-spotted.mp4`, audio a richiesta). Desktop: occhi in alto, tee sotto, felpa e girocollo ai lati; occhiolino al passaggio sul capo. Mobile: pupille che seguono fluide il capo nel carosello (niente dito). Prompt in `docs/zack-mockup-prompts.md`: 5 mockup + 3 lifestyle × 4 versioni. Occhi (`src/components/zack/ZackEyes.jsx`, dati da `node scripts/zack-eyes-sync.mjs`), subito sotto i 3 capi in rotazione senza titoli (gli occhi guardano il capo attivo), badge Etsy 4.9, «Spotted.» coi video A/C/D, footer «Watch Zack on». Menu Zack: Tee, Hoodie, Crewneck, «What else?» col segno JAYL oro → `/jayl`. Menu JAYL: objects, zack (col segno, `ZackMark.jsx`; nella barra solo da tablet in su), artist's, Wishlist. Meta e anteprima OG di `/` ora sono Zack (`public/zack/og-zack.jpg`).
- **Capi Zack collegati a Gelato (16/11):** tee `21178c71…` Gildan 64000 S–XL 25; girocollo `683f685f…` 18000 S–5XL 39; felpa `a9f73a56…` 18500 S–3XL 49. Tutti `gpr_4-0` + etichetta interna `public/designs/zack-neck-label.png`. **Felpa:** su Gelato è Dark Chocolate; gli ordini partono già col codice nero (`gco_black`, verificato), ma il prodotto in dashboard va corretto per i mockup. Foto: lifestyle AI + mockup Gelato (bianchi, solo in scheda) + stampa. **Felpa Front/Back (16/11):** stesso prodotto, in scheda si sceglie il lato; il retro parte con `gpr_0-4` (verificato) e `design-back.png` (simbolo ~28 cm). Tee: copertina e flash = 3 mockup NBP su nero.
- **Protezioni:** finché un capo non ha il prodotto Gelato collegato, il checkout lo rifiuta (409, `create-payment-intent.js`) e `npm run build` si ferma (`check-print-files`). Niente Pokémon nelle schede Zack (via lati Back/Front, disclaimer fan art, «Recently viewed» filtrato per mondo).
- **Admin:** sezione `zack` (si imposta da sola scegliendo la collezione «Zack the Duck»); per i capi Zack spariscono i ruoli B/F. Guide taglie Gildan 5000/18500/18000 in `sizeGuides.js` (lunghezza e petto, da ricontrollare sulla scheda Gelato).
- **Drop JAYL:** drop 11 (Lugia, Celebi, Ho-Oh) fino al 17/11, ora su `/jayl`. Ad pronti in `pubblicazione/da-troy/bozze/`. Video Etsy in `etsy video/_ditto/2026-11-10/`.
- **Misure:** Umami senza cookie (via API da cloud.umami.is in Chrome). GA4 e pixel Meta solo con consenso.

## Numeri (Umami, ottobre)
- 300 visitatori (USA 184, Italia 100), 4 carrelli, 3 checkout, vendite vere 0. Test B (ads verso la scheda) meglio del test A (verso la home): 30 s contro 6 s a visita.

## Prossimi passi
1. **Joshua:** mockup NBP con `docs/zack-mockup-prompts.md` (REF-3 colletto solo in 01, 06, 07) → `jayl streetwear/zack mockup/<capo>/01..10.png`; Troy li mette in `homeImages` e in galleria. Felpa nera su Gelato.
2. **Prova d'acquisto vera** (chiavi Stripe live): un ordine Zack e rimborso, poi controllare in Gelato codice nero, stampa davanti, etichetta colletto.
3. **Joshua decide:** sconto Black Friday −20% (codice o prezzo); ads Zack separate dalle Pokémon, verso `/`.

## Bloccato da
- TikTok a 1 clic: serve l'app TikTok approvata.
