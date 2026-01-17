# Feature Research

**Domain:** OBS Stream Graphics & Animations (Canvas-based Browser Sources)
**Researched:** 2026-01-17
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Event-driven alerts (follow, subscribe, donation, raid) | Core function of stream graphics - viewers expect visual feedback for community events | MEDIUM | Requires event source integration (Twitch API, StreamElements, Streamlabs). Animation timing critical. |
| Basic customization (colors, text, sounds) | Every streamer wants unique branding; "one-size-fits-all" = unprofessional | LOW | URL parameters or config file. Color theming via CSS variables or JSON config. |
| Transparent background support | Must layer over gameplay without blocking content | LOW | Canvas already transparent. Export as WebM for video transitions. |
| Persistent background animations | Streams look static/cheap without ambient motion | MEDIUM | Performance-critical - must maintain 30-60fps with minimal CPU. Already implemented. |
| Scene transition animations (stingers) | Hard cuts between scenes look unprofessional | MEDIUM | 0.5-2 second duration, timing transition point correctly (500-1000ms mark). Already implemented. |
| Responsive to platform events | Must respond to Twitch/YouTube events in real-time | MEDIUM | Event integration via browser source communication or API polling. Existing implementation handles OBS events. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Ultra-low CPU/GPU usage | Personal streamers often have limited hardware; performance = competitive edge | HIGH | Requires canvas optimization (requestAnimationFrame, dirty regions, layered canvases, hardware acceleration). **Aligns with core value.** |
| Cohesive visual language across all animations | Most overlays feel like Frankenstein collections; unified design = professional | MEDIUM | Shared animation primitives, color system, timing curves. Already started with shared bars/colors. |
| Local-first configuration | No accounts, no server dependencies, works offline | LOW | URL parameters + localStorage. Better DX than cloud dashboards for personal use. |
| Quick notification type extension | Adding new alert types should be trivial, not a refactor | MEDIUM | Shared animation components, plugin architecture. **Current goal: "Make adding new notification types quick."** |
| Minimal visual footprint | Clean, distraction-free overlays let gameplay/streamer shine | LOW | Minimal design philosophy. Growing trend in 2025. |
| Frame-perfect animation timing | Smooth 60fps animations feel premium vs janky 30fps defaults | MEDIUM | requestAnimationFrame, proper easing functions, no layout thrashing. |
| Smart queueing for rapid events | Multiple alerts don't overlap/skip - they queue gracefully | MEDIUM | Event queue with timing management. Prevents alert spam during raids. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rich WYSIWYG editor in-app | "I want to customize without code" | Adds massive complexity (300KB+ JS framework), increases CPU usage, creates maintenance burden for solo streamer tool | Use URL parameters + simple JSON config. Document examples. Pre-built themes. |
| Video file backgrounds (MP4 loops) | "Animated backgrounds look cool" | Chroma key hacks, poor performance, 10MB+ file sizes, not hardware decoded in browser sources | Canvas animations (current approach). WebM for transitions only. Procedural generation. |
| Real-time preview mode | "I want to see changes immediately" | Requires dev server, hot reload, complicates deployment | Use OBS Studio's built-in preview. Refresh browser source to see changes. |
| Dozens of animation presets | "More options = more value" | Analysis paralysis, maintenance burden, most go unused | 3-5 well-designed presets. Focus on customization of core animations. |
| Cloud sync/account system | "Save my settings across devices" | Server costs, privacy concerns, adds latency, authentication complexity | localStorage + export/import JSON. Personal streamers use one machine. |
| 3D animations / particle systems | "Advanced effects = professional" | WebGL overhead, GPU memory, mobile compatibility issues, complexity | Optimized 2D canvas animations can look premium with good design. |
| Integrate with every platform | "Support Facebook/TikTok/Mixer" | Maintenance nightmare, each platform has quirks | Focus on Twitch + OBS events. Generic event API lets users bridge others. |

## Feature Dependencies

```
[Event-driven alerts]
    └──requires──> [Event source integration]
                       └──requires──> [Browser message protocol]

[Smart queueing]
    └──requires──> [Event-driven alerts]
    └──enhances──> [Notification animations]

[Ultra-low CPU usage]
    └──requires──> [Canvas optimizations]
    └──requires──> [Hardware acceleration enabled]

[Cohesive visual language]
    └──requires──> [Shared animation primitives]
    └──enhances──> [All animation types]

[Quick notification extension]
    └──requires──> [Shared animation components]
    └──requires──> [Centralized configuration]

[Frame-perfect timing]
    └──conflicts──> [Heavy animations]
```

### Dependency Notes

- **Event-driven alerts require browser message protocol:** OBS browser sources communicate via `window.obsstudio` and custom events. Must handle event payload parsing.
- **Smart queueing requires event-driven alerts:** Can't queue events that don't exist. Queue must respect animation durations.
- **Ultra-low CPU usage requires canvas optimizations:** requestAnimationFrame, minimize redraws, avoid layout thrashing, use layered canvases for static/dynamic content.
- **Quick notification extension requires shared components:** Notification types should inherit from base animation classes, use shared color/timing systems.
- **Frame-perfect timing conflicts with heavy animations:** Can't maintain 60fps if each frame does expensive operations. Must optimize or cap at 30fps.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] Background animation (continuous, persistent) — Already implemented. Performance-critical foundation.
- [x] Stinger transition (OBS event-driven) — Already implemented. Validates event integration.
- [x] Basic notification sidebar — Already implemented. Proves notification pattern works.
- [ ] URL parameter configuration — Essential for customization without complexity.
- [ ] 2-3 notification types (follow, subscribe, generic) — Validates "quick to add new types" goal.
- [ ] Performance monitoring/FPS counter — Validates core value (low CPU usage).
- [ ] Shared animation primitive library — Enables future extension.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Smart event queueing — Add when users report overlapping alerts.
- [ ] Additional notification types (raid, donation, bits) — Add as usage patterns emerge.
- [ ] Animation timing presets (fast/medium/slow) — Add when customization requests arrive.
- [ ] Export/import configuration — Add when users request sharing setups.
- [ ] Multiple visual themes — Add when core animations are locked down.
- [ ] Sound effect support — Add when visual animations are solid.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Visual configuration builder — Only if users struggle with URL parameters.
- [ ] Custom CSS injection — Advanced users only. Document risks.
- [ ] Animation editor/timeline — High complexity. Defer until proven demand.
- [ ] Community preset marketplace — Only if user base grows significantly.
- [ ] Goal bars / progress widgets — Different use case. Separate concern.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| URL parameter configuration | HIGH | LOW | P1 |
| Shared animation primitives | HIGH | MEDIUM | P1 |
| 2-3 notification types | HIGH | MEDIUM | P1 |
| Performance monitoring | MEDIUM | LOW | P1 |
| Smart event queueing | MEDIUM | MEDIUM | P2 |
| Additional notification types | MEDIUM | LOW | P2 |
| Animation timing presets | MEDIUM | LOW | P2 |
| Export/import config | LOW | LOW | P2 |
| Sound effect support | MEDIUM | MEDIUM | P2 |
| Multiple visual themes | MEDIUM | MEDIUM | P2 |
| Visual config builder | LOW | HIGH | P3 |
| Custom CSS injection | LOW | MEDIUM | P3 |
| Animation editor | LOW | HIGH | P3 |
| Community marketplace | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (validates core value + goals)
- P2: Should have, add when possible (improves UX, extends capability)
- P3: Nice to have, future consideration (high complexity, unclear demand)

## Competitor Feature Analysis

| Feature | StreamElements | Streamlabs | Our Approach |
|---------|---------------|------------|--------------|
| Alert types | Comprehensive (follow, sub, donation, raid, bits, host) | Comprehensive + premium animated themes | Start with 2-3 core types, optimize performance. Add types incrementally. |
| Customization | Browser-based editor, CSS/HTML/JS support | WYSIWYG editor (limited) + premium themes | URL parameters + JSON config. No server, no accounts. Documentation-first. |
| Configuration | Cloud-based, requires account | Desktop app (Streamlabs Desktop) or cloud | Local-first. localStorage + export/import. Works offline. |
| Performance | Cloud-based = low system impact | Desktop app = heavy on resources | Ultra-low CPU via canvas optimization. Hardware acceleration. Single browser source. |
| Animation quality | Template-based, varies widely | Professional but paywalled | Cohesive visual language. Frame-perfect timing. Minimal design. |
| Cost model | Free with upsells | Free + premium (Ultra subscription) | Fully free. Open source potential. |
| Platform integration | Twitch, YouTube, Facebook, Trovo | Twitch, YouTube, Facebook | Focus on OBS events + generic event API. Platform-agnostic design. |
| Extension model | Widget marketplace | Premium theme packs | Shared components make adding types trivial. Document patterns. |

## Animation Type Catalog

Based on professional stream graphics research, animation types by frequency:

### Core Notification Types (Table Stakes)
- **Follow alert:** User follows the channel. Simplest event. ~1-2 second duration.
- **Subscription alert:** User subscribes. May include tier info. ~2-3 second duration.
- **Donation/Tip alert:** Monetary support. May include amount, message. ~3-5 second duration.
- **Raid alert:** Incoming raid from another channel. Include raider name, count. ~3-5 second duration.
- **Bits/Cheer alert:** Twitch bits donation. Similar to donation. ~2-3 second duration.

### Extended Notification Types (Differentiators)
- **Host alert:** Channel is hosting you (less common now). ~2-3 second duration.
- **Gift sub alert:** User gifts subscriptions to others. Include count. ~2-3 second duration.
- **Milestone alert:** Follower/subscriber milestones (100 followers, etc.). ~3-5 second duration.
- **Custom event alert:** User-triggered via channel points, commands. Flexible duration.

### Persistent Widgets (Different Category)
- **Goal bars:** Progress toward follower/subscriber goals. Static or slow-updating.
- **Countdown timers:** Stream start, event countdown. Updates every second.
- **Chat box:** Live chat overlay. Continuous updates.
- **Viewer count:** Current viewer stat. Updates every 30-60 seconds.
- **Recent events list:** Scrolling list of recent follows/subs. Continuous.

### Transition Types (Scene Changes)
- **Stinger transition:** Animated scene transition. 0.5-2 seconds. Already implemented.
- **Fade transition:** Simple cross-fade. Basic, but smooth.
- **Slide transition:** Scenes slide in/out. Directional.
- **Zoom transition:** Scale in/out effect. Can be jarring if overused.

### Background Types (Persistent Ambient)
- **Animated bars:** Geometric shapes moving. Already implemented. Low CPU.
- **Particle effects:** Floating elements. Higher CPU. Use sparingly.
- **Gradient animations:** Color shifts over time. Very low CPU.
- **Waveforms:** Audio-reactive. Medium CPU. Requires audio input.

## Configuration Approach Comparison

| Approach | Pros | Cons | Recommended For |
|----------|------|------|-----------------|
| URL parameters | Simple, no server, shareable links | Limited for complex config | Personal streamers, quick setup |
| JSON config file | Structured, supports complexity, versionable | Requires file editing | Advanced users, source control |
| localStorage | Persists across sessions, no files | Not shareable, browser-specific | Local-only, no backups |
| Cloud dashboard | User-friendly, accessible anywhere | Requires account, server costs, latency | Enterprise, multi-device |
| In-app WYSIWYG | Visual, no code needed | High complexity, large bundle size | Mainstream products only |

**Our recommendation:** Hybrid URL parameters + JSON config. URL params for simple customization (colors, text). JSON for advanced (animation timing, behavior). Export/import JSON for sharing.

## Performance Benchmarks (Research Findings)

Based on OBS community feedback and best practices:

| Optimization | CPU Impact | Implementation |
|--------------|------------|----------------|
| requestAnimationFrame vs setInterval | -30% CPU | Use RAF for all animations. Already implemented. |
| Hardware acceleration | -40% CPU | Enable in OBS browser source settings. Document requirement. |
| Custom frame rate (30fps) | -25% CPU | Set in browser source properties. User configurable. |
| Dirty region redraws | -20% CPU | Only redraw changed canvas areas. Implement for static backgrounds. |
| Layered canvases | -15% CPU | Separate static/dynamic content. Consider for complex scenes. |
| WebM format for videos | -50% CPU vs MP4 | Use WebM with alpha for transitions. Already using for stingers. |
| Minimize canvas size | -10% CPU | 1920x1080 max. Smaller if possible. Document sizing. |

**Target:** 1-3% CPU usage for background animation + alerts on modern hardware. Under 5% on older systems.

## Sources

### Professional Stream Graphics Research
- [Nerd or Die - Streamlabs vs StreamElements](https://nerdordie.com/blog/tutorials/streamlabs-vs-streamelements/)
- [Restream - Streamlabs vs StreamElements Comparison](https://restream.io/learn/comparisons/streamlabs-vs-streamelements/)
- [FragileGFX - Streamlabs vs StreamElements 2025](https://fragilegfx.com/blogs/news/streamlabs-vs-streamelements-2025)
- [Twitch Help - Types of Alerts](https://help.twitch.tv/s/article/alerts-by-twitch-events?language=en_US)
- [Streamlabs - Setting Up Alerts](https://streamlabs.com/content-hub/post/setting-up-your-streamlabs-alerts)

### Design & Best Practices
- [GETREKT Labs - Stream Overlay Design Guide](https://getrektlabs.com/blogs/news/choose-your-stream-overlays-where-to-start-what-to-avoid)
- [Nerd or Die - Focus Minimal Overlay](https://nerdordie.com/product/focus-minimal-overlay-and-alerts/)
- [Dexpixel - Stream Transitions in OBS](https://dexpixel.com/blogs/live-streaming/what-is-stream-transtion)
- [StreamGeeks - Stinger Transitions Guide](https://streamgeeks.us/how-to-use-and-make-stingers-transitions-in-obs/)

### Performance Optimization
- [GitHub - HTML5 Canvas Performance Tips](https://gist.github.com/jaredwilli/5469626)
- [web.dev - Improving HTML5 Canvas Performance](https://web.dev/articles/canvas-performance)
- [OBS Forums - Browser Source CPU Optimization](https://obsproject.com/forum/threads/browser-source-cpu-optimization.82406/)
- [Movavi - OBS High CPU Usage Fixes](https://www.movavi.com/learning-portal/obs-high-cpu-usage.html)

### Widget & Configuration Research
- [StreamElements - Countdown Timer Widget](https://widgets.streamelements.com/element/countdown-timer)
- [Yostream - Twitch Alerts in OBS](https://yostream.io/tutorials/add-twitch-alerts-chat-obs-guide/)
- [OBS Knowledge Base - Stream Tutorial 2: Alerts & Chat](https://obsproject.com/kb/stream-tutorial-2-alerts)

---
*Feature research for: OBS Stream Graphics & Animations (Canvas-based Browser Sources)*
*Researched: 2026-01-17*
*Confidence: MEDIUM - Findings based on professional tools analysis, community best practices, and performance optimization research. Needs validation with actual user testing of canvas-based approach vs template-based competitors.*
