#!/usr/bin/env bash
# Monta un ad verticale dai clip Kling grezzi.
#
#   ./scripts/build-ad.sh <clip1> <clip2> <clip3> <cartella-output>
#
# Con musica:
#   MUSIC=track.mp3 MUSIC_AT=14.155 D1=3.44 D2=3.44 D3=6.02 SKIP2=0.60 \
#     ./scripts/build-ad.sh ...
#
# Produce due file: la versione Instagram Story (senza CTA scritto, perche' lo
# mette Instagram col suo bottone) e quella TikTok (col CTA negli ultimi due
# secondi, perche' li' il bottone non c'e').
#
# Perche' ffmpeg e non un montaggio a mano: al prossimo drop cambi tre file e
# hai l'ad. E i tagli devono cadere al frame esatto, cosa che a occhio non fai.
#
# ── Le due cose che non sono opinabili ───────────────────────────────────────
#
# LE DURATE LE DETTA LA TRACCIA, non il contrario. Senza musica 4/4/6 e' un
# default ragionevole. Con una traccia vera si misura la sua griglia e ci si
# monta sopra — le durate diventano multipli dell'unita' forte:
#
#   1. profilo di energia al secondo -> trova dove entra la sezione piena
#      (quasi ogni traccia di libreria ha un'introduzione da scartare)
#   2. comb filter su quella finestra -> periodo e fase dell'unita' forte
#   3. D1, D2, D3 = multipli interi di quell'unita', MUSIC_AT = la fase
#
# Per "Ur In Control": sezione piena da 14s, unita' forte 0.86s (battito 430ms,
# ~139.5 BPM), primo punto forte a 14.155s. Da cui 4+4+7 unita' = 3.44/3.44/6.02
# e un totale di 12.90s con gli stacchi sui tempi forti.
#
# SKIP2 taglia dall'INIZIO del secondo clip invece che dalla fine: nel drop 03
# serviva a far cadere subito dopo lo stacco il fotogramma in cui il capo si
# accartoccia entrando. Un fotogramma sporco attaccato al taglio si legge come
# transizione; in mezzo alla clip si legge come errore.
#
# NORMALIZZAZIONE a 1080x1920. Kling restituisce formati che non sono 9:16 e
# nemmeno uguali fra loro (716x1284, 720x1276): senza questo passaggio il
# concat fallisce o esce storto.
#
# ── Da fare prima, non qui ───────────────────────────────────────────────────
# Passa i clip grezzi in upscale_video su Higgsfield. Il lanczos qui sotto
# regge sul telefono ma sta interpolando: su un master si vede.
set -euo pipefail

C1="${1:?serve il clip 1 (4s)}"; C2="${2:?serve il clip 2 (4s)}"; C3="${3:?serve il clip 3 (6s)}"
OUT="${4:-.}"; mkdir -p "$OUT"
D1="${D1:-4}"; D2="${D2:-4}"; D3="${D3:-6}"; SKIP2="${SKIP2:-0}"
TOT=$(python3 -c "print(f'{$D1+$D2+$D3:.3f}')")
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
FONT="/System/Library/Fonts/Supplemental/Futura.ttc"

# I testi: PNG trasparenti invece di drawtext, che il build Homebrew di ffmpeg
# non ha (niente freetype). Meglio comunque — sulla spaziatura fra le lettere
# qui c'e' controllo vero, e il marchio vive di maiuscolo spaziato.
python3 - "$TMP" "$FONT" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont
tmp, font_path = sys.argv[1], sys.argv[2]
def render(name, text, size=56, track=14):
    f = ImageFont.truetype(font_path, size, index=0)
    img = Image.new("RGBA", (1080, 200), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    w = sum(d.textlength(c, font=f) + track for c in text) - track
    x = (1080 - w) / 2
    for c in text:
        d.text((x + 2, 64), c, font=f, fill=(0, 0, 0, 90))      # ombra: i fondi cambiano a ogni shot
        d.text((x, 62), c, font=f, fill=(255, 255, 255, 235))
        x += d.textlength(c, font=f) + track
    img.save(f"{tmp}/{name}.png")
render("t1", "WHICH ONE?")
render("t2", "20 PIECES   ·   €22")
render("t3", "DROP 03   ·   JAYL.STORE", size=46, track=12)
PY

VF="scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1"
i=1; for c in "$C1" "$C2" "$C3"; do
  case $i in 1) d=$D1; ss=0;; 2) d=$D2; ss=$SKIP2;; 3) d=$D3; ss=0;; esac
  ffmpeg -v error -y -ss "$ss" -i "$c" -t "$d" -vf "$VF" -c:v libx264 -crf 17 -pix_fmt yuv420p "$TMP/$i.mp4"
  printf "file '%s'\n" "$TMP/$i.mp4" >> "$TMP/list.txt"; i=$((i+1))
done
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/cut.mp4"

# I testi stanno nella fascia alta: in basso ci vanno lo sticker link di IG e
# le caption di TikTok, e nell'ultimo shot niente testo — il macro sul colletto
# e' l'argomento di vendita e coprirlo sarebbe sprecarlo.
# I tempi si derivano dalle durate: se cambiano gli stacchi, il testo li segue.
# Ogni riga sta dentro il suo shot e sparisce prima del taglio — un testo a
# cavallo di uno stacco si legge come un errore di montaggio.
read -r T1A T1B T2A T2B T3A < <(python3 -c "
d1,d2,tot=$D1,$D2,$TOT
print(f'{0.7:.2f} {d1-0.3:.2f} {d1+0.45:.2f} {d1+d2-0.25:.2f} {tot-2.2:.2f}')")
FC="[1:v]format=rgba,fade=t=in:st=$T1A:d=0.35:alpha=1,fade=t=out:st=$(python3 -c "print(f'{$T1B-0.35:.2f}')"):d=0.35:alpha=1[t1];\
[2:v]format=rgba,fade=t=in:st=$T2A:d=0.35:alpha=1,fade=t=out:st=$(python3 -c "print(f'{$T2B-0.35:.2f}')"):d=0.35:alpha=1[t2];\
[0:v][t1]overlay=x=0:y=330:enable='between(t,$T1A,$T1B)'[v1];\
[v1][t2]overlay=x=0:y=330:enable='between(t,$T2A,$T2B)'[v]"

ffmpeg -v error -y -i "$TMP/cut.mp4" -loop 1 -t "$TOT" -i "$TMP/t1.png" -loop 1 -t "$TOT" -i "$TMP/t2.png" \
  -filter_complex "$FC" -map "[v]" -t "$TOT" \
  -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart "$OUT/ad-IG.mp4"

ffmpeg -v error -y -i "$TMP/cut.mp4" -loop 1 -t "$TOT" -i "$TMP/t1.png" -loop 1 -t "$TOT" -i "$TMP/t2.png" -loop 1 -t "$TOT" -i "$TMP/t3.png" \
  -filter_complex "$FC;[3:v]format=rgba,fade=t=in:st=$T3A:d=0.4:alpha=1[t3];[v][t3]overlay=x=0:y=1420:enable='between(t,$T3A,$TOT)'[vt]" \
  -map "[vt]" -t "$TOT" \
  -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart "$OUT/ad-TIKTOK.mp4"

# Musica, se passata. -14 LUFS e' il livello a cui le piattaforme normalizzano:
# consegnare piu' alto significa solo farsi abbassare il volume e perdere
# dinamica. Serve una traccia con licenza commerciale (Sound Collection di Meta
# o Commercial Music Library di TikTok) — l'audio di tendenza sulle inserzioni
# viene rifiutato o mutato.
if [ -n "${MUSIC:-}" ]; then
  AT="${MUSIC_AT:-0}"
  END=$(python3 -c "print(f'{$AT+$TOT:.3f}')")
  FO=$(python3 -c "print(f'{$TOT-1:.3f}')")
  for v in IG TIKTOK; do
    ffmpeg -v error -y -i "$OUT/ad-$v.mp4" -i "$MUSIC" -filter_complex \
      "[1:a]atrim=$AT:$END,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.15,afade=t=out:st=$FO:d=1.0,loudnorm=I=-14:TP=-1.0:LRA=11[a]" \
      -map 0:v -map "[a]" -t "$TOT" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT/ad-$v-music.mp4"
    mv "$OUT/ad-$v-music.mp4" "$OUT/ad-$v.mp4"
  done
fi

echo "✓ $OUT/ad-IG.mp4 e $OUT/ad-TIKTOK.mp4 — ${TOT}s, 1080x1920"
