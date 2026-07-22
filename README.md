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
A flattened EPCOT Spaceship Earth tetrahedron grid, shaded in real 3D. A
grid of equilateral triangles is raised into tetrahedral spikes and lit by
four corner point lights that cycle in intensity over a slow pattern, so
light sweeps visibly across the facets.

**URL**: `epcot/index.html?color=#hexvalue&size=90&speed=1.0&pattern=chase`

## Parameters

All animations support:
- `color` - Base color in hex format (e.g., `#ff6600`)

Epcot-specific:
- `size` - Triangle side length in pixels (default 90, range 70-300)
- `pattern` - Light cycling pattern: `chase`, `pulse`, or `diagonal` (default `chase`)
- `speed` - Multiplies the light cycle rate (default 1.0)
- `brightness` - Multiplies light intensity on top of the built-in baseline (default 1.0)

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
