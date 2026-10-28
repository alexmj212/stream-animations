/**
 * Title card math (WELCOME, BRB, ENDING): the plate and the entrance. The
 * line is fitted like the shade's (fitShadeText: hero, shrink to display,
 * then two lines).
 * Pure functions, unit-tested in tests/title/titleCard.test.js. The card
 * stays up for the whole scene, so after the entrance nothing moves and the
 * scene stops drawing.
 */

/**
 * The slanted ink plate behind the line, sized to the text.
 *
 * A second line grows the plate upward, so its bottom edge stays put.
 *
 * @param {number} textWidth - Widest line as drawn (px)
 * @param {{x: number, top: number, height: number, padX: number, slantDeg: number}} plate
 * @param {number} [extraHeight=0] - Height the extra lines need (px)
 * @returns {{x: number, top: number, height: number, width: number, lean: number, textX: number, mid: number}}
 *   lean: how far the top edge sits right of the bottom edge (px)
 */
export function titlePlate(textWidth, plate, extraHeight = 0) {
    const height = plate.height + extraHeight;
    const lean = Math.tan(plate.slantDeg * Math.PI / 180) * height;
    const top = plate.top - extraHeight;
    return {
        x: plate.x,
        top,
        height,
        width: textWidth + 2 * plate.padX + lean,
        lean,
        textX: plate.x + plate.padX + lean / 2,
        mid: top + height / 2
    };
}

/**
 * Entrance state at time t: the plate slides in from off the left edge,
 * then the text slides and fades in over it. After `done` it stays put.
 *
 * @param {number} tMs - Since the card started (ms)
 * @param {{enterMs: number, textDelayMs: number, textMs: number, textSlidePx: number}} timing
 * @param {number} plateTravel - How far left the plate starts (px)
 * @param {Function} ease - 0..1 -> 0..1 (the `enter` ease)
 * @returns {{plateDx: number, textAlpha: number, textDx: number, done: boolean}}
 */
export function titleStateAt(tMs, timing, plateTravel, ease) {
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const p = clamp(tMs / timing.enterMs);
    const q = clamp((tMs - timing.enterMs - timing.textDelayMs) / timing.textMs);
    const eq = ease(q);
    return {
        plateDx: -plateTravel * (1 - ease(p)),
        textAlpha: eq,
        textDx: -timing.textSlidePx * (1 - eq),
        done: tMs >= timing.enterMs + timing.textDelayMs + timing.textMs
    };
}
