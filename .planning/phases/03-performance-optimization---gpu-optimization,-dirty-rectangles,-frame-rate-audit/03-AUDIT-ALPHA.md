# Alpha Channel Performance Audit

**Date:** 2026-01-18T06:30:21Z
**Phase:** 03-performance-optimization
**Auditor:** Claude (automated with human verification)

## Executive Summary

{To be filled after measurements - 2-3 sentences on findings and recommendation}

## Objective

Measure memory footprint and FPS impact of alpha channel usage over 4-6 hour streaming simulations to determine if alpha optimization is required in Phase 3, or if current alpha-enabled configuration meets conservative streaming thresholds (<300MB memory, <5% FPS drop).

## Methodology

### Test Environment

- **Browser:** Chrome/Chromium (version to be documented from navigator.userAgent during test)
- **Platform:** Linux (from navigator.platform during test)
- **Hardware:** Manual documentation required (Chrome about:gpu)
- **Resolution:** 1920x1080 (typical OBS browser source resolution)
- **Test Duration:** 4-6 hours per scenario
- **Scenes Tested:** Background (primary focus - runs continuously)

### Test Scenarios

**Scenario A: Alpha Enabled (Baseline)**
- config.performance.alpha.background = true
- Canvas context: { alpha: true }
- Expected: 4 bytes per pixel (RGBA)

**Scenario B: Alpha Disabled (Optimized)**
- config.performance.alpha.background = false
- Canvas context: { alpha: false }
- Expected: Internal optimization to 3 bytes per pixel RGB, faster GPU compositing

### Measurement Tools

1. **Performance Overlay** (from 03-01):
   - Real-time FPS tracking via window.perfMonitor
   - Session summaries in localStorage
   - P99 frame time for consistency analysis

2. **Chrome DevTools Memory Panel**:
   - Heap snapshots at T=0 (baseline), T=2h, T=4h, T=6h
   - Allocation timeline for leak detection
   - Canvas memory footprint (ArrayBuffer size for canvas backing stores)

3. **Manual Observation**:
   - Visual consistency check (no artifacts)
   - OBS output preview (ensure compositing correct)

### Data Collection Protocol

1. Clear localStorage and browser cache before each scenario
2. Open background.html?perf=true in dedicated Chrome window
3. Take baseline heap snapshot (DevTools > Memory > Heap snapshot)
4. Record session start time (ISO 8601)
5. Let run for 4-6 hours (machine can be used for other tasks - window must stay visible/active)
6. Take heap snapshots every 2 hours
7. After test duration: Record end time, save final heap snapshot
8. Export session summary: window.perfMonitor.getSessions() → copy to JSON file
9. Repeat for Scenario B

### Thresholds (from CONTEXT.md)

- **Memory:** <300MB steady-state (conservative streaming threshold)
- **FPS Drop:** <5% compared to baseline
- **Stability:** 8+ hour continuous operation without crashes

## Data Collection

{Instructions for human to populate during checkpoint}

### Scenario A: Alpha Enabled

**Session Summary:**
```json
{
  "id": "",
  "timestamp": "",
  "scene": "background",
  "duration": 0,
  "avgFPS": 0,
  "peakMemoryMB": 0,
  "droppedFrames": 0
}
```

**Heap Snapshots:**
| Time | Total Heap (MB) | Canvas Memory (MB) | Detached Nodes |
|------|-----------------|--------------------| ---------------|
| T=0  |                 |                    |                |
| T=2h |                 |                    |                |
| T=4h |                 |                    |                |
| T=6h |                 |                    |                |

**Notes:**
{Manual observations, issues encountered}

### Scenario B: Alpha Disabled

**Session Summary:**
```json
{
  "id": "",
  "timestamp": "",
  "scene": "background",
  "duration": 0,
  "avgFPS": 0,
  "peakMemoryMB": 0,
  "droppedFrames": 0
}
```

**Heap Snapshots:**
| Time | Total Heap (MB) | Canvas Memory (MB) | Detached Nodes |
|------|-----------------|--------------------| ---------------|
| T=0  |                 |                    |                |
| T=2h |                 |                    |                |
| T=4h |                 |                    |                |
| T=6h |                 |                    |                |

**Notes:**
{Manual observations, issues encountered}

## Analysis

{To be filled after data collection}

### Memory Impact

- Delta between scenarios: ___MB (___% difference)
- Trend: Stable / Linear growth / Exponential growth
- Leak indicators: Detached DOM nodes, growing ArrayBuffers

### FPS Impact

- Scenario A avg FPS: ___
- Scenario B avg FPS: ___
- Difference: ___% (within <5% threshold: YES/NO)
- P99 frame time comparison: ___ms vs ___ms

### Stability

- Crashes/errors: YES/NO
- Visual artifacts: YES/NO (screenshot if issues)
- OBS compositing: Correct / Issues

## Findings

{To be completed after analysis}

1. **Memory Savings:**
   - Actual savings: ___MB (___%)
   - Meets <300MB threshold: YES/NO

2. **FPS Impact:**
   - FPS change: ___% (improvement/degradation)
   - Stays above 55fps floor: YES/NO

3. **Stability:**
   - 6+ hour operation: Successful / Issues
   - Memory leak detected: YES/NO

## Recommendations

{To be completed based on findings}

**Recommendation:** OPTIMIZE IN PHASE 3 / DEFER TO PHASE 4 / NO ACTION NEEDED

**Rationale:**
{Explain decision based on threshold comparison}

**If optimization recommended:**
- Implement scene-wide alpha:false in background.html via config
- Update canvas.js setupCanvas to respect config.performance.alpha[scene]
- Add Phase 2 test extension: Verify alpha-disabled scenarios pass position/timing invariants
- Preserve stinger/sidebar alpha for Phase 4 visual flexibility

**If deferred:**
- Current alpha usage within acceptable thresholds
- Preserve flexibility for Phase 4 fade/transparency animations
- Document findings for future optimization if requirements change

## External Research

{Include links to relevant sources from RESEARCH.md}

- MDN Canvas Optimization: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Chrome DevTools Memory: https://developer.chrome.com/docs/devtools/memory/
- {Additional sources consulted during audit}

## Appendix

### Test Setup Script

```javascript
// Scenario A: Alpha Enabled
// config.js: config.performance.alpha.background = true

// Scenario B: Alpha Disabled
// config.js: config.performance.alpha.background = false

// Open: http://localhost:5173/src/background/index.html?perf=true
// DevTools: Memory panel
// Console: window.perfMonitor.getSessions()
```

### Heap Snapshot Analysis Guide

1. Open DevTools > Memory
2. Select "Heap snapshot"
3. Click "Take snapshot"
4. Compare snapshots:
   - Look for "Detached DOM tree" (memory leak indicator)
   - Filter by "ArrayBuffer" (canvas backing stores)
   - Sort by "Retained Size" (largest memory consumers)

---
*Audit conducted: 2026-01-18*
*Next: Frame Rate Audit (03-04)*
