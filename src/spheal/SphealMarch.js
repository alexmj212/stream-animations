import { config } from '../config/config.js';
import { buildWave, marcherAt, waveEndS, unitFor } from '../shared/animations/spheal.js';
import { drawSpheal, drawShadow } from './SphealSprite.js';

/**
 * The march: holds the wave and the cached sprites, and draws the crowd at
 * any time t. Positions come from marcherAt(), so setTime() can jump.
 */
export class SphealMarch {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     * @param {() => number} random - Seeded RNG
     */
    constructor(ctx, canvas, random) {
        this.ctx = ctx;
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
        const px = this.cfg.sprite.px;
        this.spritePx = px;
        this.sprites = this.cfg.palettes.map(p => drawSpheal(p, px));
        this.kingPx = Math.ceil(this.cfg.king.radius * this.unit);
        this.kingSprite = drawSpheal(this.cfg.palettes[0], this.kingPx, { crown: true });
        this.shadow = drawShadow(32);
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
            // Shadow: shrinks as the Spheal rises off the ground
            const air = Math.min(1, (s.ground - s.r * s.sy - s.y) / (s.r * 1.5));
            const sw = s.r * (1.1 - 0.4 * air);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(this.shadow, s.x - sw, s.ground - sw * 0.22, sw * 2, sw * 0.44);

            const sprite = mr.king ? this.kingSprite : this.sprites[mr.palette];
            const k = s.r / (mr.king ? this.kingPx : this.spritePx);
            const cos = Math.cos(s.rot);
            const sin = Math.sin(s.rot);
            // translate(x, y) * scale(sx, sy) * rotate(rot) * scale(k)
            ctx.setTransform(s.sx * cos * k, s.sy * sin * k, -s.sx * sin * k, s.sy * cos * k, s.x, s.y);
            ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        }
        this.onscreen = onscreen;
        if (onscreen > this.peak) this.peak = onscreen;
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
