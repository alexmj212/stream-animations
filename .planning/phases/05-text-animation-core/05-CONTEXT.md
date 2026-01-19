# Phase 5: Text Animation Core - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Canvas-based text rendering system that displays large scrolling text with dynamic hold duration based on text length. This phase establishes the text animation foundation (rendering, scrolling, timing calculation) that Phase 6 will integrate with curtain animations into a unified "shade" component.

Scope includes: text rendering on canvas, marquee scrolling behavior, reading-time-based duration calculation, URL parameter configuration. Curtain integration is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Text Presentation
- Font: Match existing components (sidebar/stinger font for consistency)
- Size: Fixed 96px - extra large for celebratory major events (raids, massive gift subs)
- Weight: Bold for emphasis and visibility
- Effects: Text shadow or glow for depth/separation from background
- Color: Accept URL color parameter (requirement: ?color support)

### Scrolling Behavior
- Direction: Right-to-left marquee (classic marquee feel)
- Speed calculation: Based on text length - longer text scrolls faster to ensure full text is seen within hold duration
- Phase-specific behavior:
  - **Enter phase**: Text flies in from right edge (offscreen → onscreen)
  - **Hold phase**: Text scrolls continuously right-to-left at calculated speed
  - **Exit phase**: Text flies out left edge (onscreen → offscreen)
- No fading: Text remains fully opaque throughout all phases

### Timing Calibration
- Reading speed baseline: 200ms/word (5 words per second) - faster pace for stream events
- Minimum hold duration: 3 seconds (enforced regardless of text length)
- Maximum hold duration: No cap - duration scales freely with text length
- Text length measurement: Word count (split by spaces) - aligns with reading speed baseline

### Claude's Discretion
- Configuration interface details (URL parameters beyond ?text, ?color, ?duration)
- Default values for timing/styling
- Exact shadow/glow styling parameters
- Font loading sequence and race condition handling
- Scroll speed formula specifics (as long as it's based on text length)

</decisions>

<specifics>
## Specific Ideas

- Text motion follows classic marquee pattern: flies in from right → scrolls right-to-left → flies out left
- 96px text size chosen for "commanding presence" during celebratory moments
- No fading or opacity transitions - text stays fully visible throughout animation
- Reading speed (200ms/word) is faster than typical reading baselines to keep energy high for stream events

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope. Curtain integration and three-phase synchronization are explicitly Phase 6.

</deferred>

---

*Phase: 05-text-animation-core*
*Context gathered: 2026-01-19*
