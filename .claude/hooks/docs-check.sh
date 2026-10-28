#!/usr/bin/env bash
# PostToolUse hook: after a `git commit` that touched source, remind Claude to
# run the docs-check skill and the improve skill. Exit 2 sends stderr back to
# Claude as feedback; exit 0 stays silent.

set -euo pipefail

payload=$(cat || true)
[ -z "$payload" ] && exit 0

cmd=$(printf '%s' "$payload" \
  | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"//; s/"$//' || true)

case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0

changed=$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null || true)
source=$(printf '%s\n' "$changed" | grep -E '^(src/|tools/|package\.json|vite\.config\.js|\.github/workflows/)' || true)
[ -z "$source" ] && exit 0

{
  echo "[docs-check] Commit $(git rev-parse --short HEAD) touched source:"
  printf '%s\n' "$source" | sed 's/^/  - /'
  echo "Run the 'docs-check' skill to catch doc drift. Before finishing the task, run the 'improve' skill."
} >&2
exit 2
