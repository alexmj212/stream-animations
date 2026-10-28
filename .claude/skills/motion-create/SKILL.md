---
name: motion-create
description: Build a new stream animation (transition, overlay, lower third) or rework an existing scene's motion in this repo, following the timeline, hermite hand-off, seeding and probe conventions so it passes the motion harness. Use when asked to create, add, prototype or restyle a motion graphic.
---

# Create a motion graphic

Every scene here is a vanilla HTML5 Canvas page loaded as an OBS Browser Source
(transparent background, 1920×1080). Read `docs/MOTION.md` for the visual language
(brightness 0.8, 15° slants, palette rules, text pacing) and `docs/VALIDATION.md` for
the engineering conventions. Use `src/stinger/` and `src/sidebar/` as reference
implementations.

## 1. Pin down the brief

Get these settled before you write code. Ask AJ only for what you can't infer.

- **Trigger**: on page load (sidebar, shade), or on an event (stinger: `transitionStart`,
  `obsSourceActiveChanged`, `?autoplay=true`)
- **Total duration** and its phases, e.g. in 35% / hold 30% / out 35%
- **Moments that must hold**: full cover at the cut point, a region covered while text shows
- **URL params**: always `color`, `duration`, `seed`; plus scene-specific ones like `text`

## 2. Scaffold

```
src/<scene>/index.html     page: canvas, URL params, plan, rAF loop, triggers
src/<scene>/<Scene>Bar.js  objects (extend AnimatedBar for bars) + plan<Scene>()
src/config/config.js       a <scene> section: timing proportions, counts, style
```

Register it in `vite.config.js` (the mode list in `input` and in `closeBundle`) and add
`build:<scene>` / `watch:<scene>` / `dev:<scene>` scripts to `package.json`.

## 3. Motion conventions (the harness enforces these)

**Timeline in proportions; stagger inside phases.**
```js
const T = durationMs / 1000;
this.inEnd = T * timing.inProportion * (layout.inEndScale ?? 1);   // ≤ shared in end
this.inStart = Math.min(layout.inDelay ?? 0, this.inEnd * 0.6);      // stagger
this.outStart = T * (timing.inProportion + timing.holdProportion) + (layout.exitDelay ?? 0);
this.outEnd = T;                                                     // everything ends at T
```

**Position is a pure function of time, with velocity-matched hand-offs.**
```js
import { hermite } from '../shared/motion.js';

positionAt(t) {
    if (t < this.inStart) return this.startX;
    const v = this.direction * this.drift;                 // hold velocity
    if (t < this.inEnd) {
        const d = this.inEnd - this.inStart;
        return hermite(this.startX, this.targetX, 2 * (this.targetX - this.startX) / d, v, d, t - this.inStart);
    }
    const holdX = this.targetX + v * (Math.min(t, this.outStart) - this.inEnd);
    if (t < this.outStart) return holdX;
    const d = this.outEnd - this.outStart;
    return hermite(holdX, this.exitX, v, 2 * (this.exitX - holdX) / d, d, t - this.outStart);
}
setTime(t) { /* set phase, x = positionAt(t), active = t < outEnd */ }
```
Entry velocity ≈ 2× average gives "fast in, settle". Exit velocity ≈ 2× average gives
"accelerate away". A curtain that must sit still for the cut uses drift 0, so the
hand-off velocity is 0 on both sides.

**The loop drives objects from absolute time.**
```js
let start = null;
function animate(ts) {
    if (start === null) start = ts;
    const t = (ts - start) / 1000;
    clearCanvas(ctx, canvas);
    let alive = false;
    for (const o of objects) { o.setTime(t); if (o.active) { alive = true; o.draw(); } }
    if (alive) requestAnimationFrame(animate);
}
```

**Seeded, balanced layout.**
```js
import { createRandom, seedFromURL, stratified, registerProbe, sampleBar } from '../shared/motion.js';
const random = createRandom(seedFromURL() ?? Math.floor(Math.random() * 2 ** 31));
const xs = stratified(count, W * 0.15, W * 0.85, random);   // one per slot, shuffled
```
Pass `{ random, layout }` into objects. Never call `Math.random()` inside an object.

**Probe for the harness** (a no-op in production):
```js
registerProbe('<scene>', () => objects.filter(o => o.active).map(o => sampleBar(o, o.probeId)));
```

**Geometry gotchas**
- `drawBar` anchors slanted bars at their top-left: the bar leans about 0.29×H to the left at
  the bottom of the screen. Park slanted bars at least `H * 1.05 * sin(15°)` past the right edge
  so no sliver shows.
- `computeBounds()` gives exact on-screen bounds for culling. Don't hand-roll center-based boxes.
- Don't put the offscreen cache on anything whose size animates (the cache is keyed by size).

## 4. Validate

1. Add a scenario to `tools/motion/scenes.js` with checks for duration, endsClear, coverage
   (if the scene covers anything), noVelocitySteps and workP95Ms.
2. Add unit tests next to the existing ones (`tests/<scene>/`): phases sum to the duration,
   hand-offs are continuous (finite-difference velocity on both sides of each boundary), and the
   planner is deterministic per seed and balanced.
3. Run the `motion-verify` skill: harness on 6 seeds, keyframe review, `npm test -- --run`.

## 5. Ship

- README: URL, params, trigger, and the OBS setup (Browser Source, or for stingers
  `npm run motion:export -- <scene>` with the printed Transition Point)
- PR description: what it looks like (keyframes) and the harness summary line
