# Codebase Structure

**Analysis Date:** 2026-01-17

## Directory Layout

```
stream-animations/
├── src/                        # Source code
│   ├── background/            # Background animation entry point
│   ├── stinger/               # Stinger transition entry point
│   ├── sidebar/               # Sidebar overlay entry point
│   └── shared/                # Shared utilities and base classes
│       └── animations/        # Pure calculation functions
├── tests/                      # Test files (mirrors src/ structure)
│   ├── background/
│   ├── stinger/
│   └── shared/
├── dist/                       # Build output (generated)
│   ├── background/
│   ├── stinger/
│   └── sidebar/
├── coverage/                   # Test coverage reports (generated)
├── public/                     # Static assets
├── .planning/                  # Planning and documentation
│   └── codebase/              # Codebase analysis documents
├── .claude/                    # Claude agent configuration
├── vite.config.js             # Build configuration
├── vitest.config.js           # Test configuration
└── package.json               # Project manifest
```

## Directory Purposes

**src/**
- Purpose: All source code for animations
- Contains: HTML entry points, JavaScript modules
- Key files: `index.html` files are entry points for each animation type

**src/background/**
- Purpose: Continuous background animation for OBS scenes
- Contains: Entry HTML, BackgroundBar class
- Key files: `index.html` (entry), `BackgroundBar.js` (component)

**src/stinger/**
- Purpose: Scene transition animation triggered by OBS events
- Contains: Entry HTML, StingerBar class
- Key files: `index.html` (entry), `StingerBar.js` (component)

**src/sidebar/**
- Purpose: Sidebar overlay with animated text and bars
- Contains: Entry HTML, SidebarBar class
- Key files: `index.html` (entry), `SidebarBar.js` (component)

**src/shared/**
- Purpose: Reusable utilities and base classes
- Contains: Base AnimatedBar class, canvas helpers, color utilities, performance monitoring
- Key files: `AnimatedBar.js` (base class), `canvas.js`, `colors.js`, `performance.js`

**src/shared/animations/**
- Purpose: Pure calculation functions for animation math
- Contains: Testable, side-effect-free functions
- Key files: `calculations.js`

**tests/**
- Purpose: Vitest unit tests
- Contains: Test files mirroring src/ structure
- Key files: `tests/shared/AnimatedBar.test.js`, `tests/shared/colors.test.js`, `tests/shared/calculations.test.js`

**dist/**
- Purpose: Vite build output (single-file HTML bundles)
- Contains: Self-contained HTML files for OBS
- Generated: Yes
- Committed: No (in .gitignore)

**coverage/**
- Purpose: Test coverage reports
- Contains: HTML coverage viewer, JSON coverage data
- Generated: Yes (via `npm run test:coverage`)
- Committed: No (in .gitignore)

**.planning/codebase/**
- Purpose: Codebase analysis documents for GSD workflow
- Contains: Architecture, structure, conventions documentation
- Generated: By GSD mapper agents
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/background/index.html`: Background animation entry
- `src/stinger/index.html`: Stinger transition entry
- `src/sidebar/index.html`: Sidebar overlay entry

**Configuration:**
- `package.json`: Dependencies, scripts, project metadata
- `vite.config.js`: Multi-entry build config with mode-based routing
- `vitest.config.js`: Test runner configuration

**Core Logic:**
- `src/shared/AnimatedBar.js`: Base class for all bar animations
- `src/background/BackgroundBar.js`: Background-specific animation logic
- `src/stinger/StingerBar.js`: Stinger transition logic
- `src/sidebar/SidebarBar.js`: Sidebar animation logic
- `src/shared/animations/calculations.js`: Pure animation math functions

**Testing:**
- `tests/shared/AnimatedBar.test.js`: Base class tests
- `tests/shared/colors.test.js`: Color utility tests
- `tests/shared/calculations.test.js`: Animation calculation tests

**Utilities:**
- `src/shared/canvas.js`: Canvas setup and clearing utilities
- `src/shared/colors.js`: Color parsing and conversion
- `src/shared/performance.js`: Optional FPS monitoring

## Naming Conventions

**Files:**
- HTML entry points: `index.html` (one per animation type subdirectory)
- JavaScript classes: PascalCase with `.js` extension (e.g., `BackgroundBar.js`, `StingerBar.js`)
- JavaScript utilities: camelCase with `.js` extension (e.g., `canvas.js`, `colors.js`)
- Test files: Match source file name with `.test.js` suffix (e.g., `AnimatedBar.test.js`)

**Directories:**
- Animation types: lowercase (e.g., `background/`, `stinger/`, `sidebar/`)
- Shared code: `shared/` at same level as animation types
- Subdirectories: lowercase (e.g., `animations/`)

**Classes:**
- Animation components: `{Type}Bar` pattern (e.g., `BackgroundBar`, `StingerBar`, `SidebarBar`)
- Base classes: Descriptive with adjective prefix (e.g., `AnimatedBar`)
- Utility classes: Descriptive noun (e.g., `PerformanceMonitor`)

**Functions:**
- Exported functions: camelCase (e.g., `setupCanvas`, `getColorFromURL`)
- Pure calculation functions: Verb + noun with "calculate" prefix (e.g., `calculateOpacity`, `calculatePosition`)
- Predicates: Question form with "is" or "should" prefix (e.g., `isBarInViewport`, `shouldChangeDirection`)

**Variables:**
- camelCase for local and parameter names
- UPPER_SNAKE_CASE for constants (e.g., `ANIMATION_DURATION`)
- Descriptive names for canvas contexts: `ctx`, `bgCtx`, `fgCtx`

## Where to Add New Code

**New Animation Type:**
- Primary code: `src/{animation-type}/`
- Entry point: `src/{animation-type}/index.html`
- Component class: `src/{animation-type}/{AnimationType}Bar.js` (extends `AnimatedBar`)
- Update: `vite.config.js` to add new mode
- Tests: `tests/{animation-type}/`

**New Shared Utility:**
- Implementation: `src/shared/{utility-name}.js`
- Tests: `tests/shared/{utility-name}.test.js`
- Import in animation entry points as needed

**New Animation Calculation:**
- Add pure function to: `src/shared/animations/calculations.js`
- Add tests to: `tests/shared/calculations.test.js`
- Use in bar classes via import

**New Bar Behavior:**
- If specific to one animation: Add to `src/{animation-type}/{AnimationType}Bar.js`
- If shared across all animations: Add to `src/shared/AnimatedBar.js`
- Add tests to appropriate test file

**Extending Base AnimatedBar:**
- Override methods: `init()`, `update()`, `draw()`
- Call `super()` in constructor with `ctx`, `canvas`, `type`, `options`
- Use `this.drawBar()` for rendering
- Use calculation functions from `calculations.js` for testable logic

## Special Directories

**node_modules/**
- Purpose: npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)

**.git/**
- Purpose: Git version control metadata
- Generated: Yes (git repository)
- Committed: N/A (VCS internal)

**.claude/**
- Purpose: Claude agent configuration and GSD workflow
- Generated: No (manually configured)
- Committed: Yes

**dist/**
- Purpose: Production build output
- Generated: Yes (via `npm run build` or watch commands)
- Committed: No (build artifacts)
- Note: Each animation type has its own subdirectory with single `index.html` file

**coverage/**
- Purpose: Test coverage HTML reports and JSON data
- Generated: Yes (via `npm run test:coverage` using @vitest/coverage-v8)
- Committed: No (generated reports)

---

*Structure analysis: 2026-01-17*
