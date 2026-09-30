# Pubblicazione social rapida dall'admin — design

Data: 2026-09-30 · Approvato da Joshua in chat · Autore: Troy

## Obiettivo

Pubblicare un asset di un prodotto su un social in due clic dalla lista
prodotti dell'admin (e dalla sezione Social della scheda), con titolo, testo e
tag presi da un pool generato dall'AI e mai usati prima su quel social. Lo
stesso percorso deve poterlo usare un agente (Haiku) via API. Instagram e
Facebook: post, storie e reel.

## Decisioni prese con Joshua

- Clic sull'icona del social → anteprima (asset, testo pescato, "↻ altro
  testo", formato). Secondo clic → **Pubblica** (social collegati via API) o
  **Apri e copia** (gli altri). Un clic sbagliato non pubblica mai.
- Asset mostrati: tutto ciò che sta nella cartella del prodotto **tranne i
  mockup Gelato** (foto caricate, video, hero Kling, immagini generate).
- Pinterest a 1 clic subito; Meta appena il token è su Vercel; TikTok, X,
  YouTube e altri: "apri e copia" finché non vengono collegati. Il registro
  dei social è estendibile.

## Social e formati

| Social     | Formati            | Media ammessi                         | Oggi        |
|------------|--------------------|---------------------------------------|-------------|
| Pinterest  | pin                | immagine (API); video → pin builder   | API         |
| Instagram  | post, storia, reel | post: immagine · storia: img/video · reel: video | API con token Meta |
| Facebook   | post, storia, reel | post: img/video · storia: img/video · reel: video | API con token Meta |
| X          | post               | link + testo (intent)                 | apri e copia |
| TikTok     | post               | video                                 | apri e copia |
| YouTube    | short              | video                                 | apri e copia (API se ci sono le env) |

Il registro vive in `src/lib/socialPlatforms.js` (condiviso client/server):
chiave, etichetta, sigla, colore, formati, media per formato, modalità.

## Asset (build-time)

- Classificazione in `src/lib/gelatoPool.js`: `isGelatoCopy(name)` = stesso
  criterio già usato (`-NN.jpg|png|webp`, non `hf_…`). Asset social =
  immagini/video nella cartella `public/images/<id>/` (e `generated/`) che non
  sono copie Gelato.
- Il plugin Vite genera il modulo virtuale `virtual:social-assets`
  (`{ [productId]: [{ src, type, thumb, jpg? }] }`), importato solo dalle
  pagine admin (chunk lazy, mai nel negozio).
- In `vite build` emette, con l'ottimizzatore esistente:
  - `thumb`: WebP largo 200 px → `/_img/thumb<path>.webp`;
  - `jpg` (solo immagini): JPEG largo al massimo 1080 px, q90 →
    `/_img/ig<path>.jpg`. Instagram accetta solo JPEG, le foto sono PNG.
- In dev: `thumb` e `jpg` puntano all'originale.

## Pool dei testi e storico

File `src/data/social.json`, letto e scritto solo dalle API via GitHub,
commit con `[skip ci]` (come vendite e carrelli: nessun deploy).

```json
{
  "version": 1,
  "settings": { "pinterestBoardId": null },
  "captions": {
    "<productId>": {
      "<platform>": [
        { "id": "c7k2", "title": "", "text": "", "tags": [], "createdAt": "", "usedAt": null }
      ]
    }
  },
  "log": [
    { "at": "", "productId": "", "asset": "", "platform": "", "format": "",
      "captionId": "", "mode": "api|manual", "postId": null, "url": null }
  ]
}
```

- **Pesca**: il primo testo con `usedAt: null` per quel prodotto e social;
  "↻ altro testo" passa al successivo non usato.
- **Rifornimento**: se non ne restano, gpt-4o-mini ne genera 5 nello stile del
  social (Pinterest: titolo SEO + descrizione + tag; Instagram: caption +
  hashtag; Facebook: caption; X: ≤ 250 caratteri; TikTok: breve + hashtag;
  YouTube: titolo + descrizione). Inglese, voce JAYL, stesse regole
  anti-ripetizione di `api/ai.js`. Per Pinterest il primo rifornimento parte
  dai `pinterestPins` non pubblicati del prodotto.
- **Uso**: `usedAt` si scrive quando il post parte via API o quando si preme
  "Apri e copia". Ogni azione aggiunge una riga a `log`.

## API (nessun file nuovo in `api/`: siamo a 12 funzioni, il limite Hobby)

Tutto in `api/publish-social.js`, `POST` con `password` admin e `action`:

- `status` → per ogni social `{ mode: 'api'|'manual'|'error', detail }` più il
  controllo Meta (vedi sotto) e Pinterest (token valido, board).
- `state` → pool (conteggi e prossimo testo per prodotto/social) e ultime
  righe di log. Una chiamata per pagina.
- `caption` `{ productId, platform, after? }` → il prossimo testo non usato
  (rifornisce il pool se serve).
- `publish` `{ productId, asset, platform, format, captionId? }` → se manca
  `captionId` lo sceglie il server; pubblica via API; segna usato; logga.
  È l'unica azione che l'agente deve conoscere.
- `mark-used` `{ productId, platform, format, asset, captionId }` → per i
  social in "apri e copia".
- `assets` → per l'agente: prodotti con asset e testi non usati per social
  (asset letti dall'albero Git con una sola chiamata, stessa classificazione).
- Le chiamate esistenti (`platform` senza `action`) restano come sono.

La generazione dei testi usa l'helper di `api/ai.js` estratto in
`api/_lib/textai.js`, così le due funzioni lo condividono.

## Meta

- Env: `FACEBOOK_PAGE_TOKEN` + `FACEBOOK_PAGE_ID` bastano. `INSTAGRAM_*`
  restano come override facoltativi.
- Risoluzione (cache 10 minuti per istanza): `GET /{id}?fields=id,name,
  access_token,instagram_business_account{id,username}`. Se risponde con
  `access_token` il token era dell'utente → si usa quello di Pagina. Se l'id
  non è una Pagina si prova come account Instagram.
- `debug_token` (best effort): tipo, scadenza, permessi mancanti fra
  `pages_manage_posts`, `pages_read_engagement`, `instagram_content_publish`.
- Graph API `v25.0` (la più recente è v26.0; v25.0 vale fino al 2028).
- Instagram: post `image_url` (JPEG) → `media_publish`; reel `media_type=REELS`
  + `share_to_feed`; storia `media_type=STORIES` (img o video). Per i video si
  attende `status_code=FINISHED`.
- Facebook: post `/{page}/photos` o `/{page}/videos`; reel `/{page}/video_reels`
  (start → upload con `file_url` → finish); storia foto: foto non pubblicata →
  `/{page}/photo_stories`; storia video: `/{page}/video_stories` (start →
  upload → finish).

## Interfaccia

Componente unico `src/components/admin/SocialQuickPublish.jsx`
(`{ product, assets, state, status }`):

- fila di miniature (video con ▶), selezione singola; accanto le sigle dei
  social con pallino di stato (verde = 1 clic API, grigio = apri e copia,
  rosso = da collegare / errore; tooltip col dettaglio);
- clic su un social → riquadro: anteprima asset, formato (solo quelli
  compatibili col media scelto), titolo/testo/tag del testo pescato, "↻ altro
  testo", **Pubblica** / **Apri e copia**, esito con link al post.

Usato in ogni riga della lista prodotti (`AdminPage`) e nella sezione Social
della scheda (`AdminProductPage`), dove sostituisce `SocialShareButtons`.
Nella sezione Social compare anche il riquadro di stato dei social (cosa fa
ogni API, cosa manca).

## Errori

- Nessun social pubblica senza secondo clic o chiamata esplicita `publish`.
- Errori delle API riportati col messaggio del social (es. permesso mancante,
  formato non accettato); il testo NON viene segnato usato se la
  pubblicazione fallisce.
- Conflitto di scrittura su `social.json` (sha cambiato): un nuovo tentativo
  rileggendo il file.

## Test

Script node in `scripts/` (nel `prebuild` come gli altri):
- classificazione asset (`isGelatoCopy`, asset social);
- pesca/"altro testo"/segna usato sul pool;
- compatibilità formato ↔ media dal registro;
- risoluzione Meta con `fetch` finto (token utente, token Pagina, id IG,
  errore).
Verifica manuale in locale della UI (dati finti), e live dopo il deploy.

## Fuori da questa fase

Collegamento OAuth di TikTok (serve l'app approvata), X via API (a
pagamento), YouTube connect, lettura degli insights.
