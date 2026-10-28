/**
 * Alert text that holds still while it is read (docs/DESIGN.md MOTION-1,
 * TIME-1, TYPE-1/3/6; issues #33-#35). Shared by the shade and the sidebar:
 * the motion tokens as curves, the reading-time timeline, and how a line of
 * alert text is fitted and split. Pure functions, unit-tested in
 * tests/shared/alertText.test.js.
 */

/**
 * A CSS cubic-bezier(x1, y1, x2, y2) timing function, for the
 * `config.design.motion.ease` tokens.
 *
 * @param {number[]} points - [x1, y1, x2, y2], x1 and x2 in 0-1
 * @returns {(p: number) => number} Eased progress for p in 0-1 (clamped)
 */
export function cubicBezier([x1, y1, x2, y2]) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const x = (s) => ((ax * s + bx) * s + cx) * s;
    const dx = (s) => (3 * ax * s + 2 * bx) * s + cx;
    const y = (s) => ((ay * s + by) * s + cy) * s;
    return (p) => {
        if (p <= 0) return 0;
        if (p >= 1) return 1;
        // Newton's method, with bisection where the slope is too flat
        let s = p;
        for (let i = 0; i < 8; i++) {
            const err = x(s) - p;
            if (Math.abs(err) < 1e-7) return y(s);
            const d = dx(s);
            if (Math.abs(d) < 1e-6) break;
            s -= err / d;
        }
        let lo = 0;
        let hi = 1;
        s = p;
        for (let i = 0; i < 30; i++) {
            if (x(s) < p) lo = s; else hi = s;
            s = (lo + hi) / 2;
        }
        return y(s);
    };
}

/**
 * Words in a line of alert text.
 * @param {string} text
 * @returns {number}
 */
export function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Reading time (TIME-1): `msPerWord` a word, never under `minMs`.
 * @param {string} text
 * @param {number} msPerWord
 * @param {number} minMs
 * @returns {number} ms
 */
export function readingHoldMs(text, msPerWord, minMs) {
    return Math.max(minMs, wordCount(text) * msPerWord);
}

/**
 * Timeline of an alert's text, in seconds: arrive, settle, hold still,
 * leave (MOTION-1). The text is still from `enterEnd` to `exitStart`, so
 * the reading time is the settle plus the hold. A `minTotalMs` longer than
 * the alert needs (a URL `duration`) lengthens the hold; it never cuts it.
 *
 * @param {Object} o
 * @param {number} o.holdMs - Reading-time hold
 * @param {number} o.enterMs
 * @param {number} o.settleMs
 * @param {number} o.exitMs
 * @param {number} [o.tailMs=0] - Time after the text has left (the shade's curtains opening)
 * @param {number} [o.minTotalMs=0]
 * @param {number} [o.maxTotalMs=Infinity] - Hard ceiling (OBS hides the source on a timer); it
 *   shortens the hold, and wins over minTotalMs
 * @returns {{enterStart: number, enterEnd: number, exitStart: number, exitEnd: number, total: number}}
 */
export function planAlertText({ holdMs, enterMs, settleMs, exitMs, tailMs = 0, minTotalMs = 0, maxTotalMs = Infinity }) {
    const needMs = enterMs + settleMs + holdMs + exitMs + tailMs;
    const totalMs = Math.min(Math.max(needMs, minTotalMs), maxTotalMs);
    const exitStart = (totalMs - tailMs - exitMs) / 1000;
    return {
        enterStart: 0,
        enterEnd: enterMs / 1000,
        exitStart,
        exitEnd: exitStart + exitMs / 1000,
        total: totalMs / 1000
    };
}

/**
 * How far the text is from its hold position at time t (px): `inPx` before
 * it arrives, 0 while it holds, `outPx` once it has left. Both ends ease on
 * the motion tokens, so the hand-offs to the hold are at rest.
 *
 * @param {ReturnType<typeof planAlertText>} plan
 * @param {number} inPx - Offset it arrives from
 * @param {number} outPx - Offset it leaves to
 * @param {(p: number) => number} easeIn - `ease.enter`
 * @param {(p: number) => number} easeOut - `ease.exit`
 * @param {number} t - Seconds since the alert started
 * @returns {number}
 */
export function textOffsetAt(plan, inPx, outPx, easeIn, easeOut, t) {
    if (t < plan.enterEnd) {
        const p = (t - plan.enterStart) / (plan.enterEnd - plan.enterStart);
        return inPx * (1 - easeIn(p));
    }
    if (t < plan.exitStart) return 0;
    return outPx * easeOut((t - plan.exitStart) / (plan.exitEnd - plan.exitStart));
}

/**
 * Split alert text into the name (the first @word) and the action around
 * it, as Mix It Up writes them: "Check out @name", "@name RAID!!".
 *
 * @param {string} text
 * @returns {{name: string, action: string, nameFirst: boolean}|null} null when there is no @name
 */
export function splitNameAction(text) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const i = words.findIndex(w => w.startsWith('@') && w.length > 1);
    if (i < 0 || words.length < 2) return null;
    const action = [...words.slice(0, i), ...words.slice(i + 1)].join(' ');
    return { name: words[i], action, nameFirst: i === 0 };
}

/**
 * Split text into two lines at the word break that makes the wider line
 * narrowest.
 *
 * @param {string} text
 * @param {(s: string) => number} measure - Width of a string at the size it will be drawn
 * @returns {string[]} One or two lines
 */
export function balancedLines(text, measure) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return [words.join(' ')];
    let best = null;
    for (let i = 1; i < words.length; i++) {
        const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
        const widest = Math.max(...lines.map(measure));
        if (!best || widest < best.widest) best = { lines, widest };
    }
    return best.lines;
}

/**
 * Two lines for text too long for two even ones: the first line takes as
 * many words as fit, and only the second ends in an ellipsis, so the words
 * that show read on without a gap (QA on #58: an ellipsis on each even line
 * cut words out of the middle).
 *
 * @param {string} text
 * @param {(s: string) => number} measure
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function overflowLines(text, measure, maxWidth) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    let n = 1;
    while (n < words.length && measure(words.slice(0, n + 1).join(' ')) <= maxWidth) n++;
    const first = ellipsize(words.slice(0, n).join(' '), measure, maxWidth);
    const rest = words.slice(n).join(' ');
    return rest ? [first, ellipsize(rest, measure, maxWidth)] : [first];
}

/**
 * Cut a line down with an ellipsis until it fits (the last resort of TYPE-6).
 * @param {string} line
 * @param {(s: string) => number} measure
 * @param {number} maxWidth
 * @returns {string}
 */
export function ellipsize(line, measure, maxWidth) {
    if (measure(line) <= maxWidth) return line;
    let cut = line;
    while (cut.length > 1 && measure(`${cut}…`) > maxWidth) cut = cut.slice(0, -1).trimEnd();
    return `${cut}…`;
}

/**
 * The shade's text room and sizes for a canvas. 16:9 uses title-safe and
 * the house sizes. Portrait (taller than wide, the vertical canvas) uses
 * the phone-safe box, which is off-centre (the apps' button column takes
 * the right 140px), and the phone floor (DESIGN.md V-SAFE-1, V-TYPE-1;
 * design review, 2026-10-28: "@TESTRAIDER RAID!!" ran to x 1010).
 *
 * @param {number} width - Canvas width (px)
 * @param {number} height - Canvas height (px)
 * @param {object} design - config.design
 * @returns {{left: number, right: number, sizes: {hero: number, display: number, minPx: number}}}
 *   left/right: the text's edges (px), before any stroke
 */
export function shadeTextBox(width, height, design) {
    const { hero, display } = design.type.sizes;
    if (height > width) {
        const v = design.vertical;
        const k = width / v.canvas.width;
        return {
            left: v.safe.leftPx * k,
            right: width - v.safe.rightPx * k,
            sizes: { hero, display, minPx: Math.max(design.type.minPx, v.type.minPx * k) }
        };
    }
    const safeX = Math.round(width * design.safe.titleInset);
    return { left: safeX, right: width - safeX, sizes: { hero, display, minPx: design.type.minPx } };
}

/**
 * Fit the shade's line (issue #33): `hero` on one line, shrinking to fit
 * down to `display`, then two lines at `display` (name / action, else the
 * most even break), shrinking again only if a line still overflows, never
 * under `minPx`. It never scrolls.
 *
 * @param {string} text
 * @param {(s: string, px: number) => number} measure - Width at a font size
 * @param {number} maxWidth - Title-safe width (px)
 * @param {{hero: number, display: number, minPx: number}} sizes
 * @returns {{lines: string[], px: number}}
 */
export function fitShadeText(text, measure, maxWidth, { hero, display, minPx }) {
    const width = measure(text, hero);
    if (width <= maxWidth) return { lines: [text], px: hero };
    const oneLine = hero * maxWidth / width;
    if (oneLine >= display) return { lines: [text], px: oneLine };

    const split = splitNameAction(text);
    let lines = split
        ? (split.nameFirst ? [split.name, split.action] : [split.action, split.name])
        : balancedLines(text, s => measure(s, display));
    // A name/action split that leaves one line far too wide loses to the even break
    const widest = (ls, px) => Math.max(...ls.map(s => measure(s, px)));
    if (split) {
        const even = balancedLines(text, s => measure(s, display));
        if (widest(lines, display) > maxWidth && widest(even, display) < widest(lines, display)) lines = even;
    }
    const px = Math.max(minPx, Math.min(display, display * maxWidth / widest(lines, display)));
    if (widest(lines, px) > maxWidth) lines = overflowLines(text, s => measure(s, px), maxWidth);
    return { lines, px };
}

/**
 * Fit the sidebar's text (issue #34) to the nameplate. With an @name: two
 * lines in reading order, the name at `headline` (shrinking to `minScale`
 * of it) and the action at `label`. Without one: one line at `headline`,
 * shrinking to `minScale`, then two lines. An ellipsis is the last resort
 * (TYPE-6). Nothing goes under `minPx`.
 *
 * @param {string} text
 * @param {(s: string, px: number) => number} measure
 * @param {number} maxWidth - Room on the plate (px)
 * @param {{headline: number, label: number, minPx: number, minScale: number}} sizes
 * @returns {Array<{text: string, px: number, role: 'name'|'action'|'line'}>} Lines, top to bottom
 */
export function fitSidebarText(text, measure, maxWidth, { headline, label, minPx, minScale }) {
    const floor = Math.max(minPx, headline * minScale);
    const shrink = (s, px) => Math.max(floor, Math.min(px, px * maxWidth / measure(s, px)));
    const split = splitNameAction(text);
    if (split) {
        const namePx = shrink(split.name, headline);
        const name = { text: ellipsize(split.name, s => measure(s, namePx), maxWidth), px: namePx, role: 'name' };
        const action = { text: ellipsize(split.action, s => measure(s, label), maxWidth), px: label, role: 'action' };
        return split.nameFirst ? [name, action] : [action, name];
    }
    const px = shrink(text, headline);
    if (measure(text, px) <= maxWidth) return [{ text, px, role: 'line' }];
    const at = s => measure(s, floor);
    let lines = balancedLines(text, at);
    if (Math.max(...lines.map(at)) > maxWidth) lines = overflowLines(text, at, maxWidth);
    return lines.map(s => ({ text: s, px: floor, role: 'line' }));
}

/**
 * The TYPE-3 ink stroke width for a font size: `strokeEm`, never under
 * `strokeMinPx`.
 * @param {number} px
 * @param {{strokeEm: number, strokeMinPx: number}} type - config.design.type
 * @returns {number}
 */
export function strokeWidthPx(px, type) {
    return Math.max(type.strokeMinPx, px * type.strokeEm);
}
