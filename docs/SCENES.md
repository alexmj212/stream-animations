# Scenes

Each scene is `src/<scene>/index.html` plus its classes, and builds to one
self-contained HTML file (`npm run build:<scene>`) for an OBS Browser Source
at 1920x1080 with a transparent background. Tunable numbers for every scene
live in `src/config/config.js`.

| Scene | What it is | Triggered by | URL params |
|---|---|---|---|
| stinger | Curtain-style scene transition: slanted and horizontal bars sweep across | OBS `transitionStart` or `obsSourceActiveChanged` window events (listeners registered at load to catch the first scene change); `?autoplay=true` plays once on load | `color`, `scheme`, `colormode`, `duration`, `seed`, `autoplay`, `perf` |
| sidebar | Slide-in notification panel with animated bars and text. Portrait (1080x1920): the ink nameplate alone on the camera/game seam, no bars | Plays on load (OBS reloads it when the source is shown); in portrait it waits for a toast already on the seam | `color`, `scheme`, `colormode`, `text`, `duration`, `seed`, `layout`, `perf` |
| shade | Raid/alert banner: semi-transparent curtains close round a still line of large text (in portrait, fitted to the phone-safe x 60-940) | Plays on load (OBS reloads it when the source is shown) | `color`, `scheme`, `colormode`, `text`, `duration`, `seed`, `perf` |
| followers | Always-on follower-goal bar, top left; the notifications toast grows out of its right end | Always on; polls MIU's Developer API (`GET :8911/api/v2/counters/followercount`) every 5 s, or a `followers` window event | `goal`, `goalstep`, `label`, `count`, `source`, `api`, `counter`, `style`, `filllayout`, `scheme`, `perf` |
| notifications | Toast bar that grows out of the right end of the follower-goal bar (top left), shows one line of text, and slides back in. Rebuilt from the OBS "Notifications" scene (color sources, Move filters and a mask plugin that broke in OBS 33) | Plays on load (OBS reloads it when the source is shown) | `text`, `duration` (default grows with long text), `seed` (streaks), `style`, `colorlayout`, `layout`, `scheme`, `perf` |
| title | Scene title card (WELCOME, BRB, ENDING): one line of 96px Jost on a slanted ink plate, bottom-left inside title-safe; replaces the OBS text sources (design audit #39) | Plays on load: the plate slides in, the words follow, then it holds still and draws nothing | `text` (default `WELCOME`) |
| banner | Banner lane in the toast's place (issue #85): the hype train banner (`?kind=hype`, a teal strip with a scrolling "HYPE TRAIN ✦✧" marquee) or the ad warning (`?kind=ad`, black "ADS MAY BE PLAYING -" scrolling on an orange plate at half opacity, along the bottom edge, y 1032-1080), AJ's original OBS look with 32px caps, inside x 560-1920, y 26-74; replaces the OBS "Hype Train Banner" and "Ad Banner" groups | Plays on load (OBS reloads it when the source is shown): the strip wipes in from the goal bar's end and the line scrolls for as long as it's up. MIU shows and hides the sources on Hype Train Started/Ended and Ad Started/Ended | `kind` (`hype`, default, or `ad`), `text`, `cycle` (`0`: fixed teal), `border` (`0`: no screen border), `layout` (`vertical` or `wide`; a page taller than wide gets the full-width portrait lane on the seam, y 660-740, words inside x 60-940, and fades out while a toast or sidebar alert holds the seam lock) |
| spheal | AJ's gag (2026-10-29), not held to the bible: a song (`src/spheal/march.ogg`, one 5.65 s phrase looped gaplessly through Web Audio) plays while Spheals (PokeAPI's official artwork, fetched at load; our own drawing offline) hop on the beat, roll and tumble along the bottom; the crowd doubles every 4 s and piles up (~515), then a crowned giant bounces through, and the song fades when it has gone (~51 s). Math in `src/shared/animations/spheal.js` | Plays once on load (OBS reloads it when the source is shown). A Mix It Up command shows the source, waits ~55 s, hides it | `seed`, `volume` (0-1), `mute` (`1`), `sprite` (`art`, `home`, `pixel`, `drawn`) |
| gamepicker | Not a scene: an OBS Custom Browser Dock that points the 16:9 Game capture at a window in one click and routes each app's sound (AJ, 2026-10-30). Lists windows from both captures' own `window` lists over obs-websocket, merged (they differ: the game capture leaves out browsers, Explorer and Discord; minimised windows show only there). Window capture (`Window Capture`, WGC) is the default because it shows any app; the hook (`Game Capture 2`) gives no picture for desktop apps (Defiant test, 2026-10-30) and is the fallback when window capture shows a game black; a capture with no picture or black twice switches once and is remembered per exe. Hides every other capture in 16:9 Game except `Action Cam` (MIU's) and re-reads OBS on `InputSettingsChanged`. Sound: per app, off stream / Game / Music as an `App Audio: <exe> (<Game\|Music>)` Application Audio Capture in the Audio scene, copying the tracks, volume and filters of `Local Game (A)` or `BG Music` (minus BG Music's Move fade filters), monitoring off. The copy is a snapshot taken when the route is chosen (choose it again to pick up a later change); the input is created hidden and shown only once set up, and removed if setup fails. An App Audio meter that goes red stays flagged until clicked. Logic in `src/gamepicker/picker.js`, client in `src/shared/obs.js`, end-to-end check `npm run gamepicker:check` against `tools/gamepicker/fake-obs.js` | Clicks in the dock | `password`, `obs` |
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

The banner fills the goal bar toast's own place (`config.banner.lane`, AJ
on #86): from the follower bar's end at x 560 all the way to the right edge,
with the toast's leaning ends. In OBS it sits under the toast, so a toast plays over it. Its
font size comes from Jost's measured cap height, so the capitals are 32px
(a ~46px line). It keeps AJ's original OBS look (#86): the line repeats as a
marquee at 120 px/s, with drawn sparkles between repeats on the hype strip
and a dash on the ad plate. The hype train also brings back the OBS group's
4px border around the whole screen at 50%, and strip and border cycle through
the colour wheel and back every 20 s (`config.banner.kinds.hype.hueCycle`),
as its Color Correction filter did. One repeat is rendered once offscreen and tiled
each frame, and only the lane is cleared and drawn. Each kind is its own OBS
browser source in Alerts. The ad warning has its own lane along the bottom
edge at half opacity (AJ, #86: "I had it on the bottom of the screen and
not opacity 1"), so both can be up at once. OBS hides a source
instantly; give each source a Hide transition (Fade, 350 ms) for the exit.

### Vertical canvas (Aitum, 1080x1920)

The vertical canvas has its own 1080x1920 browser sources in Alerts (vrt):
"Fullscreen Source (vrt)" (shade), "Notifications Source (vrt)" (toast) and
"Sidescreen Source (vrt)" (sidebar). Move filters and show/hide can't reach
sources on the Aitum canvas, so each one stays **always visible** and rests
on `about:blank`. Mix It Up plays an alert by setting the source's URL (the
page picks portrait from its size), then runs a separate, non-blocking
"Reset Vrt …" command that waits and sets `about:blank` again. Each reset
is guarded by a counter, so it only blanks the source if no newer alert has
started since.

The toast and the sidebar share the seam, so in portrait the second one
waits for the first (`playOnSeam`, a Web Lock, ALERT-1). A queued alert can
start up to about 13 s late (the toast's longest hold), so the reset waits
must cover the wait plus the play time:

| Source | Plays for | Can wait | Reset wait |
|---|---|---|---|
| Notifications Source (vrt) | up to ~12 s (a scrolled long line) | up to ~8 s (a sidebar) | 25 s |
| Sidescreen Source (vrt) | up to 6.8 s (`sidebar.timing.maxTotalMs`) | up to ~13 s (a toast) | 25 s |
| Fullscreen Source (vrt) | ~4-6 s | never (the shade doesn't queue) | 10 s |
| Hype Train Banner (vrt), Ad Banner (vrt) | the whole hype train or ad break | never (it doesn't take the lock) | none: the event's end blanks it |

The banners (#86) are the exception: they stay up for minutes, so they
never take the seam lock (every toast and shoutout would queue behind
them) and have no timed reset. MIU sets their URL on Hype Train Started
and Ad Started, and sets `about:blank` on Hype Train Ended and Ad
Ended/Upcoming. While a toast or sidebar holds the lock, the banner
fades out, then comes back (`seamHeld()`).

Raise a reset wait together with any longer hold. The 16:9 sources keep
their move-filter timers (7 s sidebar, 10 s toast) because nothing queues
there. The OBS and MIU steps live with the Defiant thread
(project files `vertical-layout/defiant-steps.md`).

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
