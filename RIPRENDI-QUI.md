# RIPRENDI QUI — Troy, dopo la sessione del 30/9

Apri Claude Code in `~/jayl-store/` e scrivi:
> **Troy, leggi RIPRENDI-QUI.md e STATO.md e riprendiamo.**

## Cosa è live su jayl.store (verificato)
- **Prezzi:** 19,99 € al lancio, 24,99 € in collezione, i 3 insieme 49,99 €.
  - I decimali ora si vedono (prima il sito arrotondava a €20, anche nel checkout).
  - I Rich Pin usano il prezzo vero.
- **Niente "drop" ai clienti:** NEW, "launch price ends in", "next release", "Never miss a new release". Tradotto anche l'italiano che era rimasto sul sito inglese.
- **Umami** (cloud.umami.is): `view-product`, `add-to-cart`, `checkout`, `purchase` e UTM. Non conta chi passa da `/admin` o `?notrack`.
- **Video hero:** prima slide della scheda (muto, in loop) e griglia del drop su desktop. Nel cilindro della home mobile no, ci sono ancora le foto.
- **Admin:**
  - Add product ha ora il file **Front** (genera dal disegno principale) e **Carica MP4 (video hero)**.
  - Niente più mockup Gelato doppi.
  - Ordine delle immagini: trascina, "Ordina cliccando", "1°", ‹ ›.
- **Sicurezza:** il token di upload su Blob ora chiede la password dell'admin (prima chiunque poteva sovrascrivere i file di stampa).

## Da fare subito
1. **Drop 6 SHINY** (Gyarados, Charizard, Dragonite):
   - prodotti in admin, con il Front generato;
   - video hero da `~/Desktop/jayl streetwear/drop 6/kling/web/` caricato con "Carica MP4";
   - drop programmato nel tab Drop.
2. **Lo Shiny Dragonite** è stato creato prima della correzione: aprirlo nell'editor completo (`/admin/product/<id>`) e fare "✨ Genera dal disegno principale" per il Front.
3. **Provare l'admin nuovo davvero:**
   - trascina e "Ordina cliccando";
   - Front in Add product;
   - Carica MP4.

   Io non ho potuto: l'admin chiede la password, e in locale le API non girano.
4. **Verificare con Gelato** la spedizione di un ordine da 3 maglie: se è un pacco solo, i 3 a 49,99 sono l'offerta con più margine.

## Video
- **Hero Kling:** prompt ufficiale Kling v3 (muto) in `~/Desktop/jayl streetwear/pokemon prompts /HERO-MAGLIA-VIVA.md`. Eccezione ai crediti approvata: circa 3,75 crediti, al massimo 2 tentativi a prodotto.
- **I 3 hero con lo whoosh del Dragonite**, pronti da pubblicare, in `drop 6/_ditto/2026-09-30/hero-audio/`.
- **Ad v2**, 12,6 s, in `drop 6/_ditto/2026-09-30/v2/`:
  - NEW → T-SHIRTS → HAVE ARRIVED;
  - cartolina con logo animato;
  - "only €19.99 shipped".
- **Archivio motion:** `~/Desktop/jayl streetwear/ARCHIVIO-MOTION.md` e `v2/archivio-animazioni.mp4`.
  - 16 animazioni (A-P) e 12 font (F01-F12).
  - Joshua preferisce **C slam** e **D tracking**.
- **Prossimo passo:** Joshua sceglie animazione + font dall'archivio. Poi si rifà l'ad con `~/jayl-motion/kit/hero-ad.sh <stile> <traccia|fuoco>`, e l'audio con `kit/hero-ad-mix.sh`.
- **Kit Ditto:** `~/jayl-motion` ha modifiche non committate, sia di Ditto sia di Troy (HeroAd, Parola, Animazioni, Archivio, LogoJayl, font). Committarle quando Ditto ha finito.

## Regole decise il 30/9
- **Mai "drop" nei testi per i clienti.** Si dice "new", e "drop" resta una parola interna.
- **Negli ads:** poche parole ma grandi e animate, in oro; tutto centrato; logo animato alla fine; musica sotto lo whoosh.
- **Crediti Higgsfield:** solo per il video hero Kling dello store.
- **Versi ufficiali dei Pokémon** (in `drop 6/versi/`): solo per contenuti organici, mai nelle ads.

## Aperto
- **Metriche social:** l'admin pubblica ma non legge gli insights di Instagram. Si potrebbe aggiungere, col token Meta che c'è già.
- **Video hero nel cilindro della home mobile:** va progettato (strisce 3D).
- **Margine:** a 19,99 € restano circa 3-4 € netti a maglia. Le ads a freddo servono a testare; il guadagno viene dai 3 insieme, dal retargeting e dai contenuti.

---
La versione precedente di questo file (4/9, lancio del drop 01) è in `docs/archivio/RIPRENDI-QUI-2026-09-04.md`.
