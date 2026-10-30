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
- Stamping pre-turned sprites instead of rotating each `drawImage`. Rotated
  draws cost ~3.5x as much in Chromium's software raster, and OBS behaved the
  same way: the Spheal march peak went from ~34 fps in OBS and 33 fps headless
  to 60 fps headless. Bake the angles into a square only as large as the
  visible pixels, because a full-diagonal square doubles the fill
  [2026-10-29, Spheal march].

## OBS GPU

OBS's own GPU use counts as much as any scene's frame time (AJ, 2026-10-30:
~30% GPU while idle). Measured idle on Defiant that day: video encode 23% and
CUDA 13% from the always-on Replay Buffer and Aitum Vertical Backtrack, 3D 23%
from drawing both canvases at 60 fps, browser pages about 4%. So look at the
encoders and the canvases before the pages. Budget: OBS idle GPU under 10% on
every engine when not live.

- `tools/gpu/obs-gpu-log.ps1` (on Defiant, read only) logs OBS's GPU use per
  engine every 5 s to `tools/gpu-results/obs-gpu-<date>.csv`, with the
  browser pages' 3D share and the whole machine beside it. Task Manager's one
  number is roughly the busiest engine, so compare engines, not totals.
- `npm run gpu:summary -- <csv> [--from=HH:MM --to=HH:MM]` gives median, p95
  and max per engine for a stretch, to compare before and after a change.
- To find what costs what, stop one thing for 30 s while off-air, read the
  drop, and put it back.
- A browser source that draws continuously (WebGL, video, a loop) should have
  "Shutdown source when not visible" on, or pause itself when hidden;
  otherwise it costs GPU in every scene.

## Known leads

From the 2026-05-25 benchmark and the 2026-01-17 audit: `save()` dominates the
background scene's Canvas time; white-bar cache keys rarely hit because sizes
vary; viewport culling margins (200 to 300 px) are conservative; color strings
are rebuilt per draw. The real OBS validation and the 8-hour soak test were
deferred in v1.0 and v1.1 and are still owed.
