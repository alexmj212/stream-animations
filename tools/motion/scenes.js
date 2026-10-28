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
 * checks (all optional):
 *   totalDurationMs          - last visible frame must end here (±durationToleranceMs)
 *   endsClear                - final frame fully transparent
 *   fullCoverAtMs            - canvas fully opaque at this time (stinger cut point)
 *   fullCoverMinMs           - ...for at least this long
 *   regionCover              - {x0,x1,y0,y1 (fractions), fromMs, toMs, label}
 *   noVelocitySteps          - no isolated velocity jumps in probe tracks
 *   workP95Ms                - p95 update+draw CPU time per frame
 *   debugEvents              - {name: count}: exact counts of the scene's debug
 *                              events (src/shared/debug.js, ?debug=events)
 *   probeMax                 - {field, max, label}, or a list of them: a probe sample
 *                              field never exceeds max
 *   textOverPanel            - {fromMs, toMs, label}: with `textBox: {selector}`, every
 *                              pixel under the text element's on-screen box is opaque
 */

const COLOR = '%23ff6600';

export const SCENARIOS = [
  {
    name: 'stinger',
    url: `/src/stinger/index.html?color=${COLOR}&duration=1500`,
    // OBS can fire obsSourceActiveChanged with the transition; it must not
    // restart the stinger (Code review, PR #2)
    start: { event: 'transitionStart', also: [{ event: 'obsSourceActiveChanged', detail: { active: true } }] },
    captureMs: 2500,
    keyframes: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    keyframeSpanMs: 1500,
    markers: [{ at: 750, label: 'cut' }, { at: 1500, label: 'end' }],
    checks: {
      totalDurationMs: 1500,
      endsClear: true,
      fullCoverAtMs: 750,
      fullCoverMinMs: 200,
      debugEvents: { start: 1, ignored: 1, end: 1 },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'sidebar',
    url: `/src/sidebar/index.html?color=${COLOR}&text=Now+Playing&duration=5000`,
    start: 'load',
    captureMs: 6000,
    keyframes: [0.05, 0.15, 0.25, 0.5, 0.75, 0.85, 0.95],
    keyframeSpanMs: 5000,
    markers: [{ at: 1250, label: 'hold' }, { at: 3750, label: 'out' }, { at: 5000, label: 'end' }],
    region: { x0: 0.8, x1: 1, y0: 0, y1: 1 },
    textBox: { selector: '#sidebarText' },
    checks: {
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 1400, toMs: 3700, label: 'the right 20% while holding' },
      // Mix It Up draws avatars over the sidebar in OBS (AJ's bug report,
      // 2026-10-28); zones in config.sidebar.miuZones, view with ?debug=zones
      probeMax: { field: 'miuCover', max: 0, label: 'Text clear of the Mix It Up images' },
      // Text never hangs off the panel over the stream (Design review, 2026-10-28)
      textOverPanel: { fromMs: 1400, toMs: 3700, label: 'the panel while holding' },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'sidebar-long',
    scene: 'sidebar',
    // A raid thank-you must fit the panel: shrink, then wrap (Design review, 2026-10-28)
    url: `/src/sidebar/index.html?color=${COLOR}&text=Thank+you+so+much+for+the+huge+raid+everybody+welcome+in&duration=5000`,
    start: 'load',
    captureMs: 6000,
    keyframes: [0.05, 0.15, 0.25, 0.5, 0.75, 0.85, 0.95],
    keyframeSpanMs: 5000,
    markers: [{ at: 1250, label: 'hold' }, { at: 3750, label: 'out' }, { at: 5000, label: 'end' }],
    region: { x0: 0.8, x1: 1, y0: 0, y1: 1 },
    textBox: { selector: '#sidebarText' },
    checks: {
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      regionCover: { fromMs: 1400, toMs: 3700, label: 'the right 20% while holding' },
      // Text never hangs off the panel over the stream (Design review, 2026-10-28)
      textOverPanel: { fromMs: 1400, toMs: 3700, label: 'the panel while holding' },
      // Mix It Up draws avatars over the sidebar in OBS (AJ's bug report,
      // 2026-10-28); zones in config.sidebar.miuZones, view with ?debug=zones
      probeMax: { field: 'miuCover', max: 0, label: 'Text clear of the Mix It Up images' },
      noVelocitySteps: true,
      workP95Ms: 4
    }
  },
  {
    name: 'shade',
    url: `/src/shade/index.html?color=${COLOR}&text=NEW+RAID+INCOMING`,
    start: 'load',
    captureMs: 6000,
    keyframes: [0.05, 0.15, 0.25, 0.5, 0.75, 0.85, 0.95],
    keyframeSpanMs: 5000,
    markers: [{ at: 1000, label: 'hold' }, { at: 4000, label: 'exit' }, { at: 5000, label: 'end' }],
    checks: {
      totalDurationMs: 5000,
      debugEvents: { start: 1, end: 1 },
      endsClear: true,
      probeMax: { field: 'bare', max: 0, label: 'Text only over curtains' },
      noVelocitySteps: true,
      workP95Ms: 4
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
    region: { x0: 0.25, x1: 0.78, y0: 0.03, y1: 0.065 },
    checks: {
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
    name: 'notifications-long',
    scene: 'notifications',
    // A long headline shrinks, then ends in an ellipsis, and the toast
    // stretches to hold it at the reading pace (200 ms a word)
    url: `/src/notifications/index.html?color=${COLOR}&text=Pants+are+officially+off+for+the+rest+of+the+stream+thanks+to+an+incredibly+generous+gift+from+the+goobers+in+chat`,
    start: 'load',
    captureMs: 8000,
    keyframes: [0.1, 0.5, 0.9],
    keyframeSpanMs: 7000,
    markers: [{ at: 7000, label: 'end' }],
    checks: {
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
      // The follow lands before the first frame runs, so the first paint
      // already animates: one count, and one idle once it has landed
      debugEvents: { start: 1, count: 1, idle: 1 },
      probeMax: { field: 'overflow', max: 0, label: 'Text fits the bar' },
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
    captureMs: 3000,
    keyframes: [0.5, 1],
    keyframeSpanMs: 3000,
    markers: [],
    checks: {
      workP95Ms: 20
    }
  }
];
