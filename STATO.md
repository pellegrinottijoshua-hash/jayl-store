# STATO — jayl.store

Aggiornato: 2026-10-02 notte da Troy (home nuova, ruoli degli asset, SEO, 3 video bozza, cartella pubblicazione). Dettagli e passi: `RIPRENDI-QUI.md`.

## A che punto siamo
- **Negozio:** www.jayl.store. 19,99 € al lancio, 24,99 € in collezione, i 3 a 49,99 €. Niente "drop" ai clienti: NEW. 6 drop, 0 vendite reali.
- **Drop 6 SHINY** (Gyarados, Charizard, Dragonite) live fino al 6/10 alle 18:00.
- **Home (2/10):**
  - desktop: 3 schede affiancate, video insieme una volta, hover riparte; telefono: cilindro;
  - al posto del countdown la **scia dorata di Zack**, che si consuma ("last call" nelle ultime 12 h, "almost gone" nell'ultima ora);
  - cookie "Who doesn't like cookies?"; barra free shipping su ogni pagina; IG e TikTok accanto al logo su mobile.
- **Asset prodotto (2/10)**, assegnati in admin (★ hero, # mockup, 🔍 dettaglio, 🏠 lifestyle home, vedi `src/lib/productMedia.js`):
  - **hero** = video da 3 s, oppure le 2 foto di schiena (uomo e donna, `heroShots`);
  - in scheda il video gira una volta e passa al mockup 1; su Objects si vede il video hero.
  - "+" sotto la miniatura nella lista prodotti: carica nella galleria del prodotto.
- **SEO:** descrizione meta su tutte le 48 maglie. **Misure:** Umami senza cookie; GA4 e pixel Meta solo con consenso.
- **Social dall'admin:** 1 clic per Pinterest, IG, FB; "apri e copia" per X, TikTok, YT.
- **Pubblicazione:** `~/Desktop/jayl streetwear/pubblicazione/` (`da-joshua/`, `da-troy/bozze|approvati/`, `pubblicati/`, `LEGGIMI.md`).
  - **3 bozze da 10 s** in `da-troy/bozze/` (Screenshot, Pack opening, Stacco) con caption; 15 formati in `da-troy/FORMATI.md`; codice in `~/jayl-motion/src/Virali.tsx`.

## Prossimi 3 passi
1. **Joshua:** guardare le 3 bozze, approvarle (→ `approvati/`) e scegliere i formati da `FORMATI.md`.
2. **Admin:** ricaricare la pagina prima di salvare. Con la pagina vecchia un salvataggio ha cancellato la SEO di Ursaring (ripristinata).
3. **Piano editoriale:** 1 video al giorno da `approvati/`, con UTM verso la scheda. Domenica 5/10 si legge Umami.

## Bloccato da
- **TikTok a 1 clic:** serve l'app TikTok approvata, oppure la pubblicazione via Higgsfield (un clic tuo per post).

## Numeri
- Drop: 6. Vendite reali: 0. Instagram @jayl_store: 37 follower (30/9).
