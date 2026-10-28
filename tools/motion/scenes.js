/**
 * Motion-harness scenarios. Each one loads a scene, starts it the way OBS
 * would, steps the virtual clock frame by frame and checks the result.
 *
 * Adding a scene: give it a url, a start mode, how long to capture, and the
 * checks that define "correct" for it. See .claude/skills/motion-verify.
 *
 * start:
 *   'load'                   - scene animates on page load
 *   { event: 'name' }        - dispatch window event `name` once ready
 * checks (all optional):
 *   totalDurationMs          - last visible frame must end here (±durationToleranceMs)
 *   endsClear                - final frame fully transparent
 *   fullCoverAtMs            - canvas fully opaque at this time (stinger cut point)
 *   fullCoverMinMs           - ...for at least this long
 *   regionCover              - {x0,x1,y0,y1 (fractions), fromMs, toMs, label}
 *   noVelocitySteps          - no isolated velocity jumps in probe tracks
 *   workP95Ms                - p95 update+draw CPU time per frame
 */

const COLOR = '%23ff6600';

export const SCENARIOS = [
  {
    name: 'stinger',
    url: `/src/stinger/index.html?color=${COLOR}&duration=1500`,
    start: { event: 'transitionStart' },
    captureMs: 2500,
    keyframes: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    keyframeSpanMs: 1500,
    markers: [{ at: 750, label: 'cut' }, { at: 1500, label: 'end' }],
    checks: {
      totalDurationMs: 1500,
      endsClear: true,
      fullCoverAtMs: 750,
      fullCoverMinMs: 200,
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
    checks: {
      totalDurationMs: 5000,
      endsClear: true,
      regionCover: { fromMs: 1400, toMs: 3700, label: 'the right 20% while holding' },
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
      endsClear: true,
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
  }
];
