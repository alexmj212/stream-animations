# Frame Rate Performance Audit

**Date:** 2026-01-18T06:30:05Z
**Phase:** 03-performance-optimization
**Auditor:** Claude (automated with human verification)

## Executive Summary

{To be filled after measurements - 2-3 sentences on findings and recommendation}

## Objective

Validate Phase 1 unified 60fps architecture under stress scenarios, verify delta-time system correctness across different display refresh rates, and document frame time consistency to determine if GPU optimizations (dirty rectangles, render batching) are required to meet streaming performance targets.

**PERF-06 Requirement:** Audit and fix mixed frame rate timing issues - validates unified 60fps works correctly, not re-introducing split rates.

## Methodology

### Test Environment

- **Browser:** {Chrome/Chromium version - detect from navigator.userAgent during test}
- **Platform:** {OS from navigator.platform during test}
- **Hardware:** {CPU, GPU from about:gpu or manual entry}
- **Display Refresh Rate:** {60Hz, 120Hz, 144Hz - from window.screen or manual}
- **Resolution:** 1920x1080 (typical OBS browser source resolution)
- **Test Duration:** 10-15 minutes per stress scenario (sufficient to detect FPS degradation)

### Stress Scenarios

**Scenario 1: Normal Load (Baseline)**
- config.background.density.default = 15 (default bar count)
- No background system load
- Target: Consistent 60fps, P99 < 18ms

**Scenario 2: High Bar Count**
- config.background.density.default = 50 (maximum before performance degrades)
- Simulates worst-case animation load
- Target: >=55fps (acceptable floor), P99 < 20ms

**Scenario 3: Rapid Transitions**
- Trigger stinger transitions rapidly (every 2-3 seconds)
- Simulates frequent scene changes during stream
- Target: No dropped frames during transitions, >=55fps

**Scenario 4: Background System Load**
- Run stress scenario with background CPU load:
  - Open OBS with game capture source (if available)
  - OR: Run CPU stress tool (stress-ng, Prime95, or browser tab with heavy computation)
- Simulates real streaming conditions (encoding + animation)
- Target: >=55fps under load

**Scenario 5: Display Refresh Rate Validation**
- Test on different display refresh rates: 60Hz, 120Hz, 144Hz (if available)
- Verify delta-time system prevents frame rate dependencies
- Target: Animation speed consistent across refresh rates (tolerance: ±5%)

### Measurement Tools

1. **Performance Overlay** (from 03-01):
   - Real-time FPS tracking
   - Frame time distribution (min/max/avg)
   - P99 frame time (consistency metric)
   - Dropped frames counter

2. **Chrome DevTools Performance Panel**:
   - Record performance profile during stress scenarios
   - Identify GPU bottlenecks (excessive clears, compositing)
   - Measure JavaScript execution time per frame

3. **Manual Timing Verification**:
   - Measure actual animation duration vs expected (e.g., fade should be exactly 2 seconds)
   - Use external stopwatch for cross-validation

### Data Collection Protocol

1. For each stress scenario:
   - Adjust config as needed (bar count, etc.)
   - Reload background.html?perf=true
   - Let stabilize for 30 seconds (ignore initial warm-up period)
   - Record stats via window.perfMonitor.getStats()
   - Open DevTools > Performance, click "Record"
   - Let run for 5-10 minutes under stress
   - Stop recording, save profile
   - Export session: window.perfMonitor.getSessions()
2. For display refresh rate validation:
   - Change display settings to different refresh rate
   - Reload page, measure bar travel time across screen width
   - Compare actual vs expected duration (should match within ±5%)

### Thresholds (from CONTEXT.md)

- **Target FPS:** 60fps (normal load)
- **Acceptable Floor:** 55fps (under stress)
- **Frame Time Budget:** 16.67ms (60fps)
- **P99 Frame Time:** <20ms (allows occasional spikes)
- **Dropped Frames:** <1% of total frames
- **Animation Timing Accuracy:** ±5% across refresh rates

## Data Collection

{Instructions for human to populate during checkpoint}

### Scenario 1: Normal Load (Baseline)

**Session Summary:**
```json
{
  "scene": "background",
  "duration": 0,
  "avgFPS": 0,
  "minFrameTime": 0,
  "maxFrameTime": 0,
  "avgFrameTime": 0,
  "p99FrameTime": 0,
  "droppedFrames": 0
}
```

**Notes:**
{Visual stuttering, animation smoothness, issues}

### Scenario 2: High Bar Count (50 bars)

**Session Summary:**
```json
{
  "scene": "background",
  "duration": 0,
  "avgFPS": 0,
  "minFrameTime": 0,
  "maxFrameTime": 0,
  "avgFrameTime": 0,
  "p99FrameTime": 0,
  "droppedFrames": 0
}
```

**Notes:**
{Visual stuttering, animation smoothness, performance degradation}

### Scenario 3: Rapid Transitions

**Session Summary:**
```json
{
  "scene": "background",
  "duration": 0,
  "avgFPS": 0,
  "minFrameTime": 0,
  "maxFrameTime": 0,
  "avgFrameTime": 0,
  "p99FrameTime": 0,
  "droppedFrames": 0
}
```

**Notes:**
{Transition behavior, stuttering during transitions, recovery speed}

### Scenario 4: Background System Load

**Session Summary:**
```json
{
  "scene": "background",
  "duration": 0,
  "avgFPS": 0,
  "minFrameTime": 0,
  "maxFrameTime": 0,
  "avgFrameTime": 0,
  "p99FrameTime": 0,
  "droppedFrames": 0
}
```

**Background Load Type:** {OBS recording / CPU stress tool / browser stress tab}

**Notes:**
{Load impact, visual stuttering, system resource contention}

### Scenario 5: Display Refresh Rate Validation

**60Hz Display:**
- Measured bar travel time: ___ seconds
- Expected: ___ seconds (canvas.width / bar.speed from config)
- Accuracy: ___% (within ±5%: YES/NO)

**120Hz Display:**
- Measured bar travel time: ___ seconds
- Expected: ___ seconds
- Accuracy: ___% (within ±5%: YES/NO)
- {Or note "N/A - hardware unavailable"}

**144Hz Display:**
- Measured bar travel time: ___ seconds
- Expected: ___ seconds
- Accuracy: ___% (within ±5%: YES/NO)
- {Or note "N/A - hardware unavailable"}

## Analysis

{To be filled after data collection}

### Frame Rate Performance

**Normal Load (15 bars):**
- Avg FPS: ___
- Meets 60fps target: YES/NO
- P99 frame time: ___ms (under 18ms: YES/NO)

**High Bar Count (50 bars):**
- Avg FPS: ___
- Meets 55fps floor: YES/NO
- P99 frame time: ___ms (under 20ms: YES/NO)
- FPS degradation from baseline: ___%

**Rapid Transitions:**
- Avg FPS: ___
- Dropped frames during transitions: ___
- Transition smoothness: Smooth / Stuttering

**Background Load:**
- Avg FPS: ___
- Meets 55fps floor: YES/NO
- Load impact: ___%

### Frame Time Consistency

- P99 vs Avg frame time ratio: ___ (high ratio indicates inconsistency)
- Dropped frames percentage: ___% (under 1%: YES/NO)
- GPU bottleneck indicators from DevTools:
  - Excessive clearRect calls: YES/NO
  - Long compositing times: YES/NO
  - Paint flashing (visual artifacts): YES/NO

### Delta-Time Validation

- 60Hz animation duration accuracy: ___% (within ±5%: YES/NO)
- 120Hz animation duration accuracy: ___% (within ±5%: YES/NO)
- 144Hz animation duration accuracy: ___% (within ±5%: YES/NO)
- Delta-time system correct: YES/NO

## Findings

{To be completed after analysis}

1. **Frame Rate Target Achievement:**
   - Normal load (15 bars): 60fps target met: YES/NO
   - High load (50 bars): 55fps floor met: YES/NO
   - Under system load: 55fps floor met: YES/NO

2. **Frame Time Consistency:**
   - P99 under 20ms: YES/NO
   - Dropped frames under 1%: YES/NO
   - Consistent timing (low variance): YES/NO

3. **Delta-Time Correctness:**
   - Animation speed consistent across refresh rates: YES/NO
   - Timing accuracy within ±5%: YES/NO
   - Phase 1 unified 60fps validated: YES/NO

4. **GPU Bottlenecks Identified:**
   - Excessive clearRect calls: YES/NO (indicates dirty rectangles needed)
   - Long compositing times: YES/NO (indicates alpha optimization needed)
   - Paint flashing: YES/NO (indicates render batching needed)

## Recommendations

{To be completed based on findings}

**Performance Status:** MEETS TARGETS / NEEDS OPTIMIZATION / CRITICAL ISSUES

**Immediate Actions Required:**

1. **Dirty Rectangle Optimization:**
   - Needed: YES/NO
   - Rationale: {If YES: Excessive clearRect calls detected, GPU clear operations bottleneck. If NO: Current full-clear approach meets performance targets}
   - Priority: HIGH / MEDIUM / LOW
   - Plan: If needed, implement in 03-05

2. **Alpha Channel Optimization:**
   - Needed: YES/NO (cross-reference 03-03 alpha audit findings)
   - Rationale: {Long compositing times indicate alpha blending overhead}

3. **Render Batching:**
   - Needed: YES/NO
   - Rationale: {Paint flashing indicates excessive individual draw calls}

4. **Config Adjustments:**
   - Reduce default bar count: YES/NO (if 15 bars fails to meet 60fps)
   - Adjust stress test max: YES/NO (if 50 bars inappropriate threshold)

**Long-Term Optimizations (defer to future phases if current performance acceptable):**
- Offscreen canvas pre-rendering for static elements
- WebGL rendering for complex animations
- Web Workers for animation calculations

## External Research

- Chrome DevTools Performance: https://developer.chrome.com/docs/devtools/performance/
- Frame Rate Independence: https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors
- Canvas Performance Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Measuring Performance: https://web.dev/rail/

## Appendix

### Test Setup Script

```javascript
// Scenario 2: High Bar Count
// Edit src/config/config.js:
// config.background.density.default = 50

// Scenario 3: Rapid Transitions
// Open stinger.html in separate window
// Trigger via: window.dispatchEvent(new CustomEvent('transitionStart'))

// Scenario 4: Background Load
// Start OBS with game capture or CPU stress tool before test

// Get stats from performance monitor:
// window.perfMonitor.getStats()

// Export all sessions:
// window.perfMonitor.getSessions()
```

### DevTools Performance Analysis Guide

1. Open DevTools > Performance
2. Click record button (circle)
3. Let run for 10-15 seconds during stress scenario
4. Click stop button
5. Analyze:
   - FPS meter (top): Look for drops below 60fps
   - Main thread flame chart: Look for long tasks (>16.67ms)
   - GPU activity: Look for compositing bottlenecks
   - Screenshots: Visual stuttering correlation

### Expected Bar Speed Calculation

For delta-time validation (Scenario 5):

```javascript
// From config.background.speed
// Base speed: config.background.speed.defaultMultiplier (1.0)
// Bar speed range: 0.1 to 0.9
// Actual bar speed varies, but for manual timing:
// 1. Find a bar moving at approximately baseline speed
// 2. Expected time = canvas.width / (baseline_speed_px_per_second)
// 3. For 1920px canvas with typical bar speed ~100px/s: expect ~19.2s
// 4. Actual measurement should be within ±5% of expected (18.2s - 20.2s)
```

---
*Audit conducted: {date}*
*Next: Dirty Rectangle Implementation (03-05) if optimization needed*
