# STATO — jayl.store

Aggiornato: 2026-09-30 da Troy (analitica, velocità, pixel).

## A che punto siamo
- **Negozio:** online su www.jayl.store (Vercel), admin su `/admin`, Gelato e Stripe. Spedizione gratuita. Le maglie costano 23,99-25 €, la stampa circa 7 €.
- **Drop:** ne sono usciti 5. Vendite a clienti reali: 0.
- **Ads Meta** (9-30 settembre): circa 31 € per circa 160 clic, circa 0,19 € a clic. I link portano alla home, non alla scheda.
- **Cosa misura il sito:**
  - **Umami** conta tutti, senza cookie. Eventi: `view-product`, `add-to-cart`, `checkout`, `purchase`, più le UTM. Il codice è pronto ma è **spento finché non si inserisce il Website ID** (`window.__jaylUmamiId` in `index.html`). I numeri si leggono su cloud.umami.is: Events, UTM, Attribution.
  - **GA4** conta solo chi accetta il banner.
  - **Pixel Meta** (ViewContent, AddToCart, InitiateCheckout, Purchase): funziona solo dopo il consenso.
- **Velocità** (30/09): le foto passano in WebP alla build. Home da ~8,6 MB a ~330 KB di immagini, scheda da ~8,7 MB a ~430 KB.
- **Fiducia:** è stato tolto il contatore finto "N people viewing right now".

## Prossimi 3 passi
1. **Accendere Umami:** Joshua crea l'account gratuito e passa il Website ID a Troy.
2. **Nelle ads Meta, parametri URL:** `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`.
3. **Provare 3 angoli creativi** da 5 € l'uno (piano di Brandy, da approvare). Valutare anche di mandare le ads sulla scheda e non sulla home.

## Bloccato da
- Il Website ID di Umami: senza, il percorso dopo il clic non si vede.

## Numeri
- Drop usciti: 5. Vendite reali: 0. Ads: circa 31 € per circa 160 clic.
