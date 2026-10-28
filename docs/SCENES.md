# Scenes

Each scene is `src/<scene>/index.html` plus its classes, and builds to one
self-contained HTML file (`npm run build:<scene>`) for an OBS Browser Source
at 1920x1080 with a transparent background. Tunable numbers for every scene
live in `src/config/config.js`.

| Scene | What it is | Triggered by | URL params |
|---|---|---|---|
| stinger | Curtain-style scene transition: slanted and horizontal bars sweep across | OBS `transitionStart` or `obsSourceActiveChanged` window events (listeners registered at load to catch the first scene change); `?autoplay=true` plays once on load | `color`, `scheme`, `colormode`, `duration`, `seed`, `autoplay`, `perf` |
| sidebar | Slide-in notification panel with animated bars and text | Plays on load (OBS reloads it when the source is shown) | `color`, `scheme`, `colormode`, `text`, `duration`, `seed`, `perf` |
| shade | Raid/alert banner: semi-transparent curtains close round a still line of large text | Plays on load (OBS reloads it when the source is shown) | `color`, `scheme`, `colormode`, `text`, `duration`, `seed`, `perf` |
| followers | Always-on follower-goal bar, top left; the notifications toast grows out of its right end | Always on; polls MIU's Developer API (`GET :8911/api/v2/counters/followercount`) every 5 s, or a `followers` window event | `goal`, `goalstep`, `label`, `count`, `source`, `api`, `counter`, `style`, `filllayout`, `scheme`, `perf` |
| notifications | Toast bar that grows out of the right end of the follower-goal bar (top left), shows one line of text, and slides back in. Rebuilt from the OBS "Notifications" scene (color sources, Move filters and a mask plugin that broke in OBS 33) | Plays on load (OBS reloads it when the source is shown) | `text`, `duration` (default grows with long text), `seed` (streaks), `style`, `colorlayout`, `layout`, `scheme`, `perf` |
| title | Scene title card (WELCOME, BRB, ENDING): one line of 96px Jost on a slanted ink plate, bottom-left inside title-safe; replaces the OBS text sources (design audit #39) | Plays on load: the plate slides in, the words follow, then it holds still and draws nothing | `text` (default `WELCOME`) |
| banner | Banner lane under the toast (issue #85): the hype train banner (`?kind=hype`) or the ad warning (`?kind=ad`), 32px caps on an ink plate inside x 560-1824, y 84-132; replaces the OBS "Hype Train Banner" and "Ad Banner" groups | Plays on load (OBS reloads it when the source is shown): the stripe and plate slide out of the goal bar's end, the words follow, then it holds still. MIU shows and hides the sources on Hype Train Started/Ended and Ad Started/Ended | `kind` (`hype`, default, or `ad`), `text`, `glint` (ms between glints, `0` off), `scheme` |
| background | Continuous loop of drifting bars on two canvas layers | Always running | `color`, `speed`, `density` (default 8), `perf` |
| epcot | Spaceship Earth lattice with lit bulbs, patterns and overlays; deployed to GitHub Pages on push to `main` | Always running | Many; see the root README |

The stinger, sidebar and shade paint colored bars from the epcot
Illuminations palette by default, as one screen-fixed top-to-bottom
gradient (`config.palette`, `src/shared/palette.js`); `?scheme=mono` gives
the old single-hue look. See the root README for `scheme` and `colormode`.

`?perf=true` shows the performance overlay on any scene. `?seed=N` pins a
random layout so the same stinger or sidebar plays every time (recording,
motion checks).

The notifications toast lines up with the MIU "Follow Goal" overlay
(`config.notifications.geometry`, measured on the OBS program at 1920x1080:
top 26, height 48, right edge at x 560, -15 degree lean). If the follow bar
moves or changes size in MIU, update those numbers. Its colors run along the
bar (`config.notifications.colorLayout`), because the screen-fixed gradient
the other scenes use is all violet at the top of the screen.

On the Aitum Vertical canvas (1080x1920), give the toast its own 1080x1920
browser source: a page taller than wide gets the portrait layout
(`config.notifications.vertical`, AJ's pick B1, DESIGN.md V-TYPE-1): one
line at 56px on the camera/game seam (y 700), across the phone-safe width
(x 60 to 940), shrinking to 45px and then scrolling for a long line.
`?layout=vertical` or `?layout=wide` forces either. A scaled copy of the
16:9 source lands at about 34px and is cut off at both ends.

Sidebar and shade text holds still for its reading time (200 ms a word,
never under 3 s); `duration` is a minimum, so OBS's `duration=3000` still
works and gives a longer alert when the text needs it (4 s sidebar, 4.5 s
shade). The sidebar's @name is 56px over the 40px action on an ink
nameplate, and a long name shrinks to 75%; text without a name shrinks, then
wraps to two lines, then ends in an ellipsis (`config.sidebar.text`). The
shade's line shrinks from 96px to 72px to fit title-safe, then wraps to two
lines (`config.shade`). OBS's Sidescreen Alert hides the source after 7 s
and Fullscreen Alert after 10 s (their move filters' `end_delay`), so each
scene stops short of that (`timing.maxTotalMs`): past about 29 words
(sidebar) or 41 (shade) the hold is cut instead. Raise both together.

Mix It Up draws avatars and props over the sidebar in OBS (its Mixitup
source sits above Sidescreen Alert). Their positions live in
`config.sidebar.miuZones`; keep that list in step with the MIU commands that
fire Sidescreen Alert. `?debug=zones` draws them, and the motion harness
fails if the sidebar text overlaps one. To re-read the commands, stage
`%LOCALAPPDATA%\MixItUp\Settings\<id>.db3` from Defiant (read-only folder
access) and read the JSON in its `Commands` table: an Overlay action's
`OverlayItemV3` holds `XPosition`/`YPosition` (percent when `PositionType`
is 1) and `Width`/`Height` (0 = natural size).

The followers bar and the notifications toast meet at x 560 (1920 wide):
`config.followers.geometry` and `config.notifications.geometry` share top,
height, that edge and the -15 deg lean, and a unit test fails if they drift.
The followers scene only draws when the count changes (or for a rare idle
glint), so idle it runs no frames. It needs MIU's Developer API on (MIU >
Services > Developer API); the API answers with `Access-Control-Allow-Origin: *`
(MIU 1.8.203, 2026-10-28), so the Pages URL can read it from OBS.

The title card fits its line like the shade: 96px, shrinking to 72px,
then two lines (down to 56px), and its plate grows upward for a second line
so the bottom edge stays above Twitch's player controls (`config.title`).
It never animates after the entrance, so it costs nothing for the rest of
the scene.

The banner fills the banner lane of DESIGN.md's zone plan exactly, slanted
ends included (`config.banner.lane`), so it never reaches past title-safe
at x 1824. Its font size comes from Jost's measured cap height, so the
capitals are 32px (a ~46px line). A custom `?text=` too long for the lane
scrolls inside it, resting at each end. Each kind is its own OBS browser
source in Alerts, the ad one above the hype one: both plates cover the same
lane at full opacity, so the ad warning wins when both are up. OBS hides a
source instantly; give each source a Hide transition (Fade, 350 ms) for the
exit (DESIGN.md MOTION-1). The hype banner draws a light band every 12 s;
otherwise both draw nothing after the entrance.

## Shared code

- `src/shared/AnimatedBar.js`: base class; scene bars (`BackgroundBar`,
  `StingerBar`, `SidebarBar`, `ShadeBar`, `CurtainBar`) extend it.
- `src/shared/animations/`: pure animation math, unit-tested.
- `src/shared/lifecycle.js`: `AnimationLifecycle` with an `AbortController`,
  so an OBS reload leaves no listeners or loops behind.
- `src/shared/timing.js`, `cache.js`, `dirtyRect.js`, `performance.js`,
  `perfOverlay.js`, `perfStorage.js`: delta time, LRU caches, dirty-rect
  tracking and performance monitoring.

## Fragile areas

From the 2026-01-17 codebase audit (retired `.planning/codebase/CONCERNS.md`):

- **Background bar state machine** (`BackgroundBar.js`): fade in, visible,
  fade out and direction changes interact. Test a full lifecycle and use the
  pure functions in `calculations.js` rather than inline math.
- **Background dual canvas**: bars split across two canvases by speed. Don't
  add logic that depends on which layer a bar is on.
- **Random start positions** (`BackgroundBar.js`): two init paths. Test both
  `randomStart` values.
- **Stinger curtain setup** (`src/stinger/index.html`): large curtain bars
  built with manual overrides tied to canvas size and timing. Untested.
