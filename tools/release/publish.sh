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
# it would do. Needs GH_TOKEN with contents: write, and full git history
# with tags (the checkout has no stored credentials, so tags come from it).
set -euo pipefail

cd "$(dirname "$0")/../.."
latest="v$(node -p "require('./package.json').version")"

# Release commits on main, oldest first. Recent ones only: everything before
# v2.4.0 was tagged by hand.
# First-parent and the (#N) suffix keep it to squash merges, never a release
# branch's own commits. A title may say more after the version
# ("chore(release): v2.15.0, weather page (#166)" went untagged until
# 2026-11-10, when this learned to accept it).
git fetch -q --tags origin 2>/dev/null || true
# A version that fails to publish doesn't stop later ones (v2.18.0's refused
# tag would otherwise hold back every release after it, 2026-11-11). The
# loop runs in a subshell, so failures are recorded in this file.
failed="$(mktemp)"
git log --first-parent --reverse --format='%H %s' -n 300 HEAD |
  sed -nE 's/^([0-9a-f]{40}) chore\(release\): (v[0-9]+\.[0-9]+\.[0-9]+)([,;:] .*)? \(#[0-9]+\)$/\1 \2/p' |
  while read -r sha version; do
    if git rev-parse -q --verify "refs/tags/$version" >/dev/null; then
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
      if grep -qF "$ref" "$notes"; then echo "$def"; fi
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
      # A 403 here usually means $sha's .github/workflows differ from every
      # current branch and tag: GitHub won't let this token create a tag on
      # it (v2.18.0, 2026-11-11, after #178 and #179 changed pages.yml).
      # Someone with their own credentials creates the tag; then this skips it.
      if ! gh release create "$version" --target "$sha" --title "$version" \
        --notes-file "$notes" "$flag"; then
        # Only the newest release has to exist. An older one that can't be
        # published (v2.18.0, after v2.19.0 shipped) is a gap in the
        # release list, not a failure: AJ (2026-11-11), "You've already
        # published 2.19, is there a reason to publish an older version?"
        if [ "$version" = "$latest" ]; then
          echo "Could not publish $version at $sha. If that was a 403 and $sha's workflow files differ from main's, create tag $version on $sha by hand (docs/roles/release-management.md, Learnings 2026-11-11)." >&2
          echo "$version" >> "$failed"
        else
          echo "::warning::Skipped $version: an older release; the newer one carries on." >&2
        fi
        continue
      fi
      echo "Published $version at $sha"
    fi
  done

# package.json's version must end up tagged. If no release commit matched it
# (a title the pattern above missed, as #166 did), fail so the miss is red,
# not a quiet green (code review on #171, 2026-11-10).
if [ "${DRY_RUN:-}" != 1 ] && ! git ls-remote --exit-code --tags origin "refs/tags/$latest" >/dev/null; then
  echo "package.json is $latest but no tag $latest exists after publishing: is its release commit titled 'chore(release): $latest (#N)'?" >&2
  exit 1
fi

if [ -s "$failed" ]; then
  echo "Not published: $(tr '\n' ' ' < "$failed")" >&2
  exit 1
fi
