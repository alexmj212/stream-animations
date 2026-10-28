# Motion style

What the scenes should look and feel like, so a new or changed animation
matches the rest. Values live in `src/config/config.js`; this doc says why.
Sources in brackets. Owned by the design review role. The full design
system (safe areas, type scale, contrast, alert tiers, accessibility) is the
bible, [DESIGN.md](DESIGN.md), which links here for these decisions.

## Look

- **One family.** Every scene is built from the same parts: slanted bars
  rotated 15 degrees clockwise and horizontal bars skewed -15 degrees, white
  and colored, on a transparent background. Mixed scenes use about 40%
  slanted and 60% horizontal bars (`config.background.slantedShare`; the
  stinger plans 2 to 3 slanted of 6 accents, `config.stinger.accents`).
- **Brightness 0.8** on every scene's colors: harmony without looking dim.
  A new scene uses the same multiplier. [v1.0 decision]
- **Curtains** are semi-transparent at opacity 0.5 (range 0.4 to 0.6), clipped
  to their bounds, with top and bottom meeting at the centerline. [06-01]
- **Text** is white, 96px bold Jost with a soft shadow, optically centered
  with `actualBoundingBox` metrics, and always drawn above curtains. [05-01,
  05-03, 06-02]

## Timing

- **Shared defaults**: entry 1000 ms, exit 1000 ms, hold 2000 ms, eased with
  `easeInOutCubic`, used by the shade. Scenes override only with a reason:
  the background fades over 2000 ms because it is ambient. Two scenes split
  their `?duration` proportionally instead: the stinger 45% in, 10% hold,
  45% out, so OBS cuts at the 50% mark while the screen is covered
  (`config.stinger.timing`), and the sidebar 25% in, 50% hold, 25% out
  (`config.sidebar.timing`). [v1.0 timing patterns; motion harness PR #2]
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
| 2026-10-28 | Background default stays at 8 bars once spawns are balanced; 5 goes too empty, a lighter OBS source can use `?density=6` | AJ's pick on a side-by-side mock, PR #2 design review | active |
| 2026-10-28 | epcot (recorded) is AJ's main background; the bar background is rarely used, so style effort goes to epcot, stinger, sidebar and shade first | AJ, 2026-10-28 | active |
| 2026-10-28 | Stinger, sidebar and shade paint the epcot Illuminations palette as one screen-fixed top-to-bottom gradient (purple, magenta, red, orange), always: a passed `?color=` doesn't recolor it (`colorMode` default `ignore`); `?scheme=mono` keeps the old single-colour look. Hue-shifting the palette was rejected: an orange color turned it lime green over epcot | AJ chose "Always Illuminations"; PR #16 design review | active |
| 2026-10-28 | Mix It Up draws its avatars and props above the overlays on the right side, centred at 42-50% of the height and covering about 22-70% of it once padded (`config.sidebar.miuZones`). No overlay text goes in that band, and wrapped lines stay out of it too; the sidebar text sits at 78% height | AJ picked 78% on a side-by-side mock, PR #17 | active |
| 2026-10-28 | Sidebar text stays inside the slanted panel: shrink to fit the panel's width at the text's height (down to 75% of the base size), then wrap to two lines; ellipsis only as a last resort. A raid thank-you shouldn't lose its words | QA finding: long text clipped at ~560px and hung over the stream; design review call; fixed in #23 | active |
| 2026-10-28 | A bar that sits in one horizontal band (the notifications toast) takes the Illuminations palette along its length, not screen-fixed: at the top of the screen the screen-fixed gradient is all violet. Full-height or multi-band scenes stay screen-fixed | AJ picked "A Creative" on the notifications mock, PR #27 | active |
| 2026-10-28 | Decorative streaks and accents stay out of the text box while text is on screen | PR #27 design review | active |
| 2026-10-28 | Long notification text grows the bar to fit the line, up to the bar's full length at title-safe's right edge (x1824, DESIGN.md SAFE-1), and the text stays still; it scrolls only if it still doesn't fit at full length. Scrolling clipped the start and end of the line during the hold | Side-by-side mock from the notifications thread; design review call (AJ may override) | active (#32) |
| 2026-10-28 | The scene title cards (WELCOME, BRB, ENDING) and the BRB collage stay as they are, and are exempt from the rules the audit raised against them in #39 and #42 (SAFE-1/3, TYPE-3, TYPE-7, ALERT-2, COLOR-1); don't propose a title-card scene or a BRB redo again without a new reason | AJ picked "Leave as is" on the design audit cards (#39, #42, closed as not planned) | active |
| 2026-10-28 | The stinger runs 1200 ms with OBS's transition point at 600, and full static cover drops to 15% of the duration (`pauseProportion` 0.15), so the cut is a moment rather than a hold (DESIGN.md CUT-2) | AJ picked it from the 2000-vs-1200 video, design audit #36 | OBS set; target until the pauseProportion PR lands |
| 2026-10-28 | Alert text (shade and sidebar) holds still and whole while it is read, for a reading-time hold (DESIGN.md MOTION-1, TIME-1, TYPE-1/3) | AJ's pick on the design audit set, #33-#35 | target: being built in its own work thread |
| 2026-10-28 | The GOOBERS widget pair gets bigger text but keeps its position, so its top margin is AJ's exemption from SAFE-1 | AJ's pick, design audit #40 | target: design system PR |
