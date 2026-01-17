import { describe, it, expect, beforeEach } from 'vitest';
import { DeltaTimer } from './timing.js';

describe('DeltaTimer', () => {
  let timer;

  beforeEach(() => {
    timer = new DeltaTimer();
  });

  it('returns 0 on first update (no previous timestamp)', () => {
    const deltaTime = timer.update(1000);
    expect(deltaTime).toBe(0);
  });

  it('calculates delta-time in seconds', () => {
    timer.update(1000); // First frame
    const deltaTime = timer.update(1016.67); // 60fps = ~16.67ms

    // Should be approximately 0.01667 seconds
    expect(deltaTime).toBeCloseTo(0.01667, 4);
  });

  it('caps delta-time to prevent tab-switch jumps', () => {
    timer.update(1000); // First frame
    const deltaTime = timer.update(6000); // 5 second gap (tab switch)

    // Should be capped at 0.1 seconds
    expect(deltaTime).toBe(0.1);
  });

  it('handles 60Hz displays correctly', () => {
    const frameTimes = [0, 16.67, 33.34, 50.01]; // 60fps timestamps
    const deltas = [];

    for (const timestamp of frameTimes) {
      deltas.push(timer.update(timestamp));
    }

    // First frame is 0, rest should be ~0.01667 seconds
    expect(deltas[0]).toBe(0); // First call always returns 0
    expect(deltas[1]).toBeCloseTo(0.01667, 3); // 16.67ms between frames
    expect(deltas[2]).toBeCloseTo(0.01667, 3); // 16.67ms between frames
    expect(deltas[3]).toBeCloseTo(0.01667, 3); // 16.67ms between frames
  });

  it('handles 120Hz displays correctly', () => {
    const frameTimes = [0, 8.33, 16.66, 24.99]; // 120fps timestamps
    const deltas = [];

    for (const timestamp of frameTimes) {
      deltas.push(timer.update(timestamp));
    }

    // First frame is 0, rest should be ~0.00833 seconds
    expect(deltas[0]).toBe(0); // First call always returns 0
    expect(deltas[1]).toBeCloseTo(0.00833, 3); // 8.33ms between frames
    expect(deltas[2]).toBeCloseTo(0.00833, 3); // 8.33ms between frames
    expect(deltas[3]).toBeCloseTo(0.00833, 3); // 8.33ms between frames
  });

  it('resets to initial state', () => {
    timer.update(1000);
    timer.update(1016.67);

    timer.reset();

    const deltaTime = timer.update(2000);
    expect(deltaTime).toBe(0); // Acts like first frame again
  });

  it('handles consecutive frames with varying refresh rates', () => {
    timer.update(0); // First frame

    // Simulate varying frame times
    const delta1 = timer.update(16.67); // 16.67ms elapsed
    const delta2 = timer.update(25); // 8.33ms elapsed (25 - 16.67)
    const delta3 = timer.update(33.33); // 8.33ms elapsed (33.33 - 25)

    expect(delta1).toBeCloseTo(0.01667, 3); // ~16.67ms
    expect(delta2).toBeCloseTo(0.00833, 3); // ~8.33ms
    expect(delta3).toBeCloseTo(0.00833, 3); // ~8.33ms
  });
});
