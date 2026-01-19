# Phase 6: Curtain Integration & Synchronization - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Unify semi-transparent curtains (top/bottom) with scrolling text into a synchronized three-phase animation (enter → hold → exit). The curtains and text work as one cohesive "shade" effect for major stream events.

</domain>

<decisions>
## Implementation Decisions

### Synchronization approach
- Curtains and text have independent timing (don't need exact sync) but respect total animation duration
- Follow stinger pattern: curtains structured similarly, coming from top/bottom instead of sides
- Curtains hold static at full coverage during hold phase (no breathing or motion)
- Enter and exit phase durations match exactly: both use shared.durations.stinger = 1000ms
- Total animation duration uses same dynamic logic as text (enter 1000ms + dynamic hold based on word count + exit 1000ms)
- Keep architecture simple - no event/notification system (future enhancement)

### Text clipping behavior
- Text always renders ABOVE curtains (not clipped by them)
- Text visible everywhere across full canvas regardless of curtain position
- Text stays at static vertical center throughout entire animation
- Text flies in from right during enter phase (Phase 5 implementation)
- Text flies out to left during exit phase (continuing scroll direction)

### Curtain visual design
- Opacity: Medium (0.4-0.6 range)
- Coverage: Full screen - curtains meet exactly at centerline (each covers 50% of height)
  - Top curtain: y=0 to y=height/2
  - Bottom curtain: y=height/2 to y=height
- Colors: Use shared gradient from config.colors.gradient for consistency
- Shadow: Apply same shadow technique used in other components
- Enter/exit movement: Top and bottom curtains move synchronized (same rate)

### Animated bars inside curtains
- Horizontal bars only (option to enhance with vertical in future)
- Bars animate throughout entire animation (enter/hold/exit phases)
- Direction: Both left-to-right and right-to-left bars
- Pattern: Independent random patterns for top and bottom curtains
- Bars visible and moving from moment curtains start entering until they finish exiting

### Claude's Discretion
- Exact easing curve for curtain enter/exit (choose from existing patterns)
- Specific opacity value within 0.4-0.6 range
- Bar configuration details (speed, count, exact colors)
- Architecture for coordinating curtains and text (as simple as possible)
- Start timestamp synchronization approach
- Error handling strategy (fail together vs independent)

</decisions>

<specifics>
## Specific Ideas

- "Use the stinger as an example" - curtains structured like stinger component, different axis
- "The curtain is coming from a different position in the view so the timing doesn't have to be exact other than it respects the total duration"
- "Over engineered, I would plan some kind of notification engine as a major future later" - keep current implementation simple

</specifics>

<deferred>
## Deferred Ideas

- Event/notification system for phase coordination - future enhancement
- Vertical bars in curtains - option to enhance later
- Advanced synchronization patterns - keep simple for now

</deferred>

---

*Phase: 06-curtain-integration-a-synchronization*
*Context gathered: 2026-01-19*
