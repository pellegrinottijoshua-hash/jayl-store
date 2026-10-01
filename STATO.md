# STATO — jayl.store

Aggiornato: 2026-10-01 sera da Troy (drop 6 live, 2 video Etsy, kit prompt HERO e Pomelli). Dettagli e passi: `RIPRENDI-QUI.md`.

## A che punto siamo
- **Negozio:** www.jayl.store. Prezzi: 19,99 € al lancio, 24,99 € in collezione, i 3 insieme 49,99 €. Niente "drop" ai clienti: NEW. Spedizione gratuita. 6 drop usciti, 0 vendite reali.
- **Drop 6 SHINY** (Gyarados, Charizard, Dragonite) live dall'1/10 alle 18:00 fino al 6/10 alle 18:00. Tutti e 3 hanno il Front e il video hero.
- **Video in home:** su telefono la scheda davanti del cilindro è in video; su desktop la griglia. "Video home" per pezzo nel tab Drop. Da provare sul proprio iPhone.
- **Ads Meta** (9-30/9): circa 31 € per circa 160 clic, 0,19 € a clic. Portavano alla home.
- **Cosa misura il sito:** **Umami** (cloud.umami.is, senza cookie) conta `view-product`, `add-to-cart`, `checkout`, `purchase` e UTM, non `/admin` e `?notrack`. **GA4** e **pixel Meta** solo chi accetta il banner.
- **Pubblicazione social dall'admin** (lista prodotti e sezione Social della scheda): scegli la foto o il video, il social, l'anteprima con testo AI, poi Pubblica. Link con `utm_source=<social>`.
  - **1 clic:** Pinterest e Meta (IG e FB, env dal 1/10). **Apri e copia:** X, TikTok, YouTube. Pool e storico in `src/data/social.json`.
- **Kit dei prompt** in `~/Desktop/jayl streetwear/`:
  - `pokemon prompts /HERO-MASTER.md`: finale "vissuto" E1-E3, Kling K2 con 14 gesti variabili;
  - `pokemon prompts /POMELLI-KIT.md`: Business DNA, 20 template Photoshoot, 13 campagne;
  - `etsy video/PROMPT-ETSY.md`: 5 prompt tazze e 5 magliette;
  - `PROPOSTE-MARKETING-2026-10-01.md`: ads, retargeting senza pixel, 7 idee video. Da approvare.
- **Video Etsy:** `etsy video/_ditto/2026-10-01/etsy-tazze.mp4` ed `etsy-maglie.mp4` (14,9 s, 1080×1080, muti). Si rifanno con `~/jayl-motion/kit/etsy.sh tazze|maglie` (ricette in `kit/etsy-*.json`).

## Prossimi 3 passi
1. **Meta:** admin → scheda → Social: Instagram e Facebook verdi? Un token di Graph Explorer non esteso scade in un'ora.
2. **Drop 6:** controllare home e schede col video, su telefono e desktop. Caricare i 2 video sugli annunci Etsy.
3. **Primo giro di pubblicazioni** dalla lista prodotti (Pinterest + IG). Domenica 5/10 si legge Umami.

## Bloccato da
- **TikTok a 1 clic:** serve l'app TikTok approvata (client key/secret).

## Numeri
- Drop: 6. Vendite reali: 0. Instagram @jayl_store: 37 follower (30/9).
