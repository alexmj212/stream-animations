# Testing Patterns

**Analysis Date:** 2026-01-17

## Test Framework

**Runner:**
- Vitest 4.0.16
- Config: `vitest.config.js`

**Assertion Library:**
- Vitest's built-in `expect` (Chai-compatible)

**Run Commands:**
```bash
npm test                 # Run all tests
npm run test:ui          # Interactive UI mode
npm run test:coverage    # Generate coverage report
```

## Test File Organization

**Location:**
- Separate `tests/` directory at project root (not co-located)
- Mirrors source structure: `tests/shared/` matches `src/shared/`

**Naming:**
- Pattern: `{module-name}.test.js`
- Examples: `colors.test.js`, `AnimatedBar.test.js`, `calculations.test.js`

**Structure:**
```
tests/
└── shared/
    ├── colors.test.js
    ├── AnimatedBar.test.js
    └── calculations.test.js
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { functionToTest } from '../../src/shared/module.js';

describe('FunctionName', () => {
    it('should describe expected behavior', () => {
        const result = functionToTest(input);
        expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
        expect(result).toMatch(/regex/);
    });
});
```

**Patterns:**
- Top-level `describe()` per function or class
- Nested `describe()` for class methods: `describe('AnimatedBar') { describe('easeInOutCubic') {...} }`
- `it()` statements start with "should"
- One assertion focus per test (but multiple expects allowed for related checks)

**Setup/Teardown:**
- `beforeEach()` for test-specific setup (mocking, spies)
- `afterEach()` for cleanup (restore mocks)
- Setup at describe level when needed for all tests in suite

**Example from codebase:**
```javascript
describe('generateRandomColor', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should generate a valid hex color', () => {
        Math.random.mockReturnValue(0.5);
        const color = generateRandomColor();
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
});
```

## Mocking

**Framework:** Vitest's `vi` utility

**Patterns:**
```javascript
// Spy on existing methods
vi.spyOn(Math, 'random');

// Mock return values
Math.random.mockReturnValue(0.5);

// Chain multiple return values
Math.random.mockReturnValueOnce(0.1).mockReturnValueOnce(0.2);

// Custom function mocks
const customRandom = vi.fn(() => 0.5);

// Restore all mocks
vi.restoreAllMocks();
```

**What to Mock:**
- Non-deterministic functions: `Math.random()`
- Browser APIs: `window.location`
- External dependencies that are not the focus of the test

**What NOT to Mock:**
- Pure calculation functions (test them directly)
- Simple data transformations
- The function under test itself

**DOM Mocking:**
```javascript
// Save original
const originalLocation = window.location;

// Replace in beforeEach
beforeEach(() => {
    delete window.location;
    window.location = { search: '?color=FF5733' };
});

// Restore in afterEach
afterEach(() => {
    window.location = originalLocation;
});
```

## Fixtures and Factories

**Test Data:**
```javascript
// Inline constants at test level
const mockCtx = {};
const mockCanvas = { width: 1920, height: 1080 };

// Helper functions for test data
const linearEase = (t) => t;
const cubicEase = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
```

**Location:**
- Test data defined inline within test files
- No separate fixtures directory
- Helper functions defined at top of test file when reused across tests

## Coverage

**Requirements:** None enforced (no minimum threshold configured)

**Configuration:**
- Provider: V8 (native Node.js coverage)
- Reporters: `['text', 'json', 'html']`
- Excluded paths:
  - `node_modules/`
  - `dist/`
  - `**/*.config.js`
  - `**/index.html`

**View Coverage:**
```bash
npm run test:coverage
# Opens HTML report in coverage/ directory
```

## Test Types

**Unit Tests:**
- All current tests are unit tests
- Focus on pure functions and class methods in isolation
- Files: `calculations.test.js` (pure functions), `colors.test.js` (utilities), `AnimatedBar.test.js` (class methods)

**Integration Tests:**
- Not currently present
- Would test interaction between components (e.g., BackgroundBar using calculations)

**E2E Tests:**
- Not used (no framework detected)
- Animation rendering tests not automated

## Common Patterns

**Async Testing:**
- Not currently used (all tests are synchronous)
- Would use: `it('should ...', async () => { await ... })`

**Error Testing:**
- Not extensively present in current tests
- Pattern would be: `expect(() => { throwingFn() }).toThrow()`

**Parameterized Testing:**
```javascript
it('should be monotonically increasing', () => {
    const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const results = steps.map(t => bar.easeInOutCubic(t));

    for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
    }
});
```

**Boundary Testing:**
```javascript
it('should return 0 at start (t=0)', () => {
    expect(bar.easeInOutCubic(0)).toBe(0);
});

it('should return 1 at end (t=1)', () => {
    expect(bar.easeInOutCubic(1)).toBe(1);
});

it('should handle edge case near 0', () => {
    const result = bar.easeInOutCubic(0.001);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(0.001);
});
```

**Floating Point Comparisons:**
```javascript
// Use toBeCloseTo for floating point
expect(opacity).toBeCloseTo(0.7, 5); // 5 decimal places

// Or specify precision
expect(result1 - 0.5).toBeCloseTo(result2 - 0.5, 10);
```

**Matchers Used:**
- `toBe()` - strict equality
- `toEqual()` - deep equality for objects
- `toMatch()` - regex matching
- `toBeCloseTo()` - floating point comparison
- `toBeGreaterThan()`, `toBeLessThan()`, `toBeGreaterThanOrEqual()`, `toBeLessThanOrEqual()`
- `not` modifier: `expect(x).not.toBe(y)`

## Test Environment

**Environment:** jsdom (configured in `vitest.config.js`)
- Provides browser-like globals: `window`, `document`, `canvas`
- Enables testing of DOM-dependent code

**Globals:** Enabled (`globals: true`)
- No need to import `describe`, `it`, `expect` in every file
- They are automatically available

## Current Coverage

**Well-Tested Areas:**
- `src/shared/animations/calculations.js` - Comprehensive pure function tests
- `src/shared/colors.js` - Color conversion and generation utilities
- `src/shared/AnimatedBar.js` - Base class methods (easing, constructor)

**Untested Areas:**
- `src/background/BackgroundBar.js` - No tests
- `src/stinger/StingerBar.js` - No tests
- `src/sidebar/SidebarBar.js` - No tests
- `src/shared/canvas.js` - No tests
- Integration between components
- Rendering output validation

---

*Testing analysis: 2026-01-17*
