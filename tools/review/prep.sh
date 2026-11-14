#!/usr/bin/env bash
# Prepare a PR for review in one command (Code review, 2026-11-07 self-audit:
# every review round repeated the same five git calls by hand).
#
#   tools/review/prep.sh <pr-number> [worktree-dir]
#   tools/review/prep.sh --squash <pr-number> <merged-sha>
#
# Default mode fetches main and the PR head, checks the head out detached in
# its own worktree (default: $TMPDIR/review-<pr>), and prints the full head
# sha (for the review's commit id), whether it merges cleanly with main, the
# diff stat, and a column-count check for every Markdown table row the PR
# adds (a broken Learnings row is easy to miss by eye).
#
# --squash checks that a merged squash commit carries exactly the reviewed
# head merged onto its parent, so nothing unreviewed slipped in at merge.
set -euo pipefail

remote=${REVIEW_REMOTE:-origin}

if [[ ${1:-} == "--squash" ]]; then
    pr=${2:?pr number}; merged=${3:?merged sha}
    git fetch -q --force "$remote" main "pull/$pr/head:refs/review/$pr"
    parent=$(git rev-parse "$merged^1")
    expect=$(git merge-tree --write-tree "$parent" "refs/review/$pr") || {
        echo "squash check: reviewed head conflicts with $parent"; exit 1; }
    actual=$(git rev-parse "$merged^{tree}")
    if [[ $expect == "$actual" ]]; then
        echo "squash check: OK, $merged is the reviewed head $(git rev-parse "refs/review/$pr") on $parent"
    else
        echo "squash check: MISMATCH, $merged differs from the reviewed head:"
        git diff --stat "$expect" "$actual"
        exit 1
    fi
    exit 0
fi

pr=${1:?usage: tools/review/prep.sh <pr-number> [worktree-dir]}
dir=${2:-${TMPDIR:-/tmp}/review-$pr}

git fetch -q "$remote" main "pull/$pr/head:refs/review/$pr" --force
head=$(git rev-parse "refs/review/$pr")
main=$(git rev-parse "$remote/main")

if [[ -d $dir ]]; then
    git -C "$dir" checkout -q --detach "$head"
else
    git worktree add -q --detach "$dir" "$head"
fi

echo "PR #$pr head: $head"
echo "worktree:     $dir"
echo "main:         $main"
if git merge-tree --write-tree "$main" "$head" >/dev/null 2>&1; then
    echo "merge:        clean with main"
else
    echo "merge:        CONFLICTS with main:"
    # merge-tree exits 1 on a conflict; under pipefail that would end the
    # script here, before the diff stat and table check (seen on #169)
    { git merge-tree --write-tree --name-only --no-messages "$main" "$head" || true; } | tail -n +2 | sed '/^$/d; s/^/  /'
    conflicted=1
fi
base=$(git merge-base "$main" "$head")
if [[ $base != "$main" ]]; then
    echo "behind main:  $(git rev-list --count "$head..$main") commit(s)"
fi
echo
git diff --stat "$base" "$head"

# Every added table row must have as many cells as its table's header row.
bad=0
while IFS= read -r file; do
    [[ $file == *.md ]] || continue
    added=$(git diff -U0 "$base" "$head" -- "$file" | sed -n 's/^+\(|.*\)$/\1/p')
    [[ -n $added ]] || continue
    while IFS= read -r row; do
        # An escaped pipe (\|) sits inside a cell, so drop it before counting.
        cells=$(sed 's/\\|//g' <<<"$row" | awk -F'|' '{print NF}')
        # The nearest header above this row in the PR's version of the file.
        header=$(git show "$head:$file" | awk -v row="$row" '
            /^\|/ { if (!intable) { hdr = $0; intable = 1 } }
            !/^\|/ { intable = 0 }
            $0 == row { print hdr; exit }')
        want=$(sed 's/\\|//g' <<<"$header" | awk -F'|' '{print NF}')
        if [[ $cells != "$want" ]]; then
            echo "table: $file row has $((cells - 2)) cells, header has $((want - 2)): ${row:0:80}"
            bad=1
        fi
    done <<<"$added"
done < <(git diff --name-only "$base" "$head")
[[ $bad == 0 ]] && echo "tables:       every added row matches its header"
[[ $bad == 0 && -z ${conflicted:-} ]] || exit 1
