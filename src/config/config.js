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
      default: 15,                // Default number of bars
      min: 1,                     // Minimum allowed
      max: 50                     // Maximum before performance degrades
    },

    // Animation timing (in frames at 60fps - will be converted to time-based)
    timing: {
      fadeInFrames: 120,          // 2 seconds fade in
      fadeOutFrames: 120,         // 2 seconds fade out
      visibleFramesMin: 1800,     // 30 seconds minimum visible time
      visibleFramesMax: 7200,     // 120 seconds maximum visible time
      directionTransitionFrames: 180, // 3 seconds for smooth direction changes
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
    // Duration and timing
    timing: {
      defaultDurationMs: 1000,    // Default transition duration
      fps: 60,                    // Frames per second for calculations
      // Phase proportions for slanted bars (curtain effect)
      easeInProportion: 0.35,     // 35% of duration for ease-in
      pauseProportion: 0.30,      // 30% of duration for pause
      easeOutProportion: 0.35,    // 35% of duration for ease-out
      pauseDurationMs: 300,       // Pause duration in milliseconds
      // Stagger delays
      slantedStaggerFrames: 20,   // Max stagger for slanted bars
      horizontalStaggerProportion: 0.2 // Stagger as proportion of duration (20%)
    },

    // Curtain bar configuration
    curtain: {
      lightnessReductionMin: 15,  // Minimum lightness reduction for white curtain bars
      lightnessReductionMax: 30   // Maximum lightness reduction for white curtain bars
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
      pauseDriftSpeed: 2          // Pixels per frame drift during pause phase
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
      // Stagger delays
      slantedStaggerFrames: 15,   // Max stagger for slanted bars
      horizontalStaggerProportion: 0.15 // Stagger as proportion of duration (15%)
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

  // Shared configuration across all scenes
  shared: {
    // Shadow rendering
    shadow: {
      offset: 5,                  // Shadow offset in pixels (X and Y)
      baseOpacity: 0.2,           // Base shadow opacity (multiplied by bar opacity)
      color: 'rgba(0, 0, 0, 0.3)', // Shadow color
      padding: 10                 // Extra canvas padding for shadow rendering
    },

    // Performance monitoring
    performance: {
      enableMonitoring: false,    // Enable via ?perf=true URL parameter
      sampleSize: 60,             // Frame samples for FPS calculation
      logIntervalMs: 2000         // Log stats every 2 seconds
    },

    // Canvas rendering
    canvas: {
      alpha: true                 // Enable alpha channel (for transparency)
    },

    // Cache settings (for offscreen canvases)
    cache: {
      maxSize: 50,                // Maximum cached offscreen canvases
      evictionIntervalMs: 30000,  // Clean stale caches every 30 seconds
      maxAgeMs: 60000             // Evict caches unused for 60 seconds
    }
  }
};
