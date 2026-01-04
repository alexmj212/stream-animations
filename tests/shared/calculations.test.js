import { describe, it, expect } from 'vitest';
import {
    calculateOpacity,
    calculateSizeMultiplier,
    calculateDirectionTransition,
    calculatePosition,
    shouldChangeDirection,
    calculateTransitionProgress,
    determineNextPhase,
    isBarInViewport
} from '../../src/shared/animations/calculations.js';

// Simple linear easing for testing
const linearEase = (t) => t;

// Cubic easing for testing
const cubicEase = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

describe('calculateOpacity', () => {
    it('should return 0 at start of fadeIn', () => {
        const opacity = calculateOpacity('fadeIn', 0, 120, 120, 0.7, linearEase);
        expect(opacity).toBe(0);
    });

    it('should return maxOpacity at end of fadeIn', () => {
        const opacity = calculateOpacity('fadeIn', 120, 120, 120, 0.7, linearEase);
        expect(opacity).toBeCloseTo(0.7, 5);
    });

    it('should return maxOpacity during visible phase', () => {
        const opacity = calculateOpacity('visible', 100, 120, 120, 0.7, linearEase);
        expect(opacity).toBe(0.7);
    });

    it('should return maxOpacity at start of fadeOut', () => {
        const opacity = calculateOpacity('fadeOut', 0, 120, 120, 0.7, linearEase);
        expect(opacity).toBe(0.7);
    });

    it('should return 0 at end of fadeOut', () => {
        const opacity = calculateOpacity('fadeOut', 120, 120, 120, 0.7, linearEase);
        expect(opacity).toBeCloseTo(0, 5);
    });

    it('should apply easing function during fadeIn', () => {
        const opacity = calculateOpacity('fadeIn', 60, 120, 120, 1.0, cubicEase);
        // With cubic easing, midpoint should be 0.5
        expect(opacity).toBeCloseTo(0.5, 1);
    });

    it('should handle different fade durations', () => {
        const opacity = calculateOpacity('fadeIn', 60, 60, 120, 0.5, linearEase);
        expect(opacity).toBeCloseTo(0.5, 5);
    });

    it('should clamp progress to 1', () => {
        const opacity = calculateOpacity('fadeIn', 150, 120, 120, 0.7, linearEase);
        expect(opacity).toBe(0.7);
    });
});

describe('calculateSizeMultiplier', () => {
    it('should return startMultiplier at beginning of visible phase', () => {
        const multiplier = calculateSizeMultiplier('visible', 0, 1800, 0.5, 1.5, linearEase);
        expect(multiplier).toBe(0.5);
    });

    it('should return endMultiplier at end of visible phase', () => {
        const multiplier = calculateSizeMultiplier('visible', 1800, 1800, 0.5, 1.5, linearEase);
        expect(multiplier).toBe(1.5);
    });

    it('should interpolate linearly with linear easing', () => {
        const multiplier = calculateSizeMultiplier('visible', 900, 1800, 0.5, 1.5, linearEase);
        expect(multiplier).toBeCloseTo(1.0, 5); // Midpoint between 0.5 and 1.5
    });

    it('should return startMultiplier during fadeIn', () => {
        const multiplier = calculateSizeMultiplier('fadeIn', 60, 1800, 0.5, 1.5, linearEase);
        expect(multiplier).toBe(0.5);
    });

    it('should return endMultiplier during fadeOut', () => {
        const multiplier = calculateSizeMultiplier('fadeOut', 60, 1800, 0.5, 1.5, linearEase);
        expect(multiplier).toBe(1.5);
    });

    it('should handle shrinking (endMultiplier < startMultiplier)', () => {
        const multiplier = calculateSizeMultiplier('visible', 900, 1800, 1.5, 0.5, linearEase);
        expect(multiplier).toBeCloseTo(1.0, 5);
    });

    it('should apply easing function', () => {
        const multiplier = calculateSizeMultiplier('visible', 900, 1800, 0.5, 1.5, cubicEase);
        expect(multiplier).toBeCloseTo(1.0, 1); // With cubic, midpoint is still ~1.0
    });
});

describe('calculateDirectionTransition', () => {
    it('should return oldDirection at start of transition', () => {
        const direction = calculateDirectionTransition(0, 1, -1, linearEase);
        expect(direction).toBe(1);
    });

    it('should return newDirection at end of transition', () => {
        const direction = calculateDirectionTransition(1, 1, -1, linearEase);
        expect(direction).toBe(-1);
    });

    it('should interpolate at midpoint', () => {
        const direction = calculateDirectionTransition(0.5, 1, -1, linearEase);
        expect(direction).toBeCloseTo(0, 5);
    });

    it('should return newDirection when progress exceeds 1', () => {
        const direction = calculateDirectionTransition(1.5, 1, -1, linearEase);
        expect(direction).toBe(-1);
    });

    it('should handle reverse transition (-1 to 1)', () => {
        const direction = calculateDirectionTransition(0.5, -1, 1, linearEase);
        expect(direction).toBeCloseTo(0, 5);
    });

    it('should apply easing function', () => {
        const direction = calculateDirectionTransition(0.25, 1, -1, cubicEase);
        // With cubic easing, early progress is slower
        expect(direction).toBeGreaterThan(0);
        expect(direction).toBeLessThan(1);
    });
});

describe('calculatePosition', () => {
    it('should move right with positive direction', () => {
        const newPos = calculatePosition(100, 5, 1);
        expect(newPos).toBe(105);
    });

    it('should move left with negative direction', () => {
        const newPos = calculatePosition(100, 5, -1);
        expect(newPos).toBe(95);
    });

    it('should handle zero speed', () => {
        const newPos = calculatePosition(100, 0, 1);
        expect(newPos).toBe(100);
    });

    it('should handle fractional speed', () => {
        const newPos = calculatePosition(100, 0.5, 1);
        expect(newPos).toBe(100.5);
    });

    it('should handle fractional direction (during transition)', () => {
        const newPos = calculatePosition(100, 5, 0.5);
        expect(newPos).toBe(102.5);
    });

    it('should handle negative position', () => {
        const newPos = calculatePosition(-50, 5, 1);
        expect(newPos).toBe(-45);
    });

    it('should handle large positions', () => {
        const newPos = calculatePosition(10000, 5, 1);
        expect(newPos).toBe(10005);
    });
});

describe('shouldChangeDirection', () => {
    it('should return false when no changes scheduled', () => {
        const result = shouldChangeDirection(100, [], 0);
        expect(result).toBe(false);
    });

    it('should return false when before first change', () => {
        const result = shouldChangeDirection(50, [100, 200], 0);
        expect(result).toBe(false);
    });

    it('should return true at exact change frame', () => {
        const result = shouldChangeDirection(100, [100, 200], 0);
        expect(result).toBe(true);
    });

    it('should return true after change frame', () => {
        const result = shouldChangeDirection(150, [100, 200], 0);
        expect(result).toBe(true);
    });

    it('should return false when all changes consumed', () => {
        const result = shouldChangeDirection(250, [100, 200], 2);
        expect(result).toBe(false);
    });

    it('should check correct index for multiple changes', () => {
        const result = shouldChangeDirection(150, [100, 200, 300], 1);
        expect(result).toBe(false);
    });

    it('should return true for second change', () => {
        const result = shouldChangeDirection(200, [100, 200, 300], 1);
        expect(result).toBe(true);
    });
});

describe('calculateTransitionProgress', () => {
    it('should return 0 at start of transition', () => {
        const progress = calculateTransitionProgress(100, 100, 180);
        expect(progress).toBe(0);
    });

    it('should return 0.5 at midpoint', () => {
        const progress = calculateTransitionProgress(190, 100, 180);
        expect(progress).toBeCloseTo(0.5, 5);
    });

    it('should return 1 at end of transition', () => {
        const progress = calculateTransitionProgress(280, 100, 180);
        expect(progress).toBeCloseTo(1, 5);
    });

    it('should exceed 1 after transition completes', () => {
        const progress = calculateTransitionProgress(300, 100, 180);
        expect(progress).toBeGreaterThan(1);
    });

    it('should handle different durations', () => {
        const progress = calculateTransitionProgress(150, 100, 100);
        expect(progress).toBe(0.5);
    });
});

describe('determineNextPhase', () => {
    it('should stay in fadeIn when not complete', () => {
        const result = determineNextPhase('fadeIn', 60, 120, 1800, 120);
        expect(result).toEqual({ phase: 'fadeIn', frame: 60 });
    });

    it('should transition from fadeIn to visible', () => {
        const result = determineNextPhase('fadeIn', 120, 120, 1800, 120);
        expect(result).toEqual({ phase: 'visible', frame: 0 });
    });

    it('should stay in visible when not complete', () => {
        const result = determineNextPhase('visible', 900, 120, 1800, 120);
        expect(result).toEqual({ phase: 'visible', frame: 900 });
    });

    it('should transition from visible to fadeOut', () => {
        const result = determineNextPhase('visible', 1800, 120, 1800, 120);
        expect(result).toEqual({ phase: 'fadeOut', frame: 0 });
    });

    it('should stay in fadeOut when not complete', () => {
        const result = determineNextPhase('fadeOut', 60, 120, 1800, 120);
        expect(result).toEqual({ phase: 'fadeOut', frame: 60 });
    });

    it('should transition from fadeOut to complete', () => {
        const result = determineNextPhase('fadeOut', 120, 120, 1800, 120);
        expect(result).toEqual({ phase: 'complete', frame: 0 });
    });

    it('should handle varying duration values', () => {
        const result = determineNextPhase('fadeIn', 60, 60, 3600, 240);
        expect(result).toEqual({ phase: 'visible', frame: 0 });
    });
});

describe('isBarInViewport', () => {
    const canvasWidth = 1920;
    const canvasHeight = 1080;

    it('should return true for bar in center of viewport', () => {
        const result = isBarInViewport(800, 500, 200, 100, canvasWidth, canvasHeight);
        expect(result).toBe(true);
    });

    it('should return false for bar completely to the left', () => {
        const result = isBarInViewport(-500, 500, 200, 100, canvasWidth, canvasHeight);
        expect(result).toBe(false);
    });

    it('should return false for bar completely to the right', () => {
        const result = isBarInViewport(2500, 500, 200, 100, canvasWidth, canvasHeight);
        expect(result).toBe(false);
    });

    it('should return false for bar completely above', () => {
        const result = isBarInViewport(800, -500, 200, 100, canvasWidth, canvasHeight);
        expect(result).toBe(false);
    });

    it('should return false for bar completely below', () => {
        const result = isBarInViewport(800, 1500, 200, 100, canvasWidth, canvasHeight);
        expect(result).toBe(false);
    });

    it('should return true for partially visible bar on left edge', () => {
        const result = isBarInViewport(-50, 500, 200, 100, canvasWidth, canvasHeight);
        expect(result).toBe(true);
    });

    it('should return true for partially visible bar on right edge', () => {
        const result = isBarInViewport(1850, 500, 200, 100, canvasWidth, canvasHeight);
        expect(result).toBe(true);
    });

    it('should use margin for culling decision', () => {
        const result = isBarInViewport(-150, 500, 200, 100, canvasWidth, canvasHeight, 100);
        expect(result).toBe(true); // Within margin
    });

    it('should reject bars beyond margin', () => {
        const result = isBarInViewport(-400, 500, 200, 100, canvasWidth, canvasHeight, 100);
        expect(result).toBe(false);
    });

    it('should handle custom margin values', () => {
        const result = isBarInViewport(-250, 500, 200, 100, canvasWidth, canvasHeight, 300);
        expect(result).toBe(true);
    });

    it('should handle bars larger than viewport', () => {
        const result = isBarInViewport(-100, -100, 3000, 2000, canvasWidth, canvasHeight);
        expect(result).toBe(true);
    });
});
