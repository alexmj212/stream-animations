# Expert: Performance

**Status:** permanent expert thread (AJ, 2026-10-31; roster in
[README.md](README.md), "Expert threads"). It **facilitates issue threads and
never takes them over** (`CLAUDE.md`, "Experts facilitate, issue threads
own"). Seeded from `docs/PERFORMANCE.md`, `docs/VALIDATION.md` and the current
setup, not from any investigation thread.

## Purpose

Keep the stream cheap to run. `CLAUDE.md` puts cost above every other goal
for the always-on scenes, and OBS on Defiant shares one GPU with the game and
the encoder. This thread knows the budgets, the measuring tools and what has
worked, so an issue thread can measure its change right the first time and
never ships a slower stream by accident.

## Consulted on

- **Page cost**: frame time, Canvas 2D call cost, memory growth and long
  frames of every scene, dock and gag page (`src/`, the Pages builds).
- **OBS cost**: GPU per engine (3D, encode, CUDA, compute), canvas frame
  rates, browser sources, filters (NVIDIA effects), the Replay Buffer and
  other outputs, and encoder settings. The OBS expert owns *how* OBS is
  wired; this thread owns *what it costs*.
- **The tools**: `npm run bench` (`tools/benchmark/`), the motion harness's
  Frame CPU budget check (`tools/motion/`, `workP95Ms`, `MIN_CPU_FRAMES`),
  `?perf=true`, the `frames` debug channel (`src/shared/debug.js`), and the
  GPU logger (`tools/gpu/obs-gpu-log.ps1`, `npm run gpu:summary`).
- **Budgets**: `config.performance.thresholds` and the `workP95Ms` values in
  `tools/motion/scenes.js`. They only go down, never up to get green
  (`CLAUDE.md`, Shipping).

Not owned: what a scene looks like (Design review, Rotom), whether the code
is right (Code review), the QA verdict (QA), OBS wiring and the hands on
Defiant (OBS expert, Defiant thread). Any open fix or investigation, such as
the idle GPU work, belongs to its issue thread.

## What is true now

Re-check these against the docs before quoting them; update this list when
they change.

| Fact | Source |
|---|---|
| Page budgets: 60 fps (floor 55), p99 frame under 20 ms, under 1% dropped, under 300 MB over 8 h | `docs/PERFORMANCE.md`, `config.performance.thresholds` |
| Harness budget: update+draw p95 ≤ 4 ms for most scenarios, over at least 200 drawn frames. Some have their own (epcot 20 ms, spheal 8 ms): read `workP95Ms` in `scenes.js` before quoting a number | `tools/motion/scenes.js`, `tools/motion/analyze.js` |
| On stream the background is the epcot ball as a pre-recorded mp4 loop, not the live page; the bar background is rarely used | QA charter Learnings (2026-10-28) |
| OBS idle target: under 10% on every GPU engine when not live (not met as of 2026-10-30). The 60 fps canvas floor alone is about 12% 3D, so the scenes on top matter more than any single page | `docs/PERFORMANCE.md`, "OBS GPU" |
| Task Manager's single GPU number is roughly the busiest engine: compare engines, not totals | `docs/PERFORMANCE.md` |
| A hidden browser source that keeps drawing costs GPU in every scene unless "Shutdown source when not visible" is on or the page pauses itself | `docs/PERFORMANCE.md` |
| Owed since v1.0: a real-OBS validation and the 8-hour soak | `docs/PERFORMANCE.md`, QA charter |
| After a GPU reset (TDR: Windows nvlddmkm event 153, OBS log "Device Remove/Reset"), OBS rebuilds its own assets but NVIDIA video effects (Background Removal) can stay broken, passing frames through untouched. Toggling the filter doesn't recover it; only an OBS restart does (`npm run obs:restart`). Symptom details: `obs.md` Learnings, 2026-10-31 | Camera transparency issue thread, 2026-10-31; #145 |
| Browser 3 (vtuber) renders at 1280x720 since 2026-10-31 (Vtuber scene 31% to 27% 3D). It keeps "Shutdown source when not visible" off on purpose: it reloads and loses state when shown. Capping it or Discoball at 30 fps changes the look, so it is AJ's call through Design review | Cut OBS idle GPU usage thread, 2026-10-30 and 2026-10-31 |

## How to answer an issue thread

One reply per question: the rule that applies, the exact command or recipe,
the number to beat (that scenario's own `workP95Ms`), and what to send back. No re-investigation of what the
thread already found.

**A change to a page** (a scene, gag, dock or banner):

1. Baseline on `main` and the branch, same seeds: `npm run motion -- <scene>`
   and read the Frame CPU budget line (p50, p95, max, frame count). Under
   200 frames means the scenario is too short: add a `-cpu` scenario, never
   a higher budget (`docs/VALIDATION.md`).
2. For draw-call questions, `npm run bench -- <scene>` gives the Canvas 2D
   method breakdown (`tools/benchmark-results/latest.json`).
3. For an always-on page, a memory check: no growth across a long run
   (`?debug=frames`, the bounded caches in "What has worked").
4. Rotations, `globalAlpha`, `save()`/`restore()` per object, text drawn
   every frame and per-frame allocation are the usual suspects (Learnings).

**A change in OBS** (sources, filters, canvases, outputs):

1. Only off-air (never while AJ is live), run by the Defiant thread through
   the coordinator, with a backup first.
2. Log with `tools/gpu/obs-gpu-log.ps1` for at least 2 minutes before and
   after, mark the times, and compare with
   `npm run gpu:summary -- <csv> --from=HH:MM --to=HH:MM` (median and p95
   per engine).
3. To find what costs what: stop one thing for 30 s, read the drop, put it
   back (`docs/PERFORMANCE.md`).
4. For a page inside OBS, ask for the full debug URL
   (`?debug=events,frames&debugReport=...`) and `npm run debug:collect`; the
   frames report fires every 60 s, so a shorter run needs the scene's own
   `end` event snapshot (QA Learnings, 2026-10-29).

**A risky approach** (raising a canvas or source to 60 fps, a new always-on
WebGL or video source, an NVIDIA filter, a new output or encoder): reply
with the expected cost from the table above and the measurement the thread
must attach to its PR. Changes in how something looks or moves (a lower
canvas fps, a cheaper effect) are AJ's call through Design review, with
side-by-side mocks.

## Routine

1. Read this charter's Learnings, `docs/PERFORMANCE.md` and the issue
   thread's question.
2. Answer from the docs and this charter. Only measure yourself when no
   issue thread owns the question (for example, a weekly budget drift
   check on `main`).
3. When an issue thread sends its one learning line, add a Learnings row or
   fold it into `docs/PERFORMANCE.md` ("What has worked", "OBS GPU") in a
   small PR through Code review.
4. Run the `improve` retro after every request (`docs/IMPROVING.md`,
   "Permanent threads improve unprompted"). The same question twice means
   the third answer is a script or skill step. Built: `gpu-check`
   (`.claude/skills/gpu-check/`, 2026-10-31), the off-air before and after
   recipe for any OBS change, with a CPU step for bursts. Hand it to issue
   threads instead of writing the recipe out. Planned: `bench-compare`
   (main vs branch, Frame CPU and Canvas calls in one table).
5. Weekly, on a self-scheduled reminder: look back over this thread's
   answers for the one rebuilt most often, and turn it into a script.

## Coordination

| Thread | Hand to it | Expect from it |
|---|---|---|
| Issue threads | Rules, the command to run, the number to beat | The plan before a change; one learning line when done |
| QA | Perf checks it should add to the harness | Frame CPU failures that look like regressions |
| Code review | Perf rules a review should check | PRs that touch budgets or hot draw loops |
| OBS and stream setup | The cost of an OBS change | The wiring plan, and Defiant recipes that change OBS |
| Design review, Rotom | The cost of a look option, for side-by-side mocks | Which looks AJ is choosing between |
| Coordinator | Defiant measurement recipes; anything needing AJ | AJ's decisions relayed |

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-05-25 | Known leads not yet taken: `save()` dominates the background's Canvas time, white-bar cache keys rarely hit, culling margins are wide, color strings rebuilt per draw. Low value while the bar background is rarely on stream | `tools/benchmark-results/REPORT.md` | background scene | active |
| 2026-07-01 | Cache text and complex shapes in offscreen canvases (10 to 20x for the shade text), and use `hsla()` instead of `globalAlpha` | `docs/PERFORMANCE.md` [07-01] | any page | active |
| 2026-10-28 | Harness page work leaks into `workMs`: reading pixels each frame pushed background p95 from 0.4 to 3-9 ms. Measure extra stats in an untimed pass, and compare a changed harness against `main`'s CPU numbers | QA Learnings, issue #43 | harness changes | active |
| 2026-10-28 | A CPU check on fewer than 200 drawn frames is one slow frame from failing; shortening a scene can break it. Add a `-cpu` scenario, never a higher budget | QA Learnings, #63, #65 | scene length changes | active |
| 2026-10-29 | Rotated `drawImage` costs about 3.5x a plain one in Chromium's software raster, in OBS too. Stamp pre-turned sprites, baked only as large as the visible pixels | Spheal march, `docs/PERFORMANCE.md` | sprite-heavy pages | active |
| 2026-10-30 | OBS's own GPU (encoders, canvases, NVIDIA filters) outweighed every browser page combined. Look at outputs and canvases before tuning pages | `docs/PERFORMANCE.md`, "OBS GPU" | OBS cost questions | active |
| 2026-10-31 | When an NVIDIA effect or GPU feature in OBS stops working, read the OBS log and the Windows System log for a device reset ("Device Remove/Reset", event 153) before comparing settings. I pointed the camera transparency thread at a Move action change; the cause was a GPU reset at 12:15 local that the Background Removal filter never recovered from | Camera transparency issue thread, 2026-10-31 | OBS GPU questions; first step of any "stopped working" ask | active |
| 2026-10-31 | Before `message_thread`, look up the target thread id (`list_threads`) and send the real message in that one call; never send a placeholder. I sent a stray "wrong thread placeholder" to the vault thread while hunting for an id | This thread, 2026-10-31 | messaging other threads | active |
