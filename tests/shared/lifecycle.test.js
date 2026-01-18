import { test, fc } from '@fast-check/vitest';
import { describe, expect, vi, beforeEach } from 'vitest';
import { AnimationLifecycle } from '../../src/shared/lifecycle.js';

describe('AnimationLifecycle', () => {
  describe('Property-based tests', () => {
    test.prop([
      fc.integer({ min: 0, max: 20 }) // number of listeners
    ], { seed: 46, numRuns: 100 })(
      'all event listeners are removed on cleanup',
      (listenerCount) => {
        const lifecycle = new AnimationLifecycle();
        const mockElement = {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        };

        // Add multiple listeners
        for (let i = 0; i < listenerCount; i++) {
          const handler = vi.fn();
          lifecycle.addEventListener(mockElement, `event${i}`, handler);
        }

        // Verify addEventListener was called correct number of times
        expect(mockElement.addEventListener).toHaveBeenCalledTimes(listenerCount);

        // Cleanup should abort the controller (which removes all listeners)
        lifecycle.cleanup();

        // Verify AbortController signal is aborted
        expect(lifecycle.signal.aborted).toBe(true);
      }
    );

    test.prop([
      fc.integer({ min: 1, max: 5 }) // number of cleanup calls
    ], { seed: 47, numRuns: 100 })(
      'multiple cleanup calls are idempotent',
      (cleanupCount) => {
        const lifecycle = new AnimationLifecycle();
        const mockElement = {
          addEventListener: vi.fn()
        };

        lifecycle.addEventListener(mockElement, 'test', () => {});

        // Call cleanup multiple times
        for (let i = 0; i < cleanupCount; i++) {
          expect(() => lifecycle.cleanup()).not.toThrow();
        }

        // Signal should be aborted
        expect(lifecycle.signal.aborted).toBe(true);
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 10 }) // number of cleanup callbacks
    ], { seed: 48, numRuns: 100 })(
      'all cleanup callbacks are executed',
      (callbackCount) => {
        const lifecycle = new AnimationLifecycle();
        const callbacks = [];

        // Register cleanup callbacks
        for (let i = 0; i < callbackCount; i++) {
          const callback = vi.fn();
          callbacks.push(callback);
          lifecycle.onCleanup(callback);
        }

        // Cleanup should execute all callbacks
        lifecycle.cleanup();

        // Verify all callbacks were called
        callbacks.forEach(callback => {
          expect(callback).toHaveBeenCalledTimes(1);
        });
      }
    );

    test.prop([
      fc.array(fc.tuple(fc.string(), fc.string()), { minLength: 1, maxLength: 10 }) // (element, event) pairs
    ], { seed: 49, numRuns: 100 })(
      'addEventListener passes signal to native addEventListener',
      (eventPairs) => {
        const lifecycle = new AnimationLifecycle();
        const mockElements = eventPairs.map(() => ({
          addEventListener: vi.fn()
        }));

        // Add listeners
        eventPairs.forEach(([_elementId, event], i) => {
          lifecycle.addEventListener(mockElements[i], event, () => {});
        });

        // Verify signal was passed to each addEventListener call
        mockElements.forEach(element => {
          expect(element.addEventListener).toHaveBeenCalledTimes(1);
          const call = element.addEventListener.mock.calls[0];
          expect(call[2]).toHaveProperty('signal');
          expect(call[2].signal).toBe(lifecycle.signal);
        });
      }
    );

    test.prop([
      fc.integer({ min: 0, max: 5 }) // number of callbacks that throw
    ], { seed: 50, numRuns: 100 })(
      'cleanup handles errors in cleanup callbacks gracefully',
      (errorCount) => {
        const lifecycle = new AnimationLifecycle();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Add some callbacks that throw errors
        for (let i = 0; i < errorCount; i++) {
          lifecycle.onCleanup(() => {
            throw new Error(`Error ${i}`);
          });
        }

        // Add a callback that doesn't throw
        const successCallback = vi.fn();
        lifecycle.onCleanup(successCallback);

        // Cleanup should not throw despite errors
        expect(() => lifecycle.cleanup()).not.toThrow();

        // Success callback should still be called
        expect(successCallback).toHaveBeenCalledTimes(1);

        // Errors should be logged
        if (errorCount > 0) {
          expect(consoleErrorSpy).toHaveBeenCalledTimes(errorCount);
        }

        consoleErrorSpy.mockRestore();
      }
    );

    test.prop([
      fc.integer({ min: 1, max: 10 }) // number of listeners
    ], { seed: 51, numRuns: 100 })(
      'addEventListener merges options with signal',
      (listenerCount) => {
        const lifecycle = new AnimationLifecycle();
        const mockElements = Array.from({ length: listenerCount }, () => ({
          addEventListener: vi.fn()
        }));

        // Add listeners with custom options
        mockElements.forEach((element, i) => {
          lifecycle.addEventListener(element, 'click', () => {}, {
            capture: true,
            once: i % 2 === 0 // Alternate between true and false
          });
        });

        // Verify options were merged with signal
        mockElements.forEach((element, i) => {
          const call = element.addEventListener.mock.calls[0];
          const options = call[2];

          expect(options.signal).toBe(lifecycle.signal);
          expect(options.capture).toBe(true);
          expect(options.once).toBe(i % 2 === 0);
        });
      }
    );
  });

  describe('Integration tests', () => {
    it('creates lifecycle with AbortController', () => {
      const lifecycle = new AnimationLifecycle();

      expect(lifecycle.controller).toBeInstanceOf(AbortController);
      expect(lifecycle.signal).toBeInstanceOf(AbortSignal);
      expect(lifecycle.signal.aborted).toBe(false);
    });

    it('addEventListener adds listener with signal', () => {
      const lifecycle = new AnimationLifecycle();
      const mockElement = {
        addEventListener: vi.fn()
      };
      const handler = vi.fn();

      lifecycle.addEventListener(mockElement, 'click', handler);

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'click',
        handler,
        expect.objectContaining({ signal: lifecycle.signal })
      );
    });

    it('cleanup aborts controller', () => {
      const lifecycle = new AnimationLifecycle();

      expect(lifecycle.signal.aborted).toBe(false);

      lifecycle.cleanup();

      expect(lifecycle.signal.aborted).toBe(true);
    });

    it('cleanup runs registered callbacks', () => {
      const lifecycle = new AnimationLifecycle();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      lifecycle.onCleanup(callback1);
      lifecycle.onCleanup(callback2);

      lifecycle.cleanup();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('cleanup logs message after aborting', () => {
      const lifecycle = new AnimationLifecycle();
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      lifecycle.cleanup();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Lifecycle] All event listeners cleaned up'
      );

      consoleLogSpy.mockRestore();
    });

    it('cleanup catches and logs errors from callbacks', () => {
      const lifecycle = new AnimationLifecycle();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      lifecycle.onCleanup(() => {
        throw error;
      });

      expect(() => lifecycle.cleanup()).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Lifecycle] Cleanup callback error:',
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
