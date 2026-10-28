# Decisions

Newest first. One row per decision: what, why, how it turned out. Add a row
in the PR that makes the decision. Rows up to 2026-01-20 come from the retired
GSD `.planning/PROJECT.md`.

| Date | Decision | Why | Outcome |
|---|---|---|---|
| 2026-10-28 | New notifications scene replaces the OBS "Notifications" toast (color sources, Move filters, mask plugin): it grows out of the follower-goal bar, takes `?text=` from MIU instead of OBS reading notification.txt, runs the Illuminations palette along the bar, and adds seeded streaks, rims and a text wipe (`?style=clean` drops them) | AJ: the mask plugin broke in OBS 33, "rebuild it", "give it that color makeover", "get creative" | new |
| 2026-10-28 | Long sidebar text stays inside the panel: it shrinks to fit, down to 75%, then wraps to two lines, and only then ends in an ellipsis (`config.sidebar.text`) | Design review: a raid thank-you hung off the slanted panel over the stream | new |
| 2026-10-28 | Sidebar text moves from 2/3 to 78% of the height, below the Mix It Up images; `config.sidebar.miuZones` lists where MIU draws over the sidebar, and the harness fails if the text overlaps one | AJ: MIU's images covered the sidebar text. The Mixitup source sits above the alerts in OBS, and its avatars are centred at 42-50% height on the right | new |
| 2026-10-28 | Stinger, sidebar and shade take the epcot Illuminations palette as a screen-fixed top-to-bottom gradient; `?color=` is ignored by default (`?colormode=shift` hue-shifts it, anchor stop #a312c9 ≈ AJ's theme #b00bee); `?scheme=mono` keeps the old look | AJ: "the same color layout as the illuminations epcot ball on the 3 other animations". AJ chose "Always Illuminations" for Couch Color's `color=` (design review: shift turns warm colors like #ff6600 lime green over epcot) | new |
| 2026-10-28 | Ship code without approval: code review Ready + green CI, release management merges; AJ only sees design decisions, with mocks | AJ: "just get it out the door" | new |
| 2026-10-28 | Permanent role threads (code review, design review, release management, QA) write their own charters; all threads coordinate directly (`CLAUDE.md`, Work together) | AJ | new |
| 2026-10-28 | Retire GSD (`.claude/agents`, `/gsd` commands, `.planning/`); one issue or thread plus one PR per change, decisions here | AJ, following Pixelbot; durable knowledge moved into `docs/` | new |
| 2026-10-28 | Agents always improve themselves: CLAUDE.md rule, `improve` skill, role Learnings | AJ's standing rule, modeled on Pixelbot | new |
| 2026-01 | OBS validation deferred (v1.1) | Implementation complete, performance script available, empirical testing can be post-milestone | — Pending |
| 2026-01 | Optical text centering with actualBoundingBox (v1.1) | Font-specific visual alignment accounts for asymmetric ascent/descent | ✓ Good |
| 2026-01 | Word count for duration calculation (v1.1) | Correlates with reading comprehension time better than character count | ✓ Good |
| 2026-01 | hsla() colors instead of globalAlpha (v1.1) | GPU-efficient premultiplied alpha compositing, no state management | ✓ Good |
| 2026-01 | Offscreen canvas text caching (v1.1) | 10-20x performance gain, critical for 96px font with shadow rendering | ✓ Good |
| 2026-01 | Font Loading API integration (v1.1) | Prevents text measurement race conditions with document.fonts.ready → init() flow | ✓ Good |
| 2026-01 | 200ms/word reading speed (v1.1) | Calibrated for stream event pacing, matches reading comprehension time | ✓ Good |
| 2026-01 | Velocity-first animation (v1.1) | Eliminates phase boundary discontinuities, position integrated from velocity | ✓ Good |
| 2026-01 | Phase 3 validation deferred | Infrastructure complete and tested, empirical validation can be post-milestone | — Pending |
| 2026-01 | Millisecond-based timing with shared defaults | Maintainability through per-scene overrides, unified timing approach | ✓ Good |
| 2026-01 | Brightness multiplier (0.8) across scenes | Visual harmony without excessive dimming, colors remain vibrant | ✓ Good |
| 2026-01 | Property-based testing with @fast-check | Catches edge cases automatically with 2,200+ random validations | ✓ Good |
| 2026-01 | AnimationLifecycle with AbortController | Ensures proper cleanup on OBS reload, prevents event listener leaks | ✓ Good |
| 2026-01 | Delta-time normalization | Provides frame-rate independence across 30/60/120Hz displays | ✓ Good |
| 2026-01 | LRU cache with bounded size (maxSize=50) | Prevents memory exhaustion over long streams, automatic eviction every 30s | ✓ Good |
| 2026-01 | No bundler runtime overhead | Inline module scripts for minimal performance impact | ✓ Good |
| 2026-01 | Single-file HTML builds | OBS Browser Source compatibility requirement | ✓ Good |
| 2026-01 | Pure calculation functions | Testable animation math separate from rendering state, helps prevent AI regressions | ✓ Good |
| 2026-01 | Class-based inheritance pattern | Shared rendering logic in base class, specialized behavior in subclasses | ✓ Good |
| 2026-01 | Canvas API over CSS animations | More control, better performance for complex animations, JavaScript animation libraries available | ✓ Good |
