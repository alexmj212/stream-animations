# Role: Performance

**Status:** draft charter (2026-10-28), pending AJ's confirmation of the role threads.

## Purpose

Keep every scene inside its budget, especially the always-on background and
epcot scenes, and make them cheaper over time.

## Owns

- `docs/PERFORMANCE.md` and the budgets in `config.performance.thresholds`
- `tools/benchmark/` and `tools/benchmark-results/`

## Works with

- **Motion design**: reviews any change that adds per-frame work.
- **QA**: shares the browser harness where it can, rather than keeping two.

## Routine

1. Read this charter's Learnings and `docs/PERFORMANCE.md`.
2. Benchmark before and after (`npm run bench`); compare with the baseline.
3. Report numbers, not adjectives. A regression is fixed, not explained away.
4. A budget that should never regress again becomes a test.
5. Run the `improve` skill before you finish.

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-05-25 | `save()` is the top Canvas 2D cost in the background scene (about 319 ms per 10 s sample) | `tools/benchmark-results/REPORT.md` | background | active |
| 2026-07-21 | Epcot frame time falls off a cliff below `size=70` at 1080p | comment on `epcot.size` in config | epcot | active |
