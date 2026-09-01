# JAYL — Sistema Drop · design

Data: 2026-09-01 · Stato: approvato in brainstorming, pronto per il piano di implementazione

## 1 · Obiettivo

Trasformare jayl.store da catalogo di 39 prodotti sempre disponibili a **negozio a drop**: tre
magliette alla volta, edizione numerata e limitata, finestra a tempo. Il resto del catalogo
resta nascosto e viene rilasciato progressivamente — a discrezione dell'amministratore — nei
due mesi successivi, a prezzo pieno.

Il sistema serve il lancio social della collezione *Pokémon Built Different* su Instagram,
Facebook e TikTok.

### Prezzi

| Stato | Prezzo | Note |
|---|---|---|
| DROP | **€22,00** (2200) | finestra a tempo, cap per pezzo |
| LISTINO | **€25,00** (2500) | dopo il drop, attivato manualmente |
| Bundle drop | **€57,00** (5700) | i tre pezzi del drop insieme, sconto automatico di €9,00 |

Print cost Gelato ≈ €7,00; commissione Stripe ≈ €0,60. Margine ≈ €14,40 in drop, ≈ €17,40 in
listino.

### Vincoli non negoziabili

- **Il cap è reale.** Venduti 20 pezzi, il ventunesimo ordine viene rifiutato lato server.
  Senza questo, `EDITION OF 20` sarebbe una dichiarazione falsa e la numerazione `#7/20` una
  finzione. È il vincolo da cui dipende la legittimità dell'intero meccanismo.
- **Nessun dato di urgenza inventato.** Countdown, contatore e "ultimo pezzo preso N ore fa"
  derivano tutti da fatti verificabili. Nessun contatore di persone che guardano.
- **Nessuna dichiarazione sul prezzo futuro.** La pagina prodotto non annuncia il passaggio a
  €25. Decisione presa il 2026-09-01.
- **Nessuna nuova serverless function.** `vercel.json` instrada ~20 endpoint verso pochi
  handler per restare sotto il limite di funzioni Vercel. Le azioni nuove entrano negli
  handler esistenti.
- **`admin-products.js` non si tocca.** 860 KB che transitano interi dall'API GitHub a ogni
  salvataggio. Lo stato del drop vive altrove.

## 2 · Modello dati

### `src/data/drop.js` — unica fonte di verità (versionato, ~1 KB)

Modulo **JavaScript**, non JSON. Il file è importato sia dal client (Vite) sia dalle API
(Node), e `admin-products.js` è già esattamente questo pattern per la stessa ragione. Un `.json`
richiederebbe import attributes (`with { type: 'json' }`), instabili su Node 22, oppure una
`readFileSync` il cui tracing su Vercel non è garantito. `scripts/check-api-imports.js` esiste
proprio per intercettare questa classe di errore: catalog.js importava `src/data/products.js`,
Node non risolveva lo specifier Vite-only, e ogni funzione che passava di lì moriva al load con
il checkout giù. Il contenuto è comunque JSON puro dentro un `export const`.

```js
export const drop = {
  "current": {
    "id": "drop-01-sleep-mode",
    "number": 1,
    "title": "SLEEP MODE",
    "productIds": ["<altaria>", "<snorlax>", "<ursaring>"],
    "startsAt": "2026-09-05T16:00:00Z",
    "endsAt":   "2026-09-08T16:00:00Z",
    "cap": 20,
    "dropPrice": 2200,
    "bundlePrice": 5700
  },
  next: { number: 2, startsAt: '2026-09-09T16:00:00Z' },
  released: ['<id>', '<id>'],
  archivePrice: 2500,
}
```

`cap` è il default; un `caps: { "<id>": 30 }` opzionale sovrascrive per singolo prodotto.
Tutte le date in UTC, rese in ora locale dal client.

**Stati derivati**, nessun campo nuovo sui prodotti:

| Condizione | Stato | Prezzo |
|---|---|---|
| id in `current.productIds` | **DROP** | `dropPrice` |
| id in `released` | **LISTINO** | `archivePrice` |
| altrimenti | **VAULT** | non acquistabile |

### `src/data/drop-sales.json` — contatore (JSON, letto a runtime via API GitHub)

```json
{
  "drop-01-sleep-mode": {
    "counted": ["pi_3AbC…"],
    "products": { "<productId>": { "sold": 14, "lastAt": "2026-09-06T09:12:00Z" } }
  }
}
```

Questo resta JSON perché **non viene mai importato**: sarebbe congelato al deploy, che è
esattamente ciò che il contatore non deve essere. Si legge a runtime con `ghGet` sull'API
GitHub autenticata — non da `raw.githubusercontent`, che ha cache CDN di alcuni minuti e
permetterebbe di sforare il cap. Si scrive con commit `[skip ci]`, come le catture carrello,
così una vendita non fa partire un deploy.

**Idempotenza.** L'incremento non può stare solo nel webhook: `api/webhook.js` è un *fallback*
che attende 10 s e agisce solo se `create-order` non ha già evaso l'ordine. Entrambi i percorsi
chiamano quindi lo stesso `recordDropSale(paymentIntentId, items)`, che esce senza fare niente
se il `paymentIntentId` è già in `counted`. È anche il punto in cui si assegna il numero del
pezzo.

**Concorrenza.** Due vendite simultanee leggono lo stesso `sha` e la seconda `ghPut` fallisce
con conflitto. `recordDropSale` rilegge e riprova, fino a 3 tentativi.

## 3 · Storefront

### 3.1 Home — tre schermi

Sostituisce le sezioni 3, 4, 5 e 6 di `src/pages/HomePage.jsx`. Resta lo scroll-snap a schermi
pieni esistente.

**Schermo 1 — i tre quadrati.** Barra sottile in alto: `DROP 01 · SLEEP MODE` + countdown a
`endsAt`. Sotto, tre bande full-bleed impilate su mobile / tre colonne su desktop. Ogni banda:
immagine hero del prodotto, nome, `€22`, badge di disponibilità. Tap ovunque nella banda →
pagina prodotto. Sotto le tre bande, riga informativa: `tutti e tre · €57`.

**Schermo 2 — lista d'attesa.** Sezione inline a piena pagina con cattura email.

**Schermo 3 — Artist's.** Invariato (sezione 7 attuale).

Quando `released` supera i 6 prodotti compare un quarto schermo, carosello unico
`THE ARCHIVE · €25`, dopo la lista d'attesa. La soglia di 6 replica la regola già applicata a
"New In" ed evita il difetto di `CollectionCarousel`, che duplica la lista per il loop infinito
e con pochi elementi mostra visibilmente la ripetizione.

### 3.2 Regola di rivelazione del contatore

```
venduti < 30% del cap   →   EDITION OF 20
venduti ≥ 30% del cap   →   14 / 20 CLAIMED  + barra che si illumina
```

Motivo: al lancio, "19 disponibili su 20" dopo tre giorni non comunica scarsità — dimostra che
non compra nessuno. Sotto soglia si mostra solo la dimensione dell'edizione, che è
posizionamento puro e sempre vero.

Con `cap: 20` la soglia è 6 pezzi.

### 3.3 Pagina prodotto

Il blocco drop occupa la posizione di `UrgencyBadge` (`ProductPage.jsx:286`), già renderizzato
accanto ad Add to Cart in entrambi i layout, mobile (`:1116`) e desktop (`:1499`). Nessun
layout nuovo.

```
DROP 01 · SLEEP MODE
finisce tra  02 : 14 : 22 : 07
EDITION OF 20   |   14 / 20 CLAIMED  ▓▓▓▓▓▓▓░░░
ultimo pezzo preso 4 ore fa
€22
```

`ultimo pezzo preso N ore fa` si mostra solo se `lastAt` esiste ed è entro le 48 h.

Il numero del pezzo (`#7/20`) si assegna **al pagamento riuscito**, non all'aggiunta al
carrello: non esiste prenotazione, e prometterlo prima creerebbe conflitti fra carrelli aperti.
Compare nella mail di conferma ordine.

Prodotto in **LISTINO**: pagina normale a €25 con una riga —
`DROP 01 · SOLD OUT — ora in listino permanente`.

Prodotto in **VAULT**: pagina `COMING SOON` con `noindex`, artwork visibile, nessun bottone
d'acquisto, campo email. Serve a non mostrare una schermata rotta a chi arriva da un bookmark o
da un risultato Google residuo. I prodotti vault restano fuori da shop, navigazione, ricerca e
sitemap.

### 3.4 Fra un drop e l'altro

I tre pannelli restano, marcati `SOLD OUT` o `IN LISTINO`. La barra passa a
`DROP 02 · lunedì 18:00` con countdown all'**apertura**. Lo schermo non è mai vuoto e il vuoto
diventa un appuntamento.

### 3.5 Lista d'attesa

`EmailCapturePopup.jsx` è già una card d'angolo non bloccante che scatta su profondità di
scroll, exit-intent o visita di ritorno, e aspetta che il banner cookie sia stato chiuso.
Cambia solo il testo: offre l'accesso alla lista drop, non uno sconto.

**Il codice `JAYL10` è disattivato durante un drop attivo.** Su un'edizione limitata a €22 uno
sconto del 10% produce €19,80 e dissolve la scala di prezzo. `applyDiscount` rifiuta i codici
percentuali quando il carrello contiene prodotti in stato DROP.

Iscrizioni: endpoint esistente → `src/data/emails.json` (il file non esiste ancora; viene
creato alla prima iscrizione). In aggiunta, creazione del contatto su **Resend Audiences**
tramite `RESEND_AUDIENCE_ID`, per avere gestione unsubscribe e poter mandare l'annuncio come
Broadcast. Le mail marketing partono da un sottodominio dedicato per non intaccare la
deliverability di quelle transazionali.

## 4 · Server

### 4.1 Gate al checkout

Estende il ciclo di validazione già presente in `api/create-payment-intent.js:42–52`, quello di
`assertPrintable` che restituisce già messaggi utente in italiano. Tre rifiuti nuovi:

1. prodotto in **VAULT** → *"non è più disponibile. Rimuovilo dal carrello per completare
   l'ordine."*
2. drop **chiuso** (ora corrente fuori da `startsAt`–`endsAt`) → messaggio con la data del
   prossimo drop
3. **cap esaurito** per quel prodotto → *"questo pezzo è esaurito: l'edizione è chiusa a 20."*

Questo singolo intervento copre tre problemi insieme: l'integrità dell'edizione numerata, il
carrello stantio e il drop scaduto.

**Fail-open sul contatore.** Il controllo del cap richiede una lettura di `drop-sales.json`
sull'API GitHub, in mezzo al percorso di checkout. Se quella lettura fallisce, il gate
**lascia passare** e logga l'errore. Vendere 21 pezzi invece di 20 è un problema recuperabile —
si onora il pezzo in più o si rimborsa; bloccare tutti i checkout perché GitHub ha singhiozzato
non lo è.

**Carrello stantio.** `cartStore.js` persiste in localStorage l'intero oggetto prodotto, non
l'id: un visitatore può tornare con uno snapshot pre-drop a €23,99 di un prodotto ora in vault.
Il prezzo non è un rischio — `create-payment-intent.js:30` ricalcola già tutto lato server
(*"never trust client-supplied unitPrice/total"*) — ma il prodotto vault verrebbe comprato lo
stesso, perché le API leggono `admin-products.js` intero. Il gate lo blocca.

`WishlistPage.jsx:15` usa `.filter(Boolean)`: i prodotti vault spariscono in silenzio, nessun
crash. Nessun intervento.

**Ultimo pezzo conteso.** Se due carrelli contengono l'ultimo pezzo, uno dei due riceve il
rifiuto al checkout. È inevitabile senza prenotazione e va comunicato con un messaggio umano,
mai con un errore Stripe.

### 4.2 Contatore live

Nuova action `drop-status` su `api/orders.js` (pubblica, senza password), instradata in
`vercel.json` come `/api/drop-status → /api/orders?handler=drop-status`. **Nessuna function
nuova.** Restituisce per il drop corrente: venduti per prodotto, rimanenti, `lastAt`, `endsAt`.
Cache breve. Il client la interroga al caricamento della home e della pagina prodotto.

Il conteggio è runtime e non build-time: altrimenti si congelerebbe al momento del deploy.

### 4.3 Incremento

`recordDropSale(paymentIntentId, items)` incrementa `drop-sales.json` per ogni prodotto in stato
DROP presente nell'ordine e assegna il numero del pezzo. Commit con `[skip ci]`.

Viene chiamato da **entrambi** i percorsi di evasione — `handleCreateOrder` in `api/orders.js`
(primario) e `fulfillIfNeeded` in `api/webhook.js` (fallback, se il browser si chiude prima) —
ed è idempotente sul payment intent id, quindi la doppia chiamata non conta due volte.

### 4.4 Risoluzione del prezzo

Ogni prodotto porta un `price` e un prezzo per taglia in `sizes[].price`, entrambi a 2399. Il
prezzo di drop e di listino **non** riscrivono `admin-products.js`: sono un override applicato
al momento della risoluzione.

`priceItems` (`api/_lib/catalog.js`) risolve così, e la stessa funzione è la sorgente per il
prezzo mostrato a schermo, così client e server non possono divergere:

```
stato DROP     →  dropPrice      (2200)   ignora price e sizes[].price
stato LISTINO  →  archivePrice   (2500)   ignora price e sizes[].price
stato VAULT    →  rifiuto
```

L'override vale su tutte le taglie: un drop ha un prezzo unico, non una scala per taglia. Se in
futuro servisse un sovrapprezzo (2XL, 3XL), va introdotto come delta esplicito sopra il prezzo
di stato, non ripescando `sizes[].price`.

### 4.5 Bundle

Nessuno SKU bundle: Gelato richiede comunque i tre articoli separati. Nessun flusso dedicato,
nessun selettore di tre taglie.

Regola implicita in `applyDiscount` (`api/_lib/catalog.js:165`): se il carrello contiene tutti
e tre i prodotti di `current.productIds`, sconto automatico di €9,00 (3 × €22 − €57). Il
carrello mostra la spinta quando ne mancano uno o due. Un acquisto bundle consuma un pezzo da
ciascuno dei tre cap.

### 4.6 Visibilità in build

Il plugin `storefront-products` in `vite.config.js`, che oggi elimina i campi admin, elimina
anche i prodotti in stato VAULT: non sono nascosti via CSS, non esistono nel bundle. Cambiare
stato costa un deploy, ma il pannello admin committa già su main e fa partire un deploy a ogni
salvataggio.

Vanno adeguati di conseguenza `scripts/generate-sitemap.js` e l'handler `prerender` di
`api/orders.js`, che serve le pagine prodotto ai crawler.

Le API continuano a importare `admin-products.js` intero — è il gate al checkout, non
l'assenza dal bundle, a impedire l'acquisto.

## 5 · Admin

Nuovo componente `src/components/admin/DropTab.jsx`, importato da `AdminPage.jsx` (già a 4718
righe: il tab non ci va dentro).

- selezione dei tre prodotti del drop, con ricerca sul catalogo
- numero, nome, `startsAt`, `endsAt`, cap (default e per prodotto), `dropPrice`, `bundlePrice`
- venduti in tempo reale per prodotto
- **Chiudi drop** → sposta i tre in `released`, li porta a `archivePrice`
- lista dei prodotti VAULT con toggle **attiva in listino**
- data del prossimo drop, per la barra fra un drop e l'altro

Quattro azioni nuove nello switch di `api/admin.js`, protette da password:
`get-drop`, `save-drop`, `close-drop`, `release-product`.

## 6 · Social — cosa entra nel codice

**Non si costruisce uno scheduler.** `vercel.json` ha un solo cron, `0 8 * * *`: può scattare
una volta al giorno alle 8. Un drop che apre alle 18 con il post alle 18 non è pubblicabile da
lì. Il post d'apertura si pubblica a mano o si programma da Meta Business Suite, che pianifica
post e storie nativamente.

**Entra invece il pezzo ripetitivo**: `api/publish-social.js` oggi pubblica solo immagini
singole. Servono il container CAROUSEL con i children per il post da 5 slide e il media type
STORIES. Sono 13 drop × 3 prodotti × 2 formati.

Gli asset vivono fuori dal repo, organizzati per drop; i nomi degli slot coincidono con i nomi
dei file (`feed/01-mark.png` … `05-dropcard.png`, `stories/01-teaser.png` … `05-cta.png`), così
la pubblicazione non richiede di aprire le immagini. Prompt e convenzione completi in
`social-prompts-drop.md`.

## 7 · Fuori scope

Checkout, spedizioni, integrazione Gelato, recensioni, pagine legali, sezione Artist's, sezione
Art. Il drop è uno strato di visibilità più un gate al checkout: non entra nel flusso d'ordine.

## 8 · Rischi noti

- **SEO.** Nascondere 36 pagine indicizzate le fa declassare. Accettato consapevolmente: la
  perdita è temporanea, i prodotti tornano visibili in circa due mesi, e il drop deve essere
  protagonista. Decisione presa il 2026-09-01.
- **Produzione asset.** Il calendario dei drop richiede ~21 design nuovi per coprire un mese.
  **Ursaring non esiste in catalogo**, né front né back: il drop 01 ha due prodotti su tre.
  Fra i drop successivi mancano Dragonite back, Entei, Raikou, Suicune, Munchlax, Happiny,
  Magby, Togepi, Pichu, Meganium, Typhlosion, Feraligatr, Swampert, Blaziken, Sceptile.
- **Proprietà intellettuale.** Fan art Pokémon venduta commercialmente. La pubblicità a
  pagamento su Meta aumenta molto l'esposizione: esiste una pipeline automatica di
  segnalazione IP che i titolari usano attivamente. Il rischio organico è sensibilmente più
  basso di quello a pagamento.
- **Margine e traffico a pagamento.** €14,40 in drop non regge un CPA da traffico freddo. Il
  lancio è organico; le ads, se mai, servono retargeting e lookalike su un pubblico già
  costruito.
- **`RESEND_API_KEY`.** Non verificata su Vercel in fase di design. Da controllare con
  `vercel env ls` prima di contare sulle mail transazionali.
