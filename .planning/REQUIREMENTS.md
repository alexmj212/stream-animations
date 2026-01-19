# Requirements: Stream Animations v1.1

**Defined:** 2026-01-18
**Core Value:** The background animation must perform flawlessly with minimal CPU/GPU usage since it runs continuously throughout every stream.

## v1.1 Requirements

### Curtain Animation

- [ ] **CURTAIN-01**: Semi-transparent curtains enter from top and bottom edges with configurable opacity
- [ ] **CURTAIN-02**: Curtains use smooth easeInOutCubic easing for entry and exit animations
- [ ] **CURTAIN-03**: Curtains follow three-phase lifecycle (enter → hold → exit) synchronized with text
- [ ] **CURTAIN-04**: Curtain brightness matches existing scenes (0.8 multiplier for visual harmony)
- [ ] **CURTAIN-05**: Curtain timing aligns with centralized config defaults and millisecond-based system

### Text Display

- [ ] **TEXT-01**: Large readable text renders on canvas with explicit fillStyle for OBS compatibility
- [ ] **TEXT-02**: Hold duration calculated dynamically from text length (250ms/word baseline)
- [ ] **TEXT-03**: Text scrolls horizontally during hold phase with linear interpolation
- [ ] **TEXT-04**: Text clipped to curtain boundaries during enter/exit phases (no overflow)
- [ ] **TEXT-05**: Minimum readability guarantee enforced (min/max duration bounds)
- [ ] **TEXT-06**: Text remains fully visible throughout entire hold phase (no cutoff)
- [ ] **TEXT-07**: Text "flies in" with curtains during enter, "flies out" during exit

### Configuration & Integration

- [ ] **CONFIG-01**: Shade scene accepts URL parameters (?text, ?color, ?duration)
- [ ] **CONFIG-02**: config.shade section added to centralized config.js with timing and style settings
- [ ] **CONFIG-03**: Shade scene uses AnimationLifecycle for proper cleanup on OBS reload
- [ ] **CONFIG-04**: Font loading integrated via document.fonts.ready to prevent race conditions
- [ ] **CONFIG-05**: DeltaTimer provides frame-rate independent animation timing

### Performance & Testing

- [ ] **PERF-01**: Offscreen canvas caching pre-renders text for 5x+ performance gain
- [ ] **PERF-02**: Text measured once in init() and cached (not measured every frame)
- [ ] **PERF-03**: Semi-transparent curtains use rgba() colors instead of globalAlpha for GPU efficiency
- [ ] **PERF-04**: ShadeBar extends AnimatedBar with inheritance pattern from v1.0
- [ ] **TEST-01**: Unit tests verify hold duration calculation for short/medium/long text edge cases
- [ ] **TEST-02**: Unit tests verify text-curtain synchronization (timing assertions)
- [ ] **TEST-03**: OBS browser source testing validates fillStyle rendering and font loading

## v2 Requirements

Deferred to future milestones.

### Text Enhancements

- **TEXT-V2-01**: Multi-line text support with vertical layout
- **TEXT-V2-02**: Text truncation strategy for messages >150 characters
- **TEXT-V2-03**: Per-character color animation effects

### Event Integration

- **EVENT-V2-01**: OBS WebSocket integration for automatic raid triggers
- **EVENT-V2-02**: OBS WebSocket integration for gift sub triggers
- **EVENT-V2-03**: Multiple concurrent shade instances with queue management

### Configuration

- **CONFIG-V2-01**: Configurable scroll speed (currently fixed at 300px/s)
- **CONFIG-V2-02**: Real-time text updates during hold phase

## Out of Scope

Explicitly excluded features with reasoning:

| Feature | Reason |
|---------|--------|
| Backdrop blur effects | Canvas doesn't support backdrop-filter, GPU-intensive |
| Configurable scroll speed | Defeats dynamic timing algorithm, adds complexity |
| Multiple scrolling text lines | Readability degrades, timing coordination nightmare |
| Real-time text updates during hold | Breaks one-shot OBS pattern |
| Per-character color animation | GPU overhead, visual noise |
| Event-driven automatic triggers | Requires OBS WebSocket setup, validate UX with manual trigger first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| *To be filled by roadmapper* | | |

**Coverage:**
- v1.1 requirements: 22 total
- Mapped to phases: 0 (pending)
- Unmapped: 22 ⚠️

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after initial definition*
