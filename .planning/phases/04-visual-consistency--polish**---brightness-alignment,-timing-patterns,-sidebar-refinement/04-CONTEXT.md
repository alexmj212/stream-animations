# Phase 4: Visual Consistency & Polish - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Align visual aesthetics and finalize sidebar positioning/timing across all three scenes (background, stinger, sidebar). This phase harmonizes the existing animation scenes to look and feel cohesive. It does NOT add new features or capabilities - only refines what already exists.

</domain>

<decisions>
## Implementation Decisions

### Timing patterns

**Easing functions:**
- All three scenes use identical easing function (easeInOutCubic) for all transitions
- Convert all animations to use easing, including currently linear animations
- Easing function is configurable via config.shared.easingFunction
- Validation at config load time checks that easingFunction exists in easing.js exports

**Duration structure:**
- Uniform durations across all transitions (base time: 1000ms)
- Per-scene timing with shared defaults: each scene can override shared.duration
- Direct millisecond values (not named presets like "fast/normal/slow")
- Integer milliseconds for phase durations (not decimal ratios)
- Distinguish entry/exit: config.shared.entryDuration and config.shared.exitDuration for asymmetric timing
- Include hold durations: config.shared.holdDuration in addition to transition durations
- Equal phase lengths for multi-phase animations (e.g., stinger's 3 phases get 333ms each)

**Validation:**
- Tolerance ranges: allow ±50ms variance for timing consistency checks
- Hardcoded fallbacks: use DEFAULT_DURATION = 1000 if config values missing
- Both automated config tests AND visual review in OBS for verification
- Tests use scaled-down timing (10x faster) to run quickly while maintaining ratios

**Documentation:**
- Visual descriptions in comments (e.g., "// 1000ms - smooth glide, matches background bar transitions")
- No example ranges for common animation feels - just document actual values in use
- No config versioning - structure evolves without explicit version field

**Implementation approach:**
- Single pass: apply all timing changes at once
- Breaking config change: update config.js structure directly (no backward compatibility)
- Single git commit: 'refactor(04): harmonize timing patterns across all scenes'
- Code refactoring discretion: Claude decides if timing consumption code needs refactoring beyond config value updates

### Sidebar positioning/timing

**Goals:**
- Both improve current positioning values AND make future adjustments easier via config schema

**Animation sequence:**
- Independent phase timing: config.sidebar.slideInDuration, holdDuration, slideOutDuration for full control

**Positioning system:**
- Claude's discretion: choose between pixel coordinates, viewport percentages, or mixed approach based on maintainability

**Anchor point:**
- Claude's discretion: decide if anchor point configuration (top-left vs center vs bottom-right) adds value

### Color palette consistency

**Validation approach:**
- Claude's discretion: evaluate current palette and decide if adjustments needed
- Allow intentional color variation per scene (not requiring exact hex matches)
- Both automated code checks AND visual report (HTML showing colors across scenes)

**Structure:**
- Claude's discretion: choose between color families structure (primary.base/light/dark) or flat palette based on actual usage patterns

### Brightness alignment

**Per-scene control:**
- Brightness should be controllable per scene (not uniform reduction)
- Implementation approach left to Claude's discretion during planning

### Claude's Discretion

- Sidebar positioning format (pixels vs percentages vs mix)
- Sidebar anchor point configuration necessity
- Color palette structure (families vs flat)
- Color adjustment necessity based on current palette analysis
- Whether timing code refactoring is needed beyond config value updates
- Brightness control implementation approach

</decisions>

<specifics>
## Specific Ideas

None - implementation focused on systematization and consistency using established patterns from Phases 1-3.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 04-visual-consistency-polish*
*Context gathered: 2026-01-18*
