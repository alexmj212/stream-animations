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
| `npm run motion -- stinger sidebar` | Only these scenes, with their variants (`notifications` also runs `notifications-long` and `-scroll`). An exact scenario name such as `notifications-long` runs just that one |
| `npm run motion -- --seeds=1,2,3,4,5,6` | More layouts (scenes with random layouts should pass on all of them) |
| `npm run motion -- --color=00b3ff` | Another base color |
| `npm run motion -- --params=scheme=mono` | Extra URL params on every scene, to mock a look without editing `scenes.js` |
| `npm run motion -- --out=before` | Write to `tools/motion-results-before/`, so runs for a before/after mock don't wipe each other |
| `npm run motion:compare -- --runs=before,after --frames=stinger/seed-1/t00750.png --bg=frame.png --out=cmp.png` | Labelled side-by-side grid of keyframes from those runs, over a backdrop, for design decisions |
| `npm run motion -- --fps=30` | Step at another frame rate (OBS browser sources are often set to 30) |
| `npm run motion -- --no-shots` | Skip keyframe screenshots (about 2x faster) |
| `npm run motion -- --no-keepout` | Keyframes without the mock chat and music layers |
| `npm run motion:compose` | Worst-case "everything visible" frames: each pair of OBS elements that can be up together, with our scenes live, and a report of overlaps and placement breaks (`--today` for the layout before Defiant's fixes) |
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
- CSS animations are paused and advanced in lock-step

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
| Frame CPU budget | p95 of update+draw time ≤ `workP95Ms`, over at least 200 drawn frames (`MIN_CPU_FRAMES`); fewer fails the check, since p95 of a short capture is one slow frame | Per-frame allocation, cache thrash, too many objects drawn; a scenario too short to measure |
| Text over *panel* | Every canvas pixel under a text element's on-screen box (`textBox.selector`) is opaque through a window | Long text hanging off the slanted panel over the stream |
| Scene events | The scene's debug events (`?debug=events`) match `debugEvents` counts exactly | A trigger that restarts the scene, a scene that never marks `end` |
| Design rules (SAFE-1, SAFE-3, KEEP-1, TYPE-1, TIME-1, CUT-2, FLASH-1, FLASH-2) | The bible's machine-checkable rules ([DESIGN.md](DESIGN.md)), from `tools/motion/designRules.js`. Placement and size read the text box (a probe sample with `box`, `fontPx`, `words`, or `textBox.selector`) through `holdMs`; CUT-2 and FLASH read a 16x9 luminance grid, taken in a second, untimed pass of the same seed so it can't touch the CPU numbers | Text in the screen margin, on chat or the music display (KEEP-1), or under the player controls, type under the floor, text that never stops long enough to read, a stinger sitting covered and still, strobing |

**Warn, then enforce** (issue #43). A design rule a scene doesn't meet yet
reports ⚠ and doesn't fail the run: those are DESIGN.md's "Today vs target"
gaps, closed by each scene's audit issue. Rules listed in the scenario's
`design.fail` fail the run. When an audit issue lands, move its rule into
`fail` in the same PR. Never take a rule out of `fail` to get green.
A ⚠ should mean a gap someone still owes. Where a rule can't apply (an
exemption AJ or design review made, or a widget that never moves, where
TIME-1 only measures the capture), leave it out of `rules`, with a comment
naming the decision, so the warnings that remain are real.

**Test the text that really arrives** (Design review, 2026-10-28). Every
text scenario family keeps one variant with a realistic message: a follow
or raid with a Twitch username, as OBS and Mix It Up send it (`sidebar-name`,
`shade-raid`, `notifications-name`, `notifications-vertical-name`). A short
sample string like "Thanks for the follow friend" skips the shrink and
scroll paths the common case takes.

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
| `?debug=1` / `all` / `events,frames,log` | Channels. `events`: timestamped `debug.mark(name, data)` calls. `frames`: frame-time count, mean, max, long frames (>34ms), idle gaps. `log`: echo events to the console. `build`: the build stamp on screen. `zones`: the screen areas other overlays cover, drawn over the scene (sidebar: Mix It Up's images, `config.sidebar.miuZones`). `safe`: the action-safe, title-safe and player-controls guides from `config.design`, on any scene |
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

### Chat and music on screen

OBS always draws chat (a Mix It Up overlay in the left column) and the music
info box (waveform and Tuna's now-playing line, top-left) over our scenes,
and Starting and BRB add a full-width waveform and a song line at the bottom.
`config.design.keepOut` holds their boxes for the main and vertical canvases,
read from OBS's scene file. Every keyframe draws them as dashed mock layers
on top (`--no-keepout` hides them), so a shot looks like the stream, and
KEEP-1 checks that held text stays off every layer marked to keep clear. The
mocks draw on top of everything, which isn't always OBS's order: the shade
stacks above chat. Two calls from Rotom (#79): the shade, a tier 3 takeover,
may cover chat, so its scenarios leave KEEP-1 out; the goal bar on the music
waveform is accepted while the waveform draws under its plate, so followers
keeps KEEP-1 as a warning. When a source in OBS's Alerts or Information Box moves,
update `keepOut` (AJ, 2026-10-28: "you're not testing the layout with chat
present", "...with music playing"). No scene reacts to audio, so music only
matters as a layer. To prove a change keeps keyframes byte-identical, run both sides
with `--no-keepout`: main's older shots carry no mock. The vertical canvas
has no layer to keep clear today, so KEEP-1 passes there by default; a
vertical chat source must go into `keepOut.vertical` (Code review, #79).


### Everything visible

`tools/motion/composition.js` lists every element that can be on the 16:9
canvas (Rotom's inventory, 2026-10-28: goal bar, chat, music, toast, banners,
MIU images, gags, camera presets), with its box after Defiant's collision
fixes and `today`'s box before them, plus the pairs that can be up together.
`npm run motion:compose` renders each pair into
`tools/motion-results-compose/`: our scenes live at their hold, everything
else as a labelled box, and `report.md` with each overlap and placement
break. Design review gated pairs 1, 2, 5 and 6 as rule fixes, so
`tests/tools/composition.test.js` holds them to `KNOWN_OVERLAPS`: a new
overlap fails CI, and so does a known one that stops happening. When OBS or
MIU moves a source, update its box there.

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
motion. `sidebar-name` and `shade-raid` load the alerts as OBS sends them
(`duration=3000`), and `sidebar-long` and `shade-long` check that long text
fits; all of them enforce SAFE-1, TYPE-1 and TIME-1, so the text can't go
back to moving during its hold. `stinger-vertical` runs the stinger at 1080x1920, the size OBS's
Aitum Vertical canvas renders it at: a slanted bar's 15° lean reaches
further on a tall canvas, which once left a corner uncovered at the cut
and let bars pop in on screen (PR #66). `notifications-vertical`,
`notifications-vertical-name` (a follow line with a username) and
`notifications-vertical-long` check the portrait toast against the phone
rules V-SAFE-1 and V-TYPE-1 (DESIGN.md, Vertical canvas); the name and long
lines' 45px and scroll are B1's named exception, so V-TYPE-1 and TIME-1 only warn
there. `background` is checked for smooth motion and CPU. `epcot` has no
motion probe; it is a CPU regression guard (p95 at most 20ms, measured
around 10ms).

`followers` checks one follow's look and motion. `followers-cpu` holds its
frame CPU budget over five follows, two seconds apart (`events`), because
one follow draws only about 70 frames and p95 of so few is one GC pause
away from failing (issue #50). The same goes for any scene that draws only
on change: give its CPU check enough drawn frames, never a higher budget.
`stinger-cpu` does the same for the stinger: six 1200ms transitions 1.5s
apart (about 440 drawn frames), since one transition draws about 74 and
its p95 failed once on a cold-JIT frame (PR #63).

`title` and `title-long` check that the title card lands inside title-safe,
clear of the player controls, and then holds still (SAFE-1, SAFE-3, TYPE-1,
TIME-1). It draws about 60 frames once and none after, so it has no CPU
check: the debug `idle` event proves it stops.

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
define correct for that scene. A scenario for another canvas size (the
1080x1920 vertical canvas) sets `viewport: { width, height }`. Then run `npm run motion -- <name> --seeds=1,2,3,4,5,6`.
