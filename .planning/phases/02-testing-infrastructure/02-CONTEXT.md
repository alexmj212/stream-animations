# Phase 2: Testing Infrastructure - Context

**Gathered:** 2026-01-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Building a comprehensive test suite to lock down positioning and animation math, preventing AI coding regressions. Tests will verify bar positions using explicit coordinate system contracts, validate animation invariants across random inputs, fix existing test failures, and include frame rate consistency checks. Stress testing for memory leaks is deferred (not in scope for this discussion).

</domain>

<decisions>
## Implementation Decisions

### Test organization & structure
- Mirror source structure (tests/background/, tests/stinger/, tests/sidebar/)
- Keep unit and integration tests together in same files
- Shared fixtures directory for reusable test data
- Minimal helpers only - create helpers only if patterns repeat 3+ times across tests

### Position testing approach
- Tolerance-based matching for positions (handle floating point precision issues)
- Comments in each test documenting coordinate system contracts
- Continuous sampling throughout animation (test positions at many points, e.g., every 100ms)
- Real canvas in jsdom for rendering tests (not mocked)

### Property-based testing scope
- Critical invariants only (opacity 0-1, positions within bounds, speeds positive - core safety properties)
- Conservative 100 random test cases per property
- Extended ranges beyond config limits to verify boundary handling
- Fixed seed for reproducibility (easier to debug failures)

### Claude's Discretion
- Specific tolerance values for position matching (e.g., 0.1, 0.01)
- Exact continuous sampling interval (e.g., 50ms vs 100ms vs 200ms)
- Property-based test library choice (fast-check, jsverify, or custom)
- Test data organization within fixtures directory
- Helper function thresholds and patterns

</decisions>

<specifics>
## Specific Ideas

No specific product references - focus is on preventing regressions through comprehensive testing. User wants:
- Tests that mirror the source structure for easy navigation
- Practical tolerance-based assertions (not brittle exact matching)
- Conservative test volumes for fast CI runs
- Fixed seeds for reproducible test failures

</specifics>

<deferred>
## Deferred Ideas

Stress testing for memory leaks - not discussed in this session. Will be addressed during planning or in a separate context gathering session if needed.

</deferred>

---

*Phase: 02-testing-infrastructure*
*Context gathered: 2026-01-17*
