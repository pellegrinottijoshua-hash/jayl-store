#!/usr/bin/env bash
# Monta un ad verticale dai clip Kling grezzi.
#
#   ./scripts/build-ad.sh <clip1> <clip2> ... <clipN> <cartella-output>
#
# Produce due file: la versione Instagram Story (senza CTA scritto, perche' lo
# mette Instagram col suo bottone) e quella TikTok (col CTA negli ultimi due
# secondi, perche' li' il bottone non c'e').
#
# ── Variabili ────────────────────────────────────────────────────────────────
#   D      durate finali, una per clip, separate da spazi (default: intere)
#   SKIP   quanto togliere dall'INIZIO di ogni clip (default: 0)
#   Y      altezza del testo in px su 1920, una per clip (default: 330)
#   TEXTS  una riga per clip, separate da |, vuota = nessun testo su quel clip
#   CTA    riga in basso, solo nella versione TikTok, sull'ultimo clip
#   MUSIC / MUSIC_AT  traccia e secondo da cui prenderla
#
#   D="3.44 3.44 3.44 4.30" SKIP="0.60 0 0.60 0.74" \
#   TEXTS="PICK YOUR ICON|€22 · FREE SHIPPING|ONLY 20 OF EACH|CLOSES THURSDAY" \
#   CTA="JAYL.STORE" ./scripts/build-ad.sh c1 c2 c3 c4 out/
#
# ── Le cose che non sono opinabili ───────────────────────────────────────────
#
# QUINDICI SECONDI. Una story ad su Instagram non va oltre: piu' lunga viene
# troncata a meta' frase. Lo script si ferma se il totale sfora.
#
# LE DURATE LE DETTA LA TRACCIA, non il contrario. Senza musica le durate
# intere vanno bene. Con una traccia vera si misura la sua griglia e ci si
# monta sopra — le durate diventano multipli dell'unita' forte:
#
#   1. profilo di energia al secondo -> trova dove entra la sezione piena
#      (quasi ogni traccia di libreria ha un'introduzione da scartare)
#   2. comb filter su quella finestra -> periodo e fase dell'unita' forte
#   3. D = multipli interi di quell'unita', MUSIC_AT = la fase
#
# Per "Ur In Control": sezione piena da 14s, unita' forte 0.86s, primo punto
# forte a 14.155s. Da cui 4+4+4+5 unita' = 3.44/3.44/3.44/4.30 e un totale di
# 14.62s con gli stacchi sui tempi forti.
#
# SKIP taglia dall'INIZIO invece che dalla fine: serve quando i primi
# fotogrammi sono deboli (un soggetto ancora fermo) o sporchi (il capo che si
# accartoccia entrando). Un fotogramma sporco attaccato allo stacco si legge
# come transizione; in mezzo alla clip si legge come errore.
#
# NORMALIZZAZIONE a 1080x1920. Kling restituisce formati che non sono 9:16 e
# nemmeno uguali fra loro (716x1284, 720x1276): senza questo passaggio il
# concat fallisce o esce storto.
set -euo pipefail

[ $# -ge 2 ] || { echo "serve almeno un clip e la cartella di output" >&2; exit 1; }
OUT="${@: -1}"; CLIPS=("${@:1:$#-1}"); N=${#CLIPS[@]}
mkdir -p "$OUT"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
FONT="/System/Library/Fonts/Supplemental/Futura.ttc"

# Durate: quelle passate, o la durata intera del clip.
read -r -a DUR  <<< "${D:-}"
read -r -a SKP  <<< "${SKIP:-}"
read -r -a YPOS <<< "${Y:-}"
for ((i=0; i<N; i++)); do
  [ -n "${DUR[i]:-}" ] || DUR[i]=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${CLIPS[i]}")
  [ -n "${SKP[i]:-}" ] || SKP[i]=0
  # 330 tiene il testo sotto la fascia alta che IG copre con nome e sponsor.
  # Si alza quando il soggetto di quello shot arriva fin la': coprire la
  # stampa con la scritta e' l'unico errore che annulla il motivo dell'ad.
  [ -n "${YPOS[i]:-}" ] || YPOS[i]=330
done
TOT=$(python3 -c "print(f\"{sum(float(x) for x in '${DUR[*]}'.split()):.3f}\")")
python3 -c "
import sys
if float('$TOT') > 15.05:
    sys.exit('$TOT s: oltre i 15s che Instagram accetta in una story. Accorcia D.')"

# I testi: PNG trasparenti invece di drawtext, che il build Homebrew di ffmpeg
# non ha (niente freetype). Meglio comunque — sulla spaziatura fra le lettere
# qui c'e' controllo vero, e il marchio vive di maiuscolo spaziato. L'alone
# sfocato sotto il bianco serve perche' i fondi cambiano a ogni shot: senza,
# la stessa riga che si legge sul nero sparisce sul rosa cipria.
python3 - "$TMP" "$FONT" "${TEXTS:-}" "${CTA:-}" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
tmp, font_path, texts, cta = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

def render(name, text, size=56, track=14):
    f = ImageFont.truetype(font_path, size, index=0)
    img = Image.new("RGBA", (1080, 200), (0, 0, 0, 0))
    sha = Image.new("RGBA", (1080, 200), (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(img), ImageDraw.Draw(sha)
    w = sum(d.textlength(c, font=f) + track for c in text) - track
    x = (1080 - w) / 2
    for c in text:
        ds.text((x, 64), c, font=f, fill=(0, 0, 0, 200))
        d.text((x, 62), c, font=f, fill=(255, 255, 255, 240))
        x += d.textlength(c, font=f) + track
    sha = sha.filter(ImageFilter.GaussianBlur(7))
    Image.alpha_composite(sha, img).save(f"{tmp}/{name}.png")

for i, t in enumerate(texts.split("|"), 1):
    if t.strip():
        render(f"t{i}", t.strip())
if cta.strip():
    render("cta", cta.strip(), size=46, track=12)
PY

VF="scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1"
for ((i=0; i<N; i++)); do
  ffmpeg -v error -y -ss "${SKP[i]}" -i "${CLIPS[i]}" -t "${DUR[i]}" -vf "$VF" \
    -c:v libx264 -crf 17 -pix_fmt yuv420p "$TMP/$i.mp4"
  printf "file '%s'\n" "$TMP/$i.mp4" >> "$TMP/list.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/cut.mp4"

# Ogni riga vive dentro il suo shot e sparisce prima dello stacco: un testo a
# cavallo di un taglio si legge come un errore di montaggio. I tempi si
# ricavano dalle durate, quindi se cambiano gli stacchi il testo li segue.
# Fascia alta: in basso ci vanno lo sticker link di IG e le caption di TikTok.
python3 - "$TMP" "$N" "${DUR[*]}" "$TOT" "${YPOS[*]}" <<'PY'
import os, sys
tmp, n, durs, tot = sys.argv[1], int(sys.argv[2]), sys.argv[3].split(), float(sys.argv[4])
ypos = [int(float(y)) for y in sys.argv[5].split()]
durs = [float(x) for x in durs]
start, chains, over, src, inputs = 0.0, [], [], "0:v", []
for i in range(n):
    end = start + durs[i]
    png = f"{tmp}/t{i+1}.png"
    if os.path.exists(png):
        k = len(inputs) + 1          # l'input ffmpeg: 0 e' il video, poi le PNG
        inputs.append(png)
        a = start + 0.5
        # L'ultima riga resta fino alla fine: e' quella che deve essere in campo
        # quando il dito decide se toccare o scorrere.
        last = i == n - 1
        b = tot if last else end - 0.3
        chains.append(f"[{k}:v]format=rgba,fade=t=in:st={a:.2f}:d=0.35:alpha=1"
                      + ("" if last else f",fade=t=out:st={b-0.35:.2f}:d=0.35:alpha=1")
                      + f"[t{k}]")
        over.append(f"[{src}][t{k}]overlay=x=0:y={ypos[i]}:enable='between(t,{a:.2f},{b:.2f})'[v{k}]")
        src = f"v{k}"
    start = end
open(f"{tmp}/fc.txt", "w").write(";".join(chains + over) + f";[{src}]null[v]")
open(f"{tmp}/inputs.txt", "w").write("".join(x + "\n" for x in inputs))
PY

INP=(); while IFS= read -r png; do INP+=(-loop 1 -t "$TOT" -i "$png"); done < "$TMP/inputs.txt"

ffmpeg -v error -y -i "$TMP/cut.mp4" "${INP[@]}" \
  -filter_complex_script "$TMP/fc.txt" -map "[v]" -t "$TOT" \
  -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart "$OUT/ad-IG.mp4"

if [ -f "$TMP/cta.png" ]; then
  CTA_AT=$(python3 -c "print(f'{$TOT-2.2:.2f}')")
  ffmpeg -v error -y -i "$OUT/ad-IG.mp4" -loop 1 -t "$TOT" -i "$TMP/cta.png" \
    -filter_complex "[1:v]format=rgba,fade=t=in:st=$CTA_AT:d=0.4:alpha=1[c];[0:v][c]overlay=x=0:y=1420:enable='between(t,$CTA_AT,$TOT)'[v]" \
    -map "[v]" -t "$TOT" -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart "$OUT/ad-TIKTOK.mp4"
else
  cp "$OUT/ad-IG.mp4" "$OUT/ad-TIKTOK.mp4"
fi

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
      -map 0:v -map "[a]" -t "$TOT" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT/tmp-$v.mp4"
    mv "$OUT/tmp-$v.mp4" "$OUT/ad-$v.mp4"
  done
fi

echo "✓ $OUT/ad-IG.mp4 e $OUT/ad-TIKTOK.mp4 — ${TOT}s, 1080x1920"
