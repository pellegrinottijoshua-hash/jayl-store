#!/usr/bin/env bash
# Monta un ad verticale dai clip Kling grezzi.
#
#   ./scripts/build-ad.sh <clip1> <clip2> <clip3> <cartella-output>
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
# DURATE 4 / 4 / 6. I clip Kling escono a 4.0417s e 6.0417s (97 e 145 frame a
# 24fps). Tagliati a 4.000 e 6.000 i due stacchi cadono a 4.0s e 8.0s e la fine
# a 14.0s: a 120 BPM sono i tempi forti delle battute 3, 5 e 8. Sette battute
# esatte. Qualsiasi traccia a 120 BPM allineata al primo frame va a tempo senza
# toccare niente.
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
  d=4; [ $i -eq 3 ] && d=6
  ffmpeg -v error -y -i "$c" -t $d -vf "$VF" -c:v libx264 -crf 17 -pix_fmt yuv420p "$TMP/$i.mp4"
  printf "file '%s'\n" "$TMP/$i.mp4" >> "$TMP/list.txt"; i=$((i+1))
done
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/cut.mp4"

# I testi stanno nella fascia alta: in basso ci vanno lo sticker link di IG e
# le caption di TikTok, e dagli 8s in poi niente testo — il macro sul colletto
# e' l'argomento di vendita e coprirlo sarebbe sprecarlo.
FC="[1:v]format=rgba,fade=t=in:st=0.8:d=0.35:alpha=1,fade=t=out:st=3.25:d=0.35:alpha=1[t1];\
[2:v]format=rgba,fade=t=in:st=4.4:d=0.35:alpha=1,fade=t=out:st=7.25:d=0.35:alpha=1[t2];\
[0:v][t1]overlay=x=0:y=330:enable='between(t,0.8,3.6)'[v1];\
[v1][t2]overlay=x=0:y=330:enable='between(t,4.4,7.6)'[v]"

ffmpeg -v error -y -i "$TMP/cut.mp4" -loop 1 -t 14 -i "$TMP/t1.png" -loop 1 -t 14 -i "$TMP/t2.png" \
  -filter_complex "$FC" -map "[v]" -t 14 \
  -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart "$OUT/ad-IG.mp4"

ffmpeg -v error -y -i "$TMP/cut.mp4" -loop 1 -t 14 -i "$TMP/t1.png" -loop 1 -t 14 -i "$TMP/t2.png" -loop 1 -t 14 -i "$TMP/t3.png" \
  -filter_complex "$FC;[3:v]format=rgba,fade=t=in:st=11.8:d=0.4:alpha=1[t3];[v][t3]overlay=x=0:y=1420:enable='between(t,11.8,14)'[vt]" \
  -map "[vt]" -t 14 \
  -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart "$OUT/ad-TIKTOK.mp4"

# La musica si aggiunge dopo, quando c'e' la traccia con licenza commerciale:
#   ffmpeg -i ad-IG.mp4 -i track.mp3 -filter_complex \
#     "[1:a]atrim=0:14,afade=t=out:st=13:d=1,loudnorm=I=-14:TP=-1[a]" \
#     -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k ad-IG-music.mp4
# -14 LUFS e' il livello a cui le piattaforme normalizzano: consegnare piu' alto
# significa solo farsi abbassare il volume e perdere dinamica.

echo "✓ $OUT/ad-IG.mp4 e $OUT/ad-TIKTOK.mp4 — 14.000s, 1080x1920"
