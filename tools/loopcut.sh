#!/usr/bin/env bash
# loopcut.sh - cut a perfect-loop segment from an OBS recording of the
# epcot scene (or any scene recorded with the ?loop= setting).
#
# Produces two files next to the recording (or in --outdir):
#   <name>-<loop>s.mp4         full resolution @ source fps, CRF 16
#   <name>-<loop>s-720p30.mp4  1280x720 @ 30fps (lanczos), CRF 14
#
# Both are cut to EXACTLY loop*fps frames (frame-accurate re-encode; a
# stream-copy can only cut at keyframes), audio-stripped, yuv420p,
# +faststart - ready for an OBS Media Source with Loop checked.
#
# Usage:
#   tools/loopcut.sh [options] <recording>
#     -l, --loop SECONDS   loop period of the recording (default 48).
#                          Remember: real loop length = ?loop= / speed.
#     -s, --skip SECONDS   lead-in to skip from the recording start
#                          (default 1.0 - avoids page-load frames)
#     -o, --outdir DIR     output directory (default: alongside input)
#     -n, --name NAME      output base name (default: input filename stem)
#
# Windows paths (F:\...) are converted to /mnt/... automatically (WSL).
# Set FFMPEG / FFPROBE env vars to use specific binaries.

set -euo pipefail

LOOP=48
SKIP=1.0
OUTDIR=""
BASE=""

usage() { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -l|--loop) LOOP="$2"; shift 2 ;;
    -s|--skip) SKIP="$2"; shift 2 ;;
    -o|--outdir) OUTDIR="$2"; shift 2 ;;
    -n|--name) BASE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) IN="$1"; shift ;;
  esac
done

[[ -z "${IN:-}" ]] && usage

# Windows path -> WSL mount (F:\dir\file -> /mnt/f/dir/file)
if [[ "$IN" =~ ^([A-Za-z]):[\\/] ]]; then
  drive=$(echo "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]')
  IN="/mnt/${drive}/$(echo "${IN:3}" | tr '\\' '/')"
fi

[[ -f "$IN" ]] || { echo "error: input not found: $IN" >&2; exit 1; }

FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-ffprobe}"
command -v "$FFMPEG" >/dev/null || { echo "error: ffmpeg not found (install it or set FFMPEG=/path/to/ffmpeg)" >&2; exit 1; }
command -v "$FFPROBE" >/dev/null || { echo "error: ffprobe not found (install it or set FFPROBE=/path/to/ffprobe)" >&2; exit 1; }

PROBE=$("$FFPROBE" -v error -select_streams v:0 \
  -show_entries stream=r_frame_rate -show_entries format=duration \
  -of csv=p=0 "$IN")
RATE=$(head -n1 <<<"$PROBE")
DURATION=$(sed -n 2p <<<"$PROBE")

FPS=$(awk -F/ '{printf "%.6f", $1/$2}' <<<"$RATE")
FRAMES_FULL=$(awk -v f="$FPS" -v l="$LOOP" 'BEGIN{printf "%d", f*l+0.5}')
FRAMES_720=$(awk -v l="$LOOP" 'BEGIN{printf "%d", 30*l+0.5}')

# Sanity: loop*fps must be (near) integer or the cut cannot be exact
awk -v f="$FPS" -v l="$LOOP" 'BEGIN{d=f*l; exit (d-int(d) < 0.001 || int(d)+1-d < 0.001) ? 0 : 1}' \
  || { echo "error: loop ($LOOP s) x fps ($FPS) is not an integer frame count - the cut cannot be exact" >&2; exit 1; }

awk -v d="$DURATION" -v s="$SKIP" -v l="$LOOP" 'BEGIN{exit (d >= s+l) ? 0 : 1}' \
  || { echo "error: recording is ${DURATION}s but skip($SKIP) + loop($LOOP) needs $(awk -v s="$SKIP" -v l="$LOOP" 'BEGIN{print s+l}')s" >&2; exit 1; }

dir=$(dirname "$IN")
stem=$(basename "$IN")
stem="${stem%.*}"
OUTDIR="${OUTDIR:-$dir}"
BASE="${BASE:-$stem-loop}"

OUT_FULL="$OUTDIR/$BASE-${LOOP}s.mp4"
OUT_720="$OUTDIR/$BASE-${LOOP}s-720p30.mp4"

echo "source:   $IN (${DURATION}s @ ${FPS}fps)"
echo "cutting:  skip ${SKIP}s, ${LOOP}s = ${FRAMES_FULL} frames (full) / ${FRAMES_720} frames (720p30)"

"$FFMPEG" -hide_banner -loglevel warning -ss "$SKIP" -i "$IN" \
  -frames:v "$FRAMES_FULL" -c:v libx264 -crf 16 -preset medium \
  -pix_fmt yuv420p -an -movflags +faststart -y "$OUT_FULL"
echo "wrote:    $OUT_FULL"

"$FFMPEG" -hide_banner -loglevel warning -ss "$SKIP" -i "$IN" \
  -vf "fps=30,scale=1280:720:flags=lanczos" \
  -frames:v "$FRAMES_720" -c:v libx264 -crf 14 -preset slow \
  -pix_fmt yuv420p -an -movflags +faststart -y "$OUT_720"
echo "wrote:    $OUT_720"

for f in "$OUT_FULL" "$OUT_720"; do
  info=$("$FFPROBE" -v error -count_frames -select_streams v:0 \
    -show_entries stream=nb_read_frames -show_entries format=duration \
    -of csv=p=0 "$f")
  frames=$(head -n1 <<<"$info")
  dur=$(sed -n 2p <<<"$info")
  echo "verified: $f -> ${frames} frames, ${dur}s"
done
