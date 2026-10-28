# Motion style

What the scenes should look and feel like, so a new or changed animation
matches the rest. Values live in `src/config/config.js`; this doc says why.
Sources in brackets. Owned by the design review role.

## Look

- **One family.** Every scene is built from the same parts: slanted bars
  rotated 15 degrees clockwise and horizontal bars skewed -15 degrees, white
  and colored, on a transparent background. Mixed scenes use about 60%
  slanted and 40% horizontal bars. [v1.0 visual consistency; shade 06-02]
- **Brightness 0.8** on every scene's colors: harmony without looking dim.
  A new scene uses the same multiplier. [v1.0 decision]
- **Curtains** are semi-transparent at opacity 0.5 (range 0.4 to 0.6), clipped
  to their bounds, with top and bottom meeting at the centerline. [06-01]
- **Text** is white, 96px bold Jost with a soft shadow, optically centered
  with `actualBoundingBox` metrics, and always drawn above curtains. [05-01,
  05-03, 06-02]

## Timing

- **Shared defaults**: entry 1000 ms, exit 1000 ms, hold 2000 ms, eased with
  `easeInOutCubic`, for sidebar and shade. Scenes override only with a
  reason: the background fades over 2000 ms because it is ambient, and the
  stinger splits its `?duration` 35% in, 30% full cover, 35% out, so OBS
  cuts at the 50% mark while the screen is covered (`config.stinger`).
  [v1.0 timing patterns; motion harness PR #2]
- **Reading pace**: text holds 200 ms per word (5 words a second), never less
  than 3 s. Count words, not characters. [05-02]
- **No jumps between phases**: motion that crosses a phase boundary is
  continuous in velocity, not just position. Easing the position of each
  phase separately creates visible speed jumps; it took three tries to learn
  this on the shade scene. [05-03]
- **Frame-rate independent**: everything is driven by elapsed time, so a scene
  looks the same at 30, 60 or 120 Hz. [v1.0]

## How motion is built

The engineering conventions (deterministic time, velocity-matched phase
changes, seeded layouts, the probe each scene registers) and how motion is
checked are owned by the motion harness work: see [VALIDATION.md](VALIDATION.md)
and the `motion-verify` and `motion-create` skills. They link here for the
look; this doc links there for the build.

## Learnings

Add a dated line when a review or AJ's feedback settles a question of style.

| Date | Learning | Evidence | Status |
|---|---|---|---|
| 2026-01-20 | URL-based color coordination across scenes didn't work out; don't retry it without a new idea | v1.1 out-of-scope list | active |
