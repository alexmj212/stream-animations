#!/usr/bin/env bash
# Tags and publishes every release on main that has no tag yet.
#
# A release is a squash-merged "chore(release): vX.Y.Z (#N)" commit. For each
# one without a vX.Y.Z tag, this creates the tag on that commit and a GitHub
# release whose notes are the CHANGELOG.md section. The newest version is
# marked latest. Run by the release job in .github/workflows/pages.yml after
# the deploy and smoke pass, so nothing waits on a person or on Defiant
# (AJ, 2026-10-29: "I don't want to type go anymore").
#
# It catches up on any release a cancelled run skipped. DRY_RUN=1 prints what
# it would do. Needs GH_TOKEN with contents: write, and full git history.
set -euo pipefail

cd "$(dirname "$0")/../.."
latest="v$(node -p "require('./package.json').version")"

# Release commits on main, oldest first. Recent ones only: everything before
# v2.4.0 was tagged by hand.
git log --reverse --format='%H %s' -n 300 HEAD |
  sed -nE 's/^([0-9a-f]{40}) chore\(release\): (v[0-9]+\.[0-9]+\.[0-9]+)( \(#[0-9]+\))?$/\1 \2/p' |
  while read -r sha version; do
    if git ls-remote --exit-code --tags origin "refs/tags/$version" >/dev/null; then
      continue
    fi
    notes="$(mktemp)"
    # The version's section, then the [#N] link definitions it uses.
    git show "$sha:CHANGELOG.md" | awk -v v="$version" '
      $0 ~ "^## " v " " { on = 1; next }
      on && /^## v/ { exit }
      on { print }
    ' > "$notes"
    git show "$sha:CHANGELOG.md" | grep -E '^\[#[0-9]+\]: ' | while read -r def; do
      ref="${def%%:*}"
      if grep -qF "($ref)" "$notes"; then echo "$def"; fi
    done > "$notes.links"
    if [ -s "$notes.links" ]; then
      printf '\n' >> "$notes"
      cat "$notes.links" >> "$notes"
    fi
    if [ ! -s "$notes" ]; then
      echo "No CHANGELOG section for $version at $sha" >&2
      exit 1
    fi
    flag="--latest=false"
    [ "$version" = "$latest" ] && flag="--latest"
    if [ "${DRY_RUN:-}" = 1 ]; then
      echo "would publish $version at $sha ($flag)"
      cat "$notes"
    else
      gh release create "$version" --target "$sha" --title "$version" \
        --notes-file "$notes" "$flag"
      echo "Published $version at $sha"
    fi
  done
