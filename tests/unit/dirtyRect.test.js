/**
 * Unit tests for dirty rectangle tracking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DirtyRectTracker } from '../../src/shared/dirtyRect.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('DirtyRectTracker', () => {
    let tracker;

    beforeEach(() => {
        tracker = new DirtyRectTracker(5, false); // safetyMargin=5, visualize=false
    });

    describe('Basic region tracking', () => {
        it('should store region with safety margin expansion', () => {
            tracker.addRegion(100, 100, 50, 50);

            const stats = tracker.getStats();
            expect(stats.regionCount).toBe(1);

            // Verify safety margin applied (not directly accessible, check via merged regions)
            const merged = tracker.getMergedRegions();
            expect(merged.length).toBe(1);
            expect(merged[0]).toEqual({
                x: 95,  // 100 - 5
                y: 95,  // 100 - 5
                width: 60,  // 50 + 5*2
                height: 60  // 50 + 5*2
            });
        });

        it('should track multiple separate regions', () => {
            tracker.addRegion(0, 0, 50, 50);
            tracker.addRegion(200, 200, 50, 50);

            const stats = tracker.getStats();
            expect(stats.regionCount).toBe(2);
        });
    });

    describe('Region merging - non-overlapping', () => {
        it('should not merge regions that are far apart', () => {
            tracker.addRegion(0, 0, 50, 50);      // Region 1: x=0-50, y=0-50 (before safety)
            tracker.addRegion(500, 500, 50, 50);  // Region 2: x=500-550, y=500-550 (before safety)

            const merged = tracker.getMergedRegions();
            expect(merged.length).toBe(2); // Should remain separate
        });

        it('should return empty array when no regions', () => {
            const merged = tracker.getMergedRegions();
            expect(merged).toEqual([]);
        });

        it('should return single region unchanged', () => {
            tracker.addRegion(100, 100, 50, 50);

            const merged = tracker.getMergedRegions();
            expect(merged.length).toBe(1);
            expect(merged[0]).toEqual({
                x: 95,
                y: 95,
                width: 60,
                height: 60
            });
        });
    });

    describe('Region merging - overlapping', () => {
        it('should merge two overlapping regions into bounding box', () => {
            // Two overlapping rectangles
            tracker.addRegion(0, 0, 100, 100);    // After safety: x=-5, y=-5, w=110, h=110
            tracker.addRegion(50, 0, 100, 100);   // After safety: x=45, y=-5, w=110, h=110

            const merged = tracker.getMergedRegions();
            expect(merged.length).toBe(1); // Should merge into one

            // Merged region should cover both: x=-5 to x=155 (45+110), y=-5 to y=105
            expect(merged[0]).toEqual({
                x: -5,
                y: -5,
                width: 160,  // 155 - (-5)
                height: 110
            });
        });

        it('should merge multiple overlapping regions', () => {
            // Create 10 overlapping regions in a small area
            for (let i = 0; i < 10; i++) {
                tracker.addRegion(i * 10, 0, 50, 50);
            }

            const stats = tracker.getStats();
            expect(stats.regionCount).toBe(10);

            const merged = tracker.getMergedRegions();
            expect(merged.length).toBeLessThan(10); // Should merge some regions
        });

        it('should merge 10 overlapping bars into 1-2 regions', () => {
            // Simulate 10 bars in small area (as per plan verification)
            for (let i = 0; i < 10; i++) {
                tracker.addRegion(100 + i * 5, 100 + i * 5, 80, 200);
            }

            const merged = tracker.getMergedRegions();
            expect(merged.length).toBeGreaterThanOrEqual(1);
            expect(merged.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Safety margin application', () => {
        it('should expand region by safety margin in all directions', () => {
            const trackerWithMargin = new DirtyRectTracker(5, false);
            trackerWithMargin.addRegion(100, 100, 50, 50);

            const merged = trackerWithMargin.getMergedRegions();
            expect(merged[0]).toEqual({
                x: 95,   // 100 - 5
                y: 95,   // 100 - 5
                width: 60,   // 50 + 5*2
                height: 60   // 50 + 5*2
            });
        });

        it('should use custom safety margin', () => {
            const trackerLargeMargin = new DirtyRectTracker(10, false);
            trackerLargeMargin.addRegion(100, 100, 50, 50);

            const merged = trackerLargeMargin.getMergedRegions();
            expect(merged[0]).toEqual({
                x: 90,   // 100 - 10
                y: 90,   // 100 - 10
                width: 70,   // 50 + 10*2
                height: 70   // 50 + 10*2
            });
        });
    });

    describe('Clear and reset', () => {
        it('should call clearRect for each merged region', () => {
            const canvas = createMockCanvas();
            const ctx = createMockContext(canvas);
            const clearRectSpy = vi.spyOn(ctx, 'clearRect');

            tracker.addRegion(0, 0, 100, 100);
            tracker.addRegion(200, 200, 100, 100);

            tracker.clearAndReset(ctx);

            // Should call clearRect twice (two non-overlapping regions)
            expect(clearRectSpy).toHaveBeenCalledTimes(2);
        });

        it('should reset regions array after clearing', () => {
            const canvas = createMockCanvas();
            const ctx = createMockContext(canvas);

            tracker.addRegion(0, 0, 100, 100);
            tracker.addRegion(200, 200, 100, 100);

            expect(tracker.getStats().regionCount).toBe(2);

            tracker.clearAndReset(ctx);

            // Regions should be cleared
            expect(tracker.getStats().regionCount).toBe(0);
        });

        it('should draw visualization when enabled', () => {
            const canvas = createMockCanvas();
            const ctx = createMockContext(canvas);
            const strokeRectSpy = vi.spyOn(ctx, 'strokeRect');
            const saveSpy = vi.spyOn(ctx, 'save');
            const restoreSpy = vi.spyOn(ctx, 'restore');

            const visualTracker = new DirtyRectTracker(5, true); // visualize=true
            visualTracker.setCanvas(canvas, ctx);
            visualTracker.addRegion(0, 0, 100, 100);

            visualTracker.clearAndReset(ctx);

            // Should draw red debug outline
            expect(saveSpy).toHaveBeenCalled();
            expect(strokeRectSpy).toHaveBeenCalled();
            expect(restoreSpy).toHaveBeenCalled();
        });
    });

    describe('Stats reporting', () => {
        it('should report correct region count and merged count', () => {
            // Add 10 regions that merge to fewer
            for (let i = 0; i < 10; i++) {
                tracker.addRegion(i * 10, 0, 50, 50);
            }

            const stats = tracker.getStats();
            expect(stats.regionCount).toBe(10);
            expect(stats.mergedCount).toBeLessThan(10);
            expect(stats.mergedCount).toBeGreaterThan(0);
        });

        it('should handle empty tracker', () => {
            const stats = tracker.getStats();
            expect(stats.regionCount).toBe(0);
            expect(stats.mergedCount).toBe(0);
        });
    });

    describe('Reset functionality', () => {
        it('should clear regions without clearing canvas', () => {
            const canvas = createMockCanvas();
            const ctx = createMockContext(canvas);
            const clearRectSpy = vi.spyOn(ctx, 'clearRect');

            tracker.addRegion(0, 0, 100, 100);
            tracker.reset();

            // Should not call clearRect
            expect(clearRectSpy).not.toHaveBeenCalled();

            // Should clear regions
            expect(tracker.getStats().regionCount).toBe(0);
        });
    });
});
