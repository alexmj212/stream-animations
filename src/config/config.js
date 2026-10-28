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
      easeInProportion: 0.45,     // 45% of duration: bars arrive
      pauseProportion: 0.10,      // 10% of duration: the hold. Bars settle slowly at the
                                  // end of the ease, so the still cover runs 230-300ms
                                  // at the on-stream 1200ms, inside CUT-2 (AJ, 2026-10-28, #36)
      easeOutProportion: 0.45,    // 45% of duration: bars leave
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

    // Text: two lines on an ink nameplate, right-aligned to title-safe
    // (x 1824) and centred at 78% height (AJ's pick on design audit #34,
    // 2026-10-28). The action ("CHECK OUT") is `label` 40px and the @name
    // `headline` 56px; text without a name is one `headline` line. Jost 700
    // with the ink stroke and shadow of config.design.type
    text: {
      // Its vertical centre sat at 2/3 of the height, right under the Mix It
      // Up images below (AJ's bug report, 2026-10-28)
      centerY: 0.78,              // Fraction of viewport height; clears every miuZones item
      // Long text (design review, 2026-10-28): the name shrinks to fit,
      // then (text without a name) wraps to two lines, with an ellipsis
      // only past that
      minScale: 0.75,             // Smallest headline scale: 42px, still over the 40px floor
      // Widest line: the plate stops at the screen's centre (x 960), so a
      // side alert never reaches the content's centre (DESIGN.md, Alerts)
      maxWidthPx: 864,
      lineHeight: 1.1,            // Line spacing, em of each line's size
      plate: {
        alpha: 0.86,              // design.color.ink at 86%: the text reads on it without the panel
        padXPx: 24,               // Ink past the text's left end, before the 15° slant
        padYPx: 16,               // Above the first line and below the last
        bleedPx: 64               // Runs off the right edge (only bars may bleed past title-safe)
      }
    },

    // Where Mix It Up draws images while the sidebar plays. The Mixitup
    // browser source sits above Sidescreen Alert in the OBS Alerts scene, so
    // these always cover the sidebar. Read from AJ's MIU commands on Defiant
    // (2026-10-28): MIU centres each item on xPct/yPct of 1920x1080; w/h are
    // overlay px, and "natural size" Twitch avatars are 300px. Update this
    // list when a command that fires Sidescreen Alert gains or moves an image.
    // tests/shared/layout.test.js and the motion harness fail on overlap.
    // Not listed: Lechonk Jump (Resub). It draws on its own Lechonk overlay
    // source, which only exists in the Vtuber scene, mirrored and scaled so
    // it lands bottom-left (checked in OBS's scene JSON, 2026-10-28).
    miuZones: {
      pad: 0.05,                  // Each side grows 5% of the size: AnimateCSS bounce-in overshoot
      items: [
        { label: 'Hug target', xPct: 67, yPct: 50, w: 300, h: 300 },
        { label: 'Hug heart', xPct: 79, yPct: 50, w: 350, h: 350 },
        { label: 'Hug hugger', xPct: 91, yPct: 50, w: 300, h: 300 },
        { label: 'Pet hugger', xPct: 72, yPct: 50, w: 300, h: 300 },
        { label: 'Pet hand', xPct: 83, yPct: 50, w: 250, h: 250 },
        { label: 'Pet target', xPct: 91, yPct: 50, w: 300, h: 300 },
        { label: 'Treat target', xPct: 72, yPct: 50, w: 300, h: 300 },
        { label: 'Treat treat', xPct: 82, yPct: 50, w: 350, h: 150 },
        { label: 'Treat hugger', xPct: 92, yPct: 50, w: 300, h: 300 },
        { label: 'Resub avatar', xPct: 85, yPct: 50, w: 400, h: 400 },
        { label: 'Shoutout avatar', xPct: 86, yPct: 42, w: 400, h: 400 }
      ]
    },

    // Timing (design audit #35, AJ's pick 2026-10-28). Enter, settle and
    // exit are config.design.motion (500 / 150 / 350ms); the hold is the
    // text's reading time. ?duration= (OBS sends 3000) is a minimum total:
    // a longer one lengthens the hold, a shorter one can't cut it
    timing: {
      defaultDurationMs: 5000,    // Minimum total without ?duration=
      readingSpeedMsPerWord: 200, // DESIGN.md TIME-1
      minHoldMs: 3000,            // Never under 3 seconds
      accentStaggerSteps: 4,      // Accents arrive on up to 4 stagger steps (0-180ms) inside the enter
      // OBS hides Sidescreen Alert 7000ms after it shows it (the Show
      // Sidescreen Alert move filter's end_delay, read on Defiant
      // 2026-10-28), so the alert must end first; past ~29 words the hold is
      // cut short instead. Raise both together
      maxTotalMs: 6800
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

    // Accents' leftward drift while the panel holds (was 0.3-0.8 px a
    // 60fps frame)
    hold: {
      velocityMinPxPerSec: 18,
      velocityMaxPxPerSec: 48
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

    // Text: Jost 700 in white with the ink stroke and shadow of
    // config.design.type (DESIGN.md TYPE-3). Sizes come from the type
    // scale: `hero` 96px, shrinking to fit title-safe down to `display`
    // 72px, then two lines at `display` (name / action). It never scrolls
    // (AJ's pick on design audit #33, 2026-10-28)
    text: {
      color: '#ffffff',
      lineHeight: 1.15            // Line spacing when the text wraps to two lines, in em
    },

    // Reading time (DESIGN.md TIME-1): the text is still for at least this
    // long. ?duration= is a minimum on top of it, so OBS's duration=3000
    // still works but can't cut a long name short
    timing: {
      readingSpeedMsPerWord: 200, // 200ms per word = 5 words/second (fast pace for stream events)
      minHoldMs: 3000,            // Never under 3 seconds
      // OBS hides Fullscreen Alert 10000ms after it shows it (the Start
      // Alert move filter's end_delay, read on Defiant 2026-10-28), so the
      // shade must end first; past ~41 words the hold is cut short instead.
      // Raise both together
      maxTotalMs: 9800
    },

    // The text arrives and leaves on config.design.motion (enter 500ms,
    // settle 150, exit 350). The curtains close over the first 500ms, as the
    // text arrives, and open over the last 500ms, after it has gone, so the
    // text is only ever on a closed band; it is also clipped to the curtains
    curtainMoveMs: 500,
    clipTextToCurtains: true,

    // Curtain configuration
    curtains: {
      opacity: 0.5,               // Semi-transparent overlay (middle of 0.4-0.6 range)
      barCount: 6                 // Horizontal bars per curtain (balances visual density with performance)
    }
  },

  // Followers scene: the always-on follower-goal bar, top left ("946 / 1000
  // GOOBERS"). Replaces the Mix It Up "Follow Goal" widget (an MIU counter
  // goal on counter `followercount`, read from Defiant 2026-10-28). The
  // notifications toast grows out of its right end, so top, height, right
  // edge and lean must equal config.notifications.geometry (a unit test
  // holds them together).
  followers: {
    geometry: {
      top: 26,                    // = notifications.geometry.top
      height: 48,                 // = notifications.geometry.height
      leftX: 36,                  // Left edge at mid-height (MIU bar: ~x 30-42)
      rightX: 560,                // = notifications.geometry.startX: the toast starts here.
                                  // Long enough for "1000 / 1000 GOOBERS" at 42px (AJ, 2026-10-28, #40)
      skewAngle: -15              // = notifications.geometry.skewAngle
    },

    // Brightness multiplier shared by every scene (docs/MOTION.md)
    brightness: 0.8,

    // ?goal= and ?label= defaults, as MIU had them (one segment, 1000)
    goal: 1000,
    label: 'GOOBERS',
    // ?goalstep=: once the goal is reached, roll on to the next multiple of
    // this. 0 keeps the goal and shows the count past it on a full bar
    goalStep: 0,

    // Where the count comes from (src/followers/source.js). MIU's
    // Developer API (Services > Developer API, port 8911) serves the same
    // counter its widget used; MIU sets it to $streamfollowercount at launch
    // and on every follow. Polling a local API keeps every secret out of
    // this public repo. ?count= seeds the bar (and is the whole source with
    // ?source=url, for when MIU sets the OBS URL instead).
    source: {
      api: 'http://localhost:8911/api/v2/counters/',
      counter: 'followercount',
      pollMs: 5000,               // A follow shows within 5 s; one tiny local GET each time
      maxBackoffMs: 60000,        // MIU closed: back off to one try a minute
      timeoutMs: 2000,
      storageKey: 'followers:last' // Last count, so a reload paints at once
    },

    // ?style=: 'creative' (sweep and tip on a change, glint now and then)
    // or 'clean' (the fill and number just ease to the new count)
    style: 'creative',

    // The OBS-era colors (?scheme=mono): MIU widget gradient and border
    classic: {
      fill: ['#412e4d', '#b00bee', '#e6d3f5'],
      body: 'rgba(20, 6, 30, 0.55)',
      rim: '#ffffff'
    },

    // Body behind the fill: dark and see-through, like the toast body
    bodyAlpha: 0.55,
    bodyLightness: -38,           // Palette lightness offset for the body
    rim: { width: 2, alpha: 0.85 },   // MIU bar: 1 px white border
    tipWidth: 10,                 // White tip on the fill's front, like the toast's
    // ?filllayout=: how the Illuminations palette lies on the fill. 'ramp'
    // runs the whole palette over the goal (violet at zero, amber at the
    // goal), so the color itself says how close it is; 'screen' is the
    // other scenes' top-to-bottom gradient, nearly all violet up here.
    // 'screen' by default (2026-10-28 mocks, design/followers/): it matches
    // the other scenes and hands over cleanly to the toast, which starts
    // violet; 'ramp' ends amber right where the toast starts dark violet
    fillLayout: 'screen',

    timing: {
      sweepMs: 900,               // Light band along the bar on a change
      fillDelayMs: 250,           // The fill and number start behind the band...
      fillMs: 900,                // ...and land as it leaves
      glintEveryMs: 90000,        // Idle glint (creative); 0 = off. Rare, so idle stays free
      glintMs: 700
    },
    sweep: { bandPx: 70, alpha: 0.8 },
    glint: { bandPx: 40, alpha: 0.35 },

    text: {
      font: '"Jost", Arial, sans-serif',
      style: 'italic',            // Same face as the toast text
      weight: 700,
      sizePx: 42,                 // AJ's pick on #40 (2026-10-28): bigger text, same place
      strokePx: 4,
      padding: 18                 // Room kept clear at each end
    }
  },

  // Notifications scene: a toast bar that grows out of the right end of the
  // follower-goal bar (the MIU "Follow Goal" overlay, top left) with a line
  // of text. Rebuilt from AJ's OBS "Notifications" scene (color sources,
  // Move filters and a mask plugin that broke in OBS 33), read from
  // Archive_1.json on Defiant, 2026-10-28.
  // Positions are px on the 1920x1080 canvas OBS and MIU are built for and
  // scale with the page width.
  notifications: {
    geometry: {
      top: 26,                    // Follower bar's top edge (measured on the OBS program)
      height: 48,                 // Follower bar's height, so the toast reads as its extension
      startX: 560,                // Follower bar's right edge at mid-height: the toast grows from here
      endX: 1590,                 // Toast's front at mid-height when out (OBS: 1587-1591)
      skewAngle: -15,             // Same lean as the follower bar and the house horizontal bars
      bodyShort: 53,              // The dark body stops this far short of the front (OBS: 1532 vs 1587)
      tipWidth: 37,               // White tip riding the front (OBS "Block 1": 37px)
      // Long text grows the bar past endX, up to here, rather than losing
      // words (design review, 2026-10-28: a thank-you keeps the giver's name).
      // Title-safe's right edge (DESIGN.md SAFE-1), so the text stays inside
      // it and the leaning top corner inside action-safe (1853); 1890 ran
      // past both on the live check of v2.2.1
      maxEndX: 1824
    },

    // Brightness multiplier shared by every scene (docs/MOTION.md)
    brightness: 0.8,

    // ?colorlayout=: how the Illuminations palette (config.palette) lies on
    // the bar. AJ (2026-10-28): "give it that color makeover we gave the
    // other scene animations". 'along' runs the palette down the bar's
    // length, violet at the follower bar to amber at the front; 'screen' is
    // the other scenes' top-to-bottom gradient, which at the top of the
    // screen is nearly all violet; 'classic' is the OBS look below.
    // ?scheme=mono also gives 'classic'.
    colorLayout: 'along',

    // The OBS colors ('classic'). The gradient runs along the bar, dark at
    // the follower bar and bright at the front; the body sits over it at
    // 72% (OBS Color Correction) in every layout, so the gradient glows
    // through it
    colors: {
      gradientFrom: '#360c5a',
      gradientTo: '#b00bee',
      body: '#540573',
      bodyOpacity: 0.72,
      tip: '#ffffff'
    },

    timing: {
      defaultDurationMs: 5000,    // OBS: 1 s out, ~2.6 s hold, 1 s back
      inProportion: 0.2,          // Extend: 1000 ms at the default
      outProportion: 0.2,         // Retract: 1000 ms at the default
      // The body trails the gradient by this share of each phase (OBS: 200
      // ms of 1000), and retracts first, so the gradient chases it home
      lagProportion: 0.2,
      textFadeMs: 250,            // Text fades in once the body is out, and out before it retracts
      textSlidePx: 24,            // ...sliding in from the left by this much
      // Reading pace (docs/MOTION.md): 200 ms a word, never under 3 s. A
      // long line stretches the default duration to give it that hold
      msPerWord: 200,
      minHoldMs: 3000
    },

    // ?style=: 'creative' adds the flair below; 'clean' is the bar alone
    // with a fading text. AJ (2026-10-28): "get creative"
    style: 'creative',
    flair: {
      // Thin seeded streaks that race out ahead of the bar, settle around
      // its front and drift, then slide home into the follower bar. Same
      // parts as every scene: white and colored horizontal bars, -15 deg
      streaks: {
        count: 4,                 // The first is white, the rest palette-lit
        heightMin: 3,             // px
        heightMax: 8,
        lengthMin: 140,           // px
        lengthMax: 380,
        restMin: -240,            // Front at rest, px from the bar's front: some inside,
        restMax: 70,              // some poking past the white tip
        spread: 9,                // px above and below the bar the streaks may sit
        arriveMin: 0.7,           // Arrive at this share of the gradient's extend time...
        arriveMax: 0.95,          // ...so they lead it out
        exitStagger: 0.3,         // Leave up to this share into the retract
        driftMin: 4,              // px/s rightward while holding
        driftMax: 12,
        alpha: 0.85,
        // Streaks stay clear of the text while it shows (design review, PR
        // #27): their tails end this far right of its ink, and at least
        // minVisible px of each streak stays on show
        textGap: 16,              // px
        minVisible: 60            // px
      },
      // Lit rims along the top and bottom edges, like the follower bar's
      // white outline
      rim: { width: 2, alpha: 0.55 },
      // A light band sweeps along the body once it is out and writes the
      // text in behind it
      wipe: { ms: 450, bandPx: 80, alpha: 0.95 }
    },

    text: {
      font: '"Jost", Arial, sans-serif',
      style: 'italic',            // OBS: Jost Bold Italic, like the follower bar
      weight: 700,
      sizePx: 42,                 // Matches the follower bar (AJ, 2026-10-28, #40)
      strokePx: 4,                // Black outline (OBS Stroke filter)
      padding: 24,                // Room kept clear at each end of the body
      // Long text: shrink down to minScale, then grow the bar (geometry.
      // maxEndX), then, only if it still doesn't fit, scroll it during the
      // hold: show the start, glide to the end, show the end (design review,
      // 2026-10-28: a static line reads best, scroll is the last resort)
      minScale: 0.55,             // 23px: the 21-word harness line still fits whole in Jost; 0.6 scrolls
      scrollPauseMs: 800          // Still at each end of a scroll
    }
  },

  // Title card for the WELCOME, BRB and ENDING scenes (design audit #39).
  // AJ (2026-10-28): "I like the title card changes but I don't like the
  // subtext above", so the card is the title alone on its plate. It stays up
  // for the whole scene: after the entrance it stops drawing
  title: {
    defaultText: 'WELCOME',       // ?text=; always set in caps (DESIGN.md TYPE-2)
    // The slanted ink plate, bottom-left. Its text sits inside title-safe
    // (x 96+) and clear of Twitch's player controls (y 994+, SAFE-3)
    plate: {
      x: 72,                      // Bottom-left corner; the slant carries the top edge right
      top: 850,
      height: 124,
      padX: 48,                   // Room each side of the line
      slantDeg: 15,               // The house slant (GEO-1)
      alpha: 0.82                 // Ink plate over the moving backdrop (TYPE-3: a plate needs no stroke)
    },
    text: {
      font: '"Jost", Arial, sans-serif',
      weight: 700,
      sizePx: 96,                 // design.type.sizes.hero
      minPx: 72,                  // design.type.sizes.display: a long title shrinks to here, then takes two lines
      floorPx: 56,                // ...which shrink again only down to design.type.sizes.headline
      lineHeight: 1.1,            // Two lines: baseline to baseline, in ems
      maxRight: 1824              // Title-safe's right edge: the line never runs past it
    },
    timing: {
      enterMs: 500,               // design.motion.durationMs.enter, on ease.enter
      textDelayMs: 150,           // design.motion.settleMs: the plate lands, then the words
      textMs: 350,
      textSlidePx: 24
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

  // Design tokens from the stream bible (docs/DESIGN.md, design system
  // role, 2026-10-28). Every value is on the 1920x1080 OBS canvas. Scenes
  // adopt them as their audit issues land; until then a scene's own block
  // above may still differ. src/shared/design.js and design.test.js read
  // these, so a token change that breaks a contrast pair fails CI.
  design: {
    canvas: { width: 1920, height: 1080, unitPx: 8 }, // Spacing comes in multiples of 8px

    // SMPTE ST 2046-1 safe areas, as an inset from each edge. Viewers on a
    // phone, a TV with overscan or Twitch's player chrome lose the edges
    safe: {
      actionInset: 0.035,         // 67px x 38px: nothing that matters past here
      titleInset: 0.05            // 96px x 54px: every word and number sits inside
    },

    grid: { columns: 12, marginPx: 96, gutterPx: 24 }, // Margin = title-safe x

    // Twitch's player draws its controls over the bottom of the video on
    // hover and tap; nothing a viewer must read lives there
    playerChromeTop: 0.92,

    type: {
      family: 'Jost',
      weight: 700,
      // A 1.33 (perfect fourth) scale. Phone column: px a viewer actually
      // sees with the video 390px wide in portrait (x 0.203)
      sizes: {
        hero: 96,                 // Full-screen alerts (shade): 19.5px on a phone
        display: 72,              // A name that is the point of the alert: 14.6px
        headline: 56,             // Side alerts (sidebar), titles on scene cards: 11.4px
        label: 40                 // Widgets (goal, notifications): 8.1px, the floor
      },
      minPx: 40,                  // Nothing a viewer must read is smaller: 27px at 720p
      trackingEm: 0.02,           // Uppercase Jost needs a little air at small sizes
      // Text over anything that moves gets a hard ink stroke and a soft
      // shadow falling down-right (the one light, top-left)
      strokeEm: 0.08,             // 4.5px at 56px; never under strokeMinPx
      strokeMinPx: 3,             // 2px once a 720p encode halves it: still survives 4:2:0
      shadowOffsetEm: 0.04,
      shadowBlurEm: 0.08,
      shadowAlpha: 0.6
    },

    color: {
      white: '#ffffff',
      ink: '#14061f',             // The dark text and stroke colour: Illuminations violet at 4% lightness
      brightness: 0.8,            // Same multiplier as every scene's palette (MOTION.md, Look)
      // Tested text pairs. bg 'stopN' = config.epcot.palettes.illuminations[N]
      // at `brightness`, shaded on HSL lightness like the scenes. min 4.5 = any size, 3 = display sizes (56px+) only.
      // A new pair goes here first; design.test.js holds them.
      textPairs: [
        { text: 'white', bg: 'stop0', min: 4.5 },
        { text: 'white', bg: 'stop1', min: 4.5 },
        { text: 'white', bg: 'stop2', min: 4.5 },
        { text: 'white', bg: 'stop3', min: 4.5 },
        { text: 'white', bg: 'stop4', min: 4.5 },
        { text: 'white', bg: 'stop5', min: 3 },    // Orange: display sizes, with the stroke
        { text: 'ink', bg: 'stop5', min: 4.5 },
        { text: 'ink', bg: 'stop6', min: 4.5 },    // Amber: white fails (2.1), ink only
        { text: 'white', bg: 'ink', min: 4.5 }
      ]
    },

    // The vertical canvas (Aitum Vertical, 1080x1920), cut into clips for
    // Shorts, Reels and TikTok and watched on a phone (AJ, 2026-10-28: "the
    // text size requirements and guidelines might need to be specifically
    // for that"). DESIGN.md, Vertical canvas
    vertical: {
      canvas: { width: 1080, height: 1920 },
      // The apps draw over the frame: status and tabs at the top, captions,
      // channel and sound at the bottom, the like/comment/share column on
      // the right. The strictest of the current guides (TikTok right 120,
      // bottom captions 320-370) plus a margin
      safe: { topPx: 220, bottomPx: 440, leftPx: 60, rightPx: 140 },
      type: {
        // A 1080-wide frame shows about 390pt wide on a phone (x 0.36),
        // so these read at 40, 29, 23 and 17pt
        sizes: { hero: 112, display: 80, headline: 64, label: 48 },
        minPx: 48
      },
      seamY: 700                  // Camera above, game below (Chatting/Game (vrt)); a toast sits on it
    },

    // Motion tokens. Enter decelerates, exit accelerates, a move across the
    // screen eases both ends. MOTION.md keeps each scene's decided timings
    motion: {
      ease: {
        enter: [0.33, 1, 0.68, 1],  // easeOutCubic: arrives fast, settles
        exit: [0.32, 0, 0.67, 0],   // easeInCubic: leaves accelerating
        move: [0.65, 0, 0.35, 1]    // easeInOutCubic: the scenes' existing curve
      },
      durationMs: {
        micro: 150,               // A colour or value swap in place
        exit: 350,                // Leaving is quicker than arriving
        enter: 500,               // An alert or widget arriving
        move: 700,                // A bar crossing the screen
        stagger: 60               // Between siblings arriving (5 bars = 240ms spread)
      },
      settleMs: 150,              // A beat of stillness after an arrival before text starts to read
      staticCoverMaxMs: 300       // Stinger: longest the screen sits fully covered and still
    },

    alerts: {
      gapMs: 500,                 // Space between two alerts in one zone
      maxConcurrent: 1            // One alert per zone; the next waits
    },

    // Photosensitivity (WCAG 2.3.1 / ITU-R BT.1702 / Ofcom)
    flash: {
      maxPerSecond: 3,            // Flashes (a >10% luminance swing and back) over 25% of the screen
      fullFieldMaxPerSecond: 1    // A full-screen swing (the stinger) at most once a second
    }
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
