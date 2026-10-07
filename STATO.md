# STATO — jayl.store

Aggiornato: 2026-10-07 pomeriggio da Troy (5 video del Drop 7 con musica Flow, hero rewind per serie). Dettagli e passi: `RIPRENDI-QUI.md`.

## A che punto siamo
- **Negozio:** www.jayl.store. 19,99 € al lancio, 24,99 € in collezione, i 3 a 49,99 €. Niente "drop" ai clienti: NEW. 7 drop, 0 vendite reali.
- **Drop 7 ANCIENT** (Rampardos, Kabutops, Aerodactyl) dal 7/10 alle 18:00 al 12/10 alle 18:00, a 19,99 €.
- **Home (2/10):**
  - desktop: 3 schede affiancate, video insieme una volta, hover riparte; telefono: cilindro;
  - niente countdown in home; nelle schede del drop "offer · N days". Ogni settimana: metà prodotti col 3° colore FINISHED, un'altra metà "only N left" (`src/lib/scarcity.js`).
  - cookie "Who doesn't like cookies?"; barra free shipping su ogni pagina; IG e TikTok accanto al logo su mobile.
- **Asset prodotto (2/10)**, assegnati in admin (★ hero, # mockup, 🔍 dettaglio, 🏠 lifestyle home, vedi `src/lib/productMedia.js`):
  - **hero** = video da 3 s, oppure le 2 foto di schiena (uomo e donna, `heroShots`);
  - in scheda il video gira una volta e passa al mockup 1; su Objects si vede il video hero. "+" sotto la miniatura nella lista prodotti: carica nella galleria.
- **Front dentro le back** (link vecchi aprono la back su Front); 23 video hero da `heros/`. **SEO:** meta su tutte. **Misure:** Umami senza cookie; GA4 e pixel Meta solo con consenso.
- **Social dall'admin:** 1 clic per Pinterest, IG, FB; "apri e copia" per X, TikTok, YT. Ogni asset mostra dove è già uscito (pallini, ✓ sul social); "segna già pubblicato" per i post fatti fuori.
- **Pubblicazione:** `~/Desktop/jayl streetwear/pubblicazione/` (`da-joshua/`, `da-troy/bozze|approvati/`, `pubblicati/`, `LEGGIMI.md`).
  - **Bozze** in `da-troy/bozze/`, caption e ordine di uscita in `captions.txt`: 3 del 2/10 (Virali.tsx), hero rewind shiny (`kit/hero-virale.sh`), SPECIMEN fossili (museo, `src/Museo.tsx`, `kit/social.sh Museo …`), 4 statici del Drop 7 su brani Flow. Ogni drop: 5 video, ognuno in un formato nuovo.
  - **Musica:** 9 brani Flow nuovi in `marketing music/` col BPM reale nel nome, `tagli 15s/` e `firme/` (da ascoltare); BPM con `~/.claude/skills/video-statico/bpm.py`. Effetti Mixkit (uso commerciale libero) in `sfx marketing/`.

## Prossimi 3 passi
1. **Joshua:** approvare i 5 video del Drop 7 (→ `approvati/`); SPECIMEN esce stasera dopo le 18:00. Ascoltare le 5 firme e il Lo-fi.
2. **Admin:** ricaricare la pagina prima di salvare. Con la pagina vecchia un salvataggio ha cancellato la SEO di Ursaring (ripristinata).
3. **Piano editoriale:** 1 video al giorno da `approvati/`, con UTM verso la scheda. Domenica 5/10 si legge Umami.

## Bloccato da
- **TikTok a 1 clic:** serve l'app TikTok approvata, oppure la pubblicazione via Higgsfield (un clic tuo per post).

## Numeri
- Drop: 7. Vendite reali: 0. Instagram @jayl_store: 37 follower (30/9).
