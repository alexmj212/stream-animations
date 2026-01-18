# Phase 4: Visual Consistency & Polish - Research

**Researched:** 2026-01-18
**Domain:** Visual refinement and configuration schema design
**Confidence:** HIGH

## Summary

Phase 4 focuses on harmonizing visual aesthetics across three animation scenes (background, stinger, sidebar) that already exist with established patterns. Research examined current implementation patterns for timing, brightness/opacity, color palette, sidebar positioning, and configuration validation to inform planning.

**Key findings:**
- Timing is currently inconsistent: background uses frame-based durations (converted to seconds), stinger/sidebar use millisecond durations with proportions
- Brightness varies significantly: background already reduced by 20%, stinger has configurable reduction (15-30), sidebar at full 100% lightness
- All scenes use identical easing function (easeInOutCubic) but apply it differently across animation phases
- Color palette structure is consistent (HSL with hue/lightness variation) but brightness values differ per scene
- Sidebar positioning uses viewport percentages (80% start, 20% width) with pixel offsets for fine-tuning
- Configuration validation patterns from Phase 1 provide robust foundation for schema extension

**Primary recommendation:** Implement timing harmonization via shared config structure (config.shared.durations), apply per-scene brightness multipliers for visual consistency, extend existing validation patterns for new config schema properties.

## Standard Stack

No new libraries required - Phase 4 uses existing project stack established in Phases 1-3.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 4.0.16 | Testing framework | Established in Phase 2, supports property-based testing |
| @fast-check/vitest | 1.1.5 | Property-based testing | Used for animation invariant validation |
| vitest-canvas-mock | 0.3.5 | Canvas API mocking | Required for jsdom testing of canvas-based animations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | 4.0.16 | Code coverage | Validate test coverage of config changes |

### Alternatives Considered
None - Phase 4 is refinement work using existing tools, not introducing new capabilities.

**Installation:**
```bash
# All dependencies already installed from Phases 1-2
npm install
```

## Architecture Patterns

### Configuration Schema Extension Pattern

Phase 1 established centralized configuration in `src/config/config.js` with validation in `src/config/validation.js`.

**Current structure:**
```javascript
export const config = {
  background: { /* scene-specific */ },
  stinger: { /* scene-specific */ },
  sidebar: { /* scene-specific */ },
  shared: { /* cross-scene */ },
  performance: { /* Phase 3 addition */ }
};
```

**Extension pattern for Phase 4:**
```javascript
// src/config/config.js
export const config = {
  background: {
    timing: { /* existing frame-based */ },
    brightness: 0.8  // NEW: multiplier for scene brightness
  },
  stinger: {
    timing: { /* existing ms-based */ },
    brightness: 0.8  // NEW: match background
  },
  sidebar: {
    timing: { /* existing ms-based */ },
    positioning: { /* enhanced schema */ },
    brightness: 0.8  // NEW: match other scenes
  },
  shared: {
    easingFunction: 'easeInOutCubic',  // NEW: explicit easing config
    durations: {                        // NEW: shared timing values
      defaultMs: 1000,
      entryMs: 1000,
      exitMs: 1000
    }
  }
};
```

### Timing Harmonization Pattern

**Current timing implementations (INCONSISTENT):**

1. **Background scene** (BackgroundBar.js:80-86):
   - Frame-based durations converted to seconds
   - Uses `AnimatedBar.framesToSeconds(frames)` helper
   - Durations: fadeIn (120 frames = 2s), fadeOut (120 frames = 2s), visible (1800-7200 frames = 30-120s)

2. **Stinger scene** (StingerBar.js:54-56):
   - Millisecond durations with phase proportions
   - Direct ms-to-seconds conversion: `(duration * 0.4) / 1000`
   - Durations: in (40% of total), pause (300ms fixed), out (40% of total)

3. **Sidebar scene** (SidebarBar.js:44-51):
   - Millisecond durations with phase proportions from config
   - Config-driven proportions: slideIn (25%), hold (50%), slideOut (25%)
   - Durations calculated as: `(duration * proportion) / 1000`

**Harmonized approach:**
- All scenes use millisecond-based durations (drop frame-based)
- Shared config values: `config.shared.durations.{entry,hold,exit}Ms`
- Per-scene overrides allowed: `config.background.durations.entryMs` overrides shared
- Consistent conversion: `durationMs / 1000` to get seconds for deltaTime multiplication

### Brightness Control Pattern

**Current implementations (INCONSISTENT):**

1. **Background** (BackgroundBar.js:33,43):
   ```javascript
   // White bars
   this.lightness = 80;  // Hardcoded 20% reduction

   // Colored bars
   const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
   this.lightness = Math.max(10, baseLightness * 0.8);  // 20% reduction via multiplier
   ```

2. **Stinger** (StingerBar.js:34-36):
   ```javascript
   // White bars
   const lightnessReduction = config.stinger.curtain.lightnessReductionMin +
       this.random() * (config.stinger.curtain.lightnessReductionMax - config.stinger.curtain.lightnessReductionMin);
   this.lightness = 100 - lightnessReduction;  // Configurable 15-30 reduction
   ```

3. **Sidebar** (SidebarBar.js:26):
   ```javascript
   // White bars
   this.lightness = 100;  // NO REDUCTION
   ```

**Recommended pattern:**
```javascript
// Per-scene brightness multiplier approach
const baseLightness = isWhite ? 100 : calculateColoredLightness();
this.lightness = baseLightness * config.sceneName.brightness;

// Example: stinger with 0.8 multiplier
this.lightness = 100 * 0.8;  // = 80 (matches background)
```

### Color Palette Consistency Pattern

**Current color implementation (CONSISTENT STRUCTURE):**

All three scenes use identical HSL color generation pattern:
- White bars: `hue=0, saturation=0, lightness=varies`
- Colored bars: `hue=baseHSL.h ± variation, saturation=baseHSL.s, lightness=baseHSL.l ± variation`
- Variation ranges: hue ±20 (`hueVariation: 40`), lightness ±15 (`lightnessVariation: 30`)

**No structural changes needed** - only brightness multipliers differ (see above).

**Validation pattern:**
```javascript
// Color palette audit tool (automated HTML report)
function auditColorPalette() {
  const scenes = ['background', 'stinger', 'sidebar'];
  const report = scenes.map(scene => {
    const whiteBarLightness = /* calculate from config */;
    const coloredBarLightnessRange = /* calculate from baseHSL + variation */;
    return { scene, whiteBarLightness, coloredBarLightnessRange };
  });

  // Generate HTML showing side-by-side color swatches
  generateColorReport(report);
}
```

### Sidebar Positioning Schema Pattern

**Current implementation** (SidebarBar.js:54-56, 69-72, 79, 91):
```javascript
// Config values (config.js:178-182)
position: {
  sidebarStart: 0.8,          // 80% of viewport width
  sidebarWidth: 0.2,          // 20% of viewport width
  horizontalTargetOffset: -100 // Pixel offset for horizontal bars
}

// Usage in code
this.holdX = this.canvas.width * config.sidebar.position.sidebarStart;
const sidebarWidth = this.canvas.width * config.sidebar.position.sidebarWidth;
this.holdX = sidebarStart + (this.random() * sidebarWidth);
```

**Approach is already maintainable** - viewport percentages with pixel offsets provide flexibility.

**Enhancement for Phase 4:**
- Add validation for percentage ranges (0-1)
- Add validation that `sidebarStart + sidebarWidth <= 1.0` (doesn't exceed viewport)
- Add explicit anchor point documentation (current: left edge for horizontal, random within area for slanted)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Easing functions library | Custom easing collection | Inline easeInOutCubic | Only one easing function used; no need for library overhead |
| Config schema validation | JSON Schema validator | Extend existing validation.js | Phase 1 validation patterns proven; graceful degradation built-in |
| Color palette analyzer | Custom visualization tool | Simple HTML + HSL display | One-time audit, not production code; HTML/CSS sufficient |
| Timing synchronization library | Complex animation timeline | Millisecond durations + deltaTime | Existing delta-time system (Phase 1) handles timing correctly |

**Key insight:** Phase 4 is refinement using established patterns from Phases 1-3. No new abstractions needed - extend what exists.

## Common Pitfalls

### Pitfall 1: Breaking Backward Compatibility Unnecessarily
**What goes wrong:** Changing config structure breaks existing scenes without clear benefit
**Why it happens:** Refactoring impulse when seeing inconsistencies
**How to avoid:**
- Mark config changes as "breaking" explicitly in CONTEXT.md decisions
- User decided "breaking config change acceptable" - single pass refactor allowed
- Update all three scenes simultaneously in single commit
- No versioning needed (user decision: structure evolves without version field)
**Warning signs:**
- Scene doesn't load after config change
- Console warnings about missing config values (validation.js logs these)

### Pitfall 2: Timing Regression from Frame-to-Time Conversion
**What goes wrong:** Animations speed changes when converting background from frame-based to time-based
**Why it happens:** Frame-based assumes 60fps; if deltaTime calculation off, animations drift
**How to avoid:**
- Verify conversion: `frames / 60 === milliseconds / 1000`
- Test with existing Phase 2 frame rate consistency tests (02-07-PLAN.md)
- Use scaled-down timing in tests (10x faster per CONTEXT.md decision)
- Tolerance checks: ±50ms variance allowed (CONTEXT.md decision)
**Warning signs:**
- Bars fade in/out noticeably faster or slower
- Background bars move at different speeds than before
- Frame rate tests from Phase 2 fail

### Pitfall 3: Brightness Changes Too Subtle or Too Harsh
**What goes wrong:** 20% brightness reduction either imperceptible or makes bars too dark
**Why it happens:** Subjective perception; no objective measurement criteria
**How to avoid:**
- Implement config-driven multipliers (easy to tweak: 0.7, 0.8, 0.9)
- Generate color palette HTML report for visual comparison
- Test in actual OBS output (CONTEXT.md requirement: automated tests AND visual review)
- Allowance for "intentional color variation per scene" (CONTEXT.md)
**Warning signs:**
- Colors look identical before/after (too subtle)
- White bars appear gray/dim (too harsh)
- Colored bars lose saturation/vibrancy

### Pitfall 4: Config Validation Doesn't Catch Edge Cases
**What goes wrong:** Invalid config values pass validation, cause runtime errors
**Why it happens:** Validation only checks types and ranges, not logical constraints
**How to avoid:**
- Test validation with boundary values: 0, 1, negative, > 1 for percentages
- Test logical constraints: `sidebarStart + sidebarWidth <= 1.0`
- Test incompatibilities: brightness=0.5 but alpha disabled (no visual effect)
- Follow Phase 1 pattern: log warnings, return defaults, never throw
**Warning signs:**
- Console shows validation warnings in production
- Bars positioned off-screen unexpectedly
- Brightness adjustments have no visible effect

### Pitfall 5: Easing Function Mismatch Across Scenes
**What goes wrong:** Some animations use linear, others cubic, creating inconsistent feel
**Why it happens:** Easing function hardcoded in AnimatedBar.easeInOutCubic() method
**How to avoid:**
- CONTEXT.md decision: "All three scenes use identical easing function (easeInOutCubic)"
- Verify: grep for linear interpolation patterns in update() methods
- Config validates: `easingFunction` exists in easing exports (if future-proofing)
- Current: easeInOutCubic sufficient; no need for pluggable easing yet
**Warning signs:**
- Some transitions feel abrupt (linear) vs smooth (cubic)
- Background bars change direction instantly vs gradually

## Code Examples

Verified patterns from current codebase:

### Timing Pattern: Millisecond Duration with Phase Proportions
```javascript
// Source: SidebarBar.js:44-51
const slideInMs = this.duration * config.sidebar.timing.slideInProportion;
const slideOutMs = this.duration * config.sidebar.timing.slideOutProportion;
const holdMs = this.duration - slideInMs - slideOutMs;

this.slideInDuration = slideInMs / 1000;  // Convert to seconds for deltaTime
this.holdDuration = holdMs / 1000;
this.slideOutDuration = slideOutMs / 1000;

// Usage in update(deltaTime)
const phaseTime = animTime - this.phaseStartTime;
const progress = Math.min(phaseTime / this.slideInDuration, 1);
const easedProgress = this.easeInOutCubic(progress);
```

### Brightness Pattern: Multiplier Application
```javascript
// Source: BackgroundBar.js:33,43
// Current hardcoded approach
if (this.isWhite) {
  this.lightness = 80; // Hardcoded 20% reduction
} else {
  const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
  this.lightness = Math.max(10, baseLightness * 0.8); // Multiplier approach
}

// Recommended config-driven approach for Phase 4
const brightness = config.sceneName.brightness; // 0.8 for 20% reduction
if (this.isWhite) {
  this.lightness = 100 * brightness;
} else {
  const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
  this.lightness = Math.max(10, baseLightness * brightness);
}
```

### Config Validation Pattern: Range Checks with Graceful Degradation
```javascript
// Source: validation.js:65-83
export function validateNumber(value, defaultValue, label = 'value', min = 0, max = Infinity) {
  if (typeof value !== 'number' || !isFinite(value)) {
    console.warn(
      `Config validation: ${label} must be a finite number, got ${value}. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  if (value < min || value > max) {
    console.warn(
      `Config validation: ${label} must be between ${min} and ${max}, got ${value}. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return value;
}

// Usage for Phase 4 brightness validation
validateNumber(config.background.brightness, 0.8, 'background.brightness', 0, 1);
```

### Easing Application Pattern: Progress to Eased Progress
```javascript
// Source: AnimatedBar.js:54-58
easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Source: BackgroundBar.js:221-222 (fade in)
const progress = Math.min(phaseTime / this.fadeInDuration, 1);
this.currentOpacity = this.maxOpacity * this.easeInOutCubic(progress);

// Source: SidebarBar.js:125-127 (slide in)
const progress = Math.min(phaseTime / this.slideInDuration, 1);
const easedProgress = this.easeInOutCubic(progress);
this.x = this.startX + (this.holdX - this.startX) * easedProgress;
```

### Positioning Validation Pattern: Logical Constraint Checks
```javascript
// Recommended for Phase 4 sidebar schema validation
export function validateSidebarPositioning(config) {
  const pos = config.sidebar.position;

  // Validate individual percentages
  const sidebarStart = validateNumber(pos.sidebarStart, 0.8, 'sidebar.position.sidebarStart', 0, 1);
  const sidebarWidth = validateNumber(pos.sidebarWidth, 0.2, 'sidebar.position.sidebarWidth', 0, 1);

  // Validate logical constraint: sidebar must fit within viewport
  if (sidebarStart + sidebarWidth > 1.0) {
    console.warn(
      `Config validation: sidebar.position.sidebarStart (${sidebarStart}) + sidebarWidth (${sidebarWidth}) exceeds viewport (1.0). Sidebar may extend off-screen.`
    );
  }

  return { sidebarStart, sidebarWidth };
}
```

### Test Pattern: Property-Based Validation with Tolerance
```javascript
// Source: tests/shared/AnimatedBar.test.js:87-100
test.prop([
  fc.float({ min: 0, max: 1, noNaN: true })
], { seed: 48, numRuns: 100 })(
  'easeInOutCubic returns value in 0-1 range for input 0-1',
  (t) => {
    const bar = new AnimatedBar(ctx, canvas, 'slanted');
    const result = bar.easeInOutCubic(t);

    // Invariant: output must be in 0-1 range for valid input
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  }
);

// Recommended for Phase 4 timing consistency tests
test.prop([
  fc.integer({ min: 500, max: 3000 }) // duration in ms
], { seed: 54, numRuns: 50 })(
  'phase durations sum to total duration within tolerance',
  (durationMs) => {
    const entryProportion = 0.25;
    const holdProportion = 0.5;
    const exitProportion = 0.25;

    const entryMs = durationMs * entryProportion;
    const holdMs = durationMs * holdProportion;
    const exitMs = durationMs * exitProportion;
    const sumMs = entryMs + holdMs + exitMs;

    // Tolerance: ±50ms per CONTEXT.md decision
    expect(Math.abs(sumMs - durationMs)).toBeLessThanOrEqual(50);
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Frame-based timing | Time-based with deltaTime | Phase 1 (01-01) | Frame-rate independent animations |
| Magic number config | Centralized config.js | Phase 1 (01-02) | Single source of truth for values |
| No validation | Graceful validation | Phase 1 (01-02) | Warnings instead of crashes |
| Manual cache management | LRU cache with eviction | Phase 1 (01-03) | Prevents memory leaks |
| No testing | Vitest + property-based | Phase 2 (02-01) | Regression prevention |
| No performance monitoring | Overlay + storage | Phase 3 (03-01) | Real-time performance visibility |
| Full canvas clears | Dirty rectangle tracking | Phase 3 (03-05) | GPU operation reduction (if enabled) |

**Deprecated/outdated:**
- **Mixed frame rates** (30fps background / 60fps foreground): Unified to 60fps in Phase 1 (01-04)
- **Direct frame counting**: Replaced with time-based tracking (`elapsedTime`, `phaseStartTime`) in Phase 1
- **Math.random() for tests**: Replaced with seeded random via `@fast-check/vitest` in Phase 2

**Phase 4 builds on:** All patterns from Phases 1-3 remain current; no deprecation needed.

## Open Questions

Things that couldn't be fully resolved:

1. **Should all three scenes share identical durations?**
   - What we know: Stinger (1000ms), Sidebar (5000ms), Background (2-120s) serve different purposes
   - What's unclear: Whether "timing pattern alignment" means identical durations or consistent proportions/easing
   - Recommendation: Align proportions and easing, keep different absolute durations (CONTEXT.md: "duration ratios across all scenes")

2. **Is 20% brightness reduction sufficient for visual harmony?**
   - What we know: Background already at 0.8 multiplier, sidebar at 1.0, stinger configurable 15-30 reduction
   - What's unclear: Subjective perception in OBS output; may need adjustment after implementation
   - Recommendation: Implement config-driven multipliers (0.8 as starting point), validate with OBS preview per CONTEXT.md

3. **Should easing function be pluggable or remain hardcoded?**
   - What we know: All scenes use easeInOutCubic; CONTEXT.md mentions "config.shared.easingFunction"
   - What's unclear: Whether to implement function registry or just document the hardcoded choice
   - Recommendation: Add `easingFunction: 'easeInOutCubic'` to config for documentation, validate it matches hardcoded method name, defer pluggable easing to future work

4. **How to handle timing for animations using both phases and continuous motion?**
   - What we know: Background has continuous drift + direction transitions; sidebar has hold phase with velocity
   - What's unclear: Best config schema to represent "continuous + transitions" vs "discrete phases"
   - Recommendation: Use separate config sections: `durations` (for phase-based), `velocities` (for continuous), document distinction

## Sources

### Primary (HIGH confidence)
- Codebase inspection (2026-01-18):
  - `src/config/config.js` - Configuration structure and timing values
  - `src/config/validation.js` - Validation patterns and graceful degradation
  - `src/shared/AnimatedBar.js` - Easing function implementation
  - `src/background/BackgroundBar.js` - Frame-to-time conversion, brightness reduction
  - `src/stinger/StingerBar.js` - Phase-based timing, curtain effect patterns
  - `src/sidebar/SidebarBar.js` - Viewport percentage positioning, hold phase velocity
  - `tests/shared/AnimatedBar.test.js` - Property-based testing patterns
  - `src/config/validation.test.js` - Validation test coverage

### Secondary (MEDIUM confidence)
- Planning documentation:
  - `.planning/phases/04-visual-consistency--polish**/04-CONTEXT.md` - User decisions and constraints
  - `.planning/REQUIREMENTS.md` - Success criteria for Phase 4
  - `.planning/STATE.md` - Accumulated context from Phases 1-3
  - `.planning/codebase/TESTING.md` - Established testing patterns

### Tertiary (LOW confidence)
None - all findings verified through direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing Vitest setup from Phase 2, no new dependencies
- Architecture: HIGH - Config schema and validation patterns established in Phase 1, directly inspected
- Timing patterns: HIGH - All three scene implementations examined, conversion logic verified
- Brightness control: HIGH - Current values documented from source, multiplier approach consistent with existing patterns
- Color palette: HIGH - HSL generation logic identical across scenes, only brightness differs
- Sidebar positioning: HIGH - Config-driven viewport percentages already implemented
- Testing patterns: HIGH - Phase 2 established property-based testing with fast-check, validation.test.js provides model
- Pitfalls: MEDIUM - Based on anticipated issues from config refactoring and visual perception concerns

**Research date:** 2026-01-18
**Valid until:** 30 days (2026-02-17) - Visual refinement patterns stable; only risk is if Phase 3 gap closure reveals performance constraints requiring timing changes
