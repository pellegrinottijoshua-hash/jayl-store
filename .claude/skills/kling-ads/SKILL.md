---
name: kling-ads
description: Scrive prompt per video pubblicitari di prodotto con Kling 3.0 e Nano Banana Pro — story Instagram, Reels, TikTok, inserzioni Meta, formato verticale 9:16. Usala SEMPRE quando si parla di ads video, pubblicità di una maglietta o di un capo, clip di un drop, video prodotto, motion design pubblicitario, frame di partenza per un video, prompt Kling o Seedance, oppure quando l'utente dice "fammi un ad", "video per le storie", "prompt kling", "serve una pubblicità", "video del drop", "ad multiplo", "clip prodotto", "make me an ad", "product video prompt", "story ad". Usala anche quando l'utente descrive un video di prodotto che vuole generare senza nominare Kling. Copre il tetto di 2500 caratteri di Kling, gli Elements multi-vista, il frame di partenza obbligatorio, le safe zone di IG e TikTok e la pipeline di montaggio.
---

# Kling Ads — JAYL

Sistema per scrivere prompt Kling 3.0 che vendono magliette. **Non è un template**:
è un catalogo di formati + un budget di caratteri + una libreria di lock. Scegli il
formato, riempi i blocchi, resta sotto il tetto.

## I tre vincoli che decidono tutto

**1 · 2500 caratteri.** Tetto duro del prompt Kling. Ogni parola vaga è rubata a una
precisa. Conta i caratteri prima di consegnare, sempre.

**2 · Kling 3.0 pretende un frame.** Non fa text-to-video: ogni generazione parte da
`start_image` o atterra su `end_image`. Il frame non è un accessorio dello shot, è
lo **stadio 0** della pipeline — e si costruisce con Nano Banana Pro, gratis, prima
di spendere un credito Kling.

**3 · Il testo non lo genera l'AI.** Prezzo, nome del drop, CTA, contatore pezzi:
tutto in Remotion, dopo. Kling anima il prodotto e basta. Se in un prompt stai
descrivendo del testo che deve apparire, hai sbagliato strumento.

## Budget caratteri

Shot singolo 4–5s (il cavallo di battaglia):

| Blocco | Caratteri | |
|---|---|---|
| `SCENE` | 120 | obbligatorio |
| `ACTIVE REFERENCES` | 250 | obbligatorio |
| `FIRST FRAME` | 300 | obbligatorio |
| `CAMERA` | 280 | obbligatorio — terza posizione, mai in fondo |
| `ACTION` | 500 | obbligatorio |
| `LIGHTING` | 280 | obbligatorio |
| `PHYSICS` | 180 | solo se il tessuto si muove davvero |
| `STYLE` | 140 | obbligatorio |
| `POSITIVE LOCKS` | 350 | obbligatorio |
| | **~2400** | 100 di margine |

**Gli UUID costano.** Ogni `<<<uuid>>>` sono 42 caratteri. Tre Elements = 126, il 5%
del budget. Tienine conto quando scegli quanti capi mettere in campo.

**Multi-shot 10–15s in una generazione sola.** Ci sta, ma il budget si riorganizza:
`SCENE` 100 · `REFS` 280 · `FIRST FRAME` 200 · `CAMERA` 200 · `ACTION` come
`CUT 1/2/3` da ~330 l'uno · `LIGHTING` 200 · `STYLE` 100 · `LOCKS` 300. Ogni shot
riceve un terzo della densità di un F1 singolo: meno controllo su ogni inquadratura,
in cambio di continuità di luce e materia che il montaggio non ti dà gratis.

Le due strade si testano, non si deducono. Lo stesso soggetto in tre F1 montati e in
un unico 15s dicono cose diverse su cosa regge: il primo ti fa rigenerare solo lo
shot debole, il secondo ti dà un respiro unico. Nei `CUT` multi-shot il lock
`cuts only at the specified points` non è opzionale.

## Catalogo formati

Scegli in base a cosa deve fare l'ad, non all'abitudine.

| | Formato | Durata | Capi | Quando |
|---|---|---|---|---|
| **F1** | **Reveal** — il capo piegato si apre, la schiena stampata entra in campo e si legge | 4–5s | 1 | Il mattone. Da solo è già uno story ad; tre F1 montati sono il trittico |
| **F2** | **Neck proof** — macro sul collo: il JAYL nero stampato sotto il colletto, la cucitura, la grana | 3–4s | 1 | Il beat "non è merch". Chiude quasi sempre |
| **F3** | **Passaggio** — un capo esce di campo sull'asse, il secondo entra | 5s | 2 | Legare due prodotti senza stacco |
| **F4** | **Trittico** — 3× F1 + F2 + card | 15s | 3 | Lancio drop. **Mai una generazione sola** |
| **F5** | **Loop** — il capo ruota su sé stesso, primo e ultimo frame identici | 3s | 1 | Retargeting, feed, story ripetibile. `end_image` = `start_image` |
| **F6** | **Grafica viva** — macro sulla stampa che prende vita nel tessuto | 4s | 1 | Quando la grafica è il motivo d'acquisto |

Formati nuovi si aggiungono qui. Il sistema regge finché ogni formato dichiara
durata, numero di capi e a cosa serve.

## Stadio 0 — il frame di partenza

Kling non inventa: continua. Quello che c'è nel frame di partenza è quello che avrai
nel video, amplificato. Il frame è quindi il punto di controllo qualità dell'intera
pipeline — ed è anche l'unico stadio che costa zero.

```
Element (4 viste del capo)
  → prompt NBP → /higgsfield-unlimited → 4 varianti gratis
  → SCEGLI e VERIFICA: la stampa è giusta? il JAYL nero al collo è leggibile?
  → solo allora: Kling
```

**Verifica prima di spendere.** Un frame con la stampa sbagliata costa zero da
rifare e 7,5 crediti da scoprire dopo aver animato. Guarda la grafica al 100%
prima di passare allo stadio successivo.

Due strade per il frame, con un compromesso vero:

| | Stampa | Estetica |
|---|---|---|
| **Mockup Gelato** | esatta al pixel | piatta, fondo bianco, non 9:16 |
| **NBP costruito** | passa da un modello, va verificata | chiaroscuro, 9:16, composta |

Si usa **NBP**, perché l'estetica è metà del motivo per cui questi ad esistono. Ma
la verifica della stampa diventa obbligatoria, non facoltativa. L'immagine 4
dell'Element — il dettaglio ravvicinato della grafica — serve esattamente a questo:
dà a NBP un riferimento stretto da cui non derivare.

**Per un multi-shot lungo** conviene generare anche l'`end_image`: due frame
verificati che fanno da capo e coda tengono i 15 secondi molto più dritti di un
solo frame iniziale.

📖 **Quando devi scrivere i prompt immagine, leggi `references/start-frames.md`** —
scheletro del prompt, come ancorare la stampa alla reference, distribuzione degli
angoli quando i frame sono più di uno, e la scelta del fondo.

## Meccanica Kling 3.0

```
model: kling3_0
mode: pro          # std per i test, 4k solo per l'esport finale
duration: 3-15     # ma vedi la regola degli 8 secondi
aspect_ratio: 9:16
sound: off         # la musica si monta dopo, e off costa meno crediti
medias: [{role: start_image, value: <media_id del mockup>}]
```

**Elements.** Si iniettano come `<<<element_id>>>` dentro `params.prompt`, più di uno
per generazione. Il backend li riscrive in `@nome`. Non vanno nei `medias`.

**`end_image`** esiste: usalo per F5 (loop perfetto) e quando la chiusura dello shot
deve atterrare su un frame preciso.

**Costo**: ~7,5 crediti per 5s `pro` 9:16 con audio spento. Verifica sempre con
`get_cost: true` prima di una tornata.

## Struttura del prompt

Blocchi in quest'ordine, in inglese, solo quelli che servono. `CAMERA` va in terza
posizione: spostato in fondo, il FOV viene ignorato.

```
SCENE
[1 frase: cosa succede e dove. Il vuoto è un luogo — dillo.]

ACTIVE REFERENCES
[<<<uuid>>> + ancoraggio minimo + "100% matches the reference"]
[DICHIARA LA VISTA: l'Element contiene fronte, retro, logo e dettaglio insieme]

FIRST FRAME
[Dov'è il capo nel primo frame, orientamento, e che sta già muovendosi]

CAMERA
[Altezza, distanza, movimento, FOV in gradi dalla tabella: 84° 63° 47° 29° 18° 12°]

ACTION
[Eventi in ordine. Moto del capo e moto della camera dichiarati separatamente.
 Velocità in km/h, mai "lento"/"veloce".]

PHYSICS
[Massa, inerzia, come cade il cotone, ombre di contatto]

LIGHTING
[Sorgente, direzione, esposizione, Kelvin. Blocco prioritario.]

STYLE
[Photoreal, formato, grana. Niente nomi di registi, macchine o obiettivi.]

POSITIVE LOCKS
[Fixer brevi, in positivo. Vedi libreria sotto.]
```

Regole non negoziabili, ereditate da Seedance: **solo positivo** (mai "non deve"),
velocità in km/h, atmosfera in % o metri, sinistra/destra dal punto di vista della
camera, emozione e movimento descritti come muscoli e materia, mai come umore.

## Libreria di lock

Copia quelli che servono. Sono i fixer contro i guasti che si ripetono.

**Vista** — l'Element contiene quattro viste, quindi va dichiarato cosa è in campo
**e in che ordine**. La rotazione retro → fronte è voluta, non un rischio: è il modo
in cui il cliente scopre com'è fatta la maglietta. Ma va scritta, non sperata:
> `the printed back faces camera at the start, the garment rotates to reveal the plain front and the black JAYL neck print`
> `the printed back of the garment faces camera for the entire shot`  ← quando non deve girare

**Safe zone** — su 1080×1920 IG mangia 250px sopra e 250px sotto, TikTok 250px a
destra e 400px sotto:
> `the garment stays within the central vertical band, the top 13% and bottom 21% of frame stay empty`

**Isolamento** — un soggetto per inquadratura, regola del moodboard:
> `the garment is the only object in frame`

**Stacchi** — quando dichiari dei CUT:
> `cuts only at the specified points, the camera does not cut on its own`

**Leggibilità della stampa** — il motivo per cui l'ad esiste:
> `the printed graphic stays sharp and fully readable from second 1.5 onward`

**Neck print** — nel F2. Il logo è **stampato in nero** sotto la cucitura del
colletto, sul bianco del cotone. Non è un'etichetta cucita né tessuta:
> `the black JAYL wordmark printed below the collar seam stays legible and in focus through the final frame`

## Brand JAYL

- **Chiaroscuro.** Una sorgente dura, ombre profonde, nessun fondale piatto. La luce
  è materia quanto il tessuto: scrivi da dove viene e cosa colpisce.
- **Un soggetto per inquadratura.** Mai due capi che competono, tranne in F3 dove
  il passaggio è il soggetto.
- **Print-first.** La stampa si vede intera, frontale, nitida entro 1,5 secondi.
- **Impossibile, non finto.** Il capo fluttua, si apre da solo, ruota nel vuoto.
  Nessuna finta spontaneità: non c'è un "vero" da imitare, quindi non c'è valle
  perturbante in cui cadere e l'etichetta AI non costa niente.
- **Il collo chiude.** Quasi ogni ad finisce sul JAYL nero stampato sotto il
  colletto. È l'argomento "capo, non merch" detto senza affermarlo.

## Dopo Kling

```
Element (utente) → prompt NBP → frame verificato → Kling
clip grezze
  → peek: guardale davvero, critica, rigenera solo le deboli
  → Remotion: card finale e overlay tipografici (prezzo, drop, CTA, pezzi)
  → ffmpeg: concat + musica + loudness −14 LUFS + 1080×1920 h264
  → ads/<drop>/
```

**Musica**: sulle ads a pagamento l'audio di tendenza non è utilizzabile. Serve
libreria commerciale, altrimenti l'inserzione viene rifiutata o mutata.

## Checklist

- [ ] Prompt sotto i 2500 caratteri — contati, non stimati
- [ ] `start_image` esiste ed è stato **guardato**: stampa giusta, JAYL nero leggibile
- [ ] Vista dichiarata a parole in `ACTIVE REFERENCES`, con l'ordine della rotazione
- [ ] `CAMERA` in terza posizione, FOV in gradi dalla tabella
- [ ] Tutto in positivo, velocità in km/h
- [ ] Safe zone nei lock
- [ ] `sound: off`, `aspect_ratio: 9:16`
- [ ] Nessun testo affidato a Kling
- [ ] Oltre 8s: generazioni separate, non un multi-shot unico
