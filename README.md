# Stream Animations

A collection of visually consistent HTML5 Canvas animations for OBS stream overlays.

## Animations

### Stinger Transition
A dynamic curtain-style transition with slanted and horizontal bars.

**URL**: `stinger/index.html?color=#hexvalue&duration=3000`

### Background Animation
Subtle continuously looping background with drifting bars.

**URL**: `background/index.html?color=#hexvalue&speed=1.0&density=5`

### Epcot
A flattened EPCOT Spaceship Earth triangular-lattice grid, shaded in real
3D and lit like the actual ball's LED fixtures. Equilateral triangles are
raised into tetrahedral spikes; every photon in the scene comes from a
point light "bulb" sitting at a panel vertex of the lattice and glinting
locally off the facets right around it - there is no off-screen "sun" or
corner floodlight. Each facet gathers light from every bulb within a short
reach (not just its own triangle's corners), so bright bulbs throw glints
across several rows of panels, cast spikes-vs-panel shadows onto their
neighbors, and spill one-bounce indirect light. Each lit bulb renders as a
white-hot core in a colored glow with side-firing star beams, and every
bulb keeps a small visible LED point even at rest.

Light **patterns** move intensity around the surface (position+time
driven, every bulb runs the same formula): `steady` (fully lit, static),
`chase` (one bloom orbiting the perimeter), `orbit` (two opposite blooms),
`pulse` (center-weighted breathing), `diagonal` (opposite corners
alternating), `wave` (diagonal sweeping band), `cascade` (band falling top
to bottom), `scanner` (band ping-ponging left/right), `spiral` (rotating
radar beam), `radial` (expanding rings), plus color patterns that keep
every bulb lit and instead animate which of the scheme's colors each bulb
shows - `split` (boundary sweeping top/bottom), `sweep` (rotating angular
boundary), `bands` (scrolling stripes), `mix` (spatially random shuffle) -
and `auto`, which cycles through all of the above with smooth crossfades.

Color **schemes** control how bulb colors are distributed: `classic`
(gentle hue drift toward each corner), `mono` (single hue), `duo`
(complementary split), `rainbow` (full hue wheel by angle), `cycle`
(classic distribution slowly rotating through the wheel), plus discrete
palette schemes modeled on real Spaceship Earth lighting programs -
`illuminations` (the iconic violet-to-amber night gradient), `earidescent`
(50th-anniversary lavender/purple/gold/iridescent blue), `celebration`
(gold/royal blue/white), `holiday` (red/green/warm white), `halloween`
(orange/purple/green), and `patriot` (red/white/blue), `festival`
(Festival of the Arts multicolor patches).

The `meteor` and `night` overlays send a streak of light across the
surface along one of the 6 lattice axes; by default each streak picks a
random axis, but a fixed direction (`right`, `down-right`, `down-left`,
`left`, `up-left`, `up-right`) can be locked in so every streak travels the
same way, with configurable spawn interval, speed, tail length, life, and
number of concurrent tracks.

A **fisheye** toggle curves the flat lattice into the real ball's
spherical silhouette - center panels magnify, rim panels compress - purely
as a display projection: the lighting/shading simulation always runs on
the original flat lattice (so the look is physically identical either
way), and only the drawn facet outlines, gap seams, bulb positions, and
star beams are warped, including bending the beams' arms to follow the
curved rows they run along.

Dark panel-gap seams trace every base triangle's outline plus its internal
facet creases. A settings panel (gear icon, bottom-right) lets you tune
every parameter below live; it only appears on mouse movement, so it never
shows up in an OBS Browser Source (which sends no mouse events) - safe to
leave the panel enabled for stream use. Press `c` to toggle it. A "Copy URL
for OBS" button copies the current settings baked into the URL.

**URL**: `epcot/index.html?color=#hexvalue&size=90&speed=1.0&pattern=chase&scheme=classic`

## Parameters

All animations support:
- `color` - Base color in hex format (e.g., `#ff6600`)

Epcot-specific:
- `pattern` - Light cycling pattern: `steady`, `chase`, `orbit`, `pulse`, `diagonal`, `wave`, `cascade`, `scanner`, `spiral`, `radial`, `split`, `sweep`, `bands`, `mix`, or `auto` (default `chase`)
- `scheme` - Color scheme: `classic`, `mono`, `duo`, `rainbow`, `cycle`, `illuminations`, `earidescent`, `celebration`, `holiday`, `halloween`, `patriot`, or `festival` (default `classic`)
- `star` - Bulb star-beam shape: `star6`, `star4`, `burst`, `rays`, or `none` (default `star6`)
- `core` - Bulb core light color: `match` (scheme color) or `white` (default `match`)
- `overlay` - Star overlay driving extra white cores on top of the base pattern: `none`, `twinkle`, `meteor`, or `night` (default `none`)
- `size` - Triangle side length in pixels (default 90, range 70-300)
- `speed` - Multiplies the light cycle rate (default 1.0)
- `brightness` - Multiplies light intensity on top of the built-in baseline (default 1.0)
- `sat` - Saturation multiplier applied to bulb colors (default 1.35)
- `blend` - `true`/`false` - color patterns interpolate smoothly between groups instead of a dithered hard edge (default `false`)
- `floor` - Minimum visibility (0-1) every bulb's LED point keeps even at zero pattern drive (default 0.35; 0 disables idle points)
- `gap` - Panel gap line width in pixels (default 1.5; internal facet creases render thinner)
- `bounce` - One-bounce indirect light strength, fraction of neighboring panels' average direct light (default 0.38)
- `spec` - Specular (metallic glint) weight (default 2.4)
- `beam` - Star beam length as a ratio of triangle size (default 1.05)
- `bulbs` (alias `dots`) - `true`/`false` - show the bulb glow/core/beam sprites (default `true`)
- `shadows` - `true`/`false` - spikes cast shadows onto neighboring panels (default `true`)
- `mint` - Meteor spawn interval in seconds, per track (default 3.6)
- `mspd` - Meteor head speed, in triangle-sizes per second (default 13)
- `mtail` - Meteor tail length, in triangle-sizes (default 3.0)
- `mlife` - Meteor streak lifetime in seconds (default 1.5)
- `mtrk` - Number of concurrent meteor tracks, 1-4 (default 2)
- `mdir` - Meteor travel direction: `random`, `right`, `down-right`, `down-left`, `left`, `up-left`, or `up-right` (default `random`)
- `fisheye` - `true`/`false` - curve the lattice into the ball's spherical silhouette (default `false`)
- `fstr` - Fisheye amount: 0 flat, 1 full spherical projection, >1 an exaggerated beyond-spherical bulge (default 0.8)
- `fps` - Max frames per second, 15-60 (default 60). Slow light cycles look fine at 30, roughly halving GPU load; static scenes (steady pattern, no overlay) stop redrawing entirely regardless of this setting
- `panel` - `false` disables the settings panel/gear entirely (default enabled)

## Project Structure

```
src/
  shared/       - Shared animation utilities and base classes
  stinger/      - Stinger transition animation
  background/   - Background loop animation
public/         - Built/compiled animations for OBS
```

## Development

The animations are built with vanilla HTML5 Canvas and JavaScript for maximum compatibility with OBS Browser Sources.

## Usage in OBS

1. Add a Browser Source
2. Set URL to the local file path or web server hosting the HTML
3. Set Width: 1920, Height: 1080 (or your stream resolution)
4. Add custom CSS: `body { background-color: rgba(0, 0, 0, 0); }`
5. Check "Shutdown source when not visible" for performance
