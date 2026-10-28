#!/usr/bin/env bash
# Install Jost (bold, bold italic) as a local font, so headless Chrome renders
# scene text in the stream's face. Without it, cloud containers draw canvas
# text in Arial and mocks look wrong; Defiant has Jost installed for OBS.
# Added 2026-10-28 (follower widget thread): mocks came out in Arial.
set -euo pipefail
dir="${HOME}/.fonts"
mkdir -p "$dir"
# An old user agent makes Google Fonts serve TTF, which fontconfig reads
css=$(curl -fsS -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,700;1,700")
i=0
for url in $(grep -o 'https://[^)]*\.ttf' <<<"$css" | sort -u); do
  i=$((i + 1))
  curl -fsS -o "$dir/jost-$i.ttf" "$url"
done
fc-cache -f "$dir" >/dev/null
fc-list | grep -i jost
