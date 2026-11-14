// The CRT look for the weather page (AJ, 2026-11-10: "some filters to give it
// that crt aesthetic"). One static overlay, drawn once: black pillarbox
// sides, a rounded tube edge, a soft vignette, fine scanlines and a faint
// glass sheen. The page blits it over whatever it redraws, so the look costs
// a blit, never a per-frame filter (Performance expert, Rotom: 4px scanline
// period at low contrast, so Twitch's 720p downscale doesn't turn it to moire).

/**
 * Draw the CRT overlay.
 * @param {number} w - Frame width
 * @param {number} h - Frame height
 * @param {{x: number, y: number, w: number, h: number}} pic - The 4:3 picture
 * @param {Object} cfg - config.weather.crt
 * @returns {HTMLCanvasElement}
 */
export function buildCrtOverlay(w, h, pic, cfg) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const tube = () => {
        g.beginPath();
        g.roundRect(pic.x, pic.y, pic.w, pic.h, cfg.cornerPx);
    };

    // Inside the tube: scanlines, vignette, sheen
    g.save();
    tube();
    g.clip();
    g.fillStyle = `rgba(0, 0, 0, ${cfg.scanlineAlpha})`;
    for (let y = pic.y; y < pic.y + pic.h; y += cfg.scanlinePx) g.fillRect(pic.x, y + cfg.scanlinePx - 1, pic.w, 1);
    const cx = pic.x + pic.w / 2;
    const cy = pic.y + pic.h / 2;
    const v = g.createRadialGradient(cx, cy, Math.min(pic.w, pic.h) * 0.42, cx, cy, Math.hypot(pic.w, pic.h) / 2);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, `rgba(0, 0, 0, ${cfg.vignetteAlpha})`);
    g.fillStyle = v;
    g.fillRect(pic.x, pic.y, pic.w, pic.h);
    const sheen = g.createLinearGradient(pic.x, pic.y, pic.x + pic.w * 0.6, pic.y + pic.h * 0.6);
    sheen.addColorStop(0, `rgba(255, 255, 255, ${cfg.sheenAlpha})`);
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = sheen;
    g.fillRect(pic.x, pic.y, pic.w, pic.h);
    // The glass curving away at the edge: a soft dark rim
    g.lineWidth = cfg.rimPx * 2;
    g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    g.filter = `blur(${cfg.rimPx / 2}px)`;
    tube();
    g.stroke();
    g.filter = 'none';
    g.restore();

    // Outside the tube: black
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h);
    g.roundRect(pic.x, pic.y, pic.w, pic.h, cfg.cornerPx);
    g.fillStyle = '#000';
    g.fill('evenodd');
    g.restore();
    return c;
}
