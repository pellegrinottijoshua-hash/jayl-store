# Pubblicazione social rapida — piano di implementazione

> Esecuzione inline in questa sessione (superpowers:executing-plans). Ogni task
> finisce con test verdi e un commit.

**Goal:** due clic dalla lista prodotti (e dalla scheda) per pubblicare un
asset su un social con un testo AI mai usato; post/storie/reel Meta; stessa
azione per un agente.

**Architecture:** registro social + logica del pool in `src/lib/` (puri,
condivisi client/server); asset e varianti (miniatura WebP, JPEG per IG)
generati alla build dal plugin Vite; server tutto dentro
`api/publish-social.js` (azioni) con i pezzi in `api/_lib/`; stato in
`src/data/social.json` scritto via GitHub con `[skip ci]`.

**Tech Stack:** Vite + React, Vercel Node functions, sharp (build), Graph API
v25.0, Pinterest API v5, gpt-4o-mini.

**Spec:** `docs/superpowers/specs/2026-09-30-social-publish-design.md`

## Global Constraints

- Nessun file nuovo in `api/` (12 funzioni = limite Hobby).
- `api/*` gira sotto Node puro: nessun import Vite-only (`virtual:`) da `api/`
  (`scripts/check-api-imports.js` blocca la build).
- Testi in inglese; mai la parola "drop" nei testi per i clienti; niente prezzi.
- Nessuna pubblicazione senza secondo clic o chiamata `publish` esplicita.
- Nessun token nel client; password admin da `sessionStorage('jaylAdminPw')`.
- Commit su `social.json` sempre con `[skip ci]`.
- Lint: zero errori nuovi.

---

### Task 1: registro social, classificazione asset, pool (puri)

**Files:**
- Create: `src/lib/socialPlatforms.js`, `src/lib/socialPool.js`
- Modify: `src/lib/gelatoPool.js` (export `isGelatoCopy`)
- Create: `src/lib/socialAssets.js`
- Test: `scripts/test-social.js` (+ `package.json` test/prebuild)

**Produces:**
- `PLATFORMS`, `FORMAT_LABELS`, `platformOf(key)`, `formatsFor(key, mediaType) → string[]`,
  `composeText(key, caption) → string`, `productLink(productId, key, format) → string`,
  `manualUrl(key, { text, title, link, media }) → string`
- `isGelatoCopy(name)`, `isSocialAsset(name)`, `mediaTypeOf(path) → 'image'|'video'`
- `emptySocial()`, `nextCaption(state, productId, platform, afterId?)`,
  `unusedCount(state, productId, platform)`, `addCaptions(state, productId, platform, list, now)`,
  `markUsed(state, entry, now)` — tutte senza mutare l'input.

**Test (casi):** hero/`hf_`/generated sono asset, `…-black-01.jpg` e
`…-gelato-02.jpg` no; IG video → `['reel','story']`, IG immagine →
`['post','story']`, Pinterest video → `[]`; `nextCaption` salta gli usati,
`after` passa al successivo e fa il giro; `markUsed` scrive `usedAt` e una
riga di log, non tocca lo stato di partenza; `composeText` IG mette gli
hashtag, X resta ≤ 280 con il link.

### Task 2: varianti immagine e modulo `virtual:social-assets` (build)

**Files:**
- Modify: `src/lib/optimizedImage.js` (varianti `thumb` → `/_img/thumb<p>.webp`,
  `ig` → `/_img/ig<p>.jpg`; `originalImage` le riconosce)
- Modify: `scripts/optimize-images.js` (`optimize(url, emit, variant='web')`,
  varianti: web 1000/webp q80, thumb 240/webp q70, ig 1080/jpeg q90 sempre emesso)
- Modify: `vite.config.js` (optimizer a livello di modulo; plugin `socialAssets`)
- Test: `scripts/test-optimized-image.js` (schema varianti reversibile)

**Produces:** `import { socialAssets } from 'virtual:social-assets'` →
`{ [productId]: [{ src, type, thumb, jpg|null }] }` (solo pagine admin).

**Verifica:** `npm run build` → `dist/_img/thumb/…webp` e `dist/_img/ig/…jpg`
esistono; il chunk del negozio (`index-*.js`) non contiene `socialAssets`.

### Task 3: helper AI condiviso e generatore di testi

**Files:**
- Create: `api/_lib/textai.js` (spostati da `api/ai.js`: `AI_PROVIDERS`,
  `callTextAI`, `safeJsonParse`, `callTextAIJson`, `creativeBrief`)
- Modify: `api/ai.js` (importa da `_lib/textai.js`)
- Create: `api/_lib/socialCaptions.js` → `generateCaptions({ product, platform, count, avoid })`
  e `buildCaptionPrompt(...)` (puro, testabile)
- Test: `scripts/test-social.js` (il prompt contiene lo stile del social, il
  divieto di "drop" e dei prezzi, i testi da evitare)

### Task 4: Meta (risoluzione token + adattatori)

**Files:**
- Create: `api/_lib/meta.js` → `GRAPH`, `resolveMeta({ env, fetchImpl })`,
  `publishInstagram(meta, { format, mediaType, mediaUrl, caption }, deps)`,
  `publishFacebook(meta, { format, mediaType, mediaUrl, caption }, deps)`
- Test: `scripts/test-meta.js` con `fetch` finto: token utente + id Pagina
  (usa il token di Pagina e l'IG collegato), token Pagina senza id (`/me`),
  id che è un account IG, token mancante; IG post/reel/storia chiamano
  `/media` coi parametri giusti e poi `/media_publish`; FB reel fa
  start → upload (`file_url`) → finish; FB storia foto fa foto non
  pubblicata → `photo_stories`.

### Task 5: azioni server + stato

**Files:**
- Create: `api/_lib/socialStore.js` (`readSocial`, `updateSocial` con un
  nuovo tentativo su 409/422)
- Create: `api/_lib/socialActions.js` → `handleSocialAction(body, deps)`:
  `status`, `state`, `caption`, `publish`, `mark-used`, `settings`, `assets`
- Modify: `api/publish-social.js` (instrada `action`; adattatori Pinterest /
  YouTube esistenti; Graph v25.0)
- Create: `src/data/social.json` (stato vuoto)
- Test: `scripts/test-social-actions.js` con store e adattatori finti:
  `publish` senza `captionId` sceglie il primo non usato e lo segna; fallito
  → non segnato; asset fuori da `/images/<productId>/` → 400; social in
  "apri e copia" → 409; `caption` rifornisce il pool quando è vuoto (una
  chiamata al generatore) e parte dai `pinterestPins` non pubblicati.

### Task 6: interfaccia

**Files:**
- Create: `src/lib/socialClient.js` (`useSocial()` con cache condivisa fra
  righe: `status`, `state`, `call(action, data)`, `refresh()`)
- Create: `src/components/admin/SocialQuickPublish.jsx`
- Create: `src/components/admin/SocialStatusPanel.jsx`
- Modify: `src/pages/AdminPage.jsx` (`ProductAdminCard`: riga con
  SocialQuickPublish)
- Modify: `src/pages/AdminProductPage.jsx` (sezione Social: StatusPanel +
  SocialQuickPublish al posto di SocialShareButtons)

**Verifica:** in locale (dev, `adminAuth` finto) lista e scheda si vedono,
nessun overflow orizzontale a 1280/1440, anteprima si apre e chiude, formati
coerenti col media; errori API mostrati in chiaro.

### Task 7: rilascio

- `npm run lint` (0 errori), `npm test`, `npm run build`.
- `/sync-main`, ok di Joshua, push, `/verify-live` (+ `status` live con la
  password inserita da Joshua nell'admin, non da Troy).
- `STATO.md` e `RIPRENDI-QUI.md`: cosa pubblica l'admin e cosa manca
  (TikTok/X/YouTube).
