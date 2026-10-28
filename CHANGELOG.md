# Changelog

What changed on stream, newest first. Versions follow
`docs/roles/release-management.md`: major when OBS setup has to change,
minor for new scenes, features or a visible style change, patch for fixes.

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
