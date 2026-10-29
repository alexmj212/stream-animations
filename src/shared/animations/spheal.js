/**
 * Spheal march math (src/spheal): the spawn schedule, each marcher's path
 * and gait, and when the wave is over. Pure functions of time, so the page,
 * the motion harness and the tests all see the same march for a seed.
 */

/**
 * How many Spheals have set off by time t. The rate starts at rate0 per
 * second and doubles every doubleS seconds:
 *   N(t) = rate0 * doubleS / ln2 * (2^(t / doubleS) - 1)
 * @param {number} tS - Seconds since the march began
 * @param {{rate0: number, doubleS: number}} spawn
 * @returns {number}
 */
export function spawnedBy(tS, spawn) {
    if (tS <= 0) return 0;
    return spawn.rate0 * spawn.doubleS / Math.LN2 * (Math.pow(2, tS / spawn.doubleS) - 1);
}

/**
 * When the nth Spheal (from 0) sets off: the inverse of spawnedBy.
 * @param {number} n
 * @param {{rate0: number, doubleS: number}} spawn
 * @returns {number} Seconds
 */
export function spawnTime(n, spawn) {
    return spawn.doubleS * Math.log2(1 + n * Math.LN2 / (spawn.rate0 * spawn.doubleS));
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Build the whole wave: every ordinary Spheal plus the giant at the end,
 * in draw order (back of the pile first, the giant last).
 * @param {Object} cfg - config.spheal
 * @param {() => number} random - Seeded RNG in [0, 1)
 * @returns {Array<Object>} marchers
 */
export function buildWave(cfg, random) {
    const { spawn, marcher: m, king } = cfg;
    const total = Math.floor(spawnedBy(spawn.endS, spawn)) + 1;
    const marchers = [];
    for (let n = 0; n < total; n++) {
        const t0 = spawnTime(n, spawn);
        const grown = Math.pow(Math.min(1, t0 / spawn.endS), m.pileEase);
        // Depth 0 is the front row on the ground; 1 is the top of the pile
        const depth = grown * random();
        const scale = lerp(1, m.farScale, depth);
        const r = lerp(m.radius[0], m.radius[1], random()) * scale;
        const pick = random();
        const gait = pick < m.rollShare ? 'roll' : pick < m.rollShare + m.tumbleShare ? 'tumble' : 'hop';
        marchers.push({
            id: n,
            t0,
            depth,
            lift: depth * m.pileMax,
            r,
            speed: lerp(m.speed[0], m.speed[1], random()),
            gait,
            hopHeight: lerp(m.hopHeight[0], m.hopHeight[1], random()) * r / 36,
            // Hops land on the song's beats: one hop a beat or one every two
            hopBeats: random() < 0.7 ? 1 : 2,
            hopOffset: random() < 0.5 ? 0 : 0.5,
            spin: random() < 0.5 ? 1 : 2,
            palette: random() < 0.6 ? 0 : 1 + Math.floor(random() * (cfg.palettes.length - 1)),
            king: false
        });
    }
    // Far ones first, so the front row draws over them
    marchers.sort((a, b) => b.depth - a.depth || a.t0 - b.t0);
    marchers.push({
        id: 'king',
        t0: spawn.endS + spawn.kingDelayS,
        depth: 0,
        lift: 0,
        r: king.radius,
        speed: king.speed,
        gait: 'hop',
        hopHeight: king.hopHeight,
        hopBeats: 2,
        hopOffset: 0,
        spin: 1,
        palette: 0,
        king: true
    });
    return marchers;
}

/**
 * Where a marcher is at time t, in px. The canvas's shorter side scales
 * every length (config lengths are at 1080px).
 * @param {Object} mr - A marcher from buildWave
 * @param {number} tS - Seconds since the march began
 * @param {{width: number, height: number, unit: number, bottomPad: number, beatS: number}} view
 * @returns {{x: number, y: number, ground: number, r: number, rot: number, sx: number, sy: number, started: boolean, done: boolean}}
 *   x, y: body centre; ground: where its shadow sits; sx, sy: squash and stretch
 */
export function marcherAt(mr, tS, view) {
    const u = view.unit;
    const r = mr.r * u;
    const dt = tS - mr.t0;
    const travelled = Math.max(0, dt) * mr.speed * u;
    const x = -r + travelled;
    const ground = view.height - (view.bottomPad + mr.lift) * u;
    let lift = 0;
    let rot = 0;
    let sx = 1;
    let sy = 1;
    if (mr.gait === 'roll') {
        rot = travelled / r;
    } else {
        // Phase 0..1 through one hop; on the ground at 0 and 1
        const period = view.beatS * mr.hopBeats;
        const p = ((tS / period + mr.hopOffset) % 1 + 1) % 1;
        lift = Math.sin(Math.PI * p) * mr.hopHeight * u;
        // Squash on landing and take-off, stretch at mid-climb
        const contact = Math.max(0, 1 - Math.min(p, 1 - p) / 0.12);
        sy = 1 - 0.22 * contact + 0.08 * Math.sin(Math.PI * p) * (1 - contact);
        sx = 1 / sy;
        // A tumbler turns a full circle (or two) each hop and lands upright
        if (mr.gait === 'tumble') rot = 2 * Math.PI * mr.spin * (tS / period + mr.hopOffset);
        else rot = 0.12 * Math.sin(2 * Math.PI * (tS / (2 * period)));
    }
    return {
        x,
        // Squashing keeps the bottom on the ground
        y: ground - r * sy - lift,
        ground,
        r,
        rot,
        sx,
        sy,
        started: dt >= 0,
        done: x - r > view.width
    };
}

/**
 * When the last marcher leaves the right edge: the end of the wave.
 * @param {Array<Object>} marchers
 * @param {number} width - Canvas width, px
 * @param {number} unit - Length scale
 * @returns {number} Seconds
 */
export function waveEndS(marchers, width, unit) {
    let end = 0;
    for (const mr of marchers) {
        const r = mr.r * unit;
        end = Math.max(end, mr.t0 + (width + 2 * r) / (mr.speed * unit));
    }
    return end;
}

/**
 * Length scale for a canvas: config lengths are at 1080px on the shorter
 * side, so the 16:9 canvas and the 1080x1920 vertical one match.
 * @param {number} width
 * @param {number} height
 */
export function unitFor(width, height) {
    return Math.min(width, height) / 1080;
}

/**
 * Which of `steps` pre-turned angles is nearest to rot, wrapped into
 * 0..steps-1 (rolls turn past 2π, and wobbles go negative).
 * @param {number} rot - Radians
 * @param {number} steps
 * @returns {number}
 */
export function turnStep(rot, steps) {
    const step = Math.round(rot * steps / (2 * Math.PI)) % steps;
    return step < 0 ? step + steps : step;
}

/**
 * The sprite URL inside a PokeAPI pokemon's `sprites` object, by key path
 * (e.g. ['other', 'official-artwork', 'front_default']).
 * @param {Object} sprites - The API response's `sprites`
 * @param {string[]} path
 * @returns {string|null}
 */
export function spriteUrlFrom(sprites, path) {
    let node = sprites;
    for (const key of path) node = node?.[key];
    return typeof node === 'string' && /^https:\/\//.test(node) ? node : null;
}
