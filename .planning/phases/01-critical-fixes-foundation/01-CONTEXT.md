# Phase 1: Critical Fixes & Foundation - Context

**Gathered:** 2026-01-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Fixing production-critical bugs (memory leaks causing crashes during long streams, timing inconsistencies across different refresh rates) and establishing centralized configuration system to move magic numbers out of code into a maintainable config file with documented coordinate system.

</domain>

<decisions>
## Implementation Decisions

### Configuration structure
- Use JavaScript object format (config.js) - allows comments and computed values
- Organize by scene (background, stinger, sidebar sections)
- Inline comments on each position value to document coordinate system
- Include shared section for common values used across multiple scenes

### Timing system approach
- Delta-time based (adaptive) - automatically handles any refresh rate (30/60/120Hz)
- Unify to single frame rate - remove mixed 30fps/60fps system in background scene
- Performance monitoring only in dev mode - track timing issues during development, silent in production
- Only animation durations configurable - frame rate targets handled automatically by delta-time system

### Memory management strategy
- Time-based periodic cleanup for canvas caches - clear stale caches at intervals
- Automatic cleanup via AbortController for event listeners - modern API for guaranteed cleanup
- Track cache size only - monitor canvas cache memory without broader memory overhead
- Conservative cleanup strategy - preserve performance, only clean when necessary

### Migration and validation
- Scene by scene migration - background first, then stinger, then sidebar
- Schema validation at runtime - validate types, ranges, required fields
- Log error and use defaults on validation failure - graceful degradation with console warnings
- Defaults defined in config file itself - single location for all configuration values

### Claude's Discretion
- Specific validation schema design
- Exact cleanup intervals for time-based cache cleanup
- Dev mode detection approach
- Config loading and initialization order

</decisions>

<specifics>
## Specific Ideas

No specific product references - focus is on fixing bugs and establishing solid foundation. User wants:
- Performance to remain the core priority (conservative memory cleanup)
- Good developer experience (dev-only monitoring, clear inline comments)
- Maintainability (scene-based organization mirrors code structure)

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-critical-fixes-foundation*
*Context gathered: 2026-01-17*
