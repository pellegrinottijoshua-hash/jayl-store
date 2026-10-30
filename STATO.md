# STATO — jayl.store

Aggiornato: 2026-10-30 da Troy (diagnosi Umami di ottobre e master per foto vere). Dettagli: `~/Desktop/jayl streetwear/DIAGNOSI-STORE-2026-10-30.md`.

## A che punto siamo
- **Negozio:** www.jayl.store. 19,99 al lancio, poi 24,99 in collezione, i 3 a 49,99. Niente "drop" ai clienti: NEW. 9 drop. Il Drop 9 ha `dropPrice` 2000, cioè $20 invece di $19.99.
- **Drop 9 DAY & NIGHT** (Eevee, Umbreon, Espeon, fronti): 23-28/10, chiuso.
  - Finché il drop resta "current" le schede dicono BACK SOON.
  - Passano alla collezione solo quando in admin si apre il drop nuovo o si chiude questo (`isDropClosed` in `ProductPage.jsx`): con le ads accese va fatto subito.
- **Scheda:** le maglie fronte mostrano un riquadro BACK vuoto e la dicitura "cool pokemon back".
- **Misure:** Umami senza cookie, letto via API dalla sessione di cloud.umami.is in Chrome. GA4 e pixel Meta solo con consenso.
- **Social e video:** 1 clic per Pinterest, IG e FB dall'admin. Kit `~/jayl-motion` (`src/drop8/`, `src/drop9/`), musica Flow in `marketing music/`.
- **Foto per le ads:** `~/Desktop/jayl streetwear/MASTER-FOTO-REALI.md`.
  - 10 master per i fronti e 10 per i retro: direzioni fotografiche libere (luogo, posa e persona cambiano a ogni generazione), tecnica bloccata.
  - Ci sono anche i dadi per variare. Valgono anche per Zack.

## Numeri (Umami, ottobre)
- 300 visitatori (USA 184, Italia 100), 138 schede viste, 4 carrelli, 3 checkout, 1 acquisto (era un test). Vendite vere: 0.
- **Test A 19-22/10** (ads verso la home): 148 visitatori, 6 s a visita, 4 schede viste.
- **Test B 25-29/10** (Umbreon verso la scheda): 75 sessioni, 30 s a visita, 1 carrello abbandonato al checkout. 56 visite su 75 da Facebook; 13 arrivate dopo la chiusura, su BACK SOON.

## Prossimi 3 passi
1. **Joshua:** il drop nuovo a 19,99 dall'admin, con la chiusura del Drop 9; scegliere la maglia eroe del test di novembre.
2. **Troy:** scheda dal telefono e checkout. Prima immagine = il gancio dell'ad; via il BACK vuoto; riga con consegna e "Designed in Venice".
3. **Test di novembre:** 3 ganci dai master più il trio (B10) per il Black Friday (27/11). Solo IG Storie e Reels, si legge in Umami.

## Bloccato da
- TikTok a 1 clic: serve l'app TikTok approvata.
