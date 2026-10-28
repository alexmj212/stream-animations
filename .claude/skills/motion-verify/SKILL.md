---
name: motion-verify
description: Verify a stream animation's motion with the frame-exact harness (timing, cut-point coverage, smoothness, CPU) and a visual keyframe review. Use after changing any scene or shared animation code, before opening a PR, or when asked to check, review or debug how a transition or overlay moves.
---

# Verify motion graphics

The harness in `tools/motion/` renders each scene on a virtual clock and checks it.
Full reference: `docs/VALIDATION.md`. Look and timing targets: `docs/MOTION.md`.

## 1. Run the checks

```bash
npm run motion -- <scene> --seeds=1,2,3,4,5,6   # scene: stinger | sidebar | shade | background
```

- Use several seeds for scenes with random layouts; a fix that only passes seed 1 isn't a fix.
- Changed shared code (`src/shared/`, `src/config/`)? Run every scenario: `npm run motion`.
- Brand-color or contrast change? Also run `--color=<hex>` with a dark and a light color.
- OBS browser source at 30fps? Also run `--fps=30`.
- Also run `npm test -- --run`.

A non-zero exit means a check failed. Read each `✗` line: it names the object, time and
phase change (e.g. `slanted-3 @767ms Δv=133px/s (in→pause)`).

## 2. Diagnose failures

| Failure | Look at | Usual fix |
|---|---|---|
| Finishes on time | Coverage chart: where the dashed "visible" line reaches 0 | Move stagger/delays inside the phases; phases must sum to the duration |
| Smooth motion | Position chart, red circles; then `--dump` and read `capture.json` around that time | Velocity-match the hand-off with `hermite()` (next segment's v0 = previous end velocity) |
| Covers region / cut point | Keyframe at that time; coverage chart | Check which property the draw code actually reads (e.g. `holdX` vs `targetX`), slanted-edge geometry, overlap |
| Frame CPU budget | CPU chart: spikes vs a raised baseline | Per-frame allocation, cache keyed by an animating value, objects drawn while off-screen |
| Page errors | The message | Imports, 404s |

To inspect raw data for one object:

```bash
npm run motion -- stinger --seeds=2 --no-shots --dump
node -e "const {frames}=require('./tools/motion-results/stinger/seed-2/capture.json');
let px=null;for(const f of frames){const s=f.samples.find(s=>s.id==='horizontal-7');if(!s)continue;
console.log(f.t.toFixed(0),s.phase,s.x.toFixed(1),px===null?'':((s.x-px)*60).toFixed(0));px=s.x}"
```

Don't loosen a threshold in `tools/motion/scenes.js` or `analyze.js` to get green unless the
check is demonstrably wrong. If so, add a failing case to `tests/tools/motionAnalyze.test.js` first.

## 3. Look at it

Numbers can't judge composition. Read the keyframes in
`tools/motion-results/<scene>/seed-<n>/t*.png` (transparent PNGs; the HTML report shows them
on a checkerboard). Check:

- Balance: bars spread across the frame, no side left empty or crowded
- Hierarchy: accent bars never out-shout the curtains or panel; white bars are accents, not walls
- Text (sidebar, shade): legible over every bar behind it, never clipped
- Nothing visible before the start or after the end (no slivers parked at an edge)
- Stinger: the 50% frame is fully covered

For a before/after comparison, run the harness on the base commit (`git stash` or a worktree),
copy `tools/motion-results` aside, re-run on your change, and compare the same seed's keyframes.

## 4. Report

State what you ran (scenes, seeds, colors, fps) and the pass/fail summary line. For visual
changes, attach or describe before/after keyframes. For an OBS-facing stinger change, export
it (`npm run motion:export -- stinger`) and give the printed Transition Point.
