# STATO — jayl.store

Aggiornato: 2026-11-15 da Troy (Zack the Duck diventa la facciata). Diagnosi di ottobre: `~/Desktop/jayl streetwear/DIAGNOSI-STORE-2026-10-30.md`.

## A che punto siamo
- **Due mondi (15/11, branch locale `zack-natale`, NON pushato):** `/` = Zack the Duck (header, footer e palette nero/panna/oro suoi), `/jayl` = lo store JAYL di prima (drop, NEW, Pokémon). Porta neutra: «JAYL Art Collection» nell'hamburger e il segno JAYL in fondo al footer, aperta con un battito degli occhi. Logica in `src/lib/world.js`; il mondo segue l'indirizzo e, per le schede, `section: 'zack'`.
- **Home Zack** (`src/pages/ZackHomePage.jsx`): gli occhi della home-occhi (`src/components/zack/ZackEyes.jsx`, dati rigenerabili con `node scripts/zack-eyes-sync.mjs`), poi i 3 capi su nero in rotazione (gli occhi guardano il capo attivo), poi i video A/C/D muti in loop. IG, YT e TikTok di Zack nell'header. Meta e anteprima OG di `/` ora sono Zack (`public/zack/og-zack.jpg`).
- **Capi Zack:** `zack-the-duck-tee` (Gildan 5000, 25), `-crewneck` (18000, 39), `-hoodie` (18500, 49). Stesso numero in € e $ come il resto dello store. Rilasciati in `drop.js` (`archivePrice`). Stampa solo davanti: simbolo panna #F5F0E8 largo ~24 cm, file 3661×4843 in `public/designs/zack-the-duck-*/design.png`. Foto provvisorie da `zack the duck/merch/video-14nov/` (C3, A6, A7) + una foto della stampa.
- **Protezioni:** finché un capo non ha il prodotto Gelato collegato, il checkout lo rifiuta (409, `create-payment-intent.js`) e `npm run build` si ferma (`check-print-files`). Niente Pokémon nelle schede Zack (via lati Back/Front, disclaimer fan art, «Recently viewed» filtrato per mondo).
- **Admin:** sezione `zack` (si imposta da sola scegliendo la collezione «Zack the Duck»); per i capi Zack spariscono i ruoli B/F. Guide taglie Gildan 5000/18500/18000 in `sizeGuides.js` (lunghezza e petto, da ricontrollare sulla scheda Gelato).
- **Drop JAYL:** drop 11 (Lugia, Celebi, Ho-Oh) fino al 17/11, ora su `/jayl`. Ad pronti in `pubblicazione/da-troy/bozze/`. Video Etsy in `etsy video/_ditto/2026-11-10/`.
- **Misure:** Umami senza cookie (via API da cloud.umami.is in Chrome). GA4 e pixel Meta solo con consenso.

## Numeri (Umami, ottobre)
- 300 visitatori (USA 184, Italia 100), 4 carrelli, 3 checkout, vendite vere 0. Test B (ads verso la scheda) meglio del test A (verso la home): 30 s contro 6 s a visita.

## Prossimi passi
1. **Joshua, 16/11:** crea su Gelato i 3 capi neri (Gildan 5000, 18500, 18000, solo davanti, file `design.png` del capo) e passa a Troy i 3 UUID. I capi non sono ancora su main, quindi l'admin di produzione non li vede: Troy collega varianti e mockup in locale (serve `GELATO_API_KEY`, da `vercel env pull` in un file a parte, con l'ok di Joshua).
2. **Troy:** dopo il punto 1, prova di checkout con le chiavi Stripe **test** (in `.env.local` oggi ci sono le live) e `vercel dev`; controllo prezzi Gelato sul nero e margini; `npm run build` deve passare.
3. **Joshua decide:** sconto Black Friday −20% (codice o prezzo), poi ok a merge, push e deploy (`/sync-main`, `/verify-live`). Ads Zack separate da quelle Pokémon, solo verso `/`.

## Bloccato da
- TikTok a 1 clic: serve l'app TikTok approvata.
