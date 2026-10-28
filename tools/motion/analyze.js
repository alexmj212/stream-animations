/**
 * Pure analysis helpers for motion-harness captures. No browser, no I/O -
 * unit tested in tests/tools/motionAnalyze.test.js.
 *
 * A capture is an array of frames:
 *   { t, workMs, pixels: {opaque, visible, regionGaps?, grid?}, samples: [{id, x, y?, phase?, onscreen?, box?}] }
 */

import { config } from '../../src/config/config.js';
import { evaluateDesignRules } from './designRules.js';

/** Group probe samples into per-object tracks: id -> [{t, x, y, phase, onscreen}] */
export function buildTracks(frames) {
  const tracks = new Map();
  for (const frame of frames) {
    for (const s of frame.samples || []) {
      if (!tracks.has(s.id)) tracks.set(s.id, []);
      tracks.get(s.id).push({ t: frame.t, x: s.x, y: s.y ?? 0, phase: s.phase, onscreen: s.onscreen !== false });
    }
  }
  return tracks;
}

/** Per-frame velocities (px/s) for one track, using x and y. */
export function velocities(track) {
  const out = [];
  for (let i = 1; i < track.length; i++) {
    const dt = (track[i].t - track[i - 1].t) / 1000;
    if (dt <= 0) continue;
    out.push({
      t: track[i].t,
      vx: (track[i].x - track[i - 1].x) / dt,
      vy: (track[i].y - track[i - 1].y) / dt,
      onscreen: track[i].onscreen && track[i - 1].onscreen,
      phase: track[i].phase,
      prevPhase: track[i - 1].phase
    });
  }
  return out;
}

/**
 * Find velocity discontinuities ("lurches"): frames where velocity changes
 * in a way its neighbours don't predict, by a margin that is large compared
 * with how fast the object is moving.
 *
 * Smooth easing changes velocity a little every frame, and those changes
 * follow a trend, so each frame's Δv is close to the average of its
 * neighbours' Δv. A phase hand-off that resets velocity (ease to a stop,
 * then snap to a drift speed) breaks the trend for a single frame. The
 * residual is compared against the local speed because the eye notices
 * the same Δv far more on a slow object than on one moving fast.
 *
 * @param {Array} track - One object's samples
 * @param {Object} opts
 * @param {number} opts.minStep - Ignore residuals smaller than this (px/s)
 * @param {number} opts.relative - Residual / (speed + speedFloor) that counts as a jump
 * @param {number} opts.speedFloor - px/s added to speed so near-stationary noise is ignored
 * @param {number} opts.teleport - Per-frame displacement treated as a wrap/reset (px)
 */
export function findVelocitySteps(track, { minStep = 45, relative = 0.45, speedFloor = 100, teleport = 400 } = {}) {
  const v = velocities(track);
  const dv = [];
  for (let i = 1; i < v.length; i++) {
    dv.push({
      i,
      t: v[i].t,
      x: v[i].vx - v[i - 1].vx,
      y: v[i].vy - v[i - 1].vy,
      speed: Math.max(Math.hypot(v[i].vx, v[i].vy), Math.hypot(v[i - 1].vx, v[i - 1].vy)),
      onscreen: v[i].onscreen && v[i - 1].onscreen,
      phase: v[i].phase,
      prevPhase: v[i - 1].phase
    });
  }
  // Velocity samples that span a wrap-around / re-spawn are not motion
  const teleported = v.map((_, j) => Math.hypot(track[j + 1].x - track[j].x, track[j + 1].y - track[j].y) > teleport);
  const steps = [];
  for (let k = 0; k < dv.length; k++) {
    const cur = dv[k];
    if (!cur.onscreen) continue;
    if (teleported.slice(Math.max(0, k - 1), k + 3).some(Boolean)) continue;
    const before = k > 0 ? dv[k - 1] : { x: 0, y: 0 };
    const after = k < dv.length - 1 ? dv[k + 1] : before;
    // A lurch is an isolated spike: this frame's Δv sticks out past BOTH
    // neighbours. A change of acceleration (ease-out handing over to a
    // constant drift, the sign flip in the middle of an ease-in-out) moves
    // Δv monotonically from one neighbour's value to the other's instead.
    const margin = minStep / 2;
    const sticksOut = (c, b, a) => (c - b > margin && c - a > margin) || (b - c > margin && a - c > margin);
    const spike = sticksOut(cur.x, before.x, after.x) || sticksOut(cur.y, before.y, after.y);
    if (!spike) continue;
    const residual = Math.hypot(cur.x - (before.x + after.x) / 2, cur.y - (before.y + after.y) / 2);
    if (residual >= minStep && residual > relative * (cur.speed + speedFloor)) {
      steps.push({ t: cur.t, jump: Math.round(residual), phase: cur.phase, prevPhase: cur.prevPhase });
    }
  }
  return steps;
}

/** Peak on-screen speed of a track (px/s). */
export function peakSpeed(track) {
  return velocities(track)
    .filter(v => v.onscreen)
    .reduce((m, v) => Math.max(m, Math.hypot(v.vx, v.vy)), 0);
}

/**
 * Timeline from pixel stats.
 *  - firstVisibleMs / lastVisibleMs: anything drawn
 *  - coverWindows: [startMs, endMs] spans where opaque >= threshold
 */
export function coverageTimeline(frames, { coverThreshold = 0.999, visibleThreshold = 0.0005 } = {}) {
  let firstVisibleMs = null;
  let lastVisibleMs = null;
  const coverWindows = [];
  let open = null;
  for (const f of frames) {
    if (!f.pixels) continue;
    if (f.pixels.visible > visibleThreshold) {
      if (firstVisibleMs === null) firstVisibleMs = f.t;
      lastVisibleMs = f.t;
    }
    if (f.pixels.opaque >= coverThreshold) {
      if (!open) open = [f.t, f.t];
      else open[1] = f.t;
    } else if (open) {
      coverWindows.push(open);
      open = null;
    }
  }
  if (open) coverWindows.push(open);
  const last = frames[frames.length - 1];
  return {
    firstVisibleMs,
    lastVisibleMs,
    coverWindows,
    endsClear: !!last?.pixels && last.pixels.visible <= visibleThreshold
  };
}

/** Spans where a region was fully opaque (regionGaps === 0). */
export function regionWindows(frames) {
  const windows = [];
  let open = null;
  for (const f of frames) {
    if (f.pixels?.regionGaps == null) continue;
    if (f.pixels.regionGaps === 0) {
      if (!open) open = [f.t, f.t];
      else open[1] = f.t;
    } else if (open) {
      windows.push(open);
      open = null;
    }
  }
  if (open) windows.push(open);
  return windows;
}

export function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * Fewest drawn frames a Frame CPU check accepts. Under ~200 the p95 is one of
 * the few worst frames, and a cold-JIT or GC frame fails it (issue #50, PR #63;
 * Code review's idea on #65, 2026-10-28).
 */
export const MIN_CPU_FRAMES = 200;

export function workStats(frames) {
  const w = frames.filter(f => f.ran > 0).map(f => f.workMs);
  return {
    frames: w.length,
    p50: percentile(w, 50),
    p95: percentile(w, 95),
    max: w.length ? Math.max(...w) : 0
  };
}

/**
 * Evaluate a scenario's checks against a capture.
 * @returns {Array<{name, pass, detail}>}
 */
export function evaluate(spec, frames, debug = null) {
  const results = [];
  const timeline = coverageTimeline(frames, spec.coverage);
  const tracks = buildTracks(frames);
  const checks = spec.checks || {};
  const frameMs = 1000 / (spec.fps || 60);

  if (checks.totalDurationMs != null) {
    const expected = checks.totalDurationMs;
    const tolerance = checks.durationToleranceMs ?? 2 * frameMs;
    const actual = timeline.lastVisibleMs === null ? null : timeline.lastVisibleMs + frameMs;
    // 1e-6: frame times are sums of 1000/fps, so exactly 2 frames off can land a hair over
    const pass = actual !== null && Math.abs(actual - expected) <= tolerance + 1e-6;
    results.push({
      name: 'Finishes on time',
      pass,
      detail: actual === null
        ? 'nothing was ever drawn'
        : `last visible frame ends at ${Math.round(actual)}ms, expected ${expected}ms ±${Math.round(tolerance)}ms`
    });
  }

  if (checks.endsClear) {
    results.push({
      name: 'Leaves the screen clear',
      pass: timeline.endsClear,
      detail: timeline.endsClear ? 'final frame is fully transparent' : 'pixels still visible on the final frame'
    });
  }

  if (checks.fullCoverAtMs != null) {
    const at = checks.fullCoverAtMs;
    const minHold = checks.fullCoverMinMs ?? 0;
    const win = timeline.coverWindows.find(([a, b]) => a <= at && b >= at);
    const span = win ? win[1] - win[0] + frameMs : 0;
    const pass = !!win && span >= minHold;
    results.push({
      name: 'Fully covers the screen at the cut point',
      pass,
      detail: win
        ? `opaque from ${Math.round(win[0])}ms to ${Math.round(win[1])}ms (${Math.round(span)}ms, need ≥${minHold}ms around ${at}ms)`
        : `not fully opaque at ${at}ms (windows: ${JSON.stringify(timeline.coverWindows.map(w => w.map(Math.round)))})`
    });
  }

  if (checks.regionCover) {
    const { fromMs, toMs, label } = checks.regionCover;
    const holdFrames = frames.filter(f => f.t >= fromMs && f.t <= toMs && f.pixels?.regionGaps != null);
    const bad = holdFrames.filter(f => f.pixels.regionGaps > 0);
    results.push({
      name: `Covers ${label}`,
      pass: holdFrames.length > 0 && bad.length === 0,
      detail: bad.length === 0
        ? `region opaque on all ${holdFrames.length} frames between ${fromMs}ms and ${toMs}ms`
        : `${bad.length}/${holdFrames.length} frames have gaps (first at ${Math.round(bad[0].t)}ms, ${bad[0].pixels.regionGaps} sampled px)`
    });
  }

  if (checks.textOverPanel) {
    const { fromMs, toMs, label } = checks.textOverPanel;
    const win = frames.filter(f => f.t >= fromMs && f.t <= toMs);
    const shown = win.filter(f => f.pixels?.textGaps != null);
    const bad = shown.filter(f => f.pixels.textGaps > 0);
    results.push({
      name: `Text over ${label}`,
      pass: shown.length > 0 && bad.length === 0,
      detail: shown.length === 0
        ? `text never on screen between ${fromMs}ms and ${toMs}ms`
        : bad.length === 0
          ? `every pixel under the text box is opaque on all ${shown.length} frames between ${fromMs}ms and ${toMs}ms`
          : `${bad.length}/${shown.length} frames show the stream behind the text (first at ${Math.round(bad[0].t)}ms, ${bad[0].pixels.textGaps} sampled px)`
    });
  }

  // One probeMax, or a list of them
  for (const { field, max, label } of [checks.probeMax ?? []].flat()) {
    const hits = [];
    for (const f of frames) {
      for (const s of f.samples || []) {
        if (s[field] != null && s[field] > max) hits.push({ t: f.t, id: s.id, value: s[field] });
      }
    }
    results.push({
      name: label,
      pass: hits.length === 0,
      detail: hits.length === 0
        ? `${field} stays at or under ${max} on every frame`
        : `${hits.length} frames over ${max}, e.g. ${hits.slice(0, 3).map(h => `${h.id} @${Math.round(h.t)}ms ${field}=${+h.value.toFixed(3)}`).join('; ')}`
    });
  }

  if (checks.noVelocitySteps) {
    const all = [];
    for (const [id, track] of tracks) {
      for (const step of findVelocitySteps(track, checks.velocity)) all.push({ id, ...step });
    }
    results.push({
      name: 'Smooth motion (no velocity jumps)',
      pass: all.length === 0,
      detail: tracks.size === 0
        ? 'no probe data - scene does not call registerProbe()'
        : all.length === 0
          ? `${tracks.size} objects tracked, no discontinuities`
          : `${all.length} jumps, e.g. ${all.slice(0, 3).map(s => `${s.id} @${Math.round(s.t)}ms Δv=${s.jump}px/s${s.prevPhase && s.phase !== s.prevPhase ? ` (${s.prevPhase}→${s.phase})` : ''}`).join('; ')}`,
      steps: all
    });
    if (tracks.size === 0) results[results.length - 1].pass = false;
  }

  if (checks.workP95Ms != null) {
    const stats = workStats(frames);
    const enough = stats.frames >= MIN_CPU_FRAMES;
    results.push({
      name: 'Frame CPU budget',
      pass: enough && stats.p95 <= checks.workP95Ms,
      detail: enough
        ? `update+draw p50 ${stats.p50.toFixed(2)}ms, p95 ${stats.p95.toFixed(2)}ms, max ${stats.max.toFixed(2)}ms over ${stats.frames} frames (budget p95 ≤ ${checks.workP95Ms}ms)`
        : `only ${stats.frames} drawn frames, need ${MIN_CPU_FRAMES}: p95 of so few is one slow frame away from failing. Check CPU in a longer scenario (see followers-cpu, stinger-cpu)`
    });
  }

  if (checks.debugEvents) {
    const counts = {};
    for (const e of debug?.events || []) counts[e.name] = (counts[e.name] || 0) + 1;
    const want = Object.entries(checks.debugEvents);
    const bad = want.filter(([name, n]) => (counts[name] || 0) !== n);
    results.push({
      name: 'Scene events',
      pass: !!debug && bad.length === 0,
      detail: !debug
        ? 'no debug data - scene does not call createDebug()'
        : want.map(([name, n]) => `${name} ${counts[name] || 0}/${n}`).join(', ')
    });
  }

  // The bible's machine-checkable rules (docs/DESIGN.md), warn-only unless listed in `fail`
  if (checks.design) {
    results.push(...evaluateDesignRules(checks.design, frames, config.design, spec.width ?? 1920, spec.height ?? 1080, frameMs));
  }

  return { results, timeline, tracks };
}
