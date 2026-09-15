# Scrivere i frame di partenza (Nano Banana Pro)

Kling 3.0 non fa text-to-video: pretende un `start_image` o un `end_image`. Il frame
è quindi lo stadio 0 di ogni ad, ed è l'unico stadio che può costare zero — Nano
Banana Pro genera gratis in modalità Unlimited.

Questo file serve quando devi scrivere i prompt immagine, non quelli video.

## Cosa deve avere un buon frame di partenza

**Il momento prima, non il momento.** Kling continua ciò che vede. Un frame in cui
il capo è già aperto e fermo dà un video in cui non succede niente. Un frame in cui
il capo è appena stato lasciato — maniche che si allargano, orlo che si solleva —
dà a Kling da dove partire. Scrivi l'istante che precede l'azione.

**Il colore del capo dichiarato, sempre.** I modelli immagine tendono al bianco su
fondo neutro. Se il capo è rosa, azzurro o sabbia va detto esplicitamente, e va detto
anche per il colletto a costine, altrimenti torna bianco da solo.

**La stampa ancorata alla reference.** La formula che tiene:
`reproduced exactly as in the reference — same proportions, same placement, same
colors, sharp and fully readable`. È l'unica cosa che l'ad deve vendere: se deriva
qui, tutto il resto è lavoro sprecato.

**Il vuoto è un luogo.** «Fondo nero» dà un buco. `deep saturated petrol-green
seamless backdrop, clean and completely empty` dà uno spazio. Il fondo va descritto
come superficie, con il suo colore e la sua assenza di dettaglio.

**Nessun supporto.** `no mannequin, no hanger, no visible support` — senza questo
compaiono grucce e manichini. Il capo che fluttua è metà dell'idea: è l'immagine
dichiaratamente impossibile che rende l'AI un mezzo invece che un travestimento.

**Safe zone anche nel frame.** `the garment sits inside the central vertical band of
the frame; the top fifth and bottom fifth stay empty`. Se il soggetto nasce già
schiacciato ai bordi, nessun montaggio lo recupera.

**Niente testo.** `no text anywhere in frame`. I modelli immagine scrivono male e
il testo si aggiunge dopo, in modo deterministico.

## Scheletro

```
Vertical 9:16 product photograph. A [COLORE] heavyweight cotton [CAPO] floats in
mid-air against a [FONDO] seamless backdrop — no mannequin, no hanger, no visible
support. The fabric is [COLORE] throughout, body and sleeves, with the ribbed collar
the same tone.

[VISTA E ANGOLO]. The printed graphic [POSIZIONE], reproduced exactly as in the
reference — same proportions, same placement, same colors, sharp and fully readable.

[L'ISTANTE PRIMA DELL'AZIONE]. Heavy cotton drape: [COME CADONO LE PIEGHE].

Single hard key light from upper left at 5600K, [COSA FA LA LUCE SUL TESSUTO];
[DOVE CADE L'OMBRA]. The backdrop stays clean and completely empty.

The garment sits inside the central vertical band of the frame; the top fifth and
bottom fifth stay empty. Photoreal, fine grain, high detail, no text anywhere in frame.
```

## Angoli, quando i frame sono più di uno

Tre inquadrature identiche con solo la grafica che cambia, montate in fila, sembrano
un errore di rendering e non una campagna. Distribuisci:

| Posizione | Angolo | Effetto |
|---|---|---|
| Apertura | frontale, simmetrico | il più leggibile: qui la stampa deve arrivare |
| Centro | tre quarti, in rotazione | prende il movimento, lega gli shot |
| Chiusura | controcampo basso | il capo domina, prepara il taglio |
| Prova | macro sul collo | il beat qualità, fondo scuro, respiro |

## Fondo: acceso o di marca

I due registri hanno ruoli diversi e convivono nello stesso ad.

**Fondi saturi complementari** sui beat di prodotto — il capo pastello resta la cosa
più chiara in campo e la sequenza prende un ritmo cromatico. Rosa su verde petrolio,
azzurro su terracotta, sabbia su prugna.

**Fondo della palette del brand** sul beat di chiusura, dove si guarda il dettaglio
di qualità. Dopo tre frame sgargianti un frame scuro e silenzioso atterra più forte,
ed è il punto in cui l'identità ha senso di esserci invece di gridare.

## Prima di animare

Guarda la grafica al 100%. Un frame con la stampa derivata costa zero da rifare e
costa crediti da scoprire dopo aver animato — più il tempo di capire perché la clip
non convince. È il controllo più economico dell'intera pipeline.
