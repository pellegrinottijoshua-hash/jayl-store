# STATO — jayl.store

Aggiornato: 2026-09-30 notte da Troy (Umami verificato, hero Kling, ricetta Ditto drop 6).

## A che punto siamo
- **Negozio:** www.jayl.store. Drop a 22 € (3 insieme 57 €), archivio a 25 €. Spedizione gratuita. 5 drop usciti, 0 vendite reali.
- **Drop 6 SHINY** (Gyarados, Charizard, Dragonite) il 1/10, quando il drop 5 chiude alle 18:00. A catalogo c'è solo lo Shiny Charizard.
- **Ads Meta** (9-30/9): circa 31 € per circa 160 clic, 0,19 € a clic. Portavano alla home.
- **Cosa misura il sito:**
  - **Umami** (cloud.umami.is, gratuito, senza cookie): `view-product`, `add-to-cart`, `checkout`, `purchase` e UTM. **Verificato live il 30/9.** Non conta i browser passati da `/admin` o `?notrack`.
  - **GA4** e il **pixel Meta** contano solo chi accetta il banner.
- **Velocità:** foto in WebP. Home da 8,6 MB a 330 KB, scheda da 8,7 MB a 430 KB.
- **Kit** (in `~/Desktop/jayl streetwear/`):
  - `pokemon prompts /KIT-SCATTI.md`: 6 prompt NBP e 16 test Pomelli.
  - `pokemon prompts /HERO-MAGLIA-VIVA.md`: Kling 3 s, dalla maglia al Pokémon vero, a 3,75 crediti. Test in `drop 6/kling/`: il Gyarados va rifatto con Kling v2.
  - Ditto: `~/jayl-motion/monta <cartella drop>`, istruzioni in `KIT-VIDEO.md`. Manca la scelta della firma sonora.

## Prossimi 3 passi
1. **Drop 6:** prodotti e drop programmato in admin prima delle 18:00 del 1/10. Testi "€22 until {giorno}".
2. **Video:** rifare il Gyarados, poi `monta` su `drop 6/video.json` (3 formati A + 1 D). Pomelli: giorno 1 del test.
3. **UTM ovunque:** link in bio `?utm_source=instagram&utm_medium=bio`; ads con `utm_content` = formato e link alla scheda.

## Bloccato da
- **Metriche social:** l'admin pubblica ma non legge gli insights di Instagram (lavoro tecnico). Nel frattempo servono screenshot da Joshua.

## Numeri
- Drop: 5. Vendite reali: 0. Instagram @jayl_store: 37 follower (30/9).
- Umami: da leggere la prima domenica dopo il drop 6.
