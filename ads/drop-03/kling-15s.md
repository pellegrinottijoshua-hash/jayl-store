# Drop 03 · NO RUSH — prompt Kling 15s (v2, per-capo con Elements)

**Modello** `kling3_0` · **mode** `pro` · **durata** 15 · **aspect** 9:16

- **`start_image`** = frame Ditto rosa su verde petrolio
- **`end_image`** = macro colletto (se l'interfaccia lo espone)
- **Elements**: i tre capi, iniettati come `<<<uuid>>>`. Qui servono davvero:
  il Kangaskhan gira e mostra il colletto, che nel frame di partenza non c'è.

⚠️ **Prima di lanciare**: verifica che ogni Element contenga davvero le 4 viste.
L'API ne riportava una sola. Se nel Kangaskhan c'è solo il retro, al momento
della rotazione Kling inventa fronte e colletto.

**Struttura** — 4s + 4s + 7s, perché l'ultimo beat fa tre cose:

| | |
|---|---|
| 0–4s | Ditto rosa su petrolio, ruota di 10° |
| 4–8s | Slowpoke azzurra su terracotta, torsione |
| 8–11.5s | Kangaskhan sabbia su prugna, push nel retro fino al macro sugli occhialini del piccolo |
| 11.5–13s | quarto di giro, la camera sale verso il collo |
| 13–15s | il colletto riempie il campo, JAYL nero al centro |

Il dettaglio viene **prima** della rotazione di proposito: il piccolo è sulla
stampa dietro, che è quello che stiamo già guardando. Girare prima vorrebbe dire
perderlo e poi tornare indietro.

Caratteri: **2486 / 2500** — inclusi i 126 dei tre UUID.

---

```
SCENE
Three cotton t-shirts, each floating alone in its own coloured void. The last one turns and the camera closes on its neck.

ACTIVE REFERENCES
<<<3d72e0be-4571-46b5-bcf3-1ec7b6bf0d39>>> pink tee, printed back, on saturated petrol green.
<<<378096c0-b97d-46d5-be5b-07c9ec8e7d87>>> light blue tee, printed back, on burnt terracotta.
<<<7874dca5-5b47-4da5-940b-4379b6679c67>>> sand tee, printed back with a small character holding a baby in its pouch, black JAYL under the collar, on deep plum.
Each garment, background and printed graphic exactly as in its reference.

FIRST FRAME
Identical to the start image: the pink tee centred on petrol green, already drifting, sleeves lifting.

CAMERA
One axis, no roll, no shake. CUT 1 at 47 degrees, CUT 2 at 47 degrees, CUT 3 opening at 29 and closing at 12 degrees. No drift mid-segment.

ACTION
0.0s to 4.0s - the pink tee rotates 10 degrees on petrol green, sleeves drifting at 2 km/h, camera easing in.
4.0s HARD CUT
4.0s to 8.0s - the light blue tee twisting on burnt terracotta, one sleeve swinging toward camera, hem trailing.
8.0s HARD CUT
8.0s to 11.5s - the sand tee on deep plum, printed back to camera, camera pushing into the graphic until the baby character's sunglasses fill a third of frame, cotton fibres crossing the ink.
11.5s to 13.0s - the sand tee rotates a quarter turn at 3 km/h as the camera rises toward the neck.
13.0s to 15.0s - the collar fills frame, ribbing and stitch line sharp, the black JAYL wordmark settling centred as the fabric comes to rest.
Cuts only at the specified points, the camera does not cut on its own.

PHYSICS
Heavy cotton: folds fall under their own weight, hems swing half a beat behind the body, the fabric holds its shape through the turn.

LIGHTING
One hard key from upper left at 5600K in every segment, raking across the weave so each fold edge and each rib catches a bright line. Each background stays clean, unlit, fully saturated.

STYLE
Photoreal product film, fine grain, shallow depth of field from 8.0s onward.

POSITIVE LOCKS
Each printed graphic stays sharp and readable while its garment is in frame. One garment only in each segment. The printed ink sits inside the cotton weave in the macro. Through the turn the sand tee keeps the colour, collar and JAYL wordmark of its reference. The black JAYL wordmark stays legible and in focus through the final frame. Garments stay inside the central vertical band, the top 13 percent and bottom 21 percent of frame stay clear.
```
