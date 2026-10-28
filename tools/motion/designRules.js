/**
 * Harness checks for the stream bible's machine-checkable rules
 * (docs/DESIGN.md, issue #43). Pure functions of a capture, unit tested in
 * tests/tools/designRules.test.js.
 *
 * Text comes from probe samples that carry a `box` (QA, 2026-10-28):
 *   { id: 'text', onscreen, box: {x, y, width, height}, fontPx, words }
 * in screen px, the ink box of the line as drawn. DOM scenes get one from
 * the scenario's `textBox.selector` instead (run.js).
 *
 * Pixel rules read `frame.pixels.grid`: mean linear luminance per cell of a
 * GRID_COLS x GRID_ROWS grid, the scene composited over black (clock.js).
 */

import { safeRect } from '../../src/shared/design.js';

export const GRID_COLS = 16;
export const GRID_ROWS = 9;

/** Every rule this module checks, in report order. */
export const DESIGN_RULES = ['SAFE-1', 'SAFE-3', 'TYPE-1', 'TIME-1', 'CUT-2', 'FLASH-1', 'FLASH-2'];

/** On-screen text boxes per frame: [{t, box, fontPx, words, id}]. */
export function textSamples(frames) {
    const out = [];
    for (const f of frames) {
        for (const s of f.samples || []) {
            if (s.box && s.onscreen !== false && s.box.width > 0 && s.box.height > 0) {
                out.push({ t: f.t, id: s.id, box: s.box, fontPx: s.fontPx, words: s.words });
            }
        }
    }
    return out;
}

const inside = (b, r) => b.x >= r.x - 0.5 && b.y >= r.y - 0.5 &&
    b.x + b.width <= r.x + r.width + 0.5 && b.y + b.height <= r.y + r.height + 0.5;

/** SAFE-1: every text box inside title-safe. */
export function checkTitleSafe(texts, design, width, height) {
    const r = safeRect('title', design, width, height);
    const bad = texts.filter(s => !inside(s.box, r));
    return {
        rule: 'SAFE-1',
        name: 'SAFE-1 Text inside title-safe',
        pass: texts.length > 0 && bad.length === 0,
        detail: texts.length === 0
            ? 'no text box reported (probe sample `box`, or textBox.selector)'
            : bad.length === 0
                ? `all ${texts.length} text samples inside x ${r.x}-${r.x + r.width}, y ${r.y}-${r.y + r.height}`
                : `${bad.length}/${texts.length} outside title-safe x ${r.x}-${r.x + r.width}, y ${r.y}-${r.y + r.height}, e.g. ${fmtBox(bad[0])}`
    };
}

/** SAFE-3: no text box reaches below the top of Twitch's player chrome. */
export function checkPlayerChrome(texts, design, height) {
    const top = design.playerChromeTop * height;
    const bad = texts.filter(s => s.box.y + s.box.height > top + 0.5);
    return {
        rule: 'SAFE-3',
        name: 'SAFE-3 Text clear of the player controls',
        pass: texts.length > 0 && bad.length === 0,
        detail: texts.length === 0
            ? 'no text box reported'
            : bad.length === 0
                ? `every text sample ends above y ${Math.round(top)}`
                : `${bad.length}/${texts.length} reach below y ${Math.round(top)}, e.g. ${fmtBox(bad[0])}`
    };
}

/** TYPE-1: drawn font size at or over the floor. */
export function checkTypeFloor(texts, minPx) {
    const sized = texts.filter(s => s.fontPx != null);
    const smallest = sized.reduce((m, s) => Math.min(m, s.fontPx), Infinity);
    return {
        rule: 'TYPE-1',
        name: `TYPE-1 Text at least ${minPx}px`,
        pass: sized.length > 0 && smallest >= minPx - 0.5,
        detail: sized.length === 0
            ? 'no font size reported (probe sample `fontPx`)'
            : `smallest drawn size ${+smallest.toFixed(1)}px (floor ${minPx}px)`
    };
}

/**
 * Longest span (ms) a text box stays put, to within `tolerancePx`.
 * @param {Array} texts - from textSamples(), one id
 */
export function longestStillMs(texts, tolerancePx = 0.5) {
    let best = 0;
    let start = null;
    for (let i = 1; i < texts.length; i++) {
        const a = texts[i - 1].box;
        const b = texts[i].box;
        const still = Math.abs(a.x - b.x) <= tolerancePx && Math.abs(a.y - b.y) <= tolerancePx;
        if (still) {
            if (start === null) start = texts[i - 1].t;
            best = Math.max(best, texts[i].t - start);
        } else {
            start = null;
        }
    }
    return best;
}

/**
 * TIME-1: the text is still for at least max(3000, 200 x words) ms.
 * @param {Array} texts
 * @param {number} [frameMs] - slack of one frame: stillness is measured between frames
 */
export function checkReadingTime(texts, frameMs = 0) {
    const words = texts.reduce((m, s) => Math.max(m, s.words || 0), 0);
    const need = Math.max(3000, 200 * words);
    const ids = [...new Set(texts.map(s => s.id))];
    const still = ids.reduce((m, id) => Math.max(m, longestStillMs(texts.filter(s => s.id === id))), 0);
    return {
        rule: 'TIME-1',
        name: 'TIME-1 Text still long enough to read',
        pass: texts.length > 0 && still + frameMs + 1e-6 >= need,
        detail: texts.length === 0
            ? 'no text box reported'
            : `still for ${Math.round(still)}ms at most, need ${need}ms (${words || '?'} words)`
    };
}

/** Mean absolute change between two luminance grids. */
export function gridChange(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
}

/**
 * CUT-2: the longest run of fully covered frames whose picture barely
 * changes (mean cell luminance change under `stillDelta` a frame).
 */
export function checkStaticCover(frames, maxMs, { coverThreshold = 0.999, stillDelta = 0.002 } = {}) {
    let best = 0;
    let bestAt = null;
    let start = null;
    let prev = null;
    for (const f of frames) {
        if (!f.pixels?.grid) continue; // sampled every few frames (run.js)
        const covered = f.pixels.opaque >= coverThreshold;
        if (covered && prev && gridChange(prev.pixels.grid, f.pixels.grid) < stillDelta) {
            if (start === null) start = prev.t;
            if (f.t - start > best) { best = f.t - start; bestAt = start; }
        } else {
            start = null;
        }
        prev = covered ? f : null;
    }
    return {
        rule: 'CUT-2',
        name: `CUT-2 Covered and still at most ${maxMs}ms`,
        pass: best <= maxMs,
        detail: best === 0
            ? 'never covered and still'
            : `longest still cover ${Math.round(best)}ms from ${Math.round(bestAt)}ms`
    };
}

/**
 * Luminance transitions (FLASH-1/2): times where at least `area` of the
 * grid's cells moved by `delta` or more against the frame `halfCycleMs`
 * earlier, in the opposite direction to the previous transition. Two
 * opposing transitions make one flash.
 * @returns {Array<{t: number, dir: number, area: number}>}
 */
export function luminanceTransitions(frames, { delta = 0.1, area = 0.25, halfCycleMs = 1000 / 6 } = {}) {
    const g = frames.filter(f => f.pixels?.grid);
    const out = [];
    let j = 0;
    for (let i = 0; i < g.length; i++) {
        while (j < i && g[i].t - g[j + 1].t >= halfCycleMs) j++;
        if (g[i].t - g[j].t < halfCycleMs) continue;
        const a = g[j].pixels.grid;
        const b = g[i].pixels.grid;
        let up = 0;
        let down = 0;
        for (let c = 0; c < b.length; c++) {
            const d = b[c] - a[c];
            if (d >= delta) up++;
            else if (d <= -delta) down++;
        }
        const dir = up >= down ? 1 : -1;
        const share = Math.max(up, down) / b.length;
        if (share < area) continue;
        const last = out[out.length - 1];
        if (!last || last.dir !== dir) out.push({ t: g[i].t, dir, area: share });
        else if (share > last.area) last.area = share;
    }
    return out;
}

/** Most flashes (opposing transition pairs) in any 1 s window. */
export function maxFlashesPerSecond(transitions) {
    let best = 0;
    for (let i = 0; i < transitions.length; i++) {
        let n = 0;
        while (i + n < transitions.length && transitions[i + n].t - transitions[i].t < 1000) n++;
        best = Math.max(best, Math.floor(n / 2));
    }
    return best;
}

/** FLASH-1 (any flash over a quarter of the frame) and FLASH-2 (full field). */
export function checkFlashes(frames, { maxPerSecond = 3, fullFieldPerSecond = 1, fullFieldArea = 0.75 } = {}) {
    const any = luminanceTransitions(frames);
    const full = luminanceTransitions(frames, { area: fullFieldArea });
    const a = maxFlashesPerSecond(any);
    const f = maxFlashesPerSecond(full);
    return [
        {
            rule: 'FLASH-1',
            name: `FLASH-1 At most ${maxPerSecond} flashes a second`,
            pass: a <= maxPerSecond,
            detail: `${a} a second at most (${any.length} luminance swings over 25% of the frame)`
        },
        {
            rule: 'FLASH-2',
            name: `FLASH-2 At most ${fullFieldPerSecond} full-field flash a second`,
            pass: f <= fullFieldPerSecond,
            detail: `${f} a second at most (${full.length} swings over ${fullFieldArea * 100}% of the frame)`
        }
    ];
}

/**
 * Run the requested rules. `fail` lists the rules that fail the run; the
 * rest report as warnings (issue #43: warn-only until each scene's audit
 * issue lands, then promoted, never weakened to get green).
 *
 * @param {Object} opts - {rules: string[], fail?: string[], holdMs?: [from, to], minPx?: number}
 * @param {Array} frames
 * @param {Object} design - config.design
 * @param {number} width - capture width
 * @param {number} height - capture height
 * @param {number} [frameMs] - nominal frame length
 * @returns {Array<{name, pass, detail, warn?: boolean}>}
 */
export function evaluateDesignRules(opts, frames, design, width, height, frameMs = 0) {
    const want = new Set(opts.rules || DESIGN_RULES);
    const fail = new Set(opts.fail || []);
    const texts = textSamples(frames);
    // Placement rules apply while the text holds, not as it flies in or out
    const [from, to] = opts.holdMs ?? [-Infinity, Infinity];
    const held = texts.filter(s => s.t >= from && s.t <= to);
    const all = [];
    if (want.has('SAFE-1')) all.push(checkTitleSafe(held, design, width, height));
    if (want.has('SAFE-3')) all.push(checkPlayerChrome(held, design, height));
    if (want.has('TYPE-1')) all.push(checkTypeFloor(held, opts.minPx ?? design.type.minPx));
    if (want.has('TIME-1')) all.push(checkReadingTime(texts, frameMs));
    if (want.has('CUT-2')) all.push(checkStaticCover(frames, design.motion.staticCoverMaxMs));
    if (want.has('FLASH-1') || want.has('FLASH-2')) all.push(...checkFlashes(frames).filter(r => want.has(r.rule)));
    return all.map(({ rule, ...r }) => (r.pass || fail.has(rule) ? r : { ...r, pass: true, warn: true }));
}

function fmtBox(s) {
    const b = s.box;
    return `${s.id} @${Math.round(s.t)}ms x ${Math.round(b.x)}-${Math.round(b.x + b.width)}, y ${Math.round(b.y)}-${Math.round(b.y + b.height)}`;
}
