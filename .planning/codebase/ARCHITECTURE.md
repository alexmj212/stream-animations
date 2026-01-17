# Architecture

**Analysis Date:** 2026-01-17

## Pattern Overview

**Overall:** Component-based Canvas Animation System with Inheritance Hierarchy

**Key Characteristics:**
- Multiple independent HTML5 Canvas applications (background, stinger, sidebar) built from shared components
- Class-based inheritance with specialized animation behaviors
- Pure functional calculation layer separated from stateful animation classes
- Inline module scripts with ES6 imports (no bundler runtime overhead)
- Vite build system generates single-file HTML outputs for OBS compatibility

## Layers

**Presentation Layer:**
- Purpose: HTML entry points and inline module scripts
- Location: `src/background/index.html`, `src/stinger/index.html`, `src/sidebar/index.html`
- Contains: Canvas setup, URL parameter parsing, animation initialization, render loops
- Depends on: Animation classes, shared utilities
- Used by: OBS Browser Source (standalone HTML files)

**Animation Component Layer:**
- Purpose: Specialized bar animation implementations
- Location: `src/background/BackgroundBar.js`, `src/stinger/StingerBar.js`, `src/sidebar/SidebarBar.js`
- Contains: Animation-specific state machines, lifecycle management, bar initialization
- Depends on: Base AnimatedBar class, calculation utilities
- Used by: HTML entry points

**Base Abstraction Layer:**
- Purpose: Shared rendering logic and canvas optimization
- Location: `src/shared/AnimatedBar.js`
- Contains: Base class with drawing methods, offscreen canvas caching, easing functions
- Depends on: Canvas context (injected)
- Used by: All animation component classes

**Utility Layer:**
- Purpose: Pure functions and helper utilities
- Location: `src/shared/`
- Contains: Canvas setup (`canvas.js`), color conversion (`colors.js`), animation calculations (`animations/calculations.js`), performance monitoring (`performance.js`)
- Depends on: Browser APIs only
- Used by: All layers above

**Build Layer:**
- Purpose: Multi-entry build configuration
- Location: `vite.config.js`
- Contains: Mode-based entry point selection, single-file bundling plugin, output path management
- Depends on: Vite, vite-plugin-singlefile
- Used by: Build process

## Data Flow

**Background Animation (Continuous):**

1. HTML loads → Parse URL params (color, speed, density, perf)
2. Convert color to HSL → Create BackgroundBar instances with staggered lifecycles
3. Split bars into background/foreground arrays by speed
4. requestAnimationFrame loop:
   - Update background layer every 2 frames (30fps optimization)
   - Update foreground layer every frame (60fps)
   - Remove inactive bars, create replacements
   - Sort by z-index when needed
   - Draw bars with opacity/position from pure calculation functions
5. Continuous loop (no end state)

**Stinger Animation (Event-driven):**

1. HTML loads → Parse URL params (color, duration, perf)
2. Create curtain bars + accent bars with staggered delays
3. Wait for 'transitionStart' window event
4. On event → Generate new bars, start animation loop
5. Phase-based state machine: 'in' → 'pause' → 'out'
6. Exit when all bars complete their phases

**Sidebar Animation (Timed sequence):**

1. HTML loads → Parse URL params (text, color, duration, perf)
2. Set CSS animation for text overlay
3. Create sidebar bars (1 background + 8 accent bars)
4. Continuous animation loop with phases: 'in' → 'hold' → 'out'
5. Bars slide from right, hold at 80% viewport position, slide back out

**State Management:**
- Each bar instance maintains its own state (position, phase, frame counter, opacity)
- No global state manager
- Arrays of bar instances managed by animation loop in HTML
- URL parameters provide configuration state

## Key Abstractions

**AnimatedBar (Base Class):**
- Purpose: Shared rendering logic for all bar animations
- Examples: `src/shared/AnimatedBar.js`
- Pattern: Abstract base class with template methods (update/draw overridden by subclasses)
- Features: Offscreen canvas caching, cubic easing, bar drawing with rotation/skew

**Specialized Bar Classes:**
- Purpose: Animation-specific behavior implementations
- Examples: `src/background/BackgroundBar.js`, `src/stinger/StingerBar.js`, `src/sidebar/SidebarBar.js`
- Pattern: Inheritance from AnimatedBar, state machine implementation in update()
- Features: Lifecycle phases, direction transitions, random variations

**Pure Calculation Functions:**
- Purpose: Testable, side-effect-free animation math
- Examples: `src/shared/animations/calculations.js`
- Pattern: Pure functions (no external state access)
- Functions: calculateOpacity, calculateSizeMultiplier, determineNextPhase, isBarInViewport

**PerformanceMonitor:**
- Purpose: Optional FPS and frame time tracking
- Examples: `src/shared/performance.js`
- Pattern: Service class with enable/disable toggle
- Features: Rolling window sampling, console logging

## Entry Points

**Background Entry:**
- Location: `src/background/index.html`
- Triggers: Direct load (OBS browser source URL)
- Responsibilities: Multi-layered continuous animation with bar recycling

**Stinger Entry:**
- Location: `src/stinger/index.html`
- Triggers: window 'transitionStart' event
- Responsibilities: Timed curtain transition effect with accent bars

**Sidebar Entry:**
- Location: `src/sidebar/index.html`
- Triggers: Direct load (OBS browser source URL)
- Responsibilities: Sidebar overlay with text and animated bars

## Error Handling

**Strategy:** Fail-safe defaults with minimal error propagation

**Patterns:**
- URL parameter parsing: Use fallback defaults if params missing/invalid
- Color parsing: Return random color if invalid color specified
- No try-catch blocks (let errors surface in console for debugging)
- Canvas API errors: Not explicitly handled (browser provides error messages)

## Cross-Cutting Concerns

**Logging:** Optional via `?perf=true` URL parameter → PerformanceMonitor logs to console every 2 seconds

**Validation:** Implicit via parseFloat/parseInt on URL params, color validation in cssColorToHex

**Authentication:** Not applicable (standalone HTML files for OBS)

**Performance Optimization:**
- Offscreen canvas caching for white bars (reuse pre-rendered shapes)
- Viewport culling (skip drawing off-screen bars using isBarInViewport)
- Layered rendering (background at 30fps, foreground at 60fps for BackgroundBar)
- Integer coordinate rounding to avoid sub-pixel rendering
- Alpha channel control (alpha: true only when needed)

---

*Architecture analysis: 2026-01-17*
