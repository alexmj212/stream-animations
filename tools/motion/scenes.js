/**
 * Motion-harness scenarios. Each one loads a scene, starts it the way OBS
 * would, steps the virtual clock frame by frame and checks the result.
 *
 * Adding a scene: give it a url, a start mode, how long to capture, and the
 * checks that define "correct" for it. See .claude/skills/motion-verify.
 *
 * scene: createDebug() name, when it differs from the scenario name (variants)
 *
 * start:
 *   'load'                   - scene animates on page load
 *   { event: 'name' }        - dispatch window event `name` once ready
 *   { event, also: [{event, detail}] } - ...then these in the same instant
 * events: [{at, event, detail}]  - later triggers, dispatched at `at` ms of virtual time
 * viewport: {width, height}  - render at this size instead of --width/--height
 * checks (all optional):
 *   totalDurationMs          - last visible frame must end here (±durationToleranceMs)
 *   endsClear                - final frame fully transparent
 *   fullCoverAtMs            - canvas fully opaque at this time (stinger cut point)
 *   fullCoverMinMs           - ...for at least this long
 *   regionCover              - {x0,x1,y0,y1 (fractions), fromMs, toMs, label}
 *   noVelocitySteps          - no isolated velocity jumps in probe tracks
 *   workP95Ms                - p95 update+draw CPU time per frame, over at least
 *                              MIN_CPU_FRAMES (200) drawn frames (analyze.js)
 *   debugEvents              - {name: count}: exact counts of the scene's debug
 *                              events (src/shared/debug.js, ?debug=events)
 *   probeMax                 - {field, max, label}, or a list of them: a probe sample
 *                              field never exceeds max
 *   textOverPanel            - {fromMs, toMs, label, minAlpha?}: with `textBox: {selector}`,
 *                              every pixel under the text element's on-screen box has at
 *                              least minAlpha (default 250, opaque)
 *   design                   - {rules, fail}: the bible's machine-checkable rules
 *                              (tools/motion/designRules.js). Rules not in `fail` only
 *                              warn (⚠) until the scene meets them; then add them to
 *                              `fail`, and never take one out to get green
 */

const COLOR = '%23ff6600';

export const SCENARIOS = [
  {
    name: 'stinger',
    url: `/src/stinger/index.html?color=${COLOR}&duration=1200`,
    // duration=1200 is what OBS runs on stream (AJ, 2026-10-28, #36).
    // OBS can fire obsSourceActiveChanged with the transition; it must not
    // restart the stinger (Code review, PR #2)
    start: { event: 'transitionStart', also: [{ event: 'obsSourceActiveChanged', detail: { active: true } }] },
    captureMs: 2200,
    keyframes: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    keyframeSpanMs: 1200,
    markers: [{ at: 600, label: 'cut' }, { at: 1200, label: 'end' }],
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      design: { rules: ['CUT-2', 'FLASH-1', 'FLASH-2'], fail: ['CUT-2', 'FLASH-1', 'FLASH-2'] },
      totalDurationMs: 1200,
      endsClear: true,
      fullCoverAtMs: 600,
      fullCoverMinMs: 200,
      debugEvents: { start: 1, ignored: 1, end: 1 },
      // Frame CPU is checked by stinger-cpu: at 1200ms this capture draws
      // only ~74 frames, so p95 was its 4th-worst frame and a cold-JIT
      // frame failed it on a changelog-only diff (Release management, PR #63)
      noVelocitySteps: true
    }
  },
  {
    name: 'stinger-cpu',
    scene: 'stinger',
    // Six back-to-back transitions, as on a busy stream: ~440 drawn frames,
    // enough for a p95 one slow frame can't move
    url: `/src/stinger/index.html?color=${COLOR}&duration=1200`,
    start: { event: 'transitionStart' },
    events: [1500, 3000, 4500, 6000, 7500].map(at => ({ at, event: 'transitionStart' })),
    captureMs: 9000,
    keyframes: [],
    markers: [1500, 3000, 4500, 6000, 7500].map(at => ({ at, label: 'transition' })),
    checks: {
      debugEvents: { start: 6, end: 6 },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // The Aitum Vertical canvas runs the same stinger at 1080x1920 (OBS
    // plugin_config/vertical-canvas). Its curtains left a corner uncovered
    // at the cut there and no check ran portrait (PR #66, 2026-10-28)
    name: 'stinger-vertical',
    scene: 'stinger',
    url: `/src/stinger/index.html?color=${COLOR}&duration=1200`,
    viewport: { width: 1080, height: 1920 },
    start: { event: 'transitionStart' },
    captureMs: 2200,
    keyframes: [0.3, 0.5, 0.7],
    keyframeSpanMs: 1200,
    markers: [{ at: 600, label: 'cut' }, { at: 1200, label: 'end' }],
    checks: {
      design: { rules: ['CUT-2', 'FLASH-1', 'FLASH-2'], fail: ['CUT-2', 'FLASH-1', 'FLASH-2'] },
      totalDurationMs: 1200,
      endsClear: true,
      fullCoverAtMs: 600,
      fullCoverMinMs: 200,
      noVelocitySteps: true
      // No CPU check: one 1.2 s run is too few frames for p95 (QA, #65); the
      // 16:9 stinger scenarios hold the CPU budget
    }
  },
  {
    name: 'sidebar',
    url: `/src/sidebar/index.html?color=${COLOR}&text=Now+Playing&duration=5000`,
    start: 'load',
    captureMs: 6000,
    keyframes: [0.05, 0.1, 0.5, 0.94, 0.97],
    keyframeSpanMs: 5000,
    // duration=5000 is a minimum: enter 500, still to 4650, exit 350 (#35)
    markers: [{ at: 500, label: 'hold' }, { at: 4650, label: 'out' }, { at: 5000, label: 'end' }],
    region: { x0: 0.8, x1: 1, y0: 0, y1: 1 },
    textBox: { selector: '#sidebarText' },
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      design: { rules: ['SAFE-1', 'SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 4650], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 650, toMs: 4600, label: 'the right 20% while holding' },
      // Mix It Up draws avatars over the sidebar in OBS (AJ's bug report,
      // 2026-10-28); zones in config.sidebar.miuZones, view with ?debug=zones
      probeMax: { field: 'miuCover', max: 0, label: 'Text clear of the Mix It Up images' },
      // The text sits on its ink nameplate (86%, alpha 219), never bare over
      // the stream (Design review, 2026-10-28; design audit #34)
      textOverPanel: { fromMs: 650, toMs: 4600, label: 'the nameplate while holding', minAlpha: 215 },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'sidebar-name',
    scene: 'sidebar',
    // Mix It Up's shoutout as OBS sends it: duration=3000 is too short to
    // read, so the hold grows to 3s and the alert to 4s (design audit #35).
    // The name on its own 56px line, the action at 40px (#34)
    url: `/src/sidebar/index.html?color=b00bee&text=Check+out+@thegigglepussgang&duration=3000`,
    start: 'load',
    captureMs: 5000,
    keyframes: [0.05, 0.125, 0.5, 0.92, 0.96],
    keyframeSpanMs: 4000,
    markers: [{ at: 500, label: 'hold' }, { at: 3650, label: 'out' }, { at: 4000, label: 'end' }],
    region: { x0: 0.8, x1: 1, y0: 0, y1: 1 },
    textBox: { selector: '#sidebarText' },
    checks: {
      design: { rules: ['SAFE-1', 'SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 4000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 650, toMs: 3600, label: 'the right 20% while holding' },
      probeMax: { field: 'miuCover', max: 0, label: 'Text clear of the Mix It Up images' },
      textOverPanel: { fromMs: 650, toMs: 3600, label: 'the nameplate while holding', minAlpha: 215 },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'sidebar-long',
    scene: 'sidebar',
    // Long text without a name shrinks, then wraps to two lines (Design
    // review, 2026-10-28); 11 words hold 3s at 200ms a word
    url: `/src/sidebar/index.html?color=${COLOR}&text=Thank+you+so+much+for+the+huge+raid+everybody+welcome+in&duration=3000`,
    start: 'load',
    captureMs: 5000,
    keyframes: [0.05, 0.125, 0.5, 0.92, 0.96],
    keyframeSpanMs: 4000,
    markers: [{ at: 500, label: 'hold' }, { at: 3650, label: 'out' }, { at: 4000, label: 'end' }],
    region: { x0: 0.8, x1: 1, y0: 0, y1: 1 },
    textBox: { selector: '#sidebarText' },
    checks: {
      design: { rules: ['SAFE-1', 'SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 4000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 650, toMs: 3600, label: 'the right 20% while holding' },
      textOverPanel: { fromMs: 650, toMs: 3600, label: 'the nameplate while holding', minAlpha: 215 },
      probeMax: { field: 'miuCover', max: 0, label: 'Text clear of the Mix It Up images' },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // Portrait shoutout (AJ's pick A2, issue #81): the ink nameplate alone,
    // its bottom on the camera/game seam (y 700) and its words inside the
    // phone-safe box, "CHECK OUT" at 48px over the name at 64px
    name: 'sidebar-vertical',
    scene: 'sidebar',
    url: `/src/sidebar/index.html?color=b00bee&text=Check+out+@testchannel&duration=3000`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 5000,
    keyframes: [0.05, 0.125, 0.5, 0.92],
    keyframeSpanMs: 4000,
    markers: [{ at: 500, label: 'hold' }, { at: 3650, label: 'out' }, { at: 4000, label: 'end' }],
    textBox: { selector: '#sidebarText' },
    checks: {
      design: { rules: ['V-SAFE-1', 'KEEP-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['V-SAFE-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 4000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      textOverPanel: { fromMs: 650, toMs: 3600, label: 'the nameplate while holding', minAlpha: 215 },
      noVelocitySteps: true
      // No CPU check: the 16:9 sidebar scenarios hold the budget
    }
  },
  {
    // A real, long username in portrait: the name shrinks toward 48px to
    // stay inside x 60-940, then TYPE-6
    name: 'sidebar-vertical-name',
    scene: 'sidebar',
    url: `/src/sidebar/index.html?color=b00bee&text=Check+out+@thegigglepussgang&duration=3000`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 5000,
    keyframes: [0.125, 0.5],
    keyframeSpanMs: 4000,
    markers: [{ at: 500, label: 'hold' }, { at: 3650, label: 'out' }, { at: 4000, label: 'end' }],
    textBox: { selector: '#sidebarText' },
    checks: {
      design: { rules: ['V-SAFE-1', 'KEEP-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['V-SAFE-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 4000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      textOverPanel: { fromMs: 650, toMs: 3600, label: 'the nameplate while holding', minAlpha: 215 },
      noVelocitySteps: true
    }
  },
  {
    name: 'shade',
    url: `/src/shade/index.html?color=${COLOR}&text=NEW+RAID+INCOMING`,
    start: 'load',
    captureMs: 5500,
    keyframes: [0.05, 0.1, 0.5, 0.85, 0.95],
    keyframeSpanMs: 4500,
    // Curtains close as the text arrives (500), the text is still to 3650,
    // leaves by 4000, the curtains are open at 4500 (design audit #33)
    markers: [{ at: 500, label: 'hold' }, { at: 3650, label: 'exit' }, { at: 4000, label: 'open' }, { at: 4500, label: 'end' }],
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      // No KEEP-1: a tier 3 takeover may cover chat for its hold (Rotom on
      // #79, 2026-10-28; DESIGN.md keep-out zones)
      design: { rules: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'] },
      totalDurationMs: 4500,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: { field: 'bare', max: 0, label: 'Text only over curtains' },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'shade-raid',
    scene: 'shade',
    // The raid as OBS sends it: duration=3000 is the minimum hold
    url: `/src/shade/index.html?color=b00bee&duration=3000&text=@aspiritualbumpit+RAID!!`,
    start: 'load',
    captureMs: 5500,
    keyframes: [0.05, 0.1, 0.5, 0.85],
    keyframeSpanMs: 4500,
    markers: [{ at: 500, label: 'hold' }, { at: 3650, label: 'exit' }, { at: 4500, label: 'end' }],
    checks: {
      // No KEEP-1: a tier 3 takeover may cover chat for its hold (Rotom on
      // #79, 2026-10-28; DESIGN.md keep-out zones)
      design: { rules: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'] },
      totalDurationMs: 4500,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: { field: 'bare', max: 0, label: 'Text only over curtains' },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'shade-long',
    scene: 'shade',
    // Too long for one line even at 72px: name / action on two lines,
    // still inside title-safe, never scrolling (design audit #33). 16 words
    // hold 3.2s
    url: `/src/shade/index.html?color=b00bee&duration=3000&text=@aspiritualbumpit+gifted+50+tier+1+subs+to+the+goobers+thank+you+so+much+for+the+support!!`,
    start: 'load',
    captureMs: 5500,
    keyframes: [0.1, 0.5],
    keyframeSpanMs: 4700,
    markers: [{ at: 500, label: 'hold' }, { at: 3850, label: 'exit' }, { at: 4700, label: 'end' }],
    checks: {
      // No KEEP-1: a tier 3 takeover may cover chat for its hold (Rotom on
      // #79, 2026-10-28; DESIGN.md keep-out zones)
      design: { rules: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3850], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'] },
      totalDurationMs: 4700,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: { field: 'bare', max: 0, label: 'Text only over curtains' },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // Portrait raid with a long name, as OBS's 1080x1920 "Fullscreen Source
    // (vrt)" shows it: the text fits the phone-safe box (x 60-940), off-centre
    // because the apps' button column takes the right 140px (design review,
    // 2026-10-28: "@TESTRAIDER RAID!!" ran to x 1010)
    name: 'shade-vertical-raid',
    scene: 'shade',
    url: `/src/shade/index.html?color=b00bee&duration=3000&text=@aspiritualbumpit+RAID!!`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 5500,
    keyframes: [0.1, 0.5, 0.85],
    keyframeSpanMs: 4500,
    markers: [{ at: 500, label: 'hold' }, { at: 3650, label: 'exit' }, { at: 4500, label: 'end' }],
    // No KEEP-1: a tier 3 takeover may cover chat for its hold, as on 16:9
    checks: {
      design: { rules: ['V-SAFE-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['V-SAFE-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'] },
      totalDurationMs: 4500,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: { field: 'bare', max: 0, label: 'Text only over curtains' },
      noVelocitySteps: true
      // No CPU check: the 16:9 shade scenarios hold the budget
    }
  },
  {
    // A gift line too long for one portrait line: shrinks, then wraps to
    // two lines inside the phone-safe box, never under the 48px phone floor
    name: 'shade-vertical-long',
    scene: 'shade',
    url: `/src/shade/index.html?color=b00bee&duration=3000&text=@aspiritualbumpit+gifted+50+tier+1+subs+to+the+goobers!!`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 5500,
    keyframes: [0.1, 0.5],
    keyframeSpanMs: 4700,
    markers: [{ at: 500, label: 'hold' }, { at: 4700, label: 'end' }],
    // No KEEP-1: a tier 3 takeover may cover chat for its hold, as on 16:9
    checks: {
      design: { rules: ['V-SAFE-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [650, 3650], fail: ['V-SAFE-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'] },
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: { field: 'bare', max: 0, label: 'Text only over curtains' },
      noVelocitySteps: true
    }
  },
  {
    name: 'notifications',
    url: `/src/notifications/index.html?color=${COLOR}&text=Thanks+for+the+follow+friend`,
    start: 'load',
    captureMs: 6000,
    keyframes: [0.05, 0.1, 0.15, 0.22, 0.26, 0.5, 0.8, 0.85, 0.9, 0.95],
    keyframeSpanMs: 5000,
    markers: [{ at: 1000, label: 'hold' }, { at: 4000, label: 'out' }, { at: 5000, label: 'end' }],
    // The body while the toast is out, inside its slanted ends
    region: { x0: 0.31, x1: 0.78, y0: 0.03, y1: 0.065 },
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      // No SAFE-1: the goal bar and toast keep their place in the top margin
      // (AJ's exemption, #40; DESIGN.md SAFE-1). SAFE-3 still holds
      design: { rules: ['SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1000, 4000], fail: ['SAFE-3', 'TYPE-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 1000, toMs: 4000, label: 'the toast body while out' },
      probeMax: [
        { field: 'overflow', max: 0, label: 'Text fits the body' },
        { field: 'bare', max: 0, label: 'Text only over the body' },
        // Streaks never cross the text while it shows (Design review, PR #27)
        { field: 'overText', max: 0, label: 'Streaks clear of the text' }
      ],
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'notifications-name',
    scene: 'notifications',
    // A follow as it really arrives, with a username: the common case, which
    // "...friend" never exercised (Design review on #72, 2026-10-28)
    url: `/src/notifications/index.html?color=${COLOR}&text=Thanks+for+the+follow,+@aspiritualbumpit!+Welcome+in`,
    start: 'load',
    captureMs: 6000,
    keyframes: [0.26, 0.5],
    keyframeSpanMs: 5000,
    markers: [{ at: 1000, label: 'hold' }, { at: 4000, label: 'out' }, { at: 5000, label: 'end' }],
    region: { x0: 0.31, x1: 0.78, y0: 0.03, y1: 0.065 },
    checks: {
      // No SAFE-1: AJ's top-margin exemption (#40), as on notifications.
      // TYPE-1 enforced: before #76 this follow shrank to 37.8px; the bar now
      // grows first and it draws at 42px
      design: { rules: ['SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1000, 4000], fail: ['SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 1000, toMs: 4000, label: 'the toast body while out' },
      probeMax: [
        { field: 'overflow', max: 0, label: 'Text fits the body' },
        { field: 'bare', max: 0, label: 'Text only over the body' }
      ],
      noVelocitySteps: true
    }
  },
  {
    name: 'notifications-long',
    scene: 'notifications',
    // A long headline shrinks, then grows the bar instead of losing words
    // (Design review, 2026-10-28), and the toast stretches to hold it at
    // the reading pace (200 ms a word)
    url: `/src/notifications/index.html?color=${COLOR}&text=Pants+are+officially+off+for+the+rest+of+the+stream+thanks+to+an+incredibly+generous+gift+from+the+goobers+in+chat`,
    start: 'load',
    captureMs: 8000,
    keyframes: [0.1, 0.5, 0.9],
    keyframeSpanMs: 7000,
    markers: [{ at: 7000, label: 'end' }],
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      // No SAFE-1: the goal bar and toast keep their place in the top margin
      // (AJ's exemption, #40; DESIGN.md SAFE-1). SAFE-3 still holds
      design: { rules: ['SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1500, 5000], fail: ['SAFE-3', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 7000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: [
        { field: 'overflow', max: 0, label: 'Text fits the body' },
        { field: 'bare', max: 0, label: 'Text only over the body' },
        // Streaks never cross the text while it shows (Design review, PR #27)
        { field: 'overText', max: 0, label: 'Streaks clear of the text' }
      ],
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'notifications-scroll',
    scene: 'notifications',
    // Too long even for the longest bar: the line scrolls during the hold,
    // inside the body, and the streaks keep clear of it
    url: `/src/notifications/index.html?color=${COLOR}&text=Huge+thanks+to+everybody+who+came+out+tonight+for+the+marathon+stream+and+an+extra+special+shout+out+to+the+goobers+who+kept+the+hype+train+rolling+all+night+long+you+are+the+best`,
    start: 'load',
    captureMs: 13000,
    keyframes: [0.2, 0.35, 0.5, 0.65, 0.8],
    keyframeSpanMs: 11400,
    markers: [{ at: 11400, label: 'end' }],
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      // No SAFE-1: the goal bar and toast keep their place in the top margin
      // (AJ's exemption, #40; DESIGN.md SAFE-1). SAFE-3 still holds
      design: { rules: ['SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1500, 10000], fail: ['SAFE-3', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 11400,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: [
        { field: 'overflow', max: 0, label: 'Whole line shown' },
        { field: 'bare', max: 0, label: 'Text only over the body' },
        { field: 'overText', max: 0, label: 'Streaks clear of the text' }
      ],
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // The portrait toast on the Aitum Vertical canvas (AJ's pick B1,
    // DESIGN.md V-TYPE-1, V-LAYOUT-1): one line at 56px on the camera/game
    // seam, inside the phone-safe box
    name: 'notifications-vertical',
    scene: 'notifications',
    url: `/src/notifications/index.html?color=${COLOR}&text=Thanks+for+the+follow+friend`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 6000,
    keyframes: [0.1, 0.22, 0.5, 0.9],
    keyframeSpanMs: 5000,
    markers: [{ at: 1000, label: 'hold' }, { at: 4000, label: 'out' }, { at: 5000, label: 'end' }],
    // The body while the toast is out, inside its slanted ends
    region: { x0: 0.12, x1: 0.78, y0: 0.35, y1: 0.375 },
    checks: {
      design: { rules: ['V-SAFE-1', 'KEEP-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1000, 4000], fail: ['V-SAFE-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 1000, toMs: 4000, label: 'the toast body while out' },
      probeMax: [
        { field: 'overflow', max: 0, label: 'Text fits the body' },
        { field: 'bare', max: 0, label: 'Text only over the body' },
        { field: 'overText', max: 0, label: 'Streaks clear of the text' }
      ],
      noVelocitySteps: true
      // No CPU check: the 16:9 notifications scenarios hold the budget
    }
  },
  {
    // The common case: a follow line with a username already shrinks to
    // 45px and scrolls in portrait. AJ saw that in the B1 mock and picked
    // it, so V-TYPE-1 and TIME-1 only warn (Design review, PR #72)
    name: 'notifications-vertical-name',
    scene: 'notifications',
    url: `/src/notifications/index.html?color=${COLOR}&text=Thanks+for+the+follow%2C+%40aspiritualbumpit!+Welcome+in`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 6000,
    keyframes: [0.2, 0.4, 0.6, 0.8],
    keyframeSpanMs: 5000,
    markers: [{ at: 1000, label: 'hold' }, { at: 4000, label: 'out' }, { at: 5000, label: 'end' }],
    checks: {
      design: { rules: ['V-SAFE-1', 'KEEP-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1000, 4000], fail: ['V-SAFE-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: [
        { field: 'overflow', max: 0, label: 'Whole line shown' },
        { field: 'bare', max: 0, label: 'Text only over the body' },
        { field: 'overText', max: 0, label: 'Streaks clear of the text' }
      ],
      noVelocitySteps: true
    }
  },
  {
    // A long line in portrait: shrinks to 45px, then scrolls during the
    // hold. That's B1's named exception to V-TYPE-1 and TIME-1 (DESIGN.md),
    // so those two only warn here (Rotom, 2026-10-28)
    name: 'notifications-vertical-long',
    scene: 'notifications',
    url: `/src/notifications/index.html?color=${COLOR}&text=Pants+are+officially+off+for+the+rest+of+the+stream+thanks+to+an+incredibly+generous+gift+from+the+goobers+in+chat`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 8000,
    keyframes: [0.1, 0.3, 0.5, 0.7, 0.9],
    keyframeSpanMs: 7000,
    markers: [{ at: 7000, label: 'end' }],
    checks: {
      design: { rules: ['V-SAFE-1', 'KEEP-1', 'V-TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1500, 5000], fail: ['V-SAFE-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      totalDurationMs: 7000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: [
        { field: 'overflow', max: 0, label: 'Whole line shown' },
        { field: 'bare', max: 0, label: 'Text only over the body' },
        { field: 'overText', max: 0, label: 'Streaks clear of the text' }
      ],
      noVelocitySteps: true
    }
  },
  {
    name: 'followers',
    // Always on: paints 946 at load, then a follow arrives as the event
    // obs-browser's emit_event would send; the sweep runs and 947 lands
    url: `/src/followers/index.html?color=${COLOR}&source=url&count=946`,
    start: { event: 'followers', also: [{ event: 'followers', detail: { count: 947 } }] },
    captureMs: 2000,
    keyframes: [0.05, 0.15, 0.3, 0.45, 0.6, 0.9],
    keyframeSpanMs: 2000,
    markers: [{ at: 1150, label: 'landed' }],
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones.
      // No TIME-1: the goal bar is always on and its text never moves, so the
      // rule only measured this 2s capture (Design review, 2026-10-28)
      // No SAFE-1: the goal bar and toast keep their place in the top margin
      // (AJ's exemption, #40; DESIGN.md SAFE-1). SAFE-3 still holds
      // KEEP-1 warns by design: the goal bar sits on the music info box's
      // waveform (x 19-481, y 0-124). Accepted while the waveform draws under
      // the bar's solid plate (Rotom on #79, 2026-10-28; AJ's place, #62)
      design: { rules: ['SAFE-3', 'KEEP-1', 'TYPE-1', 'FLASH-1', 'FLASH-2'], fail: ['SAFE-3', 'TYPE-1', 'FLASH-1', 'FLASH-2'] },
      // The follow lands before the first frame runs, so the first paint
      // already animates: one count, and one idle once it has landed
      debugEvents: { start: 1, count: 1, idle: 1 },
      probeMax: { field: 'overflow', max: 0, label: 'Text fits the bar' },
      // Frame CPU is checked by followers-cpu: this 2s capture draws only
      // ~70 frames, so p95 was its 4th-worst frame and one GC pause failed it
      // (Code review, PR #48; issue #50)
      noVelocitySteps: true
    }
  },
  {
    // Frame CPU for the followers scene over a sample big enough to be
    // stable: five follows, two seconds apart, ~350 drawn frames. Idle
    // frames draw nothing and don't count toward p95 (issue #50)
    name: 'followers-cpu',
    scene: 'followers',
    url: `/src/followers/index.html?color=${COLOR}&source=url&count=946`,
    start: { event: 'followers', also: [{ event: 'followers', detail: { count: 947 } }] },
    events: [2000, 4000, 6000, 8000].map((at, i) => ({ at, event: 'followers', detail: { count: 948 + i } })),
    captureMs: 10000,
    keyframes: [],
    markers: [2000, 4000, 6000, 8000].map(at => ({ at, label: 'follow' })),
    checks: {
      debugEvents: { start: 1, count: 5, idle: 5 },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // Scene title card (WELCOME, BRB, ENDING): slides in once at load and
    // holds still for the whole scene, drawing nothing once it lands
    // (design audit #39; AJ, 2026-10-28: no subtext)
    name: 'title',
    url: `/src/title/index.html?text=WELCOME`,
    start: 'load',
    captureMs: 4500,
    keyframes: [0.03, 0.08, 0.13, 0.2, 0.5],
    keyframeSpanMs: 4500,
    markers: [{ at: 500, label: 'plate in' }, { at: 1000, label: 'still' }],
    checks: {
      // The bible's rules (docs/DESIGN.md); a new scene meets all of them
      design: { rules: ['SAFE-1', 'SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1000, 4500], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      debugEvents: { start: 1, idle: 1 },
      noVelocitySteps: true
    }
  },
  {
    // A title too long for hero shrinks toward display, still inside title-safe
    name: 'title-long',
    scene: 'title',
    url: `/src/title/index.html?text=Thanks+for+hanging+out+tonight+everybody`,
    start: 'load',
    captureMs: 4500,
    keyframes: [0.2, 0.5],
    keyframeSpanMs: 4500,
    checks: {
      design: { rules: ['SAFE-1', 'SAFE-3', 'KEEP-1', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2'], holdMs: [1000, 4500], fail: ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'FLASH-1', 'FLASH-2', 'KEEP-1'] },
      debugEvents: { start: 1, idle: 1 },
      noVelocitySteps: true
    }
  },
  {
    // Banner lane (issue #85), in AJ's original OBS look (#86): the hype
    // train strip wipes in from the goal bar's end, in the toast's own place
    // (AJ, #86), and the line scrolls across it. Everything stays inside the
    // lane, x 560 (the follower bar's end) to 1920, y 26-74, with 32px caps
    // (TYPE-1). No TIME-1: the marquee is
    // AJ's exemption from still text (MOTION.md Learnings). It draws every
    // frame for as long as it's up, so it carries a CPU check
    name: 'banner-hype',
    scene: 'banner',
    url: `/src/banner/index.html?kind=hype`,
    start: 'load',
    captureMs: 6000,
    // 0.6 s, 3 s and 5.4 s: three points on the colour cycle
    keyframes: [0.02, 0.05, 0.1, 0.5, 0.9],
    keyframeSpanMs: 6000,
    markers: [{ at: 500, label: 'strip in' }],
    checks: {
      // No SAFE-1: in the toast's place it shares the toast's top-margin
      // exemption (AJ, #40 and #86; DESIGN.md SAFE-1). SAFE-3 still holds
      design: { rules: ['SAFE-3', 'KEEP-1', 'TYPE-1', 'FLASH-1', 'FLASH-2'], holdMs: [600, 6000], fail: ['SAFE-3', 'KEEP-1', 'TYPE-1', 'FLASH-1', 'FLASH-2'] },
      debugEvents: { start: 1, in: 1 },
      probeMax: [
        { field: 'outsideLane', max: 0, label: 'Inside the banner lane' },
        { field: 'capShort', max: 0, label: 'Caps at least 32px' }
      ],
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // The ad warning: black text on an orange plate at half opacity along
    // the bottom edge, full width (AJ, #86: "I had it on the bottom of the
    // screen and not opacity 1"). No SAFE-1 or SAFE-3: AJ's exemption for
    // this quiet notice, which sits under the player controls as the OBS
    // group did. KEEP-1 only warns: on Starting and BRB the strip runs
    // under the song line bottom-left (x 0-651, y 1037-1080), as the OBS
    // group did; raised with AJ on #86
    name: 'banner-ad',
    scene: 'banner',
    url: `/src/banner/index.html?kind=ad`,
    start: 'load',
    captureMs: 6000,
    keyframes: [0.05, 0.5],
    keyframeSpanMs: 6000,
    checks: {
      design: { rules: ['KEEP-1', 'TYPE-1', 'FLASH-1', 'FLASH-2'], holdMs: [600, 6000], fail: ['TYPE-1', 'FLASH-1', 'FLASH-2'] },
      debugEvents: { start: 1, in: 1 },
      probeMax: [
        { field: 'outsideLane', max: 0, label: 'Inside its lane' },
        { field: 'capShort', max: 0, label: 'Caps at least 32px' }
      ],
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // The hype banner on the Aitum Vertical canvas (AJ, #86): in the
    // portrait toast's place on the camera/game seam, every word inside the
    // phone-safe box, at a ~57px line (V-TYPE-1)
    name: 'banner-vertical',
    scene: 'banner',
    url: `/src/banner/index.html?kind=hype`,
    viewport: { width: 1080, height: 1920 },
    start: 'load',
    captureMs: 6000,
    keyframes: [0.05, 0.5, 0.9],
    keyframeSpanMs: 6000,
    markers: [{ at: 500, label: 'strip in' }],
    checks: {
      design: { rules: ['V-SAFE-1', 'KEEP-1', 'V-TYPE-1', 'FLASH-1', 'FLASH-2'], holdMs: [600, 6000], fail: ['V-SAFE-1', 'KEEP-1', 'V-TYPE-1', 'FLASH-1', 'FLASH-2'] },
      debugEvents: { start: 1, in: 1, layout: 1 },
      probeMax: [
        { field: 'outsideLane', max: 0, label: 'Inside the portrait lane' },
        { field: 'capShort', max: 0, label: 'Caps at least 40px' }
      ],
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'background',
    url: `/src/background/index.html?color=${COLOR}`,
    start: 'load',
    captureMs: 8000,
    keyframes: [0.25, 0.5, 0.75, 1],
    keyframeSpanMs: 8000,
    markers: [],
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      design: { rules: ['FLASH-1', 'FLASH-2'], fail: ['FLASH-1', 'FLASH-2'] },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    // Continuous light show: no motion probe; this guards per-frame cost.
    // fps=60 so every stepped frame renders (the scene's own default caps at 30).
    name: 'epcot',
    url: '/src/epcot/index.html?panel=false&fps=60',
    start: 'load',
    // 4.5s for ~270 drawn frames: 3s drew 181, under the CPU check's 200
    // (its fps cap skips some 60Hz ticks)
    captureMs: 4500,
    keyframes: [0.5, 1],
    keyframeSpanMs: 4500,
    markers: [],
    checks: {
      // The bible's rules (docs/DESIGN.md, issue #43); `fail` lists the enforced ones
      design: { rules: ['FLASH-1', 'FLASH-2'], fail: ['FLASH-1', 'FLASH-2'] },
      workP95Ms: 20
    }
  },
  {
    // AJ's Spheal march gag (2026-10-29): not held to the bible, but it
    // must end clear once the giant has rolled off, stop its song once
    // (the end event), and stay inside the frame budget at the peak crowd
    // (~470 on screen at 30-34 s). ?mute=1: the harness has no audio
    name: 'spheal',
    // sprite=drawn keeps the run off the network; the PokeAPI sprite is
    // the same stamping path with another image (tests/spheal)
    url: '/src/spheal/index.html?seed=1&mute=1&sprite=drawn',
    start: 'load',
    captureMs: 52500,
    keyframes: [0.04, 0.24, 0.46, 0.6, 0.66, 0.8, 0.94],
    keyframeSpanMs: 52500,
    markers: [{ at: 32000, label: 'last spawn' }, { at: 35000, label: 'giant' }],
    checks: {
      // The giant sets off at 35 s and crosses 1920 + 460 px at 150 px/s
      totalDurationMs: 50870,
      endsClear: true,
      debugEvents: { start: 1, end: 1 },
      noVelocitySteps: true,
      // ~470 sprites at the peak: p95 measured 3.0-3.5 ms (seeds 1-3,
      // 2026-10-29), so 8 leaves room on CI without hiding a regression
      workP95Ms: 8
    }
  }
];
