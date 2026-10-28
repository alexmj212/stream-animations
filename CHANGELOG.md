# Changelog

What changed on stream, newest first. Versions follow
`docs/roles/release-management.md`: major when OBS setup has to change,
minor for new scenes, features or a visible style change, patch for fixes.

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
