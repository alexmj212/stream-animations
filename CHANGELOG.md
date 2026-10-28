# Changelog

What changed on stream, newest first. Versions follow
`docs/roles/release-management.md`: major when OBS setup has to change,
minor for new scenes, features or a visible style change, patch for fixes.

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
