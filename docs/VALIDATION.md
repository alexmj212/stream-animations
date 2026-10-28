# Validating motion

`npm run motion` is the source of truth for whether a scene moves correctly.
It renders each scene frame by frame on a virtual clock, measures it, and
writes a report you can look at. CI runs it on every PR
(`.github/workflows/motion.yml`) and uploads the report as an artifact.

For what the scenes should *look* like (timing values, brightness, bar
shapes, text pacing) see [MOTION.md](MOTION.md). This page covers how motion
is built and checked.

## Commands

| Command | What it does |
|---|---|
| `npm run motion` | Every scenario, layout seeds 1-3. Exit code 1 if any check fails. |
| `npm run motion -- stinger sidebar` | Only these scenarios |
| `npm run motion -- --seeds=1,2,3,4,5,6` | More layouts (scenes with random layouts should pass on all of them) |
| `npm run motion -- --color=00b3ff` | Another base color |
| `npm run motion -- --params=scheme=mono` | Extra URL params on every scene, to mock a look without editing `scenes.js` |
| `npm run motion -- --out=before` | Write to `tools/motion-results-before/`, so runs for a before/after mock don't wipe each other |
| `npm run motion:compare -- --runs=before,after --frames=stinger/seed-1/t00750.png --bg=frame.png --out=cmp.png` | Labelled side-by-side grid of keyframes from those runs, over a backdrop, for design decisions |
| `npm run motion -- --fps=30` | Step at another frame rate (OBS browser sources are often set to 30) |
| `npm run motion -- --no-shots` | Skip keyframe screenshots (about 2x faster) |
| `npm run motion -- --dump` | Also write every frame's raw data to `capture.json` |
| `npm run motion -- --jitter` | Uneven frame times, like a loaded OBS. Checks timing and coverage still hold; skips the smoothness and CPU checks |
| `npm run motion:export -- stinger` | Render to a transparent WebM for OBS (see below) |
| `npm run motion:export -- epcot --loop` | Render one seamless epcot loop to MP4 (see below) |
| `npm run bench` | Real-time FPS and Canvas 2D hot paths (complements the harness) |

Report: `tools/motion-results/index.html` (gitignored). Per run it shows the
check table, a keyframe filmstrip on a checkerboard (transparent areas show
as checks), canvas coverage over time, every tracked object's position and
on-screen speed (red circles mark velocity jumps), and update+draw CPU per
frame.

## How it works

`tools/motion/clock.js` is injected before any page script runs and replaces
wall-clock time:

- `requestAnimationFrame` callbacks queue and only run when the harness calls
  `__motion.step(dt)`; `performance.now()` and `Date.now()` return virtual time
- `Math.random` is seeded (`?seed=`), so runs are reproducible
- CSS animations (sidebar text) are paused and advanced in lock-step

So every frame is rendered at an exact timestamp no matter how slow the
machine or the screenshotting is. After each step the harness reads the
canvas alpha (coverage) and the scene's probe (object positions). Scenes
that stack full-size layer canvases (background) are read as one image: the
layers' alpha composited at each pixel (source-over).

Scenes opt in to motion tracking with `registerProbe()` from
`src/shared/motion.js`. It is a no-op unless the harness is present, so
production pages pay nothing.

## Checks

Defined per scenario in `tools/motion/scenes.js`.

| Check | Passes when | Typical cause when it fails |
|---|---|---|
| No page errors | No uncaught errors, console errors or 4xx/5xx requests | Broken import, missing asset |
| Finishes on time | Last visible frame ends at `totalDurationMs` ± 2 frames | Stagger or delays added on top of the duration instead of inside it |
| Leaves the screen clear | Final frame fully transparent | A bar that never deactivates, or parks on screen |
| Fully covers the screen at the cut point | Canvas fully opaque at `fullCoverAtMs` for at least `fullCoverMinMs` | Curtains that don't overlap, a phase that ends before the cut |
| Covers *region* | A region (fractions of the screen) is opaque on every frame of a window | Panel positioned from the wrong property, slanted edge not accounted for |
| Smooth motion | No isolated velocity jumps on any on-screen object | A phase hand-off that resets velocity (ease to a stop, then snap to a drift) |
| Frame CPU budget | p95 of update+draw time ≤ `workP95Ms` | Per-frame allocation, cache thrash, too many objects drawn |
| Text over *panel* | Every canvas pixel under a text element's on-screen box (`textBox.selector`) is opaque through a window | Long text hanging off the slanted panel over the stream |
| Scene events | The scene's debug events (`?debug=events`) match `debugEvents` counts exactly | A trigger that restarts the scene, a scene that never marks `end` |

### Smooth motion, precisely

For each tracked object, velocity is taken per frame and Δv between frames.
A frame is a jump when its Δv sticks out past *both* neighbours' Δv by more
than half of `minStep` (an isolated spike rather than a trend) and the spike
is at least `minStep` (45px/s) and larger than 0.45 × (speed + 100px/s).
Speed matters because the eye notices the same Δv much more on a slow
object. Changes of acceleration, like the sign flip in the middle of an
ease-in-out or an ease-out handing over to a constant drift, move Δv
monotonically and are not flagged. Off-screen samples and wrap-arounds
(displacement over 400px in one frame) are ignored. The detector is covered
by `tests/tools/motionAnalyze.test.js`.

### Debug signals

AJ's rule (2026-10-28): agents add whatever signals they need to the scene
code to verify without asking AJ. Everyone uses one convention,
`src/shared/debug.js`:

| Piece | What it does |
|---|---|
| `const debug = createDebug('stinger')` | One recorder per scene. Without `?debug=` it's a frozen no-op, so production pays nothing |
| `?debug=1` / `all` / `events,frames,log` | Channels. `events`: timestamped `debug.mark(name, data)` calls. `frames`: frame-time count, mean, max, long frames (>34ms), idle gaps. `log`: echo events to the console. `build`: the build stamp on screen. `zones`: the screen areas other overlays cover, drawn over the scene (sidebar: Mix It Up's images, `config.sidebar.miuZones`) |
| `window.__debug[scene].snapshot()` | Everything recorded so far, readable from the harness, Playwright or a CDP client |
| `?debugReport=http://127.0.0.1:9777/` + `npm run debug:collect` | Scenes POST each event, and frame stats every 60s, to a local collector that writes `tools/debug-results/*.jsonl`. Use it for checks inside OBS and soak runs |

Scenes mark `start` and `end`, and the stinger also marks `trigger`,
`ignored` and `obsSourceActiveChanged`. The harness loads every scenario with
`?debug=events`, and the `debugEvents` check asserts exact counts. The stinger
scenario fires `transitionStart` and `obsSourceActiveChanged` together, the
way OBS can, and expects one start, one ignored trigger and one end.

To add a signal, call `debug.mark()` where the thing happens. To add a
channel, add it to `DEBUG_CHANNELS` and this table.

### CPU numbers

`workMs` is the real time spent inside the scene's rAF callback: JS plus
Canvas 2D command recording. It does not include GPU raster or compositing,
so it is a regression signal, not an FPS number. Use `npm run bench` for
real-time frame pacing.

## Building motion that passes

These are the conventions the transitions follow. `.claude/skills/motion-create`
walks through them step by step.

1. **Phases add up to the duration.** Express in/hold/out as proportions of
   `?duration` and put any stagger *inside* a phase, never on top of it.
2. **Position from absolute time.** Compute every object's position from the
   time since the scene started (`setTime(t)`), not from accumulated deltas.
   Dropped or slow frames in OBS then can't push the cut point or the end.
3. **Velocity-matched hand-offs.** Chain phases with `hermite(p0, p1, v0, v1,
   duration, t)` from `src/shared/motion.js`, where each segment starts at the
   previous segment's end velocity. Use an entry velocity of about 2× the
   segment's average speed for a "fast in, settle" arrival, and the same for an
   accelerating exit.
4. **Seedable, balanced layouts.** Draw randomness from
   `createRandom(seedFromURL() ?? randomSeed)`, and place things with
   `stratified()` so a random layout can't clump on one side. `?seed=N` pins a
   layout (used by the harness and video export).
5. **Probe it.** Call `registerProbe(scene, () => objects.map(o => sampleBar(o, id)))`
   with ids that stay stable for an object's lifetime.

## Exporting for OBS Stinger transitions

OBS's native Stinger transition only plays video files. The export renders
a scene on the harness clock and encodes it with alpha:

```
npm run motion:export -- stinger --color=#ff6600 --duration=1000
npm run motion:export -- stinger --format=mov   # ProRes 4444 instead of VP9 WebM
```

It prints the OBS settings, including the Transition Point measured from the
frames where the screen is fully covered (the middle of that window, about
50% of the duration). Requires `ffmpeg` on PATH, or set `FFMPEG`. Output goes
to `exports/` (gitignored).

## Scenarios

`stinger`, `sidebar` and `shade` are checked for timing, coverage and smooth
motion. `background` is checked for smooth motion and CPU. `epcot` has no
motion probe; it is a CPU regression guard (p95 at most 20ms, measured
around 10ms).

### Recording the epcot loop

On stream, epcot plays as a pre-recorded looping video, so changes to the
scene only reach the stream once the loop is re-recorded:

```
npm run motion:export -- epcot --loop --fps=30          # 48s 1080p30 MP4
npm run motion:export -- epcot --loop=24 --speed=0.5    # explicit period/speed
```

`--loop` renders exactly one period (`loopPeriod / speed` seconds, from
`config.epcot` unless overridden) as an opaque H.264 MP4, then renders the
frame one period after the first and compares them. It prints `Seam: PSNR
inf dB (identical, seamless)` and exits 1 if the loop doesn't close.

## Adding a scenario

Add an entry to `SCENARIOS` in `tools/motion/scenes.js`: the URL with fixed
params, how it starts (`'load'` or `{ event: 'transitionStart' }`), how long
to capture, keyframes for the filmstrip, chart markers, and the checks that
define correct for that scene. Then run `npm run motion -- <name> --seeds=1,2,3,4,5,6`.
