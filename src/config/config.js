/**
 * Centralized configuration for stream animations
 *
 * Coordinate System:
 * - Origin: Top-left corner (0, 0)
 * - X-axis: Increases rightward (0 to canvas.width)
 * - Y-axis: Increases downward (0 to canvas.height)
 * - Rotations: Clockwise in degrees
 */

export const config = {
  // Background scene configuration
  background: {
    // Brightness multiplier (0.8 = 20% reduction for visual harmony)
    brightness: 0.8,

    // 40% slanted, 60% horizontal; kept when bars respawn
    slantedShare: 0.4,
    // Random spawn positions tried per bar; the one farthest from the bars
    // already on screen wins, so the layout stays balanced
    placementCandidates: 6,

    // Animation speeds in pixels per second (NOT per frame - frame-rate independent)
    speed: {
      defaultMultiplier: 1.0,     // Default speed multiplier from URL
      barSpeedRange: {            // Random speed range for bars
        min: 0.1,                 // Slowest bar (10% of base speed)
        max: 0.9                  // Fastest bar (90% of base speed)
      },
      layerSplitThreshold: 0.5    // Bars slower than this go to background layer
    },

    // Bar density and lifecycle
    density: {
      default: 8,                 // Default number of bars (all on screen since spawn fix)
      min: 1,                     // Minimum allowed
      max: 50                     // Maximum before performance degrades
    },

    // Per-scene duration overrides (2000ms entry/exit override - background fades slower than shared default)
    durations: {
      entryMs: 2000,      // Override shared default (background fades slower)
      exitMs: 2000,       // Override shared default (background fades slower)
      holdMinMs: 30000,   // 30 seconds minimum visible time
      holdMaxMs: 120000,  // 120 seconds maximum visible time
      transitionMs: 3000  // Direction transition duration
    },

    // Size variations
    size: {
      multiplierMin: 0.5,         // Minimum size multiplier (50%)
      multiplierMax: 1.5,         // Maximum size multiplier (150%)
      minVariation: 0.3           // Minimum difference between start/end sizes
    },

    // Opacity settings
    opacity: {
      min: 0.4,                   // Minimum bar opacity (40%)
      max: 0.7                    // Maximum bar opacity (70%)
    },

    // Direction changes
    direction: {
      maxChanges: 2,              // Maximum direction changes during lifetime (0-2)
    },

    // Bar dimensions for slanted bars
    slanted: {
      angle: 15,                  // Rotation angle in degrees (clockwise)
      whiteBarWidthMin: 50,       // Minimum width for white slanted bars
      whiteBarWidthMax: 150,      // Maximum width for white slanted bars
      coloredBarWidthMin: 200,    // Minimum width for colored slanted bars
      coloredBarWidthMax: 600     // Maximum width for colored slanted bars
    },

    // Bar dimensions for horizontal bars
    horizontal: {
      skewAngle: -15,             // Skew angle in degrees (negative for opposite direction)
      whiteBarHeightMin: 20,      // Minimum height for white horizontal bars
      whiteBarHeightMax: 50,      // Maximum height for white horizontal bars
      coloredBarHeightMin: 40,    // Minimum height for colored horizontal bars
      coloredBarHeightMax: 100    // Maximum height for colored horizontal bars
    },

    // Color settings
    color: {
      whiteBarProbability: 0.7,   // Probability of a bar being white (70%)
      whiteBarLightness: 80,      // Lightness value for white bars (reduced from 100)
      hueVariation: 40,           // Max hue variation from base color (+/- 20)
      lightnessVariation: 30,     // Max lightness variation (+/- 15)
      lightnessReduction: 0.8     // Reduce lightness by 20% for colored bars
    },

    // Viewport culling margins (pixels beyond viewport to continue rendering)
    viewport: {
      margin: 200                 // Pixels beyond viewport edges
    },

    // Offscreen positioning (coordinates for bars entering/exiting viewport)
    offscreen: {
      leftMargin: 300,            // Distance left of viewport origin (negative X)
      rightMargin: 300,           // Distance right of viewport edge
      topMargin: 0,               // Y position at top
      horizontalWidth: 400        // Extra width for horizontal bars extending beyond viewport
    }
  },

  // Stinger scene configuration
  stinger: {
    // Brightness multiplier (0.8 = 20% reduction to match background)
    brightness: 0.8,

    // Duration and timing
    // The whole stinger lasts exactly `duration` ms: in, hold, out. The
    // screen is fully covered through the hold; cut point = 50% of duration.
    timing: {
      defaultDurationMs: 1000,    // Default transition duration
      fps: 60,                    // Frames per second for calculations
      easeInProportion: 0.35,     // 35% of duration: bars arrive
      pauseProportion: 0.30,      // 30% of duration: full cover (hold)
      easeOutProportion: 0.35,    // 35% of duration: bars leave
      inStaggerProportion: 0.35,  // Accent arrivals start up to 35% into the in phase
      outStaggerProportion: 0.3   // Accent exits start up to 30% into the out phase
    },

    // Accent bar composition (planStinger)
    accents: {
      count: 6,                   // Accent bars per transition
      slantedMin: 2,              // 2-3 slanted, the rest horizontal
      whiteMin: 2                 // At least this many white bars
    },

    // Visual style
    style: {
      edgeLight: true             // Lit leading edge on colored bars and the curtain seam
    },


    // Slanted bar configuration
    slanted: {
      angle: 15,                  // Rotation angle in degrees (clockwise)
      whiteBarWidthMin: 40,       // Minimum width for white slanted bars
      whiteBarWidthMax: 120,      // Maximum width for white slanted bars
      coloredBarWidthMin: 150,    // Minimum width for colored slanted bars
      coloredBarWidthMax: 450,    // Maximum width for colored slanted bars
      targetPositionMin: 0.2,     // Minimum target position (20% of viewport width)
      targetPositionMax: 0.8,     // Maximum target position (80% of viewport width)
      driftPxPerSec: 90           // Base hold drift (scaled 0.6-1.4x by depth)
    },

    // Horizontal bar configuration
    horizontal: {
      skewAngle: -15,             // Skew angle in degrees (negative for opposite direction)
      whiteBarHeightMin: 20,      // Minimum height for white horizontal bars
      whiteBarHeightMax: 50,      // Maximum height for white horizontal bars
      coloredBarHeightMin: 40,    // Minimum height for colored horizontal bars
      coloredBarHeightMax: 100    // Maximum height for colored horizontal bars
    },

    // Color settings
    color: {
      whiteBarProbability: 0.7,   // Probability of a bar being white (70%)
      whiteBarLightness: 100,     // Lightness value for white bars
      hueVariation: 40,           // Max hue variation from base color (+/- 20)
      lightnessVariation: 30      // Max lightness variation (+/- 15)
    },

    // Opacity settings
    opacity: {
      min: 0.6,                   // Minimum bar opacity (60%)
      max: 1.0                    // Maximum bar opacity (100%)
    },

    // Direction settings
    direction: {
      reverseOnExitProbability: 0.5 // Probability of slanted bars reversing on exit (50%)
    },

    // Viewport margins
    viewport: {
      margin: 300                 // Larger margin for fast-moving stinger bars
    },

    // Offscreen positioning
    offscreen: {
      leftMargin: 300,            // Distance left of viewport origin
      rightMargin: 300,           // Distance right of viewport edge
      horizontalMargin: 200,      // Margin for horizontal bars
      horizontalWidthExtension: 400 // Extra width for horizontal bars
    }
  },

  // Sidebar scene configuration
  sidebar: {
    // Brightness multiplier (0.8 = 20% reduction to match background)
    brightness: 0.8,

    // Positioning (X coordinates - origin at left edge)
    position: {
      sidebarStart: 0.8,          // Sidebar starts at 80% of viewport width
      sidebarWidth: 0.2,          // Sidebar covers 20% of viewport width
      horizontalTargetOffset: -100 // Horizontal bars stop 100px before sidebar start
    },

    // Timing
    timing: {
      defaultDurationMs: 5000,    // Default sidebar display duration
      fps: 60,                    // Frames per second for calculations
      // Phase proportions
      slideInProportion: 0.25,    // 25% of duration for slide in
      holdProportion: 0.50,       // 50% of duration for hold
      slideOutProportion: 0.25,   // 25% of duration for slide out
      // Stagger happens inside the slide phases so everything ends at duration
      inStaggerProportion: 0.4,   // Accent arrivals start up to 40% into slide-in
      outStaggerProportion: 0.3   // Accent exits start up to 30% into slide-out
    },

    // Visual style
    style: {
      edgeLight: true             // Lit leading edge on colored bars and the panel
    },

    // Slanted bar configuration
    slanted: {
      angle: 15,                  // Rotation angle in degrees (clockwise)
      whiteBarWidthMin: 40,       // Minimum width for white slanted bars
      whiteBarWidthMax: 120,      // Maximum width for white slanted bars
      coloredBarWidthMin: 150,    // Minimum width for colored slanted bars
      coloredBarWidthMax: 450     // Maximum width for colored slanted bars
    },

    // Horizontal bar configuration
    horizontal: {
      skewAngle: -15,             // Skew angle in degrees (negative for opposite direction)
      whiteBarHeightMin: 20,      // Minimum height for white horizontal bars
      whiteBarHeightMax: 50,      // Maximum height for white horizontal bars
      coloredBarHeightMin: 40,    // Minimum height for colored horizontal bars
      coloredBarHeightMax: 100,   // Maximum height for colored horizontal bars
      widthExtension: 200         // Extra width beyond sidebar area
    },

    // Bar count
    bars: {
      background: 1,              // Single background bar
      accent: 8                   // Number of accent bars
    },

    // Hold phase velocity
    hold: {
      velocityMin: 0.3,           // Minimum velocity during hold phase (px/frame)
      velocityMax: 0.8            // Maximum velocity during hold phase (px/frame)
    },

    // Color settings
    color: {
      whiteBarProbability: 0.7,   // Probability of a bar being white (70%)
      whiteBarLightness: 100,     // Lightness value for white bars
      hueVariation: 40,           // Max hue variation from base color (+/- 20)
      lightnessVariation: 30      // Max lightness variation (+/- 15)
    },

    // Opacity settings
    opacity: {
      min: 0.6,                   // Minimum bar opacity (60%)
      max: 1.0                    // Maximum bar opacity (100%)
    },

    // Viewport margins
    viewport: {
      margin: 300
    },

    // Offscreen positioning
    offscreen: {
      startMargin: 200,           // Distance beyond viewport right edge for start position
      horizontalMargin: 200       // Margin for horizontal bars
    }
  },

  // Shade scene configuration (text animation component)
  shade: {
    // Brightness multiplier (0.8 = 20% reduction to match background/sidebar/stinger)
    brightness: 0.8,

    // Text styling
    text: {
      font: 'bold 96px Jost',     // Large celebratory font size
      color: '#ffffff',           // Default white (overridden by URL ?color parameter)
      shadow: {
        blur: 8,                  // Shadow blur radius
        offsetX: 4,               // Shadow X offset
        offsetY: 4,               // Shadow Y offset
        color: 'rgba(0, 0, 0, 0.6)' // Shadow color with opacity
      }
    },

    // Timing configuration
    timing: {
      readingSpeedMsPerWord: 200, // 200ms per word = 5 words/second (fast pace for stream events)
      minHoldMs: 3000,            // Minimum 3-second hold duration
      scrollSpeedPxPerSec: 300    // Initial baseline scroll speed (will be dynamically calculated)
    },

    // Durations (use shared defaults for entry/exit transitions)
    durations: {
      entryMs: 1000,              // Entry animation duration
      exitMs: 1000                // Exit animation duration
    },

    // Curtains close in the first half of the entry and open in the last
    // half of the exit, so the band is covered before the text reaches it
    // and after it has gone; the text is also clipped to the curtains
    curtainMoveShare: 0.5,
    clipTextToCurtains: true,

    // Curtain configuration
    curtains: {
      opacity: 0.5,               // Semi-transparent overlay (middle of 0.4-0.6 range)
      barCount: 6                 // Horizontal bars per curtain (balances visual density with performance)
    }
  },

  // Epcot scene configuration (flattened tetrahedron grid, real-3D shading)
  epcot: {
    // Base triangle side length in pixels
    size: {
      default: 100,  // Default triangle side length (?size= URL param)
      // Perf floor, measured in headless Chrome @ 1920x1080 (post
      // seam-stroke removal, tools/benchmark-style rAF sampling): frame
      // time holds at the 60Hz vsync cap with low drop counts from
      // size=70 upward, but falls off a cliff at size=65 (~18.5ms avg,
      // p99 ~25ms) and further at size=60 (~22-25ms avg, ~25fps).
      // 70 is the smallest size confirmed clear of that cliff.
      min: 70,
      max: 300        // Maximum allowed (sparser grid)
    },

    // Tetrahedral spike height as a ratio of triangle side length
    spikeHeightRatio: 0.35,   // spikeHeight = size * spikeHeightRatio

    // Per-triangle random variation applied to spike height (+/- fraction)
    spikeVariation: 0.15,     // +/-15%, seeded via options.random

    // Distance (px) each facet's Path2D is expanded outward from its own 2D
    // centroid so adjacent facets slightly overlap instead of abutting -
    // hides hairline anti-aliasing seams without a per-facet stroke() pass.
    seamInflatePx: 0.6,

    // Coordinate quantization step (px) used to match coincident lattice
    // vertices across adjacent triangles when deduplicating (see
    // geometry.buildLatticeVertices). Construction produces bit-identical
    // floats for shared vertices, so this only needs to absorb ordinary
    // floating-point rounding - not real geometric slop.
    vertexEpsilon: 0.01,

    // Full light pattern cycle duration in seconds (slow, so the sweep reads clearly)
    cycleDuration: 24,

    // Loop period in seconds (?loop= / panel slider; 0 = off). When set,
    // EVERY time-varying subsystem - patterns, combo color animations,
    // the cycle scheme's hue rotation, auto-mode segments, twinkle
    // schedules, meteor spawns - quantizes its own period to the nearest
    // divisor of this master period and the clock wraps exactly, so the
    // whole scene loops perfectly for seamless recordings. Note: the
    // period is in pattern-clock seconds; real recording length is
    // loopPeriod / speed.
    loopPeriod: 24,

    // Default speed multiplier and frame-rate cap (?speed= / ?fps=)
    speedDefault: 0.5,
    maxFps: 30,

    // Point lights sit at every unique lattice vertex (panel corners), like
    // the LEDs on the real Spaceship Earth ball - see EpcotSurface. There
    // is deliberately no such thing as a "corner light": the 4 screen
    // corners are only an abstract timing/spatial reference the pattern
    // functions sweep between (see cornerWeightFalloffRatio below) - every
    // photon in this scene originates from a lattice vertex.
    lighting: {
      // Vertex light height above the surface plane, as a ratio of the
      // (nominal, pre-variation) spike height - tuned visually so each
      // light reads as a local glint on the spikes around it.
      vertexHeightRatio: 0.5,
      // Attenuation falloff, as a ratio of triangle `size` - deliberately
      // SHORT (order of a triangle) so each vertex light only influences
      // its own neighborhood, but wide enough that the lit panels read as
      // reflective metal, not isolated pinpricks.
      falloffSizeRatio: 1.4,
      // Radius (as a fraction of the canvas diagonal) within which a
      // vertex's blended intensity/color meaningfully picks up a given
      // corner's current pattern value - see computeCornerWeights(). Kept
      // small and deliberately non-linear (Gaussian, not bilinear) so only
      // vertices genuinely near the sweep's current position light up;
      // anything larger reads as a single soft gradient wash across the
      // whole surface (like a distant light shining in), not a cluster of
      // independent local glints.
      cornerWeightFalloffRatio: 0.09,
      shininess: 34,          // Blinn-Phong specular exponent (high = tight metallic glints)
      ambient: 0.10,          // Ambient floor (keeps unlit facets a dark base color, never black)
      // Metallic response: metals are specular-dominant. Diffuse is
      // deliberately suppressed and specular boosted so facets read as
      // polished panels catching the bulbs, not matte surfaces washed by
      // them; specular highlights are tinted by the base color in
      // shadeFacet() (metals color their reflections).
      diffuseWeight: 0.65,
      specularWeight: 2,
      // Peak per-light intensity multiplier; the ?brightness= URL param
      // further multiplies this at runtime (default 1.0). Tuned for the
      // gathered-light model (each facet sums many bulbs within reach).
      intensity: 0.75,
      hueOffsets: [-20, 0, 20, 40] // Per-corner hue offset in degrees (TL, TR, BR, BL)
    },

    // One-bounce indirect light: each frame, a fraction of every panel's
    // direct light spills onto its edge-adjacent panels, so a brightly lit
    // panel visibly glows onto its neighbors (real light transport, not
    // just isolated glints).
    bounce: {
      enabled: true,
      strength: 0.25          // Fraction of neighboring panels' average direct light received
    },

    // Panel gap lines simulating the seams between panels on the real ball.
    // Rendered once per rebuild (static geometry+color), composited over
    // the facet fills once per frame - never a per-facet/per-frame stroke.
    gap: {
      enabled: true,
      width: 1.5,            // px, base-triangle perimeter edges (?gap= URL param)
      // Internal facet edges (vertex-to-apex seams) are thinner than the
      // base-triangle perimeter so the panel outlines still read as the
      // dominant structure, matching how the real ball's major panel seams
      // are more prominent than the subtle facet creases within a panel.
      internalWidthRatio: 0.6,
      lightnessRatio: 0.15   // Gap color lightness = baseHSL.l * this ratio (near-black, base-color tinted)
    },

    // Bulb rendering at each lattice vertex. Every bulb is identical in
    // configuration - brightness differences come only from the pattern's
    // current value at that vertex. Each bulb is drawn additively as a
    // white-hot core inside a colored glow halo, plus six side-firing
    // beams along the lattice edge directions (0/60/120/180/240/300 deg)
    // that carry the bulb's color - together forming the 6-point star
    // across the surrounding triangles, per the real ball's fixtures
    // ("each bulb also has side-firing beams that can also match the
    // color").
    bulbs: {
      enabled: true,
      glowRadiusRatio: 0.40,   // Glow halo radius as a ratio of triangle size
      coreRadiusRatio: 0.09,   // White-hot core radius as a ratio of triangle size
      beamLengthRatio: 0.6,    // Side-firing beam length as a ratio of triangle size
      beamWidthPx: 2.2,        // Beam stroke width at the bulb, tapering outward
      beamAlpha: 0.8,          // Beam opacity multiplier relative to bulb intensity
      intensityThreshold: 0.06, // Skip bulbs below this normalized intensity (0..1)
      // Visibility floor (?floor= URL param / panel slider): every bulb
      // keeps a small crisp LED point at at least this visibility even at
      // zero pattern drive - like a real LED at its lowest, the point
      // never goes transparent while the bloom/illumination collapse.
      // 0 disables the idle points entirely.
      floor: 0.2,
      // Star effect: shape of each bulb's side-firing beams. star6 follows
      // the lattice edge directions (the classic 6-point star); star4 is an
      // upright 4-point twinkle; burst is 12 short arms; rays is 6 long
      // thin arms; none disables beams entirely.
      style: 'star6',
      styleOptions: ['star6', 'star4', 'burst', 'rays', 'none'],
      // Forward (camera-facing) core light color: 'match' uses the bulb's
      // scheme color; 'white' makes every core burn white regardless of
      // the radial beam color - the layered "shooting star" look.
      coreStyle: 'match',
      coreStyleOptions: ['match', 'white'],
      // Star overlay: per-bulb effects driving ONLY the white forward
      // cores, layered over the base animation (which keeps driving the
      // facet lighting and colored beams). Bulbs are individually
      // addressable here: twinkle = single bulbs flare briefly at
      // staggered deterministic times; meteor = a streak of bulbs lights
      // in sequence along a line with a decaying tail; night = both.
      overlay: 'night',
      overlayOptions: ['none', 'twinkle', 'meteor', 'night'],
      // Twinkle: mean seconds between one bulb's flares (each bulb gets a
      // deterministic +/-35% period jitter) and flare sharpness (higher =
      // shorter, snappier flares).
      twinklePeriod: 9,
      twinkleSharpness: 140,
      // Meteor: seconds between spawns per track (tracks run staggered),
      // head speed in triangle-sizes/second, tail length in
      // triangle-sizes, number of concurrent tracks, and travel direction
      // - 'random' picks a lattice axis per meteor; a fixed direction
      // locks every streak to that axis. Each streak's lifetime is
      // derived (not configured): it always travels the full ray across
      // the canvas from its spawn edge to its exit edge, tail included.
      meteorInterval: 2,
      meteorSpeed: 29,
      meteorTail: 10,
      meteorTracks: 2,
      meteorDirection: 'random',
      meteorDirectionOptions: ['random', 'right', 'down-right', 'down-left', 'left', 'up-left', 'up-right'],
      // Overlay stars lighting the surface - both PURELY ADDITIVE in the
      // existing colors (never blending toward white, which overwrote the
      // facets' scheme colors and grayed/overblew them):
      // - overlaySurfaceLight: extra intensity through the bulb's normal
      //   scheme-colored light path (specular/bounce/shadows apply). Kept
      //   LOW - the mirror-angle geometry otherwise paints a ring of
      //   facets ~1.5 triangles out.
      // - overlayLocalLift: multiplicative brightness gain on the facets
      //   of the triangles touching the star (each facet brightens in its
      //   OWN color), shaped by facet orientation.
      // Subtle by default, fully controllable (?oslight= / ?olift= and
      // panel sliders); 0 disables for pure forward-light stars.
      overlaySurfaceLight: 0.05,
      overlayLocalLift: 1
    },

    // Cast shadows: spikes between a bulb and a panel occlude its
    // low-grazing light. Occlusion is precomputed per (panel, bulb) pair
    // at rebuild (geometry is static); each intervening spike multiplies
    // the light by `occluderFactor`, floored at `floor`.
    shadows: {
      enabled: true,
      occluderFactor: 0.5,
      floor: 0.18
    },

    // Light cycling pattern - every bulb runs the same formula; its
    // intensity depends only on its position and the current time.
    pattern: {
      default: 'orbit',       // ?pattern= URL param
      // Intensity patterns (chase..radial) move light around; color
      // patterns (split/sweep/bands/mix) keep every bulb lit and animate
      // WHICH color each bulb shows - the scheme's colors trade territory
      // (e.g. illuminations: purple on top, orange below, the boundary
      // sweeping so the proportions cycle). 'auto' cycles through all of
      // them with smooth crossfades.
      // 'steady' is fully lit and motionless - with a gradient scheme
      // (e.g. illuminations) it renders the flat static gradient.
      // 'swoosh' is a logo-style wave: an undulating S-curve boundary
      // travels horizontally while the colors gradient across it.
      options: ['steady', 'chase', 'orbit', 'pulse', 'diagonal', 'wave', 'cascade', 'scanner', 'spiral', 'radial', 'split', 'sweep', 'bands', 'mix', 'swoosh', 'auto'],
      // Auto mode: seconds each pattern plays before crossfading to the
      // next, and the crossfade length in seconds.
      autoSegmentDuration: 20,
      autoFadeDuration: 3
    },

    // Color scheme: how bulb colors are distributed across the surface.
    // Wheel schemes derive hues from the base color: classic = gentle hue
    // drift toward each screen corner; mono = single hue; duo =
    // complementary split; rainbow = full hue wheel by angle; cycle =
    // classic distribution rotating over time. Palette schemes assign
    // discrete color combinations (below) in patchwork blocks, like the
    // real ball's panel-region lighting programs.
    scheme: {
      default: 'illuminations', // ?scheme= URL param
      options: ['classic', 'mono', 'duo', 'rainbow', 'cycle', 'illuminations', 'earidescent', 'celebration', 'holiday', 'halloween', 'patriot', 'festival']
    },

    // Discrete palettes modeled on real Spaceship Earth lighting programs.
    // earidescent = 50th-anniversary EARidescent (lavender/purple/gold/
    // iridescent blue); celebration = classic gold/royal blue/white;
    // holiday = red/green/warm white; halloween = orange/purple/green;
    // patriot = red/white/blue; festival = Festival of the Arts
    // multicolor patches.
    palettes: {
      // The iconic Spaceship Earth night look, color-sampled from a
      // reference photo of the real ball (allears.net, Beacon of Magic):
      // violet crown -> purple -> magenta -> crimson -> red -> red-orange
      // -> orange -> amber base glow. Ordered top -> bottom; rendered as
      // a STATIC vertical gradient (see gradientSchemes below), idealized
      // slightly from the camera-washed samples.
      illuminations: ['#7a14e8', '#a312c9', '#c90f8a', '#d8123c', '#ef5a24', '#ff8c1e', '#ffb85c'],
      earidescent: ['#b57edc', '#7b52ab', '#ffd77a', '#5ad0f0'],
      celebration: ['#ffc84a', '#2b5fd9', '#f0f4ff'],
      holiday: ['#e8443a', '#2ea84f', '#fff4e0'],
      halloween: ['#ff8c1a', '#8a2be2', '#39d353'],
      patriot: ['#ff4444', '#f5f7ff', '#3d6dff'],
      festival: ['#ff5252', '#ff9f40', '#ffe14d', '#4dd97b', '#3fa9f5', '#b06ef2']
    },

    // Patchwork block size for palette schemes, as a ratio of triangle
    // size - each block of lattice vertices shares one palette color.
    paletteCellRatio: 2.6,

    // Palette schemes listed here render as a STATIC top-to-bottom
    // gradient through all their colors (like the real ball's fixed
    // night look) instead of animated patchwork blocks.
    gradientSchemes: ['illuminations'],

    // Fisheye: barrel-warp the lattice around screen center (magnified
    // middle, compressed edges) so the flat pattern reads as the round
    // ball. Applied to the geometry at rebuild - zero per-frame cost.
    fisheye: {
      enabled: false,        // ?fisheye=true / panel toggle
      strength: 1          // 0 = flat, 1 = full spherical projection
    },

    // Globe: render the lattice ON an actual sphere (orthographic
    // projection, back hemisphere culled) - the full ball floating
    // against darkness, zoomable. Takes precedence over fisheye when
    // both are enabled. Like fisheye, a pure display projection: the
    // simulation stays flat; only drawing coordinates map to the sphere.
    globe: {
      enabled: false,        // ?globe=true / panel toggle
      zoom: 1.16,            // ?zoom= / panel slider / mouse wheel (0.4-3)
      latSpan: 2.6,          // Radians of latitude the canvas height covers on the sphere
      // Authentic scale: the real Spaceship Earth has 11,324 triangular
      // panels; lights sit at panel intersections (~F/2+2 = ~5,664 total,
      // ~2,830 on the visible hemisphere). Globe mode derives its
      // triangle size from this so the on-screen ball carries the real
      // number of panels/lights. Set to 0 to use the scene's normal
      // triangle size instead.
      panels: 11324
    },

    // Color pattern boundary handling: 'sharp' assigns each bulb to one
    // color group with a dithered edge; 'blend' interpolates smoothly
    // between the groups across a wide transition zone (?blend=true).
    colorBlend: true,

    // Light gathering: each facet collects light from every bulb within
    // this many triangle-sizes of its triangle's centroid (precomputed
    // spatial lists), so bright bulbs throw glints across facets several
    // rows away - not just their own triangle's corners.
    lightReachRatio: 2.2,

    // Default base color when no ?color= URL param is provided
    color: {
      defaultHex: '#c0c0c0',  // Silver - lets the illuminations palette carry the color
      // Saturation multiplier applied to every scheme's light colors
      // (?sat= URL param / panel slider). >1 deepens colors toward the
      // rich look the real ball's fixtures produce; 1.0 = palette as-is.
      saturationBoost: 2
    }
  },

  // Color layout for the stinger, sidebar and shade. AJ (2026-10-28): "the
  // same color layout as the illuminations epcot ball on the 3 other
  // animations". Colored bars are painted from a screen-fixed top-to-bottom
  // gradient through one of config.epcot.palettes (src/shared/palette.js),
  // like the ball's static night look. White bars stay white.
  palette: {
    default: 'illuminations', // ?scheme= URL param; 'mono' = the single-hue look from before
    // How a passed ?color= (Mix It Up's Couch Color sends color=$themecolor)
    // combines with the palette (?colormode= overrides):
    // 'shift'  - rotate every stop's hue so the anchor stop lands on the
    //            color's hue: same layout, recolored
    // 'ignore' - palette stays exact; color= has no effect
    // 'mono'   - any passed color brings back the single-hue look
    // Default 'ignore': AJ chose "Always Illuminations" (2026-10-28, PR #16),
    // so Couch Color no longer recolors these scenes. Design review found
    // shift turns warm colors such as #ff6600 lime green over epcot.
    colorMode: 'ignore',
    // Stop the passed color is matched to. Stop 1 (#a312c9, hue 288) is
    // within 4 degrees of AJ's theme color #b00bee, so the stream's own
    // color renders the ball's palette almost exactly.
    anchorIndex: 1,
    // Passed colors below this saturation (grays, white) have no real hue,
    // so they leave the palette unshifted
    minShiftSaturation: 15,
    // Per-role lightness offsets on the palette (percentage points, before
    // each scene's brightness multiplier). Curtains/panels sit darker so
    // accents read in front of them, as with the single-hue look (base - 25).
    curtainLightness: -20,
    // Shade: the semi-transparent curtain body (was base -> base - 20, so
    // -10 on average), and the solid band behind the text, darker still
    // so the white text reads
    bodyLightness: -10,
    tipLightness: -22
  },

  /**
   * Performance optimization configuration
   *
   * Alpha toggles: Preserve visual flexibility for Phase 4 enhancements while
   * enabling A/B testing of GPU memory impact.
   *
   * Thresholds: Conservative values based on streaming requirements (8+ hour sessions)
   * for production validation. Tests fail if exceeded to catch regressions.
   *
   * Feature flags: Allow controlled rollout of optimizations (dirty rectangles)
   * with easy rollback via config toggle.
   *
   * Overlay/monitoring: Dev tooling controlled via ?perf=true URL parameter for
   * real-time performance debugging during development.
   */
  performance: {
    // Alpha channel settings (per-scene control)
    alpha: {
      background: true,     // Keep alpha for Phase 4 visual flexibility
      stinger: true,
      sidebar: true
    },

    // Performance thresholds (conservative for 8+ hour streaming)
    thresholds: {
      maxMemoryMB: 300,        // Fail if memory exceeds 300MB steady-state
      minFPS: 55,              // Acceptable floor under stress (target: 60fps)
      targetFPS: 60,           // Target frame rate
      maxContinuousHours: 8,   // Test duration for long-running validation
      frameTimeBudgetMs: 16.67 // 60fps frame budget (1000ms / 60fps)
    },

    // Dirty rectangle optimization
    dirtyRectangles: {
      enabled: false,          // Toggle for A/B testing (disable by default until audit)
      safetyMargin: 5,         // Pixels to expand dirty regions (catch anti-aliasing)
      visualize: false         // Show dirty regions when ?perf=true (for debugging)
    },

    // Performance overlay settings
    overlay: {
      position: 'top-right',   // Position: 'top-right', 'top-left', 'bottom-right', 'bottom-left'
      opacity: 0.9,            // Overlay background opacity (0-1)
      updateIntervalMs: 100    // Refresh overlay metrics every 100ms (not every frame)
    },

    // Performance monitoring
    monitoring: {
      enabled: false,          // Enable via ?perf=true URL parameter (overrides this)
      sampleSize: 60,          // Rolling window size for FPS calculation (frames)
      sampleIntervalMs: 1000,  // Collect metrics every 1 second for session summaries
      logIntervalMs: 2000,     // Log stats to console every 2 seconds
      sessionHistoryLimit: 50  // Max localStorage sessions before FIFO eviction
    }
  },

  // Shared configuration across all scenes
  shared: {
    // Timing patterns (millisecond-based, consistent across scenes)
    // 1000ms - smooth transition matching easeInOutCubic feel
    durations: {
      defaultMs: 1000,      // Default transition duration
      entryMs: 1000,        // Entry/slide-in transitions
      exitMs: 1000,         // Exit/slide-out transitions
      holdMs: 2000          // Hold/pause durations
    },

    // Easing function (explicit config for documentation)
    // Hardcoded in AnimatedBar.easeInOutCubic(), config for validation only
    easingFunction: 'easeInOutCubic',  // Used by AnimatedBar.easeInOutCubic()

    // Shadow rendering
    shadow: {
      offset: 5,                  // Shadow offset in pixels (X and Y)
      baseOpacity: 0.2,           // Base shadow opacity (multiplied by bar opacity)
      color: 'rgba(0, 0, 0, 0.3)', // Shadow color
      padding: 10                 // Extra canvas padding for shadow rendering
    },

    // Cache settings (for offscreen canvases)
    cache: {
      maxSize: 50,                // Maximum cached offscreen canvases
      evictionIntervalMs: 30000,  // Clean stale caches every 30 seconds
      maxAgeMs: 60000             // Evict caches unused for 60 seconds
    }
  }
};
