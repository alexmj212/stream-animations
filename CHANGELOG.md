# Changelog

What changed on stream, newest first. Versions follow
`docs/roles/release-management.md`: major when OBS setup has to change,
minor for new scenes, features or a visible style change, patch for fixes.

## v2.0.0 - 2026-10-28

**OBS setup change:** the stinger now lasts exactly `duration` and the screen
is fully covered through the middle, so the cut point is 50% of `duration`
(500 ms at the default 1000 ms). Re-enter the Transition Point on any OBS
Stinger transition, or use the WebM and Transition Point attached to this
release.

- Stinger: bars arrive, hold and leave without speed jumps, and every layout
  is balanced across the screen (`?seed=N` pins one). Also plays on
  `obsSourceActiveChanged` and `?autoplay=true`. ([#2])
- Sidebar: ends exactly at `duration` and fully covers its panel. ([#2])
- Background: bars appear on screen instead of creeping in from off-screen,
  turn smoothly, and spread evenly; default density is now 8. ([#2])
- Colored bars and the curtain seam get a lit leading edge. ([#2])
- New: `npm run motion` checks every scene's timing and smoothness, and
  `npm run motion:export -- stinger` renders a transparent stinger video for
  OBS. ([#2])

[#2]: https://github.com/alexmj212/stream-animations/pull/2
