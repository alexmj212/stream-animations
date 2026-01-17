# Coding Conventions

**Analysis Date:** 2026-01-17

## Naming Patterns

**Files:**
- PascalCase for class files: `AnimatedBar.js`, `BackgroundBar.js`, `StingerBar.js`, `SidebarBar.js`
- camelCase for utility/function modules: `colors.js`, `canvas.js`, `calculations.js`
- kebab-case for test files: `colors.test.js`, `AnimatedBar.test.js`, `calculations.test.js`
- lowercase for config files: `package.json`, `vitest.config.js`, `vite.config.js`

**Functions:**
- camelCase: `hexToHSL()`, `generateRandomColor()`, `setupCanvas()`, `calculateOpacity()`
- Descriptive action verbs: `calculate*`, `determine*`, `should*`, `is*`, `get*`, `setup*`, `clear*`

**Variables:**
- camelCase for all variables: `baseSpeed`, `currentOpacity`, `fadeInDuration`
- Descriptive names: `directionChangeTimings`, `transitionStartFrame`, `maxOpacity`
- Single letter only in arrow function parameters: `const f = n => {...}`, `(a, b) => a - b`

**Classes:**
- PascalCase: `AnimatedBar`, `BackgroundBar`, `StingerBar`, `SidebarBar`
- Noun phrases describing the entity
- Suffix pattern: `*Bar` for animation classes

**Constants:**
- camelCase (not SCREAMING_SNAKE_CASE): `fadeInDuration`, `totalFrames`, `baseSpeed`

## Code Style

**Formatting:**
- No formatter detected (no `.prettierrc` or similar in root)
- Indentation: 4 spaces (observed in source files)
- Line length: Generally kept under 120 characters
- Single quotes in test imports: `import { describe, it, expect } from 'vitest';`
- Double quotes in canvas context: `ctx.getContext("2d")`
- Semicolons: Consistently used throughout

**Linting:**
- No ESLint config detected at project root
- No Biome config detected
- Relying on editor defaults and manual consistency

## Import Organization

**Order:**
1. Test framework imports (in tests): `vitest` functions
2. Source imports: Named exports from local modules
3. Relative imports using `.js` extension explicitly

**Pattern observed:**
```javascript
// Test files
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hexToHSL, generateRandomColor } from '../../src/shared/colors.js';

// Source files
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { calculateOpacity, calculatePosition } from '../shared/animations/calculations.js';
```

**Path Aliases:**
- None detected - all imports use relative paths
- Consistent use of `../` for parent directory navigation

## Error Handling

**Patterns:**
- Minimal explicit error handling in animation code
- Defensive checks before operations: `if (!this.active) return;`
- Guard clauses for early returns: `if (this.frame <= this.startDelay) return;`
- Try-catch in build config only: `vite.config.js` file operations
- Validation by calculation bounds: `Math.min(progress, 1)` to clamp values

**Console usage:**
- `console.error()` used in build config for file operations

## Logging

**Framework:** Native `console`

**Patterns:**
- Minimal logging in production code
- Error logging in build pipeline: `console.error('Error moving file:', error);`
- No debug logging detected in animation code
- No logging wrapper or utility

## Comments

**When to Comment:**
- File-level purpose: `/** * Background-specific animated bar with continuous drift and fade lifecycle */`
- Function documentation with JSDoc
- Inline comments for non-obvious calculations: `// 20% of viewport + margin`
- Phase explanations: `// Animation timing: 25% slide in, 50% hold, 25% slide out`
- Magic numbers: `// 2 seconds`, `// 80% mark`

**JSDoc/TSDoc:**
- Extensive JSDoc on all exported functions in utility modules (`calculations.js`, `colors.js`, `canvas.js`)
- Includes `@param` with types: `@param {string} phase - Animation phase`
- Includes `@returns` with types: `@returns {number} Calculated opacity (0-1)`
- Class constructors documented with parameter descriptions
- Class methods documented for public API

**Example pattern:**
```javascript
/**
 * Calculate opacity based on animation phase
 * @param {string} phase - Animation phase ('fadeIn', 'visible', 'fadeOut')
 * @param {number} frame - Current frame number in the phase
 * @returns {number} Calculated opacity (0-1)
 */
export function calculateOpacity(phase, frame, ...) {
```

## Function Design

**Size:**
- Utility functions: 10-30 lines typical
- Class methods: 20-80 lines
- Large methods broken into phases with clear comments
- Pure calculation functions kept small and focused

**Parameters:**
- Named parameters, no excessive use of options objects
- Options object pattern for optional config: `constructor(ctx, canvas, type, options = {})`
- Pure functions accept all dependencies as parameters (no hidden state)
- Easing functions passed as parameters for testability: `easingFn`

**Return Values:**
- Single return type per function
- Early returns for guard clauses
- Object returns for multi-value results: `{ phase: 'fadeIn', frame: 0 }`
- Direct value returns: primitives (number, string, boolean)

## Module Design

**Exports:**
- Named exports only (no default exports)
- Multiple exports per module common: `export function hexToHSL() {}`, `export function cssColorToHex() {}`
- Classes exported as named: `export class AnimatedBar {}`

**Barrel Files:**
- Not used - direct imports from specific files

**Module organization:**
- Shared utilities in `src/shared/`: `colors.js`, `canvas.js`, `AnimatedBar.js`
- Nested utilities: `src/shared/animations/calculations.js`
- Feature-specific classes in feature directories: `src/background/BackgroundBar.js`

## Class Design

**Inheritance:**
- Base class pattern: `AnimatedBar` extended by `BackgroundBar`, `StingerBar`, `SidebarBar`
- Static properties for shared state: `static offscreenCache = new Map()`
- Constructor calls `super()` then `this.init()`

**Methods:**
- `init()` pattern for initialization logic
- `update()` for state changes
- `draw()` for rendering
- Helper methods prefixed with action verbs

**Properties:**
- Public properties (no private fields with `#`)
- Instance properties initialized in constructor or `init()`
- Descriptive names matching domain concepts

---

*Convention analysis: 2026-01-17*
