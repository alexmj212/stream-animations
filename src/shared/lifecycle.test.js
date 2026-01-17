import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnimationLifecycle } from './lifecycle.js';

describe('AnimationLifecycle', () => {
  let lifecycle;
  let mockTarget;

  beforeEach(() => {
    lifecycle = new AnimationLifecycle();

    // Create mock event target
    mockTarget = {
      listeners: [],
      addEventListener: vi.fn(function(event, handler, options) {
        this.listeners.push({ event, handler, options });
      }),
      removeEventListener: vi.fn(function(event, handler) {
        const index = this.listeners.findIndex(l => l.event === event && l.handler === handler);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      })
    };
  });

  it('creates AbortController and signal', () => {
    expect(lifecycle.controller).toBeInstanceOf(AbortController);
    expect(lifecycle.signal).toBe(lifecycle.controller.signal);
  });

  it('adds event listener with signal option', () => {
    const handler = vi.fn();

    lifecycle.addEventListener(mockTarget, 'click', handler);

    expect(mockTarget.addEventListener).toHaveBeenCalledWith(
      'click',
      handler,
      { signal: lifecycle.signal }
    );
  });

  it('merges custom options with signal', () => {
    const handler = vi.fn();

    lifecycle.addEventListener(mockTarget, 'click', handler, { passive: true });

    expect(mockTarget.addEventListener).toHaveBeenCalledWith(
      'click',
      handler,
      { passive: true, signal: lifecycle.signal }
    );
  });

  it('registers cleanup callbacks', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    lifecycle.onCleanup(callback1);
    lifecycle.onCleanup(callback2);

    expect(lifecycle.cleanupCallbacks).toHaveLength(2);
    expect(lifecycle.cleanupCallbacks).toContain(callback1);
    expect(lifecycle.cleanupCallbacks).toContain(callback2);
  });

  it('runs cleanup callbacks on cleanup()', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    lifecycle.onCleanup(callback1);
    lifecycle.onCleanup(callback2);

    lifecycle.cleanup();

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('aborts controller on cleanup()', () => {
    const abortSpy = vi.spyOn(lifecycle.controller, 'abort');

    lifecycle.cleanup();

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(lifecycle.signal.aborted).toBe(true);
  });

  it('catches and logs cleanup callback errors', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorCallback = vi.fn(() => {
      throw new Error('Cleanup error');
    });
    const successCallback = vi.fn();

    lifecycle.onCleanup(errorCallback);
    lifecycle.onCleanup(successCallback);

    lifecycle.cleanup();

    expect(errorCallback).toHaveBeenCalled();
    expect(successCallback).toHaveBeenCalled(); // Should still run
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Lifecycle] Cleanup callback error:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('logs cleanup message', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    lifecycle.cleanup();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Lifecycle] All event listeners cleaned up'
    );

    consoleLogSpy.mockRestore();
  });

  it('removes event listeners when signal is aborted (browser behavior)', () => {
    // This test verifies that event listeners are properly removed when AbortController.abort() is called
    // In a real browser, listeners with signal option are automatically removed on abort
    const handler = vi.fn();

    // Add listener with signal
    lifecycle.addEventListener(mockTarget, 'click', handler);

    // Verify listener was added with signal
    expect(mockTarget.listeners[0].options.signal).toBe(lifecycle.signal);

    // Clean up (aborts controller)
    lifecycle.cleanup();

    // Verify controller was aborted
    expect(lifecycle.signal.aborted).toBe(true);

    // In real browser, the listener would be removed automatically
    // We can verify the signal is passed correctly
    expect(mockTarget.listeners[0].options.signal.aborted).toBe(true);
  });

  it('handles multiple event listeners on different targets', () => {
    const mockTarget2 = {
      addEventListener: vi.fn()
    };

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    lifecycle.addEventListener(mockTarget, 'click', handler1);
    lifecycle.addEventListener(mockTarget2, 'resize', handler2);

    expect(mockTarget.addEventListener).toHaveBeenCalledWith(
      'click',
      handler1,
      { signal: lifecycle.signal }
    );
    expect(mockTarget2.addEventListener).toHaveBeenCalledWith(
      'resize',
      handler2,
      { signal: lifecycle.signal }
    );
  });

  it('sets up beforeunload listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    // Create new lifecycle to capture beforeunload setup
    const newLifecycle = new AnimationLifecycle();

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
      { once: true }
    );

    addEventListenerSpy.mockRestore();
  });
});
