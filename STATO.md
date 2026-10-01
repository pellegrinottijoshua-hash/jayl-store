# STATO — jayl.store

Aggiornato: 2026-10-01 da Troy (video hero sistemati, pubblicazione social rapida in admin). Dettagli e passi: `RIPRENDI-QUI.md`.

## A che punto siamo
- **Negozio:** www.jayl.store. Prezzi: 19,99 € al lancio, 24,99 € in collezione, i 3 insieme 49,99 €. Niente "drop" ai clienti: NEW. Spedizione gratuita. 5 drop usciti, 0 vendite reali.
- **Drop 6 SHINY** (Gyarados, Charizard, Dragonite) il 1/10 alle 18:00. I 3 video hero ora sono nel sito (prima erano sul Blob privato e rispondevano 403); "Carica MP4" li salva nel repo.
- **Ads Meta** (9-30/9): circa 31 € per circa 160 clic, 0,19 € a clic. Portavano alla home.
- **Cosa misura il sito:**
  - **Umami** (cloud.umami.is, gratuito, senza cookie): `view-product`, `add-to-cart`, `checkout`, `purchase` e UTM. Non conta `/admin` e `?notrack`.
  - **GA4** e il **pixel Meta** contano solo chi accetta il banner.
- **Velocità:** foto in WebP. Home da 8,6 MB a 330 KB, scheda da 8,7 MB a 430 KB.
- **Pubblicazione social dall'admin** (lista prodotti e sezione Social della scheda): scegli foto o video importato, poi il social; anteprima con testo AI mai usato, poi Pubblica o Apri e copia. Link con UTM `utm_source=<social>`.
  - **1 clic:** Pinterest (scegliere la board nella scheda → Social). Instagram e Facebook (post, reel, storie) appena ci sono `FACEBOOK_PAGE_TOKEN` e `FACEBOOK_PAGE_ID` su Vercel, più un redeploy.
  - **Apri e copia:** X, TikTok, YouTube.
  - Pool dei testi e storico in `src/data/social.json`. Per un agente: `POST /api/publish-social` con `action: "publish"`.
- **Kit video** in `~/Desktop/jayl streetwear/` (`pokemon prompts /`, `drop 6/kling/web/`, `drop 6/_ditto/`). Ditto: `~/jayl-motion/monta`.

## Prossimi 3 passi
1. **Meta:** aggiungere i 2 env (comandi in `RIPRENDI-QUI.md`), redeploy, poi admin → scheda → Social: tutto verde?
2. **Drop 6:** drop programmato nel tab Drop prima delle 18:00 del 1/10; controllare i video hero sulle schede.
3. **Primo giro di pubblicazioni** dalla lista prodotti (Pinterest + IG), e lettura di Umami la domenica dopo.

## Bloccato da
- **Meta a 1 clic:** servono i 2 env su Vercel.
- **TikTok a 1 clic:** serve l'app TikTok approvata (client key/secret).

## Numeri
- Drop: 5. Vendite reali: 0. Instagram @jayl_store: 37 follower (30/9).
