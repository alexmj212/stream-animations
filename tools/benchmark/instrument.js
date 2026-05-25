/**
 * Canvas 2D instrumentation — injected into the page BEFORE any user script runs.
 *
 * Wraps CanvasRenderingContext2D methods and createLinearGradient on the
 * HTMLCanvasElement prototype so the benchmark can attribute time to specific
 * draw operations. The accumulated stats are exposed at `window.__canvasStats`.
 *
 * Designed to be passed verbatim to page.evaluateOnNewDocument.
 */
(() => {
  const stats = {
    calls: Object.create(null),       // { methodName: callCount }
    timeMs: Object.create(null),      // { methodName: totalMs }
    fillStyleSets: 0,
    globalAlphaSets: 0,
    gradientObjectsCreated: 0,
    canvasGetContextCalls: 0,
    drawImageBytes: 0,
    started: false
  };
  window.__canvasStats = stats;

  // Reset clears counters but preserves the reference so the harness can
  // toggle measurement windows.
  window.__canvasStatsReset = () => {
    for (const k of Object.keys(stats.calls)) stats.calls[k] = 0;
    for (const k of Object.keys(stats.timeMs)) stats.timeMs[k] = 0;
    stats.fillStyleSets = 0;
    stats.globalAlphaSets = 0;
    stats.gradientObjectsCreated = 0;
    stats.canvasGetContextCalls = 0;
    stats.drawImageBytes = 0;
  };

  const METHODS = [
    'fillRect', 'clearRect', 'strokeRect',
    'save', 'restore',
    'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'createLinearGradient', 'createRadialGradient', 'createPattern',
    'drawImage',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'rect', 'fill', 'stroke',
    'measureText', 'fillText', 'strokeText',
    'getImageData', 'putImageData',
    'clip'
  ];

  const proto = CanvasRenderingContext2D.prototype;

  for (const name of METHODS) {
    const original = proto[name];
    if (typeof original !== 'function') continue;
    stats.calls[name] = 0;
    stats.timeMs[name] = 0;

    proto[name] = function instrumented(...args) {
      const t0 = performance.now();
      const result = original.apply(this, args);
      const dt = performance.now() - t0;
      stats.calls[name]++;
      stats.timeMs[name] += dt;
      if (name === 'createLinearGradient' || name === 'createRadialGradient') {
        stats.gradientObjectsCreated++;
      }
      if (name === 'drawImage') {
        // Approximate uploaded bytes (4 bytes per RGBA px) for the source rect
        const src = args[0];
        if (src && src.width && src.height) {
          stats.drawImageBytes += src.width * src.height * 4;
        }
      }
      return result;
    };
  }

  // Track property assignments that often dominate state-change cost
  const fillStyleDesc = Object.getOwnPropertyDescriptor(proto, 'fillStyle');
  if (fillStyleDesc && fillStyleDesc.set) {
    Object.defineProperty(proto, 'fillStyle', {
      configurable: true,
      enumerable: fillStyleDesc.enumerable,
      get: fillStyleDesc.get,
      set(value) {
        stats.fillStyleSets++;
        return fillStyleDesc.set.call(this, value);
      }
    });
  }

  const globalAlphaDesc = Object.getOwnPropertyDescriptor(proto, 'globalAlpha');
  if (globalAlphaDesc && globalAlphaDesc.set) {
    Object.defineProperty(proto, 'globalAlpha', {
      configurable: true,
      enumerable: globalAlphaDesc.enumerable,
      get: globalAlphaDesc.get,
      set(value) {
        stats.globalAlphaSets++;
        return globalAlphaDesc.set.call(this, value);
      }
    });
  }

  // Track context creation (cache hits vs new offscreen canvases)
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function instrumentedGetContext(...args) {
    stats.canvasGetContextCalls++;
    return origGetContext.apply(this, args);
  };

  stats.started = true;
})();
