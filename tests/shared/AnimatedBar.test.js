import { describe, it, expect, vi } from 'vitest';
import { AnimatedBar } from '../../src/shared/AnimatedBar.js';

describe('AnimatedBar', () => {
    describe('constructor', () => {
        it('should initialize with default random function', () => {
            const mockCtx = {};
            const mockCanvas = { width: 1920, height: 1080 };
            const bar = new AnimatedBar(mockCtx, mockCanvas, 'slanted');

            expect(bar.ctx).toBe(mockCtx);
            expect(bar.canvas).toBe(mockCanvas);
            expect(bar.type).toBe('slanted');
            expect(bar.active).toBe(true);
            expect(typeof bar.random).toBe('function');
        });

        it('should accept custom random function', () => {
            const mockCtx = {};
            const mockCanvas = { width: 1920, height: 1080 };
            const customRandom = vi.fn(() => 0.5);
            const bar = new AnimatedBar(mockCtx, mockCanvas, 'horizontal', { random: customRandom });

            expect(bar.random).toBe(customRandom);
        });
    });

    describe('easeInOutCubic', () => {
        let bar;

        beforeEach(() => {
            const mockCtx = {};
            const mockCanvas = { width: 1920, height: 1080 };
            bar = new AnimatedBar(mockCtx, mockCanvas, 'slanted');
        });

        it('should return 0 at start (t=0)', () => {
            expect(bar.easeInOutCubic(0)).toBe(0);
        });

        it('should return 1 at end (t=1)', () => {
            expect(bar.easeInOutCubic(1)).toBe(1);
        });

        it('should return 0.5 at midpoint (t=0.5)', () => {
            expect(bar.easeInOutCubic(0.5)).toBe(0.5);
        });

        it('should ease in during first half (t < 0.5)', () => {
            const t = 0.25;
            const result = bar.easeInOutCubic(t);
            // Cubic ease should be slower at start
            expect(result).toBeLessThan(t);
            expect(result).toBeGreaterThan(0);
        });

        it('should ease out during second half (t > 0.5)', () => {
            const t = 0.75;
            const result = bar.easeInOutCubic(t);
            // Cubic ease should be faster near end
            expect(result).toBeGreaterThan(t);
            expect(result).toBeLessThan(1);
        });

        it('should be smooth and continuous', () => {
            const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
            const results = steps.map(t => bar.easeInOutCubic(t));

            // Results should be monotonically increasing
            for (let i = 1; i < results.length; i++) {
                expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
            }
        });

        it('should handle edge case near 0', () => {
            const result = bar.easeInOutCubic(0.001);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(0.001);
        });

        it('should handle edge case near 1', () => {
            const result = bar.easeInOutCubic(0.999);
            expect(result).toBeGreaterThan(0.999);
            expect(result).toBeLessThanOrEqual(1);
        });

        it('should be symmetric around 0.5', () => {
            const t1 = 0.25;
            const t2 = 0.75;
            const result1 = bar.easeInOutCubic(t1);
            const result2 = bar.easeInOutCubic(t2);

            // Distance from 0.5 should be equal
            expect(Math.abs(result1 - 0.5)).toBeCloseTo(Math.abs(result2 - 0.5), 10);
        });
    });
});
