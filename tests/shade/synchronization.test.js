import { describe, it, expect, beforeEach } from 'vitest';
import { CurtainBar } from '../../src/shade/CurtainBar.js';
import { ShadeBar } from '../../src/shade/ShadeBar.js';
import { config } from '../../src/config/config.js';

/**
 * Synchronization tests for curtain and text timing coordination
 *
 * These tests validate that:
 * - All components share the same total duration
 * - Components activate and deactivate simultaneously
 * - Phase transitions occur at correct timing boundaries
 * - Curtains meet exactly at centerline during hold phase
 */

describe('CurtainBar and ShadeBar Synchronization', () => {
  let canvas, ctx;

  beforeEach(() => {
    // Create mock canvas and context
    canvas = {
      width: 1920,
      height: 1080,
      getContext: () => ctx
    };

    // Mock 2D rendering context with essential methods
    ctx = {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 800 }),
      createLinearGradient: () => ({
        addColorStop: () => {}
      }),
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      // Properties that need to be settable
      fillStyle: '',
      globalAlpha: 1,
      font: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0
    };
  });

  describe('Shared Duration', () => {
    it('should give all components the same total duration', () => {
      const text = 'Test message for synchronization';
      const holdDurationMs = ShadeBar.calculateHoldDuration(text);
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

      const baseHSL = { h: 220, s: 79, l: 64 }; // Discord blurple

      const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
      const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
      const shadeBar = new ShadeBar(ctx, canvas, text, holdDurationMs);
      shadeBar.init(); // Initialize text metrics

      // All components should share the same total duration
      expect(topCurtain.totalDurationMs).toBe(totalDurationMs);
      expect(bottomCurtain.totalDurationMs).toBe(totalDurationMs);
      expect(shadeBar.totalDurationMs).toBe(totalDurationMs);
    });
  });

  describe('Simultaneous Activation', () => {
    it('should start with all components active', () => {
      const text = 'Test message';
      const holdDurationMs = ShadeBar.calculateHoldDuration(text);
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

      const baseHSL = { h: 220, s: 79, l: 64 };

      const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
      const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
      const shadeBar = new ShadeBar(ctx, canvas, text, holdDurationMs);
      shadeBar.init();

      // All components should start active
      expect(topCurtain.active).toBe(true);
      expect(bottomCurtain.active).toBe(true);
      expect(shadeBar.active).toBe(true);
    });

    it('should remain active during animation', () => {
      const text = 'Test';
      const holdDurationMs = ShadeBar.calculateHoldDuration(text);
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

      const baseHSL = { h: 220, s: 79, l: 64 };

      const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
      const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
      const shadeBar = new ShadeBar(ctx, canvas, text, holdDurationMs);
      shadeBar.init();

      // Simulate time progression (halfway through animation)
      const halfDuration = totalDurationMs / 2000; // Convert to seconds
      topCurtain.update(halfDuration);
      bottomCurtain.update(halfDuration);
      shadeBar.update(halfDuration);

      // All should still be active
      expect(topCurtain.active).toBe(true);
      expect(bottomCurtain.active).toBe(true);
      expect(shadeBar.active).toBe(true);
    });
  });

  describe('Simultaneous Deactivation', () => {
    it('should deactivate all components at the same time', () => {
      // Use short duration for faster test
      const text = 'Hi'; // 2 words = 400ms, but minHoldMs = 3000ms
      const holdDurationMs = ShadeBar.calculateHoldDuration(text); // Should be 3000ms (minimum)
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;
      // Total: 1000 + 3000 + 1000 = 5000ms = 5 seconds

      const baseHSL = { h: 220, s: 79, l: 64 };

      const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
      const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
      const shadeBar = new ShadeBar(ctx, canvas, text, holdDurationMs);
      shadeBar.init();

      // Simulate frame-by-frame updates to advance past total duration
      const deltaTime = 0.1; // 100ms per frame
      const totalDurationSec = totalDurationMs / 1000;
      const frameCount = Math.ceil(totalDurationSec / deltaTime) + 2; // +2 to go past duration

      for (let i = 0; i < frameCount; i++) {
        topCurtain.update(deltaTime);
        bottomCurtain.update(deltaTime);
        shadeBar.update(deltaTime);
      }

      // All should be inactive now
      expect(topCurtain.active).toBe(false);
      expect(bottomCurtain.active).toBe(false);
      expect(shadeBar.active).toBe(false);
    });

    it('should handle frame-by-frame updates and finish together', () => {
      const text = 'Quick';
      const holdDurationMs = ShadeBar.calculateHoldDuration(text);
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

      const baseHSL = { h: 220, s: 79, l: 64 };

      const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
      const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
      const shadeBar = new ShadeBar(ctx, canvas, text, holdDurationMs);
      shadeBar.init();

      // Simulate frame-by-frame updates at 60fps (16.67ms per frame)
      const deltaTime = 16.67 / 1000; // Convert to seconds
      const totalDurationSec = totalDurationMs / 1000;
      const frameCount = Math.ceil(totalDurationSec / deltaTime);

      let allActiveCount = 0;
      let allInactiveCount = 0;

      for (let i = 0; i < frameCount + 10; i++) {
        topCurtain.update(deltaTime);
        bottomCurtain.update(deltaTime);
        shadeBar.update(deltaTime);

        const allActive = topCurtain.active && bottomCurtain.active && shadeBar.active;
        const allInactive = !topCurtain.active && !bottomCurtain.active && !shadeBar.active;

        if (allActive) allActiveCount++;
        if (allInactive) allInactiveCount++;
      }

      // All should transition from active to inactive together
      expect(allActiveCount).toBeGreaterThan(0); // Were active during animation
      expect(allInactiveCount).toBeGreaterThan(0); // All became inactive together
    });
  });

  describe('Phase Transitions', () => {
    it('should transition curtain phases at correct times', () => {
      const holdDurationMs = 3000; // 3 seconds
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;
      // Total: 1000 + 3000 + 1000 = 5000ms

      const baseHSL = { h: 220, s: 79, l: 64 };
      const curtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);

      // Curtains close in the first half of the entry and open in the last
      // half of the exit (config.shade.curtainMoveShare = 0.5)
      expect(curtain.phase).toBe('enter');

      curtain.setTime(0.25);
      expect(curtain.phase).toBe('enter');

      // Band closed at 0.5s, before the text is fully in
      curtain.setTime(0.5);
      expect(curtain.phase).toBe('hold');

      // Still closed at 4.4s while the text exits
      curtain.setTime(4.4);
      expect(curtain.phase).toBe('hold');

      curtain.setTime(4.5);
      expect(curtain.phase).toBe('exit');

      curtain.setTime(5.0);
      expect(curtain.active).toBe(false);
    });
  });

  describe('Centerline Meeting', () => {
    it('should have curtains overlap slightly at centerline during hold phase', () => {
      const holdDurationMs = 3000;
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

      const baseHSL = { h: 220, s: 79, l: 64 };

      const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
      const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);

      // Advance to hold phase (1 second to get through enter)
      topCurtain.update(1.0);
      bottomCurtain.update(1.0);

      // Both should be in hold phase
      expect(topCurtain.phase).toBe('hold');
      expect(bottomCurtain.phase).toBe('hold');

      // Check positions - curtains intentionally overlap by 2 * overshoot (8px total)
      // to prevent gaps during animation
      const topBottom = topCurtain.y + topCurtain.targetHeight;
      const bottomTop = bottomCurtain.y;

      // Top curtain extends 4px past center, bottom curtain starts 4px before center
      // This creates 8px overlap to guarantee no gaps
      expect(topBottom).toBe(canvas.height / 2 + 4); // 4px past centerline
      expect(bottomTop).toBe(canvas.height / 2 - 4); // 4px before centerline
    });

    it('should have correct target heights with intentional overlap', () => {
      const holdDurationMs = 3000;
      const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

      const baseHSL = { h: 220, s: 79, l: 64 };

      const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
      const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);

      // Each curtain covers half the viewport PLUS 4px overshoot
      // This ensures no gaps appear during animation
      expect(topCurtain.targetHeight).toBe(canvas.height / 2 + 4); // 544px (540 + 4)
      expect(bottomCurtain.targetHeight).toBe(canvas.height / 2 + 4); // 544px (540 + 4)

      // Together they cover MORE than the full viewport (intentional 8px overlap)
      expect(topCurtain.targetHeight + bottomCurtain.targetHeight).toBe(canvas.height + 8); // 1088px (1080 + 8)
    });
  });
});
