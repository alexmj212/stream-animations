import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { DeltaTimer } from '../../src/shared/timing.js';

describe('DeltaTimer', () => {
  describe('Property-based tests', () => {
    test.prop([
      fc.integer({ min: 0, max: 10000 }),  // timestamp1 (ms)
      fc.integer({ min: 0, max: 10000 })   // timestamp2 (ms)
    ], { seed: 42, numRuns: 100 })(
      'delta time is always non-negative',
      (t1, t2) => {
        const timer = new DeltaTimer();
        timer.update(t1);
        const delta = timer.update(t2);
        expect(delta).toBeGreaterThanOrEqual(0);
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 1000 }),   // initial timestamp
      fc.integer({ min: 200, max: 10000 }) // large delta (>100ms)
    ], { seed: 43, numRuns: 100 })(
      'large deltas are capped at 0.1 seconds',
      (t1, t2) => {
        const timer = new DeltaTimer();
        timer.update(t1);
        const delta = timer.update(t1 + t2);
        expect(delta).toBeLessThanOrEqual(0.1);
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 10000 })  // timestamp
    ], { seed: 44, numRuns: 100 })(
      'null initialization returns 0 on first call',
      (timestamp) => {
        const timer = new DeltaTimer();
        const firstDelta = timer.update(timestamp);
        expect(firstDelta).toBe(0);
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 10000 }),  // timestamp1
      fc.integer({ min: 0, max: 100 })     // delta (ms)
    ], { seed: 45, numRuns: 100 })(
      'handles timestamp=0 correctly with null initialization',
      (t1, delta) => {
        const timer = new DeltaTimer();
        // First call with 0
        const firstDelta = timer.update(0);
        expect(firstDelta).toBe(0);

        // Second call should work normally
        const secondDelta = timer.update(delta);
        expect(secondDelta).toBeGreaterThanOrEqual(0);
        expect(secondDelta).toBeLessThanOrEqual(0.1);
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 10000 }),  // base timestamp
      fc.integer({ min: 1, max: 100 }),    // delta1 (ms)
      fc.integer({ min: 1, max: 100 })     // delta2 (ms)
    ], { seed: 46, numRuns: 100 })(
      'consecutive calls return consistent deltas',
      (base, delta1, delta2) => {
        const timer = new DeltaTimer();

        // Initialize
        timer.update(base);

        // First delta
        const firstDelta = timer.update(base + delta1);
        expect(firstDelta).toBeCloseTo(delta1 / 1000, 5);

        // Second delta
        const secondDelta = timer.update(base + delta1 + delta2);
        expect(secondDelta).toBeCloseTo(delta2 / 1000, 5);
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 10000 }),  // timestamp1
      fc.integer({ min: 0, max: 10000 })   // timestamp2
    ], { seed: 47, numRuns: 100 })(
      'reset() clears state and next call returns 0',
      (t1, t2) => {
        const timer = new DeltaTimer();

        // Prime the timer
        timer.update(t1);
        timer.update(t1 + 1000);

        // Reset
        timer.reset();

        // Next call should return 0 (like initialization)
        const delta = timer.update(t2);
        expect(delta).toBe(0);
      }
    );

    test.prop([
      fc.integer({ min: 1, max: 10000 }),  // base timestamp
      fc.integer({ min: -1000, max: -1 })  // negative delta (time goes backwards)
    ], { seed: 48, numRuns: 100 })(
      'backwards time results in zero delta (not negative)',
      (base, negativeDelta) => {
        const timer = new DeltaTimer();
        timer.update(base);
        const delta = timer.update(base + negativeDelta);
        expect(delta).toBeGreaterThanOrEqual(0);
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 10000 }),  // timestamp
      fc.integer({ min: 0, max: 50 })      // small delta (ms)
    ], { seed: 49, numRuns: 100 })(
      'small deltas are not capped (under 100ms)',
      (base, smallDelta) => {
        const timer = new DeltaTimer();
        timer.update(base);
        const delta = timer.update(base + smallDelta);

        // Should be exactly the small delta in seconds
        expect(delta).toBeCloseTo(smallDelta / 1000, 5);
        expect(delta).toBeLessThanOrEqual(0.1);
      }
    );
  });
});
