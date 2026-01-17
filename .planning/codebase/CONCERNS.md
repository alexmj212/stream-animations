# Codebase Concerns

**Analysis Date:** 2026-01-17

## Tech Debt

**Sidebar animation incomplete:**
- Issue: SidebarBar.js exists but has no HTML entry point or build configuration
- Files: `src/sidebar/SidebarBar.js`, `src/sidebar/index.html` (exists but uncommitted), `vite.config.js` (has sidebar mode but not fully tested), `package.json` (has build:sidebar script)
- Impact: Sidebar animation cannot be deployed or used in production. Build scripts reference it but functionality is untested.
- Fix approach: Either complete the sidebar implementation (test HTML entry point, verify build) or remove sidebar-related code and build scripts to avoid confusion

**Offscreen canvas cache never cleared:**
- Issue: Static cache in AnimatedBar grows indefinitely as new bars with different properties are created
- Files: `src/shared/AnimatedBar.js` (lines 6, 108)
- Impact: Memory leak over long-running sessions. Each unique bar configuration creates a new cached canvas that never gets garbage collected. In background scene with continuous bar creation, this accumulates memory over time.
- Fix approach: Implement cache size limit with LRU eviction, or clear cache periodically. Add cache.clear() method and call it when bars are removed.

**Duplicate bar generation code in stinger scene:**
- Issue: Bar generation logic is duplicated between initialization (lines 54-120) and generateBars() function (lines 151-219)
- Files: `src/stinger/index.html`
- Impact: Maintenance burden - changes must be made in two places. Risk of divergence between initial bars and regenerated bars.
- Fix approach: Extract bar generation into a single reusable function, call it from both locations

**Background scene updates at mixed frame rates:**
- Issue: Background layer updates at 30fps (every 2 frames) while foreground updates at 60fps. Frame counters and lifecycle timings are all calibrated for 60fps.
- Files: `src/background/index.html` (line 117)
- Impact: Background bars age at half speed - a 2-second fade becomes 4 seconds. Direction changes and lifecycle transitions occur at wrong times. Visual inconsistency between layers.
- Fix approach: Either update both layers at same rate, or scale background bar timings by 0.5x to compensate

**StingerBar retains lightness values from recent refactoring:**
- Issue: StingerBar uses full brightness (lightness 100) for white bars while BackgroundBar reduces to 80. No consistent brightness reduction applied to StingerBar colored bars.
- Files: `src/stinger/StingerBar.js` (lines 32, 40), `src/background/BackgroundBar.js` (lines 32, 42)
- Impact: Visual inconsistency between animations. Stinger may appear too bright compared to background. Recent commit "Reduce brightness of background colors by 20%" only applied to BackgroundBar.
- Fix approach: Apply same 20% brightness reduction to StingerBar and SidebarBar for consistency

**Test failures not blocking development:**
- Issue: Two tests failing in colors.test.js related to URL parameter parsing (expected "FF5733" but got "#FF5733")
- Files: `tests/shared/colors.test.js` (lines 121, 140)
- Impact: Tests don't match actual implementation. Either tests are wrong or getColorFromURL() has a bug. Code is being committed with failing tests.
- Fix approach: Fix the tests to match actual behavior (color includes "#") or fix getColorFromURL() to remove "#" from return value. Add CI to prevent commits with failing tests.

## Known Bugs

**Stinger animation doesn't auto-start:**
- Symptoms: Stinger scene requires 'transitionStart' event to begin animating. No auto-start mechanism.
- Files: `src/stinger/index.html` (lines 221-230)
- Trigger: Load stinger/index.html directly - canvas remains blank until custom event fires
- Workaround: Manually dispatch transitionStart event or integrate with OBS browser source that fires the event
- Fix needed: Add auto-start option via URL parameter (?autoplay=true) or start animation immediately if not in OBS

**Color URL parameter parsing inconsistent:**
- Symptoms: getColorFromURL() returns color with "#" prefix, but tests expect no prefix
- Files: `src/shared/colors.js`, `tests/shared/colors.test.js` (lines 119-141)
- Trigger: Use ?color=FF5733 URL parameter - function returns "#FF5733"
- Current impact: Tests fail but functionality works (hexToHSL handles "#" prefix)
- Fix needed: Normalize return value - either always include "#" or always exclude it. Update tests to match.

## Security Considerations

**No input validation on URL parameters:**
- Risk: URL parameters (speed, density, duration, color) are parsed without validation
- Files: `src/background/index.html` (lines 49-50), `src/stinger/index.html` (lines 36-37)
- Current mitigation: parseFloat/parseInt provide some bounds, but extreme values could cause performance issues or crashes
- Recommendations:
  - Add min/max bounds for speed (0.1-10), density (1-50), duration (500-10000)
  - Validate color hex format before parsing
  - Add error handling for malformed parameters

**Performance monitoring logs to console:**
- Risk: Performance stats logged to browser console may expose timing information
- Files: `src/shared/performance.js` (line 100)
- Current mitigation: Only enabled with ?perf=true URL parameter
- Recommendations: Not a serious security issue for stream overlays, but consider removing in production builds or adding option to disable logging

## Performance Bottlenecks

**Array sorting on every bar add/remove:**
- Problem: Background scene sorts bars by zIndex when bars added/removed, but still sorts on every change
- Files: `src/background/index.html` (lines 135-137, 164-166)
- Cause: bgNeedsSort/fgNeedsSort flags set when bars added/removed, triggering sort
- Improvement path: Pre-generate zIndex values in ascending order instead of random, eliminating need for sorting. Or use insertion sort to maintain order when adding single bar.

**Offscreen canvas cache for white bars may not improve performance:**
- Problem: Cache hit requires exact match on width, height, hue, saturation, lightness. White bars vary in size, so cache hit rate may be low.
- Files: `src/shared/AnimatedBar.js` (lines 46-111)
- Cause: White bars have random sizes (50-180 for slanted, 20-50 for horizontal), creating many unique cache keys
- Improvement path: Round dimensions to nearest 10px for cache key, or pre-render a fixed set of common sizes

**Viewport culling margin may be too conservative:**
- Problem: Background bars use 200px margin, stinger/sidebar use 300px. Bars drawn well beyond visible area.
- Files: `src/background/BackgroundBar.js` (line 285), `src/stinger/StingerBar.js` (line 192), `src/sidebar/SidebarBar.js` (line 163)
- Cause: Conservative margins to account for rotation/skew, but may be larger than necessary
- Improvement path: Calculate exact bounds based on angle/skew instead of fixed margin. Could save 10-20% of draw calls.

**String concatenation in hot path:**
- Problem: HSL color string created on every draw call using template literal
- Files: `src/shared/AnimatedBar.js` (line 188)
- Cause: `hsl(${hue}, ${saturation}%, ${lightness}%)` executed 60 times per second per bar
- Improvement path: Pre-compute color string during init for bars with static colors (white bars, background curtains). Only recompute for bars with animated opacity.

## Fragile Areas

**Phase state machine in BackgroundBar:**
- Files: `src/background/BackgroundBar.js` (lines 199-253)
- Why fragile: Complex state transitions with multiple phases (fadeIn, visible, fadeOut, complete), direction transitions, size animations all interacting. Easy to introduce off-by-one errors in frame counting.
- Safe modification: Always test full lifecycle (6000+ frames). Use existing pure functions in calculations.js rather than inline math.
- Test coverage: Good coverage in calculations.test.js (58 tests), but no integration tests for full bar lifecycle

**Dual canvas layering in background scene:**
- Files: `src/background/index.html` (lines 63-103)
- Why fragile: Bars split between two canvases based on speed. Adding/removing bars must maintain balance. Different update rates (30fps vs 60fps) complicate debugging.
- Safe modification: Keep both layers synchronized. Avoid adding logic that depends on which layer a bar is on.
- Test coverage: No tests for dual-canvas behavior

**Random start position logic:**
- Files: `src/background/BackgroundBar.js` (lines 130-179)
- Why fragile: Two initialization paths (random position vs fresh start) with different calculations for x position based on phase, direction, and elapsed frames. Easy to desync position with lifecycle state.
- Safe modification: Test both randomStart=true and randomStart=false code paths. Verify bars appear at correct positions and phases.
- Test coverage: No tests for initialization logic

**Stinger curtain bar setup:**
- Files: `src/stinger/index.html` (lines 56-85, 154-183)
- Why fragile: Large background curtain bars created with manual property overrides (width, opacity, direction, startX, targetX). Tightly coupled to canvas dimensions and animation timing.
- Safe modification: Extract curtain creation into a function. Add comments explaining the magic numbers (0.75 width, 15-25 lightness reduction).
- Test coverage: None

## Scaling Limits

**Canvas rendering at 60fps with 15+ bars:**
- Current capacity: 15 bars (background scene default) runs smoothly at 1920x1080
- Limit: Performance degrades above ~50 bars or 4K resolution. Each bar requires transform, shadow draw, and main draw.
- Scaling path: Use WebGL/OffscreenCanvas for rendering, or reduce shadow quality further. Consider dropping to 30fps for very high bar counts.

**Offscreen canvas cache grows unbounded:**
- Current capacity: Works fine for short sessions (minutes to hours)
- Limit: Memory leak becomes noticeable after several hours with continuous bar creation (background scene)
- Scaling path: Implement cache size limit (e.g., 100 entries max) with LRU eviction

**Stinger animation not reusable:**
- Current capacity: Single animation plays once per page load (requires event trigger)
- Limit: Cannot replay animation without regenerating bars. No cleanup between animations.
- Scaling path: Add reset() method to clear all bars and state. Make transitionStart event reusable.

## Dependencies at Risk

**vite-plugin-singlefile:**
- Risk: Plugin used to bundle everything into single HTML file for OBS. Last significant update unknown, may become unmaintained.
- Impact: Build process would break. OBS requires single-file HTML for browser sources.
- Migration plan: Switch to manual inlining (inline CSS, bundle JS with Vite, inject into HTML template) or fork plugin

**Vitest 4.x:**
- Risk: Recently upgraded to v4 (major version). May have breaking changes in future minor versions.
- Impact: Tests could break on npm update
- Migration plan: Pin version in package.json (currently using ^4.0.16). Monitor changelog for breaking changes.

## Missing Critical Features

**No error handling for canvas context creation:**
- Problem: Canvas context creation assumed to succeed, no fallback or error message
- Blocks: Debugging when canvas fails (rare but possible in some browsers/environments)
- Files: `src/shared/canvas.js`, all HTML entry points

**No way to stop/pause animations:**
- Problem: Background animation runs indefinitely with no stop mechanism
- Blocks: Cannot gracefully unload scene or reduce CPU usage when not visible in OBS

**No accessibility considerations:**
- Problem: Canvas animations provide no alt text, no reduced motion support, no screen reader hints
- Blocks: Cannot use animations in accessibility-compliant contexts

**No build output verification:**
- Problem: Build creates single HTML files but no automated verification that they work
- Blocks: Can't detect broken builds until manual testing

## Test Coverage Gaps

**No integration tests for bar lifecycle:**
- What's not tested: Full lifecycle of bar from fadeIn through visible to fadeOut and deactivation
- Files: `src/background/BackgroundBar.js`, `src/stinger/StingerBar.js`, `src/sidebar/SidebarBar.js`
- Risk: Phase transitions could break unnoticed. Direction changes during visible phase untested. Size animations over full lifecycle untested.
- Priority: Medium - Pure calculation functions have good coverage, but integration untested

**No tests for HTML entry points:**
- What's not tested: URL parameter parsing, canvas setup, animation loop initialization, bar creation logic
- Files: `src/background/index.html`, `src/stinger/index.html`, `src/sidebar/index.html`
- Risk: Changes to entry point logic (event listeners, parameter parsing, bar generation) have no safety net
- Priority: High - These are the actual deployed artifacts

**No visual regression tests:**
- What's not tested: Visual output of animations. Color accuracy, position calculations, shadow rendering.
- Files: All rendering code
- Risk: Visual bugs could ship unnoticed. Refactoring could change appearance without detection.
- Priority: Low - Manual testing catches most issues, but time-consuming

**No performance benchmarks:**
- What's not tested: Performance characteristics under different loads (bar counts, resolutions)
- Files: All performance-critical code
- Risk: Performance regressions go undetected. Optimizations can't be verified quantitatively.
- Priority: Medium - REFACTORING_SUMMARY.md claims "30-60% improvement" but no automated verification

**No tests for error conditions:**
- What's not tested: Invalid URL parameters, missing canvas elements, context creation failures
- Files: All entry points and utility functions
- Risk: Error handling paths never exercised. May fail ungracefully in production.
- Priority: Low - Errors are rare in controlled OBS environment

---

*Concerns audit: 2026-01-17*
