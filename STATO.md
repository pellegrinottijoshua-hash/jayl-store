# STATO — jayl.store

Aggiornato: 2026-09-30 notte da Troy (Umami acceso, drop 6, kit scatti).

## A che punto siamo
- **Negozio:** online su www.jayl.store. Drop a 22 € (3 insieme 57 €), archivio a 25 € per tutti. Spedizione gratuita.
- **Drop:** 5 usciti, 0 vendite reali. Il drop 5 chiude il **1/10 alle 18:00**.
- **Drop 6 SHINY** (Gyarados, Charizard, Dragonite) parte il 1/10.
  - Joshua carica i prodotti e lo programma nel tab Drop.
  - Oggi a catalogo c'è solo lo Shiny Charizard.
- **Ads Meta** (9-30/9): circa 31 € per circa 160 clic, 0,19 € a clic. Portavano alla home.
- **Cosa misura il sito:**
  - **Umami** (cloud.umami.is, piano gratuito), senza cookie. Eventi `view-product`, `add-to-cart`, `checkout`, `purchase` e UTM. Il codice è live.
  - ⚠️ La CSP in `vercel.json` bloccava lo script: la correzione è committata ma va pushata.
  - **GA4** e il **pixel Meta** contano solo chi accetta il banner.
- **Velocità:** foto in WebP. La home è passata da 8,6 MB a 330 KB, la scheda da 8,7 MB a 430 KB.
- **Kit:**
  - `~/Desktop/jayl streetwear/pokemon prompts /KIT-SCATTI.md`: 6 master prompt NBP e 16 test Pomelli;
  - `HERO-MAGLIA-VIVA.md`: video Kling di 3 s, dalla maglia al Pokémon vero.

## Prossimi 3 passi
1. **Pushare la CSP e verificare** su Umami che arrivino visite ed eventi.
2. **Drop 6:** prodotti in admin, testi con "€22 until {giorno}" (niente "closes" né "only 20").
   - Test Kling: HERO sul Dragonite.
   - Pomelli: giorno 1 del test.
3. **UTM ovunque:**
   - link in bio `?utm_source=instagram&utm_medium=bio`;
   - ads con `utm_content` uguale al formato, e link diretto alla scheda.

## Bloccato da
- **Metriche social:** l'admin pubblica ma non le legge.
  - Serve una lettura degli insights di Instagram (lavoro tecnico).
  - Nel frattempo: screenshot degli insights da Joshua.

## Numeri
- Drop usciti: 5. Vendite reali: 0. Instagram @jayl_store: 37 follower (30/9).
- Umami: da leggere la prima domenica dopo il drop 6.
