import 'vitest-canvas-mock';

// Re-initialize canvas mock after vi.resetAllMocks() if needed
import { setupVitestCanvasMock } from 'vitest-canvas-mock';
global.setupVitestCanvasMock = setupVitestCanvasMock;

// Memory: vitest-canvas-mock wraps every Path2D method in its own vi.fn spy,
// per instance. Spies are registered with vitest for the life of the worker,
// so the epcot suite - which builds thousands of facet paths per surface,
// rebuilt across ~140 tests - retained millions of spies and their recorded
// calls, and the run died with "JavaScript heap out of memory". Build
// Path2D instances without spies (still real mock Path2Ds: `instanceof`
// checks in the mock context pass and the path is recorded as before), and
// drop the per-call event logs nothing reads.
const MockPath2D = globalThis.Path2D;
const MockContext = globalThis.CanvasRenderingContext2D;
const PATH_METHODS = ['closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect'];
const noop = () => 0;
const sink = () => Object.assign([], { push: noop });

function Path2D(source) {
  const path = Object.create(MockPath2D.prototype);
  path._path = [];
  path._events = sink();
  path._stackIndex = 0;
  path._transformStack = [[1, 0, 0, 1, 0, 0]];
  for (const key of PATH_METHODS) path[key] = MockContext.prototype[key];
  if (source instanceof MockPath2D) path._path.push(...source._path);
  return path;
}
Path2D.prototype = MockPath2D.prototype;
globalThis.Path2D = Path2D;
if (typeof window !== 'undefined') window.Path2D = Path2D;

// Contexts log every call (with transform/style state) into _events and
// _drawCalls; no test reads them.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function getContext(...args) {
  const ctx = originalGetContext.apply(this, args);
  if (ctx && Array.isArray(ctx._events) && ctx._events.push !== noop) {
    ctx._events = sink();
    ctx._drawCalls = sink();
  }
  return ctx;
};
