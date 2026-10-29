import { config } from '../config/config.js';
import { buildWave, marcherAt, waveEndS, unitFor, turnStep } from '../shared/animations/spheal.js';
import { drawSpheal, drawShadow, spriteFromImage, turnSprite, turnSide } from './SphealSprite.js';

/**
 * The march: holds the wave and the cached sprites, and draws the crowd at
 * any time t. Positions come from marcherAt(), so setTime() can jump.
 */
export class SphealMarch {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     * @param {() => number} random - Seeded RNG
     * @param {{img: HTMLImageElement, box: Object, pixel: boolean}|null} [art] -
     *   The PokeAPI sprite (SphealSprite.loadPokeSprite); null draws our own
     */
    constructor(ctx, canvas, random, art = null) {
        this.ctx = ctx;
        this.art = art;
        this.canvas = canvas;
        this.cfg = config.spheal;
        this.marchers = buildWave(this.cfg, random);
        this.tS = 0;
        this.onscreen = 0;
        this.peak = 0;
        this.build();
    }

    /** Sizes and sprites for the current canvas; call again on resize. */
    build() {
        const { width, height } = this.canvas;
        this.unit = unitFor(width, height);
        this.view = {
            width,
            height,
            unit: this.unit,
            bottomPad: this.cfg.marcher.bottomPad,
            beatS: this.cfg.song.beatS
        };
        // sprites[palette][tier], radii ascending. The PokeAPI sprite has
        // one look, so every palette pick stamps it
        this.spritePx = this.cfg.sprite.px;
        this.kingPx = Math.ceil(this.cfg.king.radius * this.unit);
        const art = this.art;
        if (art) {
            const opts = { pixel: art.pixel, flip: this.cfg.sprite.faces === 'left' };
            const tiers = this.spritePx.map(px => spriteFromImage(art.img, art.box, px, opts));
            this.sprites = this.cfg.palettes.map(() => tiers);
            this.kingSprite = spriteFromImage(art.img, art.box, this.kingPx, { ...opts, crown: true });
        } else {
            this.sprites = this.cfg.palettes.map(p => this.spritePx.map(px => drawSpheal(p, px)));
            this.kingSprite = drawSpheal(this.cfg.palettes[0], this.kingPx, { crown: true });
        }
        this.shadow = drawShadow(32);
        // sprite -> {side, frames[step]}, filled as angles come up
        this.turns = new Map();
        this.endS = waveEndS(this.marchers, width, this.unit);
    }

    /** Total ordinary Spheals plus the giant. */
    get count() {
        return this.marchers.length;
    }

    /** @param {number} ms - Time since the march began */
    setTime(ms) {
        this.tS = ms / 1000;
    }

    get done() {
        return this.tS >= this.endS;
    }

    clear() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        const { ctx, view, tS } = this;
        let onscreen = 0;
        for (const mr of this.marchers) {
            if (tS < mr.t0) continue;
            const s = marcherAt(mr, tS, view);
            if (s.done) continue;
            onscreen++;
            // Shadow: shrinks as the Spheal rises off the ground. Only the
            // front rows get one: further back the pile hides it, and
            // skipping it halves the draw calls at the peak (QA, #97)
            if (mr.depth <= this.cfg.marcher.shadowDepth) this.drawShadow(s);
            let sprite = this.kingSprite;
            let px = this.kingPx;
            if (!mr.king) {
                const tier = this.spritePx.findIndex(p => p >= s.r);
                const i = tier === -1 ? this.spritePx.length - 1 : tier;
                sprite = this.sprites[mr.palette][i];
                px = this.spritePx[i];
            }
            const k = s.r / px;
            if (mr.king) {
                // One giant: turned live, it isn't worth a cache
                const cos = Math.cos(s.rot);
                const sin = Math.sin(s.rot);
                // translate(x, y) * scale(sx, sy) * rotate(rot) * scale(k)
                ctx.setTransform(s.sx * cos * k, s.sy * sin * k, -s.sx * sin * k, s.sy * cos * k, s.x, s.y);
            } else {
                sprite = this.turned(sprite, s.rot);
                ctx.setTransform(s.sx * k, 0, 0, s.sy * k, s.x, s.y);
            }
            ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        }
        this.onscreen = onscreen;
        if (onscreen > this.peak) this.peak = onscreen;
    }

    /**
     * The sprite pre-turned to the nearest of config turnSteps angles, so
     * the crowd is stamped without a rotation (Defiant, 2026-10-29).
     * @param {HTMLCanvasElement} sprite
     * @param {number} rot - Radians
     * @returns {HTMLCanvasElement}
     */
    turned(sprite, rot) {
        const steps = this.cfg.sprite.turnSteps;
        let turn = this.turns.get(sprite);
        if (!turn) {
            turn = { side: turnSide(sprite), frames: new Array(steps) };
            this.turns.set(sprite, turn);
        }
        const step = turnStep(rot, steps);
        return turn.frames[step] ??= turnSprite(sprite, step * 2 * Math.PI / steps, turn.side);
    }

    /** A soft shadow on the marcher's ground line, smaller while it's in the air. */
    drawShadow(s) {
        const air = Math.min(1, (s.ground - s.r * s.sy - s.y) / (s.r * 1.5));
        const sw = s.r * (1.1 - 0.4 * air);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.drawImage(this.shadow, s.x - sw, s.ground - sw * 0.22, sw * 2, sw * 0.44);
    }

    /** Motion-harness probe: the first few to set off and the giant (x only: hops bounce in y). */
    probeSamples() {
        const picks = this.marchers.filter(m => m.king || (typeof m.id === 'number' && m.id < 3));
        return picks.map(mr => {
            const s = marcherAt(mr, this.tS, this.view);
            return { id: `spheal-${mr.id}`, x: s.x, onscreen: s.started && !s.done && s.x + s.r > 0, onscreenCount: this.onscreen };
        });
    }
}
