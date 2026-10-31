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
| gamepicker | Not a scene: an OBS Custom Browser Dock that points a game scene's capture at a window in one click and routes each app's sound (AJ, 2026-10-30). Nothing about any one OBS is built in (AJ, 2026-10-30): a first-run setup screen guesses the scene with the most window/game captures, the person confirms the scene, its window capture and/or game capture, optional pinned sources (one-click buttons, e.g. a capture card), whether to also hide the scene's other captures, whether the dock handles app sound, the scene app sound goes in (guess: the scene nested in the most others), and the channel fader max (default -12 dB, out of the red with no limiter); saved in obs-websocket persistent data (profile realm, slot `gamePicker.setup`), reopened with ⚙. Lists apps (AJ, 2026-10-30: called "Apps" in the dock, not "Windows") from the captures' own `window` lists, merged (the game capture leaves out browsers, Explorer and Discord; minimised windows show only there), title first with the exe under it and a letter tile per app (OBS can't hand a dock icons). Window capture (WGC) is the default because it shows any app; the hook gives no picture for desktop apps and is the fallback when window capture shows a game black; a capture with no picture or black twice switches once and is remembered per exe. Only the dock's own sources are shown and hidden (plus other captures if ticked). Sound: per app, off or a channel, as an `App Audio: <exe> (<channel>)` Application Audio Capture in the setup's audio scene, monitoring off; no virtual cables or extra Windows devices. A channel is a name, tracks 1-6 and optionally a source to copy filters (its Move Audio Value volume fades too, so a music app keeps the fades the fade scenes trigger; not Move filters that drive other sources. A fade only moves the input its Move Action names, so with several apps in a channel only that one follows it, and a fade and the channel fader both set the volume: the last one wins) and starting fader from; a new dock offers plain Game and Music (removable); an app joining a channel with apps copies their tracks and filters unless the channel sets them. One fader (capped at the setup's max), mute and a working light (idle, live, or red and latched until clicked) per channel; no level meters (AJ, 2026-10-30: only show it's working). Channels and faders live in persistent data (slot `gamePicker.channels`); inputs whose channel isn't saved show as plain channels. Copied filters are a snapshot taken when the app joins; an input is created hidden, shown once set up, removed if setup fails. Layout follows the dock's shape: one column when tall and narrow, apps beside the picture and mixer from 560 px wide, picture, apps grid and channels in a row at 900 px or wider and 460 px or shorter, Apps/Sound tabs when short and narrower. Logic in `src/gamepicker/picker.js`, client in `src/shared/obs.js`, end-to-end check `npm run gamepicker:check` (`--shots=dir` saves pictures) against `tools/gamepicker/fake-obs.js` | Clicks in the dock | `password`, `obs` |
| audiorouting | Not a scene: an OBS Custom Browser Dock, separate from the Game Switcher (AJ, 2026-10-31: "make this visual editor a different dock"), that draws OBS's sound as a flow chart and edits it by dragging. Sources: every input whose sound reaches OBS's tracks (`GetInputAudioTracks` answers; browser pages only with "Control audio via OBS", window/game captures only with "Capture audio"), grouped inputs, desktop and apps, Game Switcher channels, media, browser, other; each with its audio filters as icons in chain order (AJ: "have icons for filters"; disabled ones faded, video filters left out), a working light, muted and not-in-program marks. Channels come from the Game Switcher's persistent slot `gamePicker.channels` and its `App Audio:` inputs; a channel is one box holding its apps and wires to the tracks its apps share (dashed where only some do, or where it has no apps yet). Tracks 1-6 are named and labelled from the profile's output settings (`GetProfileParameter`: Output Mode, AdvOut TrackIndex, VodTrackEnabled/VodTrackIndex, RecType, RecTracks or FFAudioMixes, Track1-6Name; Simple mode is track 1, or SimpleOutput RecTracks for a recording quality of its own). Outputs: Stream, Twitch VOD, Recording, Replay buffer, plus Monitor. Edits: drag a dot to a track (`SetInputAudioTracks`), drag a wire to another track or away, click a wire and ×; dropping on Monitor sets Monitor and Output (`SetInputAudioMonitorType`); a channel edit changes every app in it and its saved tracks. While an output runs, a change to a track it takes needs one confirm, and so does anything joining the profile's Twitch VOD track (QA, #131: music there can get the VOD muted). Undo (20 deep). Reads again on OBS's events (debounced 150 ms) and as the pointer arrives (output settings have no event); meters only while visible; no animation loop. Logic in `src/audiorouting/routing.js`, end-to-end check `npm run audiorouting:check` (`--shots=dir`) against `tools/gamepicker/fake-obs.js` with `routing: true` | Drags in the dock | `password`, `obs` |
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
