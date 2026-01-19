# Roadmap: Stream Animations

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-18)
- 🚧 **v1.1 Shade Component** - Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-18</summary>

### Phase 1: Project Foundation & Testing Infrastructure
**Goal**: Establish test-driven development workflow and baseline performance
**Plans**: 3 plans

Plans:
- [x] 01-01: Test setup and coverage foundation
- [x] 01-02: Background bar improvements
- [x] 01-03: Stinger and sidebar test coverage

### Phase 2: Core Architecture Unification
**Goal**: Consolidate component patterns into maintainable inheritance hierarchy
**Plans**: 3 plans

Plans:
- [x] 02-01: AnimatedBar base class refactor
- [x] 02-02: Performance infrastructure
- [x] 02-03: Centralized configuration system

### Phase 3: Memory Management & Performance Optimization
**Goal**: Eliminate memory leaks and stabilize long-duration rendering
**Plans**: 2 plans

Plans:
- [x] 03-01: Bounded cache with LRU eviction
- [x] 03-02: Animation lifecycle and cleanup

### Phase 4: Visual Consistency Polish
**Goal**: Achieve visual harmony across all scenes
**Plans**: 3 plans

Plans:
- [x] 04-01: Brightness consistency
- [x] 04-02: Timing consistency
- [x] 04-03: Visual verification

</details>

### 🚧 v1.1 Shade Component (In Progress)

**Milestone Goal:** Add shade component for major stream events with semi-transparent curtains and scrolling text

#### Phase 5: Text Animation Core
**Goal**: Users can see large scrolling text with dynamic hold duration based on readability
**Depends on**: Phase 4
**Requirements**: TEXT-01, TEXT-02, TEXT-05, CONFIG-01, CONFIG-02, CONFIG-04, CONFIG-05, TEST-01
**Success Criteria** (what must be TRUE):
  1. Text renders on canvas with explicit fillStyle for OBS browser source compatibility
  2. Hold duration calculated dynamically from text length using reading speed baseline (250ms/word)
  3. Text is fully readable - minimum duration enforced regardless of text length
  4. Shade scene accepts URL parameters (?text, ?color, ?duration) for OBS integration
  5. Custom fonts load before text measurement to prevent race conditions
**Plans**: TBD

Plans:
- [ ] 05-01: [TBD during phase planning]

#### Phase 6: Curtain Integration & Synchronization
**Goal**: Text and curtains animate as unified "shade" effect with synchronized three-phase lifecycle
**Depends on**: Phase 5
**Requirements**: CURTAIN-01, CURTAIN-02, CURTAIN-03, CURTAIN-04, CURTAIN-05, TEXT-03, TEXT-04, TEXT-06, TEXT-07, CONFIG-03, PERF-04, TEST-02
**Success Criteria** (what must be TRUE):
  1. Semi-transparent curtains enter from top and bottom edges with smooth easing
  2. Text "flies in" with curtains during enter phase, "flies out" during exit phase
  3. Text scrolls horizontally during hold phase with constant speed
  4. Text clipped to curtain boundaries during enter/exit (no overflow)
  5. Text and curtains synchronized via single phase controller - no desynchronization
**Plans**: TBD

Plans:
- [ ] 06-01: [TBD during phase planning]

#### Phase 7: Performance Optimization & Polish
**Goal**: Production-ready shade component with optimized performance and validated visual polish
**Depends on**: Phase 6
**Requirements**: PERF-01, PERF-02, PERF-03, TEST-03
**Success Criteria** (what must be TRUE):
  1. Text measured once during init and cached (not measured every frame)
  2. Offscreen canvas caching provides 5x+ performance gain for text rendering
  3. GPU usage remains under 50% during animation
  4. Shade component validated in OBS browser source across 5+ test streams
**Plans**: TBD

Plans:
- [ ] 07-01: [TBD during phase planning]

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Foundation & Testing Infrastructure | v1.0 | 3/3 | Complete | 2026-01-18 |
| 2. Core Architecture Unification | v1.0 | 3/3 | Complete | 2026-01-18 |
| 3. Memory Management & Performance Optimization | v1.0 | 2/2 | Complete | 2026-01-18 |
| 4. Visual Consistency Polish | v1.0 | 3/3 | Complete | 2026-01-18 |
| 5. Text Animation Core | v1.1 | 0/TBD | Not started | - |
| 6. Curtain Integration & Synchronization | v1.1 | 0/TBD | Not started | - |
| 7. Performance Optimization & Polish | v1.1 | 0/TBD | Not started | - |
