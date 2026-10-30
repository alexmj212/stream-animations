#!/usr/bin/env bash
# Stage the Pages site from an existing `npm run build` into _site (or $1).
# One script for the deploy (.github/workflows/pages.yml) and for local QA
# (`npm run pages:stage`, then `npm run pages:smoke`), so they can't drift.
#
# Layout (https://alexmj212.dev/stream-animations/):
#   <scene>/          loader OBS points at (tools/pages/loader.html);
#                     fetches latest/<scene>/ uncached on every load
#   latest/<scene>/   this deploy's build
#   index.html        loader for epcot (the site's old root URL)
#   version.json      which deploy is live: {"version", "commit"}
#
# The commit is $GITHUB_SHA in CI, else this checkout's HEAD.
set -euo pipefail
cd "$(dirname "$0")/../.."

out=${1:-_site}
# rm -rf below: refuse paths that would wipe the repo, its parent or root
case $out in
  ''|.|./|..|../*|/) echo "stage.sh: refusing to stage into '$out'" >&2; exit 2 ;;
esac
version=$(node -p "require('./package.json').version")
commit=${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || true)}

rm -rf "$out"
mkdir -p "$out"
for scene in stinger sidebar shade notifications followers background epcot title banner spheal gamepicker; do
  # find: vite can nest the output path under dist/<scene>/
  src=$(find "dist/$scene" -name index.html | head -n 1)
  test -s "$src"
  mkdir -p "$out/latest/$scene" "$out/$scene"
  cp "$src" "$out/latest/$scene/index.html"
  sed -e "s|__SCENE__|$scene|" -e "s|__ROOT__|../|" tools/pages/loader.html > "$out/$scene/index.html"
done
sed -e "s|__SCENE__|epcot|" -e "s|__ROOT__|./|" tools/pages/loader.html > "$out/index.html"
printf '{"version":"%s","commit":"%s"}\n' "$version" "$commit" > "$out/version.json"
echo "Staged $out (version $version, commit ${commit:0:7})"
