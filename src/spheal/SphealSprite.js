/**
 * Draws one Spheal (a round seal: blue back, cream belly, flippers) into an
 * offscreen canvas, facing right. Original drawing from shapes, no artwork
 * copied. The page caches one sprite per palette and stamps it per marcher.
 */

const INK = '#1d2f52';

/**
 * Render a Spheal sprite.
 * @param {Object} palette - {body, dark, spot, belly} from config.spheal.palettes
 * @param {number} R - Body radius in px
 * @param {{crown?: boolean}} [opts] - crown: the giant at the end of the wave
 * @returns {HTMLCanvasElement} Square canvas; the body centre is its centre
 */
export function drawSpheal(palette, R, opts = {}) {
    const pad = Math.ceil(R * 0.55);
    const size = Math.ceil(2 * (R + pad));
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const line = Math.max(2, R * 0.055);

    const blob = (x, y, rx, ry, rot, fill) => {
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        g.fillStyle = fill;
        g.fill();
        g.lineWidth = line;
        g.strokeStyle = INK;
        g.stroke();
    };

    // Tail fin behind, then the back flipper
    blob(-R * 0.92, R * 0.62, R * 0.28, R * 0.14, -0.5, palette.dark);
    blob(-R * 0.3, R * 0.9, R * 0.26, R * 0.13, 0.25, palette.dark);

    // Ear nubs
    blob(-R * 0.38, -R * 0.86, R * 0.17, R * 0.13, -0.4, palette.dark);
    blob(R * 0.28, -R * 0.92, R * 0.17, R * 0.13, 0.35, palette.dark);

    // Body
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    const shade = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
    shade.addColorStop(0, palette.spot);
    shade.addColorStop(0.45, palette.body);
    shade.addColorStop(1, palette.dark);
    g.fillStyle = shade;
    g.fill();

    // Inside the body: belly and spots, clipped to the circle
    g.save();
    g.clip();
    g.beginPath();
    g.ellipse(R * 0.22, R * 0.5, R * 0.78, R * 0.62, -0.15, 0, Math.PI * 2);
    g.fillStyle = palette.belly;
    g.fill();
    g.fillStyle = palette.spot;
    for (const [x, y, s] of [[-0.55, -0.35, 0.11], [-0.3, -0.62, 0.08], [-0.7, 0.05, 0.08], [-0.05, -0.72, 0.06], [-0.45, -0.05, 0.06]]) {
        g.beginPath();
        g.arc(x * R, y * R, s * R, 0, Math.PI * 2);
        g.fill();
    }
    g.restore();

    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.stroke();

    // Front flipper over the belly
    blob(R * 0.62, R * 0.62, R * 0.27, R * 0.13, -0.6, palette.dark);

    // Blush
    g.fillStyle = 'hsla(350, 90%, 75%, 0.55)';
    for (const x of [-0.05, 0.82]) {
        g.beginPath();
        g.ellipse(x * R, R * 0.08, R * 0.11, R * 0.07, 0, 0, Math.PI * 2);
        g.fill();
    }

    // Eyes: big, black, shiny
    for (const x of [0.12, 0.6]) {
        g.beginPath();
        g.ellipse(x * R, -R * 0.14, R * 0.12, R * 0.16, 0, 0, Math.PI * 2);
        g.fillStyle = '#10131c';
        g.fill();
        g.beginPath();
        g.arc(x * R + R * 0.04, -R * 0.2, R * 0.045, 0, Math.PI * 2);
        g.fillStyle = '#ffffff';
        g.fill();
    }

    // Nose and a little smile
    g.beginPath();
    g.ellipse(R * 0.4, R * 0.08, R * 0.07, R * 0.05, 0, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    g.beginPath();
    g.moveTo(R * 0.3, R * 0.2);
    g.quadraticCurveTo(R * 0.36, R * 0.28, R * 0.4, R * 0.2);
    g.quadraticCurveTo(R * 0.44, R * 0.28, R * 0.5, R * 0.2);
    g.lineWidth = line * 0.8;
    g.stroke();

    if (opts.crown) drawCrown(g, R, line);
    return c;
}

/** A gold crown, tilted, on top of the head. */
function drawCrown(g, R, line) {
    g.save();
    g.translate(R * 0.05, -R * 0.98);
    g.rotate(0.18);
    const w = R * 0.62;
    const h = R * 0.42;
    g.beginPath();
    g.moveTo(-w / 2, 0);
    g.lineTo(-w / 2, -h);
    g.lineTo(-w / 4, -h * 0.45);
    g.lineTo(0, -h * 1.1);
    g.lineTo(w / 4, -h * 0.45);
    g.lineTo(w / 2, -h);
    g.lineTo(w / 2, 0);
    g.closePath();
    g.fillStyle = '#ffcf33';
    g.fill();
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = '#e8364f';
    for (const x of [-w / 4, w / 4]) {
        g.beginPath();
        g.arc(x, -h * 0.22, R * 0.05, 0, Math.PI * 2);
        g.fill();
    }
    g.restore();
}

/**
 * A soft ground shadow, stretched under each marcher.
 * @param {number} R - Radius in px
 * @returns {HTMLCanvasElement}
 */
export function drawShadow(R) {
    const c = document.createElement('canvas');
    c.width = 2 * R;
    c.height = 2 * R;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, 'hsla(220, 40%, 8%, 0.45)');
    grad.addColorStop(1, 'hsla(220, 40%, 8%, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2 * R, 2 * R);
    return c;
}
