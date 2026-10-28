---
name: docs-check
description: Check CLAUDE.md, README.md and docs/ against the code after a source change, and fix drift. Use when the commit hook asks, or when asked to audit the docs.
---

# docs-check

You were invoked because source changed, or someone asked for a docs audit.
Find drift between the docs and the code and fix it with targeted edits, not
rewrites.

## Gather

1. `git log -1 --stat` and `git diff HEAD~1 HEAD -- '*.md'`.
2. The docs the change touches (table below).

## What lives where

| Claim | Lives in | Check against |
|---|---|---|
| Scenes, entry points, URL params, triggers | `docs/SCENES.md`, root `README.md` | `src/<scene>/index.html` (`URLSearchParams` reads, event listeners) |
| Style values (timing, brightness, shapes, text) | `docs/MOTION.md` | `src/config/config.js` |
| Budgets and benchmark usage | `docs/PERFORMANCE.md` | `config.performance.thresholds`, `tools/benchmark/` |
| Commands and skills | `CLAUDE.md`, `repeat-routines` | `package.json` scripts, `tools/`, `.claude/skills/` |
| Decisions | `docs/DECISIONS.md` | the PR making the change |

Drift is a doc naming something that no longer exists, missing something that
changes how a scene is used (new param, new scene, removed behavior), or
stating a number that no longer matches config. Wording and order are not
drift.

## Fix and report

Apply the edits right away. Fold them into the unpushed commit that caused
the drift, or make a `docs:` commit. Report in one line when everything is
fresh; otherwise list what you changed in a line or two.
