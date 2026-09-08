# RIPRENDI QUI — dopo il drop 01

Scritto 2026-09-08, con il drop 01 ancora aperto (chiude **martedì 9 alle 18:00**).
Da dare a una chat nuova. Il precedente `RIPRENDI-QUI.md` resta valido per l'architettura;
questo copre i quattro cantieri aperti: **social/ads, analytics, email, scheduling dei drop**.

---

## La situazione, senza addolcirla

Ho letto i dati di produzione invece di ricostruirli a memoria. Il quadro:

| | |
|---|---|
| Pezzi venduti nel drop 01 | **1 su 60** |
| Di cui a clienti veri | **0** |
| Iscritti alla newsletter | **0** |
| Carrelli abbandonati | 2, di cui **1 persona reale** |
| Email di recupero inviate | **0** |

L'unica vendita registrata è il **tuo acquisto di prova**: il carrello di
`pellegrinottijoshua@gmail.com` è stato catturato alle 14:26:52 del 7 settembre e la vendita
risulta alle 14:27:06 — quattordici secondi dopo. Buona notizia: la catena Stripe → Gelato →
`drop-sales.json` → numerazione `#1/20` **funziona davvero**, era l'ultima cosa non verificata.
Cattiva notizia: il drop ha venduto zero a persone che non sei tu.

**C'è però un lead reale**: `scarpa.greta.1998@gmail.com` ha messo una maglietta nel carrello
il 31 agosto e non ha mai ricevuto l'email di recupero — perché quella email non è mai partita
(vedi bug 1). È l'unica persona che ha mostrato intenzione d'acquisto in tutta la storia del
negozio. Vale un messaggio scritto a mano, oggi, prima di qualunque altra cosa in questo file.

**Cosa significa per la revisione social.** Con 1 vendita non hai dati sufficienti per giudicare
creatività, caption o hashtag: non è che il post ha convertito male, è che non l'ha visto
nessuno. Qualunque conclusione del tipo «il carosello non funziona» sarebbe rumore letto come
segnale. L'unica domanda con una risposta possibile è **quante persone hanno visto qualcosa**.

---

## Bug trovati mentre indagavo — vanno prima di tutto il resto

Due bug veri, entrambi verificati sui dati di produzione, entrambi bloccanti per il cantiere 3.

### Bug 1 — L'email di recupero carrello non è mai partita

`api/admin.js:239` — il cron giornaliero esce in anticipo:

```js
const due = items.filter(it => it.status === 'pending' && ...)
if (!due.length) return res.status(200).json({ processed: 0, message: 'No items due' })
// ...il blocco dei carrelli abbandonati sta QUI SOTTO, mai raggiunto
```

`content-queue.json` è `[]` e lo è sempre stato, quindi il `return` scatta ogni singolo giorno
e il blocco dei carrelli non viene mai eseguito. Prova: entrambi i carrelli hanno `sent: false`,
uno da otto giorni. **Il codice del recupero carrello è corretto — semplicemente non è mai
stato eseguito.** Fix: spostare il blocco carrelli prima del return, o togliere il return
anticipato.

### Bug 2 — I carrelli convertiti non vengono marcati

`api/orders.js:253` chiama `/api/capture-email` con `action: 'cart-converted'` **senza await**,
in una funzione serverless. È esattamente la classe di bug che ha rotto l'email di benvenuto:
la funzione risponde e viene congelata prima che la fetch arrivi a destinazione.

Prova: il tuo carrello del 7 settembre è ancora `converted: false` benché tu abbia comprato
quattordici secondi dopo. **Conseguenza pratica una volta risolto il bug 1:** un cliente che
compra riceverebbe comunque l'email «hai lasciato qualcosa nel carrello». Vanno risolti insieme,
mai il primo da solo.

---

# 1 · Revisione social e strategia ads

## Cosa sappiamo davvero

Gli account esistono da venerdì 5, i tre post sono usciti sabato alle 18:00 come da piano.
Ma **`src/data/social-links.js` è ancora vuoto**: il sito non linka nessun profilo, quindi il
traffico ha viaggiato in una sola direzione da tre giorni. È la cosa più veloce da sistemare in
tutto questo file — si compila dal pannello admin.

## La revisione da fare (30 minuti, con i numeri sotto mano)

Non serve un'analisi elaborata. Servono cinque numeri, uno per canale, presi a mano dalle
statistiche native:

| Metrica | Dove | A cosa serve |
|---|---|---|
| Copertura dei 3 post IG | Instagram Insights | quante persone hanno visto qualcosa |
| Visualizzazioni per post TikTok | TikTok Analytics | l'unico canale con reach a freddo possibile |
| Click sul link in bio | IG Insights | quanti sono passati dal social al sito |
| Follower guadagnati | tutti e tre | il vero obiettivo dei primi post |
| Sessioni sul sito 6-9 settembre | GA4 (vedi cantiere 2) | il denominatore di tutto |

**Come leggere il risultato, deciso prima di guardare i numeri** — così non si razionalizza a
posteriori:

- **Copertura sotto ~200 in totale** → il problema è la distribuzione, non il contenuto. Non
  toccare creatività e caption. Lavora sul pubblico: inviti a mano, commenti genuini, TikTok.
- **Copertura buona ma zero click** → il problema è il ponte social→sito. Lavora su CTA,
  link in bio, sticker link nelle storie.
- **Click buoni ma zero acquisti** → allora, e solo allora, il problema è prezzo, prodotto o
  pagina prodotto. È l'unico scenario in cui ha senso rivedere il sito.

Con i dati attuali la scommessa è sul primo scenario, ma va confermata, non assunta.

## Ads — la risposta breve è: non ancora, e per due ragioni indipendenti

**Il margine non regge il traffico a freddo.** €22 meno ~€7 di stampa e ~€0,60 di Stripe fa
~€14,40 per pezzo. Un CPA da campagna a freddo su Meta per un brand sconosciuto sta
realisticamente sopra quella cifra. Spenderesti per vendere in perdita, e lo scopriresti dopo
aver speso.

**Il rischio IP è concreto proprio sulle ads.** Le campagne a pagamento su Meta passano da una
pipeline automatica di segnalazione che i titolari dei diritti usano attivamente. Il rischio
organico su un account piccolo è sensibilmente più basso; quello pubblicitario no. Con contenuto
Pokémon, pagare per farsi trovare significa pagare per farsi trovare *anche da loro*.

**Quando le ads avranno senso:**

1. Quando c'è un pubblico da ritargettizzare (pixel Meta già installato e consenso-gated, quindi
   la raccolta parte da sola appena c'è traffico) — il retargeting ha CPA molto più bassi.
2. Quando il drop gira su **IP originale** invece che Pokémon. Zack the Duck e Dinos & Mages
   tolgono il vincolo alla radice: puoi spendere senza guardarti alle spalle.
3. Quando il margine sale — la serigrafia in batch da 20 pezzi post-chiusura porta il costo di
   stampa da €7 a €4-6 (vedi le idee nel giro precedente).

Prima di allora ogni euro speso in ads è un euro che compra un dato che già hai.

---

# 2 · Google Analytics

## Cosa c'è già

GA4 è **installato e funzionante**: `G-SZQ80GDTJ0` in `index.html`, con Consent Mode configurato
correttamente (analytics negato di default, concesso all'accettazione del banner cookie, che ora
è anche in inglese). Non serve installare niente.

## Il buco vero

**GA4 traccia solo `page_view`.** Ho controllato ogni chiamata `gtag()` nel codice: ci sono
`consent` e `page_view`, e basta. Non esiste `purchase`, non esiste `add_to_cart`, non esiste
`begin_checkout`.

Tradotto: **oggi GA non può dirti nulla sulle conversioni.** Può dirti quante persone hanno
visitato una pagina, non quante hanno messo qualcosa nel carrello, non quante sono arrivate al
checkout e si sono fermate, non quanto hai incassato. Per un negozio è il dato che conta e non
c'è.

## Cosa fare, in ordine

1. **Verifica l'accesso alla proprietà.** Prima di tutto: entra su analytics.google.com e
   controlla di avere accesso a `G-SZQ80GDTJ0`. Se la proprietà è legata a un account vecchio,
   tutto il resto è inutile. Cinque minuti, ma se salta questo salta tutto.
2. **Aggiungi i tre eventi e-commerce** che mancano: `add_to_cart` quando si aggiunge al
   carrello, `begin_checkout` all'ingresso nel checkout, `purchase` alla conferma d'ordine (con
   `value`, `currency`, `items`). Sono tre chiamate `gtag()` nei punti dove il codice già sa
   cosa sta succedendo — non è un lavoro grosso.
3. **Segna `purchase` come conversione** nell'interfaccia GA4.
4. **Ricorda il limite strutturale del consenso:** solo chi accetta i cookie finisce nei numeri.
   Con un tasso di accettazione normale (30-60%) GA sottostima il traffico reale, sempre. Non è
   un bug, è il prezzo di una cookie policy onesta — ma va tenuto a mente prima di leggere un
   calo dove non c'è.

**Il numero da guardare per primo, appena gli eventi sono attivi:** quante sessioni ha avuto il
sito nelle 72 ore del drop. È il denominatore che manca per interpretare tutto il cantiere 1.

---

# 3 · Resend

## Cosa c'è

Sette template transazionali in `api/_lib/email.js`, tutti funzionanti:

| Template | Quando parte | Automatico? |
|---|---|---|
| Conferma ordine | webhook Stripe (+ backup in create-order) | Sì |
| Spedizione + tracking | webhook Gelato | Sì |
| Benvenuto iscrizione | all'iscrizione alla waitlist | Sì — verificato 7 set |
| Notifica contatto (a te) | form contatti | Sì |
| Autorisposta contatto | form contatti | Sì |
| Recupero carrello | cron 08:00 | **No — bug 1** |
| Richiesta recensione | bottone in admin | **No — manuale** |

## Cosa manca, in ordine di importanza

**Primo: i due bug sopra.** Il recupero carrello è già scritto e già testato — gli manca solo
di essere eseguito. È il ritorno più alto per il lavoro più basso di tutto questo file.

**Secondo: Resend Audiences + Broadcasts.** Oggi Resend è cablato solo per la posta
transazionale: un destinatario alla volta via `sendEmail({to, subject, html})`. Non esiste il
concetto di lista, di broadcast, di unsubscribe gestito. Significa che **non hai modo di
annunciare un drop alla tua lista** — e quando la lista sarà popolata sarà il canale con il
tasso di conversione più alto che avrai, molto sopra i social.

Serve: `RESEND_AUDIENCE_ID`, l'iscrizione automatica a Resend nel momento della cattura email
(oggi `capture-email` scrive solo su GitHub, mai su Resend), e l'invio da un **sottodominio
dedicato** (`drops@mail.jayl.store`) per non bruciare la reputazione di `orders@jayl.store`
mescolando marketing e conferme d'ordine sullo stesso mittente.

Ciclare `sendEmail` su ogni iscritto funzionerebbe tecnicamente ma è lo strumento sbagliato usato
a forza: niente unsubscribe, deliverability che degrada a ogni invio.

**Terzo: il timing del recupero carrello.** Anche risolto il bug 1, il cron gira una volta al
giorno alle 08:00. Un carrello abbandonato alle 8:05 riceve l'email quasi 24 ore dopo. Per un
drop di 72 ore è un ritardo che costa vendite. Va portato a ~30 minuti reali, ma tocca
`vercel.json` e la frequenza dei cron — non è un cambio leggero, va fatto con calma.

**Nota sul lead reale:** `scarpa.greta.1998@gmail.com` aspetta un'email dal 31 agosto. Non
aspettare la fix del bug per scriverle — mandale un messaggio a mano.

---

# 4 · Admin — programmare i drop successivi

## Il vincolo che decide l'architettura

Il plugin `storefront-products` in `vite.config.js` decide **al momento della build** quali
prodotti finiscono nel bundle del client. Un drop che diventasse `current` solo a runtime
mostrerebbe prodotti che nel bundle non esistono. **Rotazione puramente a orologio: impossibile
senza rebuild.**

## La soluzione, senza infrastruttura nuova

> Il cron giornaliero delle 08:00 promuove il drop successivo a `current`.
> Il drop si apre poi da solo alle 18:00 tramite `isDropOpen`, che già esiste.

Funziona perché promuovere in anticipo **non mette in vendita**: il prodotto entra nello stato
`BEFORE`, che mostra «Preview · not on sale yet» e che il gate al checkout rifiuta fino a
`startsAt`. Le dieci ore di anticipo non sono un effetto collaterale, sono la vetrina d'attesa —
che per un drop è esattamente ciò che serve.

Nessun upgrade del piano Vercel, nessun deploy hook, lo stesso cron che hai già (e che, risolto
il bug 1, farà anche i carrelli abbandonati).

## Cosa serve costruire

1. Un array `scheduled: []` in `src/data/drop.js`, con la stessa forma di `current`.
2. Una sezione «prossimi drop» nel tab Drop dell'admin per riempirlo.
3. Un ramo nel cron che promuove ciò che è dovuto: sposta `current` in `previous`, prende il
   primo di `scheduled`, lo mette in `current`, committa. Il commit fa partire il deploy, il
   deploy rigenera il bundle con i prodotti giusti.
4. Test: `scripts/test-drop-config.js` va esteso alla nuova forma. **Le config nei test devono
   restare sintetiche** — è già costato due volte: un test che leggeva l'orologio reale avrebbe
   fatto fallire ogni deploy per le 72 ore del drop.

## Il resto della lista admin, in ordine

**Riordino del tab Drop.** Oggi funziona ma è scomodo. Il riordino ha senso farlo *insieme* allo
scheduling, non prima: la sezione «prossimi drop» cambia comunque il layout.

**La crepa sul vault.** Il chunk `admin-catalog-*.js` è scaricabile da chiunque senza password e
contiene tutti e 40 i prodotti, vault inclusi. Non è un problema di sicurezza — niente è
acquistabile, niente è indicizzato — ma **chiunque può leggere in anticipo tutti i drop futuri**.
Per un brand costruito sul vault è una crepa nella narrativa. Si chiude spostando il catalogo
admin dietro un endpoint autenticato invece che in un chunk statico.

**I mockup colore.** Restano ~50 abbinamenti colore/immagine rotti su ~18 prodotti (soprattutto
`white` e `black`), stessa causa già risolta per Altaria, Elekid e Ursaring: `color.image` punta
a nomi file che non esistono più dopo un reimport. Richiede ispezione visiva prodotto per
prodotto. Non urgente finché quei prodotti sono in vault.

---

## L'ordine in cui farei le cose

Dal ritorno più alto per lo sforzo più basso.

| # | Cosa | Perché ora | Sforzo |
|---|---|---|---|
| 1 | Scrivere a mano a `scarpa.greta.1998@gmail.com` | unica persona reale che ha mostrato intenzione | 5 min |
| 2 | Compilare `social-links.js` dall'admin | il sito non linka i social da tre giorni | 5 min |
| 3 | Verificare l'accesso alla proprietà GA4 | se salta questo, il cantiere 2 non parte | 5 min |
| 4 | **Fix bug 1 + bug 2 insieme** | il recupero carrello è già scritto, gli manca solo di girare | 1 h |
| 5 | Chiudere il drop 01 martedì 18:00 dall'admin | libera lo spazio per il 02 | 1 min |
| 6 | Revisione social con i cinque numeri | serve prima di decidere qualunque cosa sul contenuto | 30 min |
| 7 | Eventi e-commerce GA4 | senza, il prossimo drop è cieco quanto questo | 2 h |
| 8 | Scheduling dei drop + riordino tab Drop | il drop 02 è già in `next` per il 10 e nulla lo automatizza | mezza giornata |
| 9 | Resend Audiences + Broadcasts | diventa il canale migliore quando la lista esiste | mezza giornata |
| 10 | Cron carrelli a 30 minuti | tocca `vercel.json`, da fare con calma | — |

**La cosa che non è in questa lista e che conta più di tutte:** un meccanismo di scarsità
funziona solo se c'è qualcuno per cui essere scarso. Il drop 01 ha chiuso a 0/60 con clienti
veri, e nessuna delle dieci righe qui sopra cambia quel numero da sola. Il lavoro vero delle
prossime settimane è il pubblico — inviti a mano, presenza genuina nelle community, e il primo
drop su IP originale. Il resto è manutenzione di una macchina che, tecnicamente, funziona già.

---

## Gotcha che valgono ancora

- **Prima di ogni push:** `git pull --rebase --autostash origin main`. L'admin committa
  direttamente su remote main.
- **Dopo ogni deploy:** lo smoke test dei 4 endpoint (`/verify-live`). Il checkout è già
  rimasto morto 19 giorni per averlo saltato.
- **Mai `await import()` dentro una funzione in `api/`** — `scripts/check-api-imports.js`
  cammina solo il grafo statico. C'è ancora una violazione nota in `api/admin.js:1624`
  (`buildReviewRequestEmail`), innocua ma da ripulire.
- **Ogni invio email che non ha un secondo percorso va awaitato.** Il pattern fire-and-forget
  è sicuro solo dove qualcun altro rimanda la stessa email (conferma d'ordine, doppiata dal
  webhook). È la causa del bug 2 e lo era dell'email di benvenuto.
