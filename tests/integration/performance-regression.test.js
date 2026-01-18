/**
 * Performance Regression Tests
 *
 * Detects performance regressions in CI by running synthetic stress scenarios
 * and asserting against thresholds from config.performance.thresholds.
 *
 * BASELINES (PLACEHOLDER - will be updated after Phase 3 audits):
 * - Normal load (15 bars): ~200-250MB memory, 58-60 FPS (estimated)
 * - High load (50 bars): ~250-300MB memory, 52-58 FPS (estimated)
 * - P99 frame time: <20ms (estimated)
 * - Dropped frames: <1%
 *
 * TODO: Update baselines after 03-03 alpha audit and 03-04 frame rate audit complete.
 * See 03-03-SUMMARY.md and 03-04-SUMMARY.md for actual measured values.
 *
 * THRESHOLDS (conservative for streaming):
 * - maxMemoryMB: 300 (from config)
 * - minFPS: 55 (from config)
 * - P99: 20ms (from AUDIT-FRAMERATE)
 * - Dropped: 1% (from CONTEXT)
 *
 * CI ENVIRONMENT:
 * - Headless Chrome with Xvfb (virtual display)
 * - Slower than dev hardware (allow 20% variance)
 * - Tests focus on detecting MAJOR regressions (>20% degradation)
 * - Minor fluctuations (<10%) expected and acceptable
 *
 * LIMITATIONS:
 * - Cannot simulate real OBS streaming load (game capture, encoding)
 * - Memory tests may be unavailable if performance.memory not supported
 * - FPS thresholds generous to prevent false positives in CI
 * - Real-world validation requires manual OBS testing
 *
 * USAGE:
 * - Run locally: npm test -- performance-regression.test.js
 * - CI runs automatically on every commit
 * - Failures indicate code changes degraded performance
 * - Review recent commits if tests fail unexpectedly
 *
 * TROUBLESHOOTING:
 * - "Memory exceeded": Check for removed LRU cache eviction, unbounded arrays
 * - "FPS below floor": Check for added expensive operations in animate loop
 * - "P99 high": Check for synchronous blocking operations (I/O, heavy computation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { config } from '../../src/config/config.js';
import { PerformanceMonitor } from '../../src/shared/performance.js';
import { BackgroundBar } from '../../src/background/BackgroundBar.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';
import { DeltaTimer } from '../../src/shared/timing.js';

describe('Performance Regression Tests', () => {
  let canvas;
  let ctx;
  let perfMonitor;
  let deltaTimer;
  const baseHSL = { h: 180, s: 50, l: 50 };

  beforeEach(() => {
    // Create canvas via setupCanvas fixture
    canvas = createMockCanvas(1920, 1080);
    ctx = createMockContext(canvas);

    // Initialize PerformanceMonitor and enable
    perfMonitor = new PerformanceMonitor(60);
    perfMonitor.enable();

    // Create DeltaTimer for frame simulation
    deltaTimer = new DeltaTimer();

    // Clear static cache before each test
    if (BackgroundBar.offscreenCache) {
      BackgroundBar.offscreenCache.clear();
    }

    // Use fake timers for consistent frame timing
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    // Cleanup
    perfMonitor.disable();
    perfMonitor.reset();
    deltaTimer.reset();

    // Clear cache after each test
    if (BackgroundBar.offscreenCache) {
      BackgroundBar.offscreenCache.clear();
    }

    vi.useRealTimers();
  });

  describe('Memory thresholds', () => {
    it('should not exceed memory threshold under normal load (15 bars)', (ctx) => {
      // Skip test if performance.memory unavailable
      if (!performance.memory) {
        ctx.skip();
        return;
      }

      // Create 15 BackgroundBar instances (config.background.density.default)
      const bars = [];
      for (let i = 0; i < config.background.density.default; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Simulate 1000 update cycles (accelerated from Phase 2 stress test pattern)
      const iterations = 1000;
      const delta = 0.016; // 60fps

      for (let i = 0; i < iterations; i++) {
        bars.forEach(bar => bar.update(delta));
      }

      // Check memory usage
      const usedMemoryMB = performance.memory.usedJSHeapSize / 1048576;
      const thresholdMB = config.performance.thresholds.maxMemoryMB * 1.2; // 20% headroom for CI

      expect(usedMemoryMB).toBeLessThan(thresholdMB);

      // Provide actionable error message
      if (usedMemoryMB >= thresholdMB) {
        throw new Error(
          `Memory exceeded threshold: ${usedMemoryMB.toFixed(2)}MB > ${thresholdMB.toFixed(2)}MB (maxMemoryMB * 1.2). Possible memory leak introduced.`
        );
      }
    });

    it('should not exceed memory threshold under high load (50 bars)', (ctx) => {
      // Skip test if performance.memory unavailable
      if (!performance.memory) {
        ctx.skip();
        return;
      }

      // Create 50 BackgroundBar instances (config.background.density.max)
      const bars = [];
      for (let i = 0; i < config.background.density.max; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Simulate 500 update cycles (shorter run due to higher load)
      const iterations = 500;
      const delta = 0.016; // 60fps

      for (let i = 0; i < iterations; i++) {
        bars.forEach(bar => bar.update(delta));
      }

      // Check memory usage - more generous threshold for stress test
      const usedMemoryMB = performance.memory.usedJSHeapSize / 1048576;
      const thresholdMB = config.performance.thresholds.maxMemoryMB * 1.5; // 50% headroom for high load

      expect(usedMemoryMB).toBeLessThan(thresholdMB);

      // Provide actionable error message
      if (usedMemoryMB >= thresholdMB) {
        throw new Error(
          `Memory exceeded high load threshold: ${usedMemoryMB.toFixed(2)}MB > ${thresholdMB.toFixed(2)}MB (maxMemoryMB * 1.5). Possible memory leak introduced. Detects major regressions (2x memory growth), not minor fluctuations.`
        );
      }
    });

    it('should maintain stable memory without linear growth', (ctx) => {
      // Skip test if performance.memory unavailable
      if (!performance.memory) {
        ctx.skip();
        return;
      }

      // Create 15 bars
      const bars = [];
      for (let i = 0; i < config.background.density.default; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Sample usedJSHeapSize every 100 iterations over 1000 iterations
      const iterations = 1000;
      const delta = 0.016; // 60fps
      const memorySamples = [];

      for (let i = 0; i < iterations; i++) {
        bars.forEach(bar => bar.update(delta));

        // Sample memory every 100 iterations
        if (i % 100 === 0) {
          memorySamples.push(performance.memory.usedJSHeapSize / 1048576);
        }
      }

      // Calculate first-half average vs second-half average (Phase 2 pattern)
      const firstHalfAvg = memorySamples.slice(0, Math.floor(memorySamples.length / 2))
        .reduce((a, b) => a + b, 0) / Math.floor(memorySamples.length / 2);
      const secondHalfAvg = memorySamples.slice(Math.floor(memorySamples.length / 2))
        .reduce((a, b) => a + b, 0) / Math.ceil(memorySamples.length / 2);

      // Assert: secondHalfAvg < firstHalfAvg * 1.5 (allows GC fluctuation, detects leaks)
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);

      if (secondHalfAvg >= firstHalfAvg * 1.5) {
        throw new Error(
          `Memory growth detected: second-half average ${secondHalfAvg.toFixed(2)}MB >= first-half average ${firstHalfAvg.toFixed(2)}MB * 1.5. Linear memory growth suggests leak.`
        );
      }
    });
  });

  describe('FPS thresholds', () => {
    it('should maintain minimum FPS under normal load (15 bars)', () => {
      // TODO: Update baseline after 03-03 alpha audit completes. Expected: 58-60fps normal load.

      // Create 15 bars
      const bars = [];
      for (let i = 0; i < config.background.density.default; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Simulate 300 frames with realistic delta times (~16.67ms)
      const iterations = 300;
      const delta = 0.016667; // ~60fps

      let timestamp = 0;
      for (let i = 0; i < iterations; i++) {
        timestamp += delta * 1000; // Convert to ms
        perfMonitor.recordFrame();
        bars.forEach(bar => bar.update(delta));
      }

      // Collect perfMonitor.getStats()
      const stats = perfMonitor.getStats();

      // Allow 5fps variance: stats.fps >= minFPS - 5 (CI environment slower than dev machine)
      const minFPSWithVariance = config.performance.thresholds.minFPS - 5;

      expect(stats.fps).toBeGreaterThanOrEqual(minFPSWithVariance);

      if (stats.fps < minFPSWithVariance) {
        throw new Error(
          `FPS below floor: ${stats.fps}fps < ${minFPSWithVariance}fps (minFPS - 5fps CI variance). Performance regression detected.`
        );
      }
    });

    it('should maintain acceptable FPS under high load (50 bars)', () => {
      // TODO: Update baseline after 03-03 alpha audit completes. Expected: 52-58fps high load.

      // Create 50 bars
      const bars = [];
      for (let i = 0; i < config.background.density.max; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Simulate 200 frames (shorter due to load)
      const iterations = 200;
      const delta = 0.016667; // ~60fps

      let timestamp = 0;
      for (let i = 0; i < iterations; i++) {
        timestamp += delta * 1000;
        perfMonitor.recordFrame();
        bars.forEach(bar => bar.update(delta));
      }

      // Collect stats
      const stats = perfMonitor.getStats();

      // Allow 10fps variance: stats.fps >= minFPS - 10 (more generous under stress)
      const minFPSWithVariance = config.performance.thresholds.minFPS - 10;

      expect(stats.fps).toBeGreaterThanOrEqual(minFPSWithVariance);

      if (stats.fps < minFPSWithVariance) {
        throw new Error(
          `FPS below high load floor: ${stats.fps}fps < ${minFPSWithVariance}fps (minFPS - 10fps stress variance). CI with Xvfb slower than real hardware, detect major drops (>20%) not minor variance.`
        );
      }
    });
  });

  describe('Frame time consistency', () => {
    it('should maintain acceptable P99 frame time', () => {
      // TODO: P99 threshold from 03-04 frame rate audit. Update if audit findings differ.

      // Create 15 bars
      const bars = [];
      for (let i = 0; i < config.background.density.default; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Simulate 300 frames
      const iterations = 300;
      const delta = 0.016667; // ~60fps

      let timestamp = 0;
      for (let i = 0; i < iterations; i++) {
        timestamp += delta * 1000;
        perfMonitor.recordFrame();
        bars.forEach(bar => bar.update(delta));
      }

      // Get P99 frame time
      const p99FrameTime = parseFloat(perfMonitor.getP99FrameTime());

      // Assert: P99 < 20ms (from AUDIT-FRAMERATE threshold)
      expect(p99FrameTime).toBeLessThan(20);

      if (p99FrameTime >= 20) {
        throw new Error(
          `P99 frame time high: ${p99FrameTime.toFixed(2)}ms >= 20ms. Animation inconsistency introduced. Detects high variance/stuttering even if average FPS acceptable.`
        );
      }
    });

    it('should keep dropped frames below 1% threshold', () => {
      // Create 15 bars
      const bars = [];
      for (let i = 0; i < config.background.density.default; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Simulate 300 frames
      const iterations = 300;
      const delta = 0.016667; // ~60fps

      let timestamp = 0;
      for (let i = 0; i < iterations; i++) {
        timestamp += delta * 1000;
        perfMonitor.recordFrame();
        bars.forEach(bar => bar.update(delta));
      }

      // Calculate dropped frame percentage
      const stats = perfMonitor.getStats();
      const droppedFramePercent = (stats.droppedFrames / iterations) * 100;

      // Assert: droppedFramePercent < 1% (from CONTEXT.md threshold)
      expect(droppedFramePercent).toBeLessThan(1);

      if (droppedFramePercent >= 1) {
        throw new Error(
          `Dropped frames exceed threshold: ${droppedFramePercent.toFixed(2)}% >= 1%. ${stats.droppedFrames} frames dropped out of ${iterations}.`
        );
      }
    });
  });
});

/**
 * TEST MAINTENANCE
 *
 * Update baselines after audits complete:
 * 1. Run 03-03 alpha audit (provides memory and FPS baselines)
 * 2. Run 03-04 frame rate audit (provides P99 and dropped frame baselines)
 * 3. Read 03-03-SUMMARY.md and 03-04-SUMMARY.md for actual measurements
 * 4. Update TODO comments in Test 3, 4, 5 with real baseline values
 * 5. Adjust test thresholds if actual baselines differ significantly from estimates
 * 6. Update this header JSDoc with confirmed baselines
 *
 * When intentional performance changes made:
 * 1. Re-run audits after changes to establish new baselines
 * 2. Document new baselines in header JSDoc
 * 3. Adjust test thresholds if targets change
 * 4. Update config.performance.thresholds if streaming requirements change
 *
 * Skip flaky tests temporarily:
 * - Use it.skip() for tests failing inconsistently in CI
 * - Document reason: "Skipped: Xvfb memory reporting unreliable, see issue #123"
 * - Re-enable after CI environment improved
 *
 * Add new regression tests:
 * - Follow existing test structure (setup, simulate, assert)
 * - Use accelerated iteration (1000 cycles) not real-time delays
 * - Reference config.performance.thresholds for consistency
 * - Provide actionable error messages on failure
 */
