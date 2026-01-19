# Feature Research: Shade Component for Stream Graphics

**Domain:** Stream overlay notifications with scrolling text
**Researched:** 2026-01-18
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Semi-transparent backdrop curtains | Standard pattern for major event overlays - dims gameplay without fully obscuring it | LOW | Already validated pattern from stinger (top/bottom curtain entry) |
| Large readable text | Major events deserve prominent display - must be readable at stream resolution (1920x1080) | LOW | Canvas measureText() for width calculation, font sizing from config |
| Smooth enter/exit animations | Jarring cuts break viewer immersion - eased transitions are table stakes | LOW | easeInOutCubic already implemented in AnimatedBar base class |
| One-shot trigger pattern | Must integrate with OBS page load pattern (tested with stinger/sidebar) | LOW | Existing pattern: page load → animation → exit → OBS hides source |
| Performance (minimal CPU/GPU) | Shade runs during active gameplay - cannot impact stream encoding performance | MEDIUM | Core value constraint - must measure and verify during implementation |
| Text visibility guarantee | Text must be fully visible (not cut off) for entire hold phase | MEDIUM | Requires text width measurement + scroll timing coordination |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dynamic hold duration based on text length | Generic overlays use fixed timing - smart timing ensures text is always fully readable | MEDIUM | Calculate: textWidth + viewportWidth → scroll duration, apply minimum readability threshold (reading speed ~200 WPM speaking, ~240 WPM reading) |
| Three-phase text choreography | Text "flies in" with curtains, scrolls during hold, "flies out" with curtains - feels cohesive and polished | MEDIUM | Synchronized text position with curtain phase (in: fly in from right, hold: scroll left, out: fly out to left) |
| Consistent visual language | Shade uses same bar patterns (slanted/horizontal), colors, timing as stinger/sidebar - feels like unified system | LOW | Leverage existing AnimatedBar patterns, config-driven colors/timing, brightness multiplier (0.8) |
| Minimum readability guarantee | Unlike generic tickers that scroll too fast, enforce minimum display time regardless of text length | LOW | Config-driven minimum hold duration (e.g., 3000ms baseline) before scroll calculation |
| Visual harmony with gameplay | Semi-transparent curtains with controlled brightness (0.8 multiplier) preserve gameplay visibility while establishing focus | LOW | Reuse existing brightness/opacity config pattern from stinger |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multiple scrolling text lines | "Show more information" - raids/gift subs have username, count, message | Vertical space = vertical complexity, readability degrades fast, timing coordination nightmare | Single-line with strategic text composition: "Username raided with 50 viewers!" - all essential info, one line |
| Configurable scroll speed (user control) | "Let user decide readability" - seems flexible | Users will misconfigure (too fast = unreadable, too slow = boring), testing burden explodes, defeats dynamic timing value prop | Calculate optimal speed based on text length + minimum readability time - trust the algorithm, not user guessing |
| Real-time text updates during hold | "Show live count updates" - hype train level changes, sub count increases | Introduces state management complexity, requires event system integration, breaks one-shot OBS pattern, GPU thrash from constant re-measurement | One-shot snapshot at trigger time - clean, predictable, matches existing OBS integration pattern |
| Backdrop blur effects | "Frosted glass looks premium" - backdrop-filter: blur() for visual polish | Canvas doesn't support CSS backdrop-filter, implementing blur in canvas is GPU-intensive (kills performance core value), browser compatibility issues in OBS Chromium | Semi-transparent solid color curtains with controlled opacity - fast, reliable, already validated pattern |
| Text wrapping for long messages | "Don't truncate messages" - preserve full raid message | Adds vertical space (breaks single-line design), complicates scroll timing (multi-line width calculations), reduces text size (readability loss) | Strategic truncation with ellipsis - preserve username and key info, sacrifice message tail. Example: "StreamerName raided with 100 viewers! Thanks for..." |
| Per-character color animation (RGB wave) | "Make it flashy" - rainbow text for excitement | GPU overhead (every character = separate draw call), visual noise distracts from information, clashes with existing visual language (harmony > hype) | Single color with slight hue variation from base theme - maintains visual consistency, performs well |

## Feature Dependencies

```
[Semi-transparent backdrop curtains]
    └──requires──> [Three-phase animation system]
                       └──requires──> [Phase timing configuration]

[Scrolling text]
    ├──requires──> [Canvas measureText for width calculation]
    ├──requires──> [Dynamic hold duration calculation]
    └──requires──> [Text position synchronization with curtain phases]

[One-shot trigger pattern]
    └──requires──> [Page load animation lifecycle]

[Performance guarantee]
    ├──requires──> [Viewport culling]
    ├──requires──> [Offscreen canvas caching for text]
    └──requires──> [Frame rate monitoring]

[Dynamic hold duration] ──enhances──> [Minimum readability guarantee]

[Text wrapping] ──conflicts──> [Single-line scrolling design]
[Real-time updates] ──conflicts──> [One-shot OBS pattern]
```

### Dependency Notes

- **Curtains require phase system:** Top/bottom curtain entry mirrors stinger pattern (validated). Reuse StingerBar three-phase logic (in/pause/out) with appropriate timing adjustments.
- **Text requires measurement:** Canvas measureText() provides pixel-width for scroll timing calculation. Must measure with actual font/size before animation starts.
- **Dynamic duration enhances readability:** Calculate scroll time from text width, but floor at minimum (e.g., 3000ms) to prevent "blink and miss" for short text.
- **Text wrapping conflicts with design:** Single-line scrolling is simple, performant, and readable. Multi-line introduces complexity without proportional value gain.
- **Real-time updates conflict with OBS pattern:** One-shot page load trigger is proven (stinger: OBS transitionStart event, sidebar: page load). Adding real-time updates requires event system (WebSocket/OBS events) which breaks simplicity.

## MVP Definition

### Launch With (v1.1)

Minimum viable shade component for major stream events.

- [x] **Semi-transparent curtains (top/bottom entry)** — Table stakes for shade overlay pattern
- [x] **Large single-line scrolling text** — Core value: display raid/gift sub information prominently
- [x] **Dynamic hold duration** — Differentiator: smart timing ensures readability regardless of text length
- [x] **Three-phase animation (enter/hold/exit)** — Smooth UX, mirrors existing stinger pattern
- [x] **One-shot page load trigger** — Proven OBS integration pattern (sidebar validates this)
- [x] **Minimum readability guarantee** — Baseline hold time (e.g., 3000ms) before text scroll
- [x] **Visual consistency (colors, brightness, timing)** — Reuse config patterns from stinger/sidebar
- [x] **Performance validation** — Must not impact encoding (measure FPS, memory during gameplay)

### Add After Validation (v1.x)

Features to add once core is working and validated in production streams.

- [ ] **Text truncation with ellipsis** — Trigger: First real-world use case where raid message exceeds single-line readability (estimate: >150 characters). Graceful handling for edge cases.
- [ ] **Multiple shade variants (visual styles)** — Trigger: After 5+ production uses, identify if different event types (raid vs gift subs vs hype train) benefit from visual distinction. LOW priority - consistency may be more valuable than variety.
- [ ] **Font weight variations** — Trigger: Readability issues in production. Some fonts read better bold vs regular at large sizes. Test after 3+ streams.
- [ ] **Configurable text alignment (left/center/right)** — Trigger: User preference after 10+ uses. May want centered text for symmetry or left-aligned for consistency with sidebar.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Multi-line text support** — Why defer: Complexity not justified until single-line proves insufficient. Adds vertical layout, scroll timing coordination, testing burden. Wait for real-world use case that demands it.
- [ ] **Event-driven triggers (OBS WebSocket)** — Why defer: Requires OBS event integration (raids, subs, hype trains). Current manual trigger (page load) validates UX first, then automate. Phase 2 feature after manual validation.
- [ ] **Sound integration** — Why defer: Audio is separate concern (OBS handles alert sounds). Shade is visual-only for v1. Add if user research identifies value.
- [ ] **Multiple concurrent shades** — Why defer: Edge case (multiple raids simultaneously). Adds complexity (z-index management, visual clutter). Validate single shade first, then consider queuing system.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Semi-transparent curtains | HIGH | LOW | P1 |
| Large scrolling text | HIGH | LOW | P1 |
| Three-phase animation | HIGH | LOW | P1 |
| Dynamic hold duration | HIGH | MEDIUM | P1 |
| One-shot trigger | HIGH | LOW | P1 |
| Minimum readability guarantee | HIGH | LOW | P1 |
| Visual consistency | MEDIUM | LOW | P1 |
| Performance validation | HIGH | MEDIUM | P1 |
| Text truncation with ellipsis | MEDIUM | MEDIUM | P2 |
| Multiple shade variants | LOW | MEDIUM | P2 |
| Font weight variations | LOW | LOW | P2 |
| Configurable text alignment | LOW | LOW | P2 |
| Multi-line text support | LOW | HIGH | P3 |
| Event-driven triggers | MEDIUM | HIGH | P3 |
| Sound integration | LOW | MEDIUM | P3 |
| Multiple concurrent shades | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch - validates core shade component value prop
- P2: Should have, add when possible - quality of life improvements after validation
- P3: Nice to have, future consideration - complexity not justified until proven demand

## Competitor Feature Analysis

| Feature | StreamElements | OBS Native Scrolling Text | Our Approach |
|---------|----------------|---------------------------|--------------|
| Curtain backdrop | Yes (animated overlays) | No (text only) | **Yes** - semi-transparent curtains top/bottom with bar patterns |
| Text scrolling | Yes (ticker widget) | Yes (scroll filter) | **Yes** - single-line scrolling with dynamic timing |
| Dynamic duration | No (fixed speed) | No (user-configured speed) | **Yes** - calculated from text length + min readability |
| Visual consistency | Mixed (depends on overlay pack) | N/A (text only) | **Yes** - unified visual language with stinger/sidebar (colors, timing, brightness) |
| Performance focus | Unknown (cloud-based) | Good (native OBS) | **Explicit** - core value constraint, measured and validated |
| One-shot pattern | Yes (alert system) | No (continuous loop) | **Yes** - OBS page load trigger (proven pattern) |
| Text measurement | Yes (automatic) | No (manual config) | **Yes** - Canvas measureText() for precise width calculation |
| Three-phase choreography | Partial (enter/exit, no synchronized text) | No (continuous scroll) | **Yes** - text flies in with curtains, scrolls during hold, flies out with curtains |

### Analysis

**StreamElements strength:** Comprehensive alert system with cloud-based event integration. Pre-built widgets for raids, subs, hype trains.

**StreamElements weakness:** Generic visual style (not customized to stream brand), performance unknown (depends on cloud service), requires account/setup overhead.

**OBS Native strength:** Zero dependencies, perfect integration, known performance characteristics.

**OBS Native weakness:** No curtain backdrop (text only), no dynamic timing (user guesses scroll speed), no visual polish (bare text filter).

**Our differentiator:** Hybrid approach - performance and integration of native OBS (one-shot page load) with visual polish and intelligence of StreamElements (dynamic timing, unified visual language). Custom-built for personal stream aesthetic, no cloud dependencies, explicit performance guarantees.

## Reading Speed Research Findings

**Context:** Dynamic hold duration calculation requires understanding how fast viewers can read scrolling text.

### Reading Speed Benchmarks (Source: LOW confidence - WebSearch only)

- **Average reading speed:** 170-240 WPM for silent reading in English
- **Average speaking speed:** 130 WPM (natural conversation), 100-125 WPM (public speaking for clarity)
- **Fast speakers:** 200+ WPM
- **Scrolling text (teleprompter):** Based on speaking speed, typically 100-150 WPM for comfortable reading

### Implications for Shade Component

**Conservative estimate:** 150 WPM for scrolling text readability (between speaking and silent reading).

**Calculation approach:**
1. Measure text width in pixels (Canvas measureText)
2. Calculate viewport traverse time: `scrollDuration = (textWidth + viewportWidth) / scrollSpeed`
3. Estimate word count from character count: `words ≈ characters / 5` (English average)
4. Calculate minimum duration: `minDuration = (words / 150) * 60 * 1000` (milliseconds)
5. Use `max(calculated_scroll_duration, minDuration, baseline_minimum_3000ms)`

**Example:** "StreamerName raided with 100 viewers!" = 40 characters ≈ 8 words
- Minimum duration: (8 / 150) * 60 * 1000 = 3200ms
- Baseline minimum: 3000ms
- Final: max(scroll_time, 3200ms, 3000ms) = use calculated value

**Confidence level:** LOW - reading speed research is not stream-specific. Requires validation in production with real viewer feedback. May need adjustment after testing.

## Text Measurement Implementation Notes

**Canvas measureText() method:**
- Returns TextMetrics object with `width` property (pixel width of text)
- Width includes kerning and character spacing (full string measurement ≠ sum of individual characters)
- Must call with exact font context: `ctx.font = "72px Arial Bold"`
- Width is DPI-independent (canvas logical pixels)

**Performance consideration:** measureText() is fast, but avoid calling every frame. Measure once during initialization, cache result.

**Sources:**
- [HTML canvas measureText() Method - W3Schools](https://www.w3schools.com/tags/canvas_measuretext.asp)
- [JavaScript Canvas measureText Tutorial - ZetCode](https://zetcode.com/canvas-api/measuretext/)

## Common Overlay Design Mistakes (Source: MEDIUM confidence - WebSearch verified)

**Mistake 1: Overcrowding and clutter**
- Trying to show too much information at once
- **Shade mitigation:** Single-line text, strategic information composition, no multi-line temptation

**Mistake 2: Poor readability**
- Ornate/decorative fonts, tiny text, insufficient contrast
- **Shade mitigation:** Large font size, high contrast (white/colored text on semi-transparent dark curtains), sans-serif font preference

**Mistake 3: Overdesigned layouts**
- Visual noise, inconsistent styling, "slapped together" aesthetic
- **Shade mitigation:** Unified visual language with stinger/sidebar (config-driven colors, brightness multiplier, consistent timing patterns)

**Mistake 4: Mobile incompatibility**
- ~40% of viewers watch on mobile, tiny text = unreadable
- **Shade mitigation:** Not applicable (OBS desktop streaming target), but principle applies: large text, high contrast, simple composition

**Mistake 5: Lack of testing**
- Overlays look different in practice vs design tools
- **Shade mitigation:** Test in OBS output preview (not just browser), validate during gameplay encoding, performance monitoring

**Sources:**
- [Stream Overlay Design: Where To Start & What To Avoid - GETREKT Labs](https://getrektlabs.com/blogs/news/choose-your-stream-overlays-where-to-start-what-to-avoid)
- [What Streamers Need To Know About Stream Overlays - GETREKT Labs](https://getrektlabs.com/blogs/news/stream-overlay-essentials-what-every-streamer-needs-to-know)

## Performance Optimization Research (Source: HIGH confidence - recent technical articles)

**Key findings for canvas scrolling text:**

**RequestAnimationFrame is mandatory:**
- Tells browser that animation is occurring → optimizes repaints
- Throttles animation for inactive tabs → saves battery
- Provides high-resolution timestamps for smooth motion

**Redraw regions (dirty rectangles):**
- Clear/redraw only changed pixels, not full canvas
- `clearRect(x, y, width, height)` for partial clears
- Significant performance gain for localized changes (scrolling text is ideal use case)

**Multiple canvas layers:**
- Separate static elements (curtains) from dynamic elements (scrolling text)
- Static layer: redraw only on phase changes (enter/hold/exit)
- Dynamic layer: redraw every frame for text scroll
- Reduces pixels cleared/painted per frame

**Text rendering optimization:**
- Pre-render text to offscreen canvas, then blit to main canvas
- Avoids font rasterization every frame
- Shade use case: Text content doesn't change during scroll, perfect for caching

**Sources:**
- [Buttery-Smooth Scroll Animations: Building a High-Performance Canvas Parallax Effect - DEV Community](https://dev.to/nidal_tahir_cde5660ddbe04/buttery-smooth-scroll-animations-building-a-high-performance-canvas-parallax-effect-2m8l)
- [HTML5 Canvas Optimize Animation Performance - Konva.js](https://konvajs.org/docs/performance/Optimize_Animation.html)
- [60fps on the mobile web - Flipboard Engineering](https://engineering.flipboard.com/2015/02/mobile-web)

### Shade Implementation Recommendations

1. **Multi-layer canvas approach:**
   - Layer 1 (background): Semi-transparent curtains (redraw only on phase changes)
   - Layer 2 (foreground): Scrolling text (redraw every frame)

2. **Offscreen text caching:**
   - Pre-render text to offscreen canvas during initialization
   - Blit cached text to foreground layer each frame (fast)
   - Existing cache system (LRU, maxSize=50) already handles this

3. **Dirty rectangle optimization:**
   - Text scroll: dirty region = previous text bounding box + current text bounding box
   - Curtains: dirty region = full canvas on phase change, nothing during hold
   - Config flag: `config.performance.dirtyRectangles.enabled` (defer to post-MVP)

4. **Delta time normalization:**
   - Already implemented (DeltaTimer class, deltaTime in seconds)
   - Scroll speed: pixels per second, multiply by deltaTime
   - Frame-rate independent (60fps, 120fps, tab-switch recovery)

---

## Research Summary

**High confidence findings:**
- Semi-transparent curtains with top/bottom entry are table stakes (validated in stinger)
- Three-phase animation pattern is proven (stinger: in/pause/out)
- One-shot OBS page load trigger is reliable (sidebar validates this)
- Canvas measureText() provides accurate text width for scroll timing
- Performance optimization patterns are well-documented (multi-layer, offscreen cache, requestAnimationFrame)

**Medium confidence findings:**
- Dynamic hold duration based on text length is a differentiator (no competitor does this well)
- Reading speed benchmarks (150 WPM) are general-purpose, not stream-specific (requires validation)
- Common overlay mistakes are documented, mitigations are sound

**Low confidence findings:**
- Optimal scroll speed requires empirical testing in production streams
- Text truncation strategy (where to truncate, how to preserve key info) needs real-world use cases

**Research gaps:**
- No specific research on raid/gift sub notification patterns in 2026 (generic alert systems documented)
- Limited information on long-duration performance with scrolling text (existing 8-hour background validation should apply)
- No stream-specific readability research (extrapolating from general reading speed studies)

**Next steps:**
- Implement MVP with conservative timing defaults (3000ms minimum hold, 150 WPM scroll speed)
- Validate in production streams (5+ real raids/gift subs)
- Adjust timing based on empirical readability feedback
- Measure performance impact during gameplay encoding (FPS, memory)

---

*Feature research for: Shade component with scrolling text for major stream events*
*Researched: 2026-01-18*
