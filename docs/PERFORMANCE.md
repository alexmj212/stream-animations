# Performance

The background and epcot scenes run for the entire stream (8+ hours) inside
OBS alongside the game and the encoder. Cheap and steady beats pretty.

## Budgets

From `config.performance.thresholds` in `src/config/config.js`:

| Measure | Budget |
|---|---|
| Frame rate | target 60 fps, floor 55 fps under stress |
| Frame time | 16.67 ms; p99 under 20 ms |
| Dropped frames | under 1% |
| Memory | under 300 MB steady state over 8 hours |

Epcot runs at `?fps=30` by default (roughly half the GPU load; slow light
cycles look the same), stops redrawing when static, and has a perf floor at
`size=70`: below it frame time falls off a cliff (see the comment on
`epcot.size` in config).

## Measuring

- `npm run bench` (`tools/benchmark/run.js`): Vite dev server plus headless
  Chrome, samples each scene, and records frame times and Canvas 2D calls.
  Results go to `tools/benchmark-results/`; `REPORT.md` there is the last
  written analysis (2026-05-25: all four bar scenes pass).
- `?perf=true` on any scene shows the live overlay in OBS.
- `tests/integration/performance-regression.test.js` and friends guard the
  math in CI.

## What has worked

- Offscreen canvas caches for text and complex shapes (10 to 20x for the
  shade text) [07-01].
- `hsla()` colors instead of `globalAlpha` [07-01].
- Bounded LRU caches (max 50, evicted every 30 s) so long streams don't grow
  memory [v1.0].

## Known leads

From the 2026-05-25 benchmark and the 2026-01-17 audit: `save()` dominates the
background scene's Canvas time; white-bar cache keys rarely hit because sizes
vary; viewport culling margins (200 to 300 px) are conservative; color strings
are rebuilt per draw. The real OBS validation and the 8-hour soak test were
deferred in v1.0 and v1.1 and are still owed.
