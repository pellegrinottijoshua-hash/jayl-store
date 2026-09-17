# Drop 03 · NO RUSH — prompt Kling 15s

**Modello** `kling3_0` · **mode** `pro` · **durata** 15 · **aspect** 9:16

**`start_image` = il frame del trittico** (le tre magliette sospese su verde
petrolio). Si imposta con "Turn to video" sulla generazione NBP: quell'immagine
diventa il fotogramma 1. **Nessun Element, nessun `<<<uuid>>>`** — i capi sono
già nel primo fotogramma con la stampa esatta, e gli Element servono solo quando
il soggetto NON è nel frame di partenza.

**`end_image` = il macro colletto**, se l'interfaccia lo espone. Se non lo trovi,
si genera lo stesso: il prompt porta la chiusura sul collo anche senza.

**Due giri, come deciso:** uno `sound: on` e uno `sound: off`. Se l'audio nativo
di Kling dà schiocchi di tessuto puliti si tiene come layer SFX con la musica
sotto; se infila ambienze o pseudo-voci si tiene la muta e i suoni si montano in
ffmpeg. ~30 crediti il giro con audio.

Caratteri: **2016 / 2500**. Il margine è voluto — dopo il primo risultato serve
spazio per aggiungere un lock dove sbanda, senza dover tagliare altrove.

---

```
SCENE
Three cotton t-shirts float in a deep petrol-green void. The camera travels through them and lands on a neck detail.

ACTIVE REFERENCES
The garments, their colours and their printed graphics are exactly as in the start frame: a pink tee near and centred, a light blue tee behind left, a sand tee behind right, each printed back facing camera.

FIRST FRAME
Identical to the start image, already in motion: all three garments drifting, sleeves lifting, hems swinging.

CAMERA
One axis, no roll, no shake. CUT 1 at 47 degrees, CUT 2 at 12 degrees, CUT 3 at 18 degrees. No drift mid-segment.

ACTION
0.0s to 5.0s - the three garments rotate 8 degrees, sleeves drifting outward at 2 km/h, camera pushing in at 3 km/h toward the sand tee behind right.
5.0s HARD CUT
5.0s to 10.0s - extreme macro on the sand tee's printed graphic, the small character's sunglasses centred and filling a third of frame, cotton fibres crossing the ink, the fabric breathing once.
10.0s HARD CUT
10.0s to 15.0s - the sand tee's collar, ribbing and stitch line sharp, the black JAYL wordmark settling centred as the fabric comes to rest.
Cuts only at the specified points, the camera does not cut on its own.

PHYSICS
Heavy cotton: folds fall under their own weight, hems swing half a beat behind the body, the fabric holds its shape.

LIGHTING
One hard key from upper left at 5600K in every segment, raking across the weave so each fold edge and each rib catches a bright line. Backgrounds clean and unlit: saturated petrol green in CUT 1, out-of-focus plum in CUT 3.

STYLE
Photoreal product film, fine grain, shallow depth of field in the macro segments.

POSITIVE LOCKS
The three printed graphics stay sharp and fully readable through CUT 1. The garments are the only objects in frame. The printed ink sits inside the cotton weave in every macro. The black JAYL wordmark stays legible and in focus through the final frame. Garments stay inside the central vertical band, the top 13 percent and bottom 21 percent of frame stay clear.
```
