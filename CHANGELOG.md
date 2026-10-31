# Changelog

What changed on stream, newest first. Versions follow
`docs/roles/release-management.md`: major when OBS setup has to change,
minor for new scenes, features or a visible style change, patch for fixes.

## v2.13.1 - 2026-10-30

- Game Switcher dock fixes from the first run in AJ's OBS. The top line
  shows the window title first, with the app and capture method below it.
  Setup skips divider scenes, and its audio-scene guess picks the scene
  with more audio sources when two are nested equally often. Reload the
  dock to pick it up. ([#124])
- The Game Switcher's list is called Apps instead of Windows. ([#126])

## v2.13.0 - 2026-10-30

- The Game Switcher dock works with any OBS setup, in any dock shape. A
  first-run setup screen (reopened with the gear) picks the scene, its
  captures, pinned sources and the fader max, guessed from the scenes in
  OBS and saved in OBS. Channels are plain track sets that can copy another
  source's filters. Each channel shows a working light instead of a meter.
  The layout adapts to tall, wide and small docks. AJ's dock opens on setup
  once, until setup is saved. ([#120])

## v2.12.0 - 2026-10-30

- The Game Picker dock can make its own audio channels. Name a channel and
  choose whether it goes on the VOD (like Game) or stays off it (like Music),
  then send several apps to it. Each channel has one fader, mute and meter
  in the dock that moves every app in it. The fader stops at -12 dB, so
  each app peaks at -19 dBFS at most; several loud apps in one channel add
  up, and the channel meter flags it if they reach the red. Channels are
  saved in OBS, not the browser. Reload the dock to pick it up. ([#118])

## v2.11.0 - 2026-10-30

- The Game Picker dock uses window capture by default and falls back to the
  game hook only for games that show black, remembered per game. Store apps
  and minimised windows now work, and a failed pick puts the old picture
  back.
- Each app in the dock has a sound menu: off stream, Game, or Music (Music
  stays off the VOD track). The dock adds its own audio source for that app
  and never changes AJ's existing ones. Reload the dock to pick it up.
  ([#116])

## v2.10.1 - 2026-10-30

- The Game Picker dock lists every window OBS lists, from both the game
  capture and the window capture, and sends each window only to a capture
  that can see it. It shows what 16:9 Game really has, including changes
  made in the source properties, and flags a stored window that isn't open.
  Reload the dock to pick it up. ([#114])

## v2.10.0 - 2026-10-30

- New Game Picker dock for OBS. It lists open windows and points the 16:9
  Game capture at one in a single click, hiding the other captures there
  (Action Cam is left alone). It falls back to window capture when a game
  hooks black, and shows read-only audio meters. It's a Custom Browser Dock,
  not a scene, so nothing on stream changes until AJ adds the dock. ([#111])

## v2.9.2 - 2026-10-30

- The Spheal march song plays 12 dB quieter, so it stays out of the red on
  the OBS meter (it peaks around -11 dB instead of clipping). `?volume`
  still works on top of it. ([#106])

## v2.9.1 - 2026-10-29

- The Spheal march holds a smooth frame rate at its peak crowd. Each
  Spheal's tilt is now drawn ahead of time instead of on every frame. In
  Defiant's OBS test the peak ran at about 34 fps before this fix. It looks
  the same as before. ([#102])

## v2.9.0 - 2026-10-29

- New Spheal march gag page. A slow march of real Spheals (the PokeAPI
  sprite, with a drawn fallback) hops across the bottom of the screen to
  AJ's song, a few at first and then hundreds, until a crowned giant hops
  through. The song stops once the whole wave has crossed. It's a gag, so
  it is exempt from the stream bible. It goes live once OBS has the new
  browser source and Mix It Up has a command to show it. ([#97])

## v2.8.0 - 2026-10-28

- New banner scene for the hype train banner and the ad warning. It keeps
  AJ's original look: a teal strip with a scrolling "HYPE TRAIN" marquee
  and sparkles, and black scrolling text on an orange plate. The capitals
  are now 32px. The hype banner fills the toast's place, from the follower
  bar to the right edge, and a toast plays over it. The ad warning runs
  along the bottom edge at half opacity. On the vertical canvas both are
  full width on the seam and step aside while a toast or sidebar alert
  plays. It replaces the OBS banner groups once OBS and Mix It Up point at
  the new page. ([#86])

## v2.7.0 - 2026-10-28

- Vertical (1080x1920) canvas, AJ's pick A2: the sidebar becomes a
  two-line ink nameplate on the camera/game seam, with the action at 48px
  over the name at 64px. It grows upward and stays inside the phone-safe
  area, so it no longer covers the camera with the 16:9 bars. The raid
  shade's words now fit the phone-safe area too. On the vertical canvas
  the toast and the sidebar take turns on the seam instead of stacking.
  The 16:9 sidebar, shade and toast are unchanged. The new sidebar shows
  on stream once OBS has a 1080x1920 source for it. ([#82])

## v2.6.1 - 2026-10-28

- Goal bar toast (16:9): a line too long for the standard bar now grows the
  bar first and keeps the text at full size, so a follow with a username
  reads at 42px instead of shrinking to 38px. The text only shrinks once
  the bar is at its longest. ([#76])

## v2.6.0 - 2026-10-28

- Toast on the vertical (1080x1920) canvas: a portrait layout, AJ's pick
  B1. It's one line at 56px on the camera/game seam, inside the phone-safe
  area, instead of the 16:9 toast scaled down and cut off at the sides. A
  long line shrinks to 45px and then scrolls. The page picks the layout
  from its size, and `?layout=vertical|wide` forces one. The 16:9 toast is
  unchanged. It shows on stream once OBS has a 1080x1920 source for it.
  ([#72])

## v2.5.0 - 2026-10-28

- New title card scene for the Starting, BRB and Ending titles: one line
  of 96px Jost on a slanted ink plate, bottom-left. The plate slides in,
  then the words, and then it holds still and stops drawing. Set the words
  with `?text=`; a long title shrinks and then wraps to two lines. It only
  shows on stream once the OBS text sources are swapped for it. ([#70])

## v2.4.1 - 2026-10-28

- Stinger on the vertical (1080x1920) canvas: the slanted bars now start
  fully off screen instead of popping in partway down. The 16:9 stinger
  is unchanged. ([#69])

## v2.4.0 - 2026-10-28

- Alerts: the shade and sidebar text now holds still and whole while
  viewers read it, for 200ms a word and never under 3s, instead of
  scrolling. The shade line sits centred and wraps to two lines when it's
  long. The sidebar shows the @name large on a dark nameplate, with the
  action in reading order. OBS's `duration` is now a minimum, so nothing
  changes in OBS or Mix It Up. A very long alert stops at 6.8s in the
  sidebar and 9.8s in the shade, before OBS hides the source. An alert
  too long for two lines now reads on without gaps and ends in "…".
  ([#58], [#64])
- Goal bar and toast: the text is bigger, 42px instead of 32px, in the same
  top-left spot. The goal bar now reaches x560 so the count fits, and the
  toast grows out from there. ([#62])
- Stinger on the vertical (1080x1920) canvas: the curtains now cover the
  whole screen at the cut, instead of leaving a wedge at the bottom right.
  The 16:9 stinger is unchanged. ([#66])
- Text scenes carry their own copy of Jost, so a browser source that
  loads offline or before the font arrives no longer falls back to
  Arial. ([#60])

## v2.3.0 - 2026-10-28

- Stinger: runs at 1200ms with the cut at 600ms, as AJ picked. The bars
  hold still for a shorter time while they cover the screen (45/10/45
  instead of 35/30/35), so the transition never sits frozen for more than
  about 270ms. OBS was already set to 1200ms. ([#56])

## v2.2.3 - 2026-10-28

- Followers: a new follow no longer stutters the stream (its slowest frame
  drops from 20-75ms to about 5ms), and the count holds still as the number
  ticks instead of shifting sideways. The look is unchanged. ([#52])

## v2.2.2 - 2026-10-28

- Notifications: a grown bar now stops at the title-safe edge, so its tip
  stays inside the action-safe area instead of running to the screen
  edge. Long lines start scrolling a little sooner. ([#47])

## v2.2.1 - 2026-10-28

- Notifications: long text no longer ends in an ellipsis. The bar grows
  as far as the line needs, and a line too long even for the longest
  bar scrolls during the hold. ([#32])
- Followers: the bar is now live in OBS in place of the Mix It Up Follow
  Goal widget (the v2.2.0 notes said it was still pending).

## v2.2.0 - 2026-10-28

**New OBS sources:** `notifications/?text=...` and `followers/` on Pages.

- Notifications: a new toast scene that grows out of the right end of the
  follower-goal bar, shows `?text=` in the Illuminations palette and shrinks
  back. It replaces the old OBS Notifications scene, whose mask plugin broke
  in OBS 33. Mix It Up's Show Toast now passes `text=`. ([#27])
- Followers: a new follower-goal bar ("946 / 1000 GOOBERS") built to
  replace Mix It Up's Follow Goal widget. It reads Mix It Up's follower
  counter from the local API and sweeps up on each follow. OBS keeps the
  widget until a live check shows the Pages page can reach that API.
  ([#29])

## v2.1.2 - 2026-10-28

- Sidebar: long text now fits inside the panel. It shrinks as needed, down to 75%, then
  wraps to two lines, and only then ends with an ellipsis, instead of
  hanging off the panel over the stream. ([#23])

## v2.1.1 - 2026-10-28

- Sidebar: the text now sits at 78% of the height instead of 67%, so the
  Mix It Up images (Hug, Pet, Treat, Resubscribed, Shoutout avatars) no
  longer cover it. ([#17])

## v2.1.0 - 2026-10-28

- Look: the stinger, sidebar and shade now paint their colored bars with the
  epcot ball's Illuminations palette (violet at the top through red to amber
  at the bottom), fixed to the screen. `?color=` no longer recolors them, so
  Couch Color leaves them alone. Per URL, `?scheme=mono` (or
  `?colormode=mono` with a `color`) brings back the old single-color look,
  and `?colormode=shift` rotates the palette's hues to `color`. The stinger
  WebMs attached to this release show the new palette. ([#16])
- Hosting: every scene is served from GitHub Pages behind a loader that
  never serves a stale build, and OBS loads those URLs with the same params.
  `?debug=build` shows which build is running. ([#11])

## v2.0.0 - 2026-10-28

**OBS setup change:** the stinger now lasts exactly `duration` and the screen
is fully covered through the middle, so the cut point is 50% of `duration`
(500 ms at the default 1000 ms). Re-enter the Transition Point on any OBS
Stinger transition, or use the WebM and Transition Point attached to this
release (`npm run motion:export -- stinger` renders your own).

- Look: stinger and sidebar colored bars and the curtain seam get a lit
  leading edge, and in every bar scene white horizontal bars now line up with
  their shadows. ([#2])
- Stinger: bars arrive, hold and leave without speed jumps, and every layout
  is balanced across the screen (`?seed=N` pins one). Also plays on
  `obsSourceActiveChanged` and `?autoplay=true`. ([#2])
- Sidebar: ends exactly at `duration` and fully covers its panel. ([#2])
- Shade: the curtains now lead the text in and out, and the text stays on
  the curtains throughout. ([#6])
- Background: bars appear on screen instead of creeping in from off-screen,
  turn smoothly, and spread evenly; default density is now 8. ([#2])

[#2]: https://github.com/alexmj212/stream-animations/pull/2
[#6]: https://github.com/alexmj212/stream-animations/pull/6
[#11]: https://github.com/alexmj212/stream-animations/pull/11
[#16]: https://github.com/alexmj212/stream-animations/pull/16
[#17]: https://github.com/alexmj212/stream-animations/pull/17
[#23]: https://github.com/alexmj212/stream-animations/pull/23
[#27]: https://github.com/alexmj212/stream-animations/pull/27
[#29]: https://github.com/alexmj212/stream-animations/pull/29
[#32]: https://github.com/alexmj212/stream-animations/pull/32
[#47]: https://github.com/alexmj212/stream-animations/pull/47
[#52]: https://github.com/alexmj212/stream-animations/pull/52
[#56]: https://github.com/alexmj212/stream-animations/pull/56
[#58]: https://github.com/alexmj212/stream-animations/pull/58
[#60]: https://github.com/alexmj212/stream-animations/pull/60
[#62]: https://github.com/alexmj212/stream-animations/pull/62
[#64]: https://github.com/alexmj212/stream-animations/pull/64
[#66]: https://github.com/alexmj212/stream-animations/pull/66
[#69]: https://github.com/alexmj212/stream-animations/pull/69
[#70]: https://github.com/alexmj212/stream-animations/pull/70
[#72]: https://github.com/alexmj212/stream-animations/pull/72
[#76]: https://github.com/alexmj212/stream-animations/pull/76
[#82]: https://github.com/alexmj212/stream-animations/pull/82
[#86]: https://github.com/alexmj212/stream-animations/pull/86
[#97]: https://github.com/alexmj212/stream-animations/pull/97
[#102]: https://github.com/alexmj212/stream-animations/pull/102
[#106]: https://github.com/alexmj212/stream-animations/pull/106
[#111]: https://github.com/alexmj212/stream-animations/pull/111
[#114]: https://github.com/alexmj212/stream-animations/pull/114
[#116]: https://github.com/alexmj212/stream-animations/pull/116
[#118]: https://github.com/alexmj212/stream-animations/pull/118
[#120]: https://github.com/alexmj212/stream-animations/pull/120
[#124]: https://github.com/alexmj212/stream-animations/pull/124
[#126]: https://github.com/alexmj212/stream-animations/pull/126
