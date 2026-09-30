# RIPRENDI QUI — jayl.store, sistema Drop e lancio social

Aggiornato: 2026-09-04. Da dare a una chat nuova per riprendere senza ricostruire il contesto.

---

## Situazione in una riga

Il sistema drop è **in produzione e verificato**. Il **drop 01 «ORIGIN» apre domani, 5 settembre
alle 18:00 italiane**. Gli asset social esistono ma **non sono ancora pubblicabili così come sono**.

---

## Il sito

jayl.store è un **negozio a drop**: tre magliette alla volta come edizioni numerate a tiratura
limitata, tutto il resto del catalogo nascosto e rilasciato progressivamente dall'admin.

Configurazione live in `src/data/drop.js`:

| | |
|---|---|
| Drop | `drop-01-sleep-mode` — titolo **«ORIGIN»** |
| Prodotti | Mewtwo back · Charizard back · Psyduck back |
| Apre | **2026-09-05T16:00:00Z** (venerdì 5, 18:00 italiane) |
| Chiude | 2026-09-08T16:00:00Z |
| Cap | 20 pezzi per prodotto |
| Prezzi | drop €22 · bundle tre pezzi €57 · listino post-drop €25 |
| `released` | vuoto |
| Vault | 37 prodotti nascosti |

Le tre hero sono caricate e risolvono correttamente (`200` verificato in produzione).

---

## PRIORITÀ — le prossime 24 ore

In quest'ordine. Tutto il resto può aspettare il post-lancio.

1. **Acquisto di prova reale.** Mai fatto. Gli smoke test provano che gli endpoint rispondono,
   **non** che un ordine vero arrivi a Gelato, incrementi `drop-sales.json` e assegni il `#1/20`.
   Comprare una maglietta all'apertura e verificare la catena intera.
2. **Nominare i 20 file grezzi del drop 1** (vedi sotto). Senza, domani si pubblica cercando fra
   gli hash.
3. **Pubblicare il teaser stasera** — slot `06 — TEASER`. Aprire senza preavviso a un pubblico
   quasi inesistente è lo scenario peggiore per un meccanismo basato sulla scarsità.
4. **Scrivere le 3 caption + tag** per i post di domani. Solo quelle tre.

**Da NON fare adesso:** automazione di pubblicazione, SEO dei drop 2-5, nomenclatura degli altri
drop, strategia tag come sistema. Sono cose giuste al momento sbagliato.

---

## Stato reale degli asset social

Cartelle in `~/Desktop/jayl streetwear/`, una per drop (`first drop` … `fifth drop`), **piatte,
senza sottocartelle**.

| Drop | File immagine | Nominati per ruolo | Note |
|---|---|---|---|
| first | 33 | **10 su 30** | solo Charizard (`c post 1-5`, `c storia 1-5`) |
| second | 30 | 15 | metà |
| third | 33 | **0** | tutti hash grezzi |
| fourth | **5** | 0 | **incompleto — non sono 30** |
| fifth | 30 | 9 | |

Nel `first drop`, Mewtwo e Psyduck sono 20 file `hf_2026...` indistinguibili senza aprirli:
10 in 928×1152 (post) e 10 in 768×1376 (storie).

**Proporzioni fuori standard.** I post sono 0,806 invece di 0,800 e le storie 0,558 invece di
0,5625. Instagram croppa dove capita e ricomprime sotto i 1080 px di lato. **Consegna finale:
1080×1350 per i post, 1080×1920 per le storie.**

---

## Nomenclatura da adottare

I dieci slot del documento prompt (`~/Desktop/jayl streetwear/pokemon prompts /JAYL_social_prompts_10_final.md`)
sono già numerati 01-10: **01-05 sono i post in 4:5, 06-10 le storie in 9:16.** Il nome del file
deve essere il numero dello slot, così un agent sa cos'è senza aprirlo.

```
first drop/
  drop.json                    ← manifest: prodotti, date, prezzi, caption, tag
  charizard/
    post/   01-mark.png 02-hero.png 03-macro.png 04-creature.png 05-dropcard.png
    story/  06-teaser.png 07-reveal.png 08-macro.png 09-scale.png 10-cta.png
  mewtwo/   …
  psyduck/  …
```

Le due cose che sbloccano l'automazione sono **nomi per ruolo** e **un `drop.json` per cartella**.
Senza quelle, nessun agent può pubblicare senza supervisione umana su ogni singolo file.

---

## Automazione di pubblicazione — cosa c'è e cosa manca

**C'è già:** `api/publish-social.js` pubblica su Instagram, Facebook, TikTok, Pinterest e YouTube.

**Mancano tre cose:**

1. **Il carosello.** Oggi pubblica solo immagini singole. Un post da 5 slide richiede il container
   `CAROUSEL` con i children (Instagram Graph API).
2. **Le storie.** Serve il media type `STORIES`.
3. **Lo scheduling.** `content-queue.json` è vuoto e `vercel.json` ha **un solo cron, `0 8 * * *`** —
   scatta una volta al giorno alle 8. Un post alle 18 non è pubblicabile da lì.

**Raccomandazione:** non costruire uno scheduler. Il post d'apertura si pubblica a mano — è l'unico
momento in cui vale la pena esserci — oppure si programma da Meta Business Suite, che pianifica
post e storie nativamente a costo zero. Vale invece la pena costruire **carosello e storie**, che
sono il pezzo ripetitivo: 5 drop × 3 prodotti × 2 formati.

---

## Da fare dopo il lancio

- **Strategia tag e caption.** Non esiste ancora. Serve un set base per JAYL (brand, Venezia,
  wearable art) più un set per Pokémon, e una regola su quanti e dove.
- **Descrizioni SEO** dei prodotti in drop e in listino.
- **Completare il quarto drop** (5 file su 30).
- **Nominare drop 2-5** con lo schema sopra.
- **Ritagliare tutto** a 1080×1350 e 1080×1920.
- **Resend Audiences + Broadcasts.** `api/_lib/email.js` è solo transazionale: manda una mail a un
  destinatario. Per annunciare un drop alla lista serve un Broadcast con unsubscribe gestito —
  ciclare sull'endpoint transazionale è lo strumento sbagliato e degrada la deliverability.
  Aggiungere `RESEND_AUDIENCE_ID` e mandare da un sottodominio (`drops@mail.jayl.store`).

---

## Come si gestisce un drop, in pratica

Tutto dal **tab Drop** del pannello admin (`/admin`). Nessuna modifica al codice serve mai.

- **Configurare**: i tre prodotti, date, cap generale e per prodotto, prezzi, e la hero di ogni pannello.
- **Chiudere**: il bottone «Chiudi drop» sposta i tre in `released` — diventano acquistabili a €25
  su Objects — e svuota `current.productIds`. Verificato: restano acquistabili **solo quei tre**.
- **Rilasciare dal vault**: lista in fondo al tab, un bottone per prodotto.

Il pannello scrive `src/data/drop.js` su main via API GitHub, il che fa partire un deploy.

---

## Gotcha che una sessione nuova deve sapere

**Prima di ogni push**: `/sync-main`. Il pannello admin committa direttamente su remote main,
quindi il locale è cronicamente indietro.

**Dopo ogni deploy**: `/verify-live`. Il push avvia solo una build. C'è uno smoke test obbligatorio
di 4 endpoint in quella skill: eseguirlo sempre, anche per modifiche che sembrano solo frontend.
Il checkout è già rimasto morto 19 giorni per questo.

**`src/data/drop.js` è un modulo `.js` con corpo JSON puro.** Commenti sopra `export const drop =`,
dentro le graffe JSON valido. Le azioni admin lo rigenerano con `serializeDropConfig()` e lo
rileggono con `parseDropConfig()`. Una modifica a mano che rompa il formato blocca il pannello.
`scripts/test-drop-config.js` lo verifica in `prebuild`.

**I test non devono mai dipendere dal contenuto di `drop.js`.** Corretto due volte: un test leggeva
l'orologio reale e avrebbe fatto fallire ogni deploy per le 72 ore del drop; poi tre suite
dipendevano da quali prodotti fossero nel drop e si sarebbero rotte al primo `close-drop`,
impedendo al commit stesso della chiusura di deployare. Usare config sintetiche.

**Import statici in tutto `api/`, mai `await import()` dentro una funzione.**
`scripts/check-api-imports.js` cammina solo il grafo statico.

**Il fail-open sul cap è voluto.** Se la lettura del registro fallisce, il checkout passa e logga.
Vendere 21 pezzi su 20 si recupera; bloccare ogni checkout perché GitHub ha singhiozzato no.

**Il cap non si applica in scrittura.** Il registro annota la verità e segnala `overCap`; il cap si
impone al checkout. Un clamp in scrittura renderebbe un oversell invisibile.

**Attenzione ai percorsi immagine.** `api/admin.js` restituiva `/images/images/...` per ogni hero
caricata (sostituiva `public` con `images` invece di togliere il prefisso). Corretto il 2026-09-04,
ma è il tipo di bug che ricompare: `filePath` è `public/images/<id>/<file>`, il path pubblico è
`/images/<id>/<file>`.

---

## Architettura, in breve

- `src/data/drop.js` — unica fonte di verità. Tre stati derivati: **DROP**, **LISTINO** (in
  `released`), **VAULT** (tutto il resto).
- `api/_lib/drop.js` — logica pura: `getDrop`, `productState`, `isDropOpen`, `basePriceFor`,
  `capFor`, `counterMode`, `bundleDiscount`. Ogni funzione accetta una `cfg` opzionale.
- `api/_lib/drop-sales.js` — registro vendite, idempotente sul payment intent id, con retry.
  Vive in `src/data/drop-sales.json`, letto a runtime via API GitHub, **mai importato**.
- `api/_lib/drop-config.js` — `serializeDropConfig` / `parseDropConfig` / `validateDropConfig`.
- `src/components/drop/dropWindowState.js` — macchina a tre stati (prima / durante / dopo),
  condivisa fra home e pagina prodotto. Non scriverne una seconda.
- `vite.config.js` — il plugin `storefront-products` elimina i prodotti VAULT dal bundle client.
- Il gate al checkout è in `api/create-payment-intent.js`.

**Suite**: `npm test` esegue 6 file, ~130 asserzioni. `prebuild` le esegue tutte più
`check-api-imports.js` e `generate-sitemap.js`.

---

## Decisioni prese e perché

Registro completo con 45 ruling in `~/Desktop/jayl-drop-log/progress.md`.

- **Il cap è reale.** Venduti 20, il ventunesimo ordine viene rifiutato lato server. Senza questo
  «EDITION OF 20» sarebbe una dichiarazione falsa.
- **Niente dati di urgenza inventati.** Countdown, contatore e «ultimo pezzo preso N ore fa»
  derivano da fatti verificabili. Nessun contatore di «persone che stanno guardando»: oltre a
  essere pratica scorretta in UE, è il tell del dropshipping e l'opposto del posizionamento.
- **Il contatore resta nascosto sotto il 30% venduto**, e mostra solo `EDITION OF 20`. Al lancio
  «19 disponibili su 20» dopo tre giorni non comunica scarsità: dimostra che non compra nessuno.
- **Nessun codice sconto è valido sui pezzi in drop.**
- **La perdita SEO è voluta e temporanea**, con rilascio progressivo in circa due mesi.

---

## Rischi noti, non risolti

- **Proprietà intellettuale.** Fan art Pokémon venduta commercialmente. Le ads a pagamento su Meta
  sono la strada più rapida per farsi trovare: esiste una pipeline automatica di segnalazione IP
  che i titolari usano. Il rischio organico è sensibilmente più basso.
- **Margine.** €22 meno €7 di stampa e ~€0,60 di Stripe fa ~€14,40. Non regge un CPA da traffico
  freddo. Lancio organico; ads semmai per retargeting.
- **Pubblico.** La lista email è partita da zero. Un meccanismo di scarsità funziona solo se c'è
  qualcuno per cui essere scarso: se il primo drop chiude a `0/20`, il problema non è il sito.
- **Produzione asset.** Drop da tre giorni significa tre design nuovi ogni tre giorni.

---

## Dove sono le cose

- Codice: `/Users/jpelle/jayl-store` (branch `main`, deploy automatico su push)
- Spec e piano: `docs/superpowers/specs/2026-09-01-jayl-drop-system-design.md` e
  `docs/superpowers/plans/2026-09-01-drop-system.md` (versionati)
- Registro decisioni e report di tutte le review: `~/Desktop/jayl-drop-log/`
- Prompt social (10 slot): `~/Desktop/jayl streetwear/pokemon prompts /JAYL_social_prompts_10_final.md`
- Spec hero del sito: `~/Desktop/jayl streetwear/pokemon prompts /social-prompts-drop.md`, sezione «1-bis»
- Asset per drop: `~/Desktop/jayl streetwear/first drop` … `fifth drop`
