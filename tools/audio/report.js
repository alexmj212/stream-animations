/**
 * The audio harness report: one self-contained HTML page (inline SVG
 * charts, relative links to the listening clips) that can be opened
 * locally or published as an Artifact for AJ.
 */
import fs from 'node:fs';
import { THIRD_OCTAVES } from './lib/spectrum.js';
import { tonalShape } from './lib/checks.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)'];

/**
 * Line chart in SVG with a shared scale for every series.
 * @param {object} o
 * @param {Array<{ label: string, color: string, points: Array<[number, number]>, dash?: boolean }>} o.series
 * @param {[number, number]} o.x x domain
 * @param {[number, number]} o.y y domain
 * @param {boolean} [o.logX]
 * @param {number[]} o.xTicks
 * @param {number[]} o.yTicks
 * @param {(v: number) => string} [o.xFmt]
 * @param {string} o.xLabel
 * @param {string} o.yLabel
 * @param {Array<[number, number, number]>} [o.band] [x, lo, hi] shaded range
 * @returns {string}
 */
function lineChart(o) {
    const W = 640, H = 300, L = 52, R = 16, T = 14, B = 44;
    const sx = (v) => {
        const [a, b] = o.x;
        const t = o.logX ? (Math.log(v) - Math.log(a)) / (Math.log(b) - Math.log(a)) : (v - a) / (b - a);
        return L + t * (W - L - R);
    };
    const sy = (v) => T + (1 - (Math.min(Math.max(v, o.y[0]), o.y[1]) - o.y[0]) / (o.y[1] - o.y[0])) * (H - T - B);
    const xf = o.xFmt || ((v) => String(v));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.yLabel)} by ${esc(o.xLabel)}">`;
    for (const t of o.yTicks) s += `<line x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}" class="grid"/><text x="${L - 6}" y="${sy(t) + 4}" class="tick" text-anchor="end">${t}</text>`;
    for (const t of o.xTicks) s += `<text x="${sx(t)}" y="${H - B + 16}" class="tick" text-anchor="middle">${xf(t)}</text>`;
    s += `<text x="${(L + W - R) / 2}" y="${H - 6}" class="axis" text-anchor="middle">${esc(o.xLabel)}</text>`;
    s += `<text transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" class="axis" text-anchor="middle">${esc(o.yLabel)}</text>`;
    if (o.band) {
        const up = o.band.map(([x, , hi]) => `${sx(x)},${sy(hi)}`);
        const dn = o.band.slice().reverse().map(([x, lo]) => `${sx(x)},${sy(lo)}`);
        s += `<polygon points="${[...up, ...dn].join(' ')}" class="band"/>`;
    }
    for (const se of o.series) {
        const pts = se.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
        s += `<polyline points="${pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round"${se.dash ? ' stroke-dasharray="5 4"' : ''}/>`;
        for (const [x, y] of pts.filter((_, i) => i % Math.max(1, Math.ceil(pts.length / 40)) === 0)) {
            s += `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="7" class="hit"><title>${esc(se.label)}: ${xf(x)} → ${num(y)}</title></circle>`;
        }
    }
    s += '</svg>';
    const legend = o.series.map((se) => `<span class="key"><i style="background:${se.color}${se.dash ? ';opacity:.6' : ''}"></i>${esc(se.label)}</span>`).join('')
        + (o.band ? '<span class="key"><i class="bandkey"></i>Past streams (range)</span>' : '');
    return `<figure class="chart"><div class="legend">${legend}</div><div class="plot">${s}</div></figure>`;
}

const hz = (v) => (v >= 1000 ? `${v / 1000}k` : String(v));

function baselineSection(b) {
    if (!b) return '';
    const agg = b.aggregate;
    const rows = b.rows.map((r) => `<tr><td>${esc(r.file.replace(/_trk\d.*$/, '').replace(/_/g, ' '))}</td><td>${num(r.integratedLufs)}</td><td>${num(r.truePeakDbtp)}</td><td>${num(r.speechPct, 0)}%</td><td>${num(r.digitalSilencePct, 0)}%</td><td>${num(r.speechLoudnessSpreadLu)}</td></tr>`).join('');
    const shapes = b.rows.map((r) => tonalShape(r.speechBands));
    const band = THIRD_OCTAVES.map((f, i) => {
        const v = shapes.map((s) => s[i]).filter(Number.isFinite);
        return v.length ? [f, Math.min(...v), Math.max(...v)] : null;
    }).filter(Boolean);
    const med = tonalShape(agg.speechBands);
    return `
<section id="baseline">
  <h2>Past streams: the sound to match</h2>
  <p>Track 3 of the last five stream recordings (mic plus Mix It Up sounds, no game or music), three 5-minute excerpts each. This is what your mic has sounded like on stream, and every proposal is measured against it.</p>
  <div class="stats">
    <div><b>${num(agg.integratedLufs.median)}</b><span>LUFS, median voice loudness (range ${num(agg.integratedLufs.min)} to ${num(agg.integratedLufs.max)})</span></div>
    <div><b>${num(agg.truePeakDbtp.max)}</b><span>dBTP, loudest peak in any excerpt</span></div>
    <div><b>${agg.files}</b><span>excerpts with speech</span></div>
  </div>
  ${lineChart({
        series: [{ label: 'Past streams (median)', color: 'var(--ink2)', points: THIRD_OCTAVES.map((f, i) => [f, med[i]]) }],
        band, x: [100, 8000], y: [-24, 12], logX: true, xTicks: [100, 250, 500, 1000, 2000, 4000, 8000], yTicks: [-24, -12, 0, 12],
        xFmt: hz, xLabel: 'Frequency (Hz)', yLabel: 'Level vs voice average (dB)'
    })}
  <p class="note">Voice tone: each 1/3-octave band relative to the voice's own average, so loud and quiet streams compare by shape. A proposal whose curve leaves this band sounds different.</p>
  <div class="tablewrap"><table><thead><tr><th>Excerpt</th><th>LUFS</th><th>Peak dBTP</th><th>Talking</th><th>Gated silent</th><th>Spread LU</th></tr></thead><tbody>${rows}</tbody></table></div>
</section>`;
}

function curvesSection(c) {
    if (!c) return '';
    const chains = c.chains.slice(0, 3);
    const transfer = lineChart({
        series: [
            { label: 'Unchanged (in = out)', color: 'var(--ink3)', dash: true, points: [[-80, -80], [0, 0]] },
            ...chains.map((ch, i) => ({ label: ch.title, color: SERIES[i], points: ch.transfer.map((p) => [p.inDb, p.outDb]) }))
        ],
        x: [-80, 0], y: [-80, 0], xTicks: [-80, -60, -40, -20, 0], yTicks: [-80, -60, -40, -20, 0],
        xLabel: 'Mic level in (dBFS RMS)', yLabel: 'Level out to stream (dBFS RMS)'
    });
    const resp = lineChart({
        series: chains.map((ch, i) => ({ label: ch.title, color: SERIES[i], points: ch.response.map((p) => [p.hz, p.db]) })),
        x: [40, 16000], y: [-12, 12], logX: true, xTicks: [50, 100, 250, 500, 1000, 2000, 5000, 10000], yTicks: [-12, -6, 0, 6, 12],
        xFmt: hz, xLabel: 'Frequency (Hz)', yLabel: 'Gain vs 1 kHz (dB)'
    });
    const list = chains.map((ch, i) => `<li><i style="background:${SERIES[i]}"></i><div><b>${esc(ch.title)}</b><span>${esc(ch.describe)}</span><span>Talking at -30 dBFS comes out at ${num(ch.transfer.find((p) => p.inDb === -30)?.outDb)} dBFS; a shout peaking at -6 dBFS peaks at ${num(ch.burstPeakDbfs)} dBFS.</span>${ch.notEmulated.length ? `<em>Runs only inside OBS: ${esc(ch.notEmulated.join(', '))}. Charts show the rest of the chain.</em>` : ''}</div></li>`).join('');
    return `
<section id="curves">
  <h2>What each chain does to your voice</h2>
  <p>Test tones run through exact copies of OBS's own filters, with the settings read from your scene collection. No microphone needed, so these are certain for the filters OBS ships.</p>
  <ul class="chains">${list}</ul>
  <h3>Level in → level out</h3>
  ${transfer}
  <p class="note">Where a line sits above the dashed one, the chain makes that level louder; below, quieter. The far left is room noise between words, the right is shouting.</p>
  ${chains.some((a, i) => chains.some((b, j) => j > i && JSON.stringify(a.transfer) === JSON.stringify(b.transfer))) ? '<p class="note">Lines that look missing are drawn exactly underneath another chain: those chains behave identically on these test tones.</p>' : ''}
  <h3>Tone (frequency response at speaking level)</h3>
  ${resp}
</section>`;
}

function renderSection(r) {
    if (!r) return '';
    const chains = r.chains.filter((c) => !c.skipped);
    const proposals = chains.slice(1);
    const verdicts = proposals.map((p) => {
        const rows = p.checks.map((x) => `<tr class="${x.pass ? 'ok' : 'bad'}"><td><span class="pill">${x.pass ? 'Pass' : 'Fail'}</span></td><td><b>${esc(x.title)}</b><br><span>${esc(x.detail)}</span></td><td class="why">${esc(x.why)}</td></tr>`).join('');
        return `<article class="verdict ${p.verdict}"><header><span class="pill big">${p.verdict === 'pass' ? 'Proven' : 'Not proven'}</span><h3>${esc(p.title)}</h3></header>${p.meta?.hypothesis ? `<p>${esc(p.meta.hypothesis)}</p>` : ''}${p.faderMatchedDb !== null && p.faderMatchedDb !== undefined ? `<p class="note">Fader set to ${num(p.faderMatchedDb)} dB to match past streams' level.</p>` : ''}<div class="tablewrap"><table class="checks"><tbody>${rows}</tbody></table></div></article>`;
    }).join('');
    const clips = r.clips.map((c) => `<div class="clip"><b>${esc(c.title)}</b><span>${num(c.lufs)} LUFS as recorded</span><label>As on stream<audio controls preload="none" src="${esc(c.file)}"></audio></label><label>Level-matched<audio controls preload="none" src="${esc(c.matched)}"></audio></label></div>`).join('');
    const mom = lineChart({
        series: chains.slice(0, 3).map((c, i) => ({ label: c.title, color: SERIES[i], points: c.metrics.momentary.map((v, k) => [k * 0.1, v]).filter((_, k) => k % 5 === 0) })),
        x: [0, r.input.seconds], y: [-60, -10], xTicks: Array.from({ length: 6 }, (_, i) => Math.round((i * r.input.seconds) / 5)), yTicks: [-60, -40, -20],
        xLabel: 'Time (s)', yLabel: 'Momentary loudness (LUFS)'
    });
    const stages = chains.map((c) => `<h4>${esc(c.title)}</h4><div class="tablewrap"><table><thead><tr><th>Stage</th><th>Speech out dBFS</th><th>Pauses out dBFS</th><th>Peak dBFS</th><th>Avg reduction dB</th></tr></thead><tbody>${c.stages.map((s) => `<tr><td>${esc(s.name)}</td><td>${num(s.out.speech)}</td><td>${num(s.out.pause)}</td><td>${num(s.out.peak)}</td><td>${s.stats ? num(s.stats.meanGrDb) : '–'}</td></tr>`).join('')}</tbody></table></div>`).join('');
    return `
<section id="results">
  <h2>Proof on your real voice</h2>
  <p>The same ${num(r.input.seconds / 60)} minutes of raw mic, recorded in OBS off-air, run through today's chain and each proposal. Speech and pauses are measured over exactly the same moments for every version.</p>
  ${verdicts}
  <h3>Listen</h3>
  <p class="note">"Level-matched" plays every version at the same loudness, so you judge the sound and not the volume.</p>
  <div class="clips">${clips}</div>
  <h3>Loudness over time</h3>
  ${mom}
  <h3>Stage by stage</h3>
  ${stages}
</section>`;
}

/**
 * @param {object} d
 * @param {object} [d.baseline] baseline.json
 * @param {object} [d.curves] curves.json
 * @param {object} [d.render] results.json
 * @param {string} [d.status] HTML for the status block at the top
 * @returns {string}
 */
export function buildPage(d) {
    return `<title>Stream Audio Proof</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: one reading column like a bench test report; measurements in mono. */
:root {
  --bg: #f6f7f4; --panel: #ffffff; --ink: #14171a; --ink2: #4a5157; --ink3: #8a9096; --line: #dde1dc;
  --accent: #0b6e69; --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a;
  --ok: #157a3c; --okbg: #e3f3e8; --bad: #b3261e; --badbg: #fbe5e3; --band: rgba(74, 81, 87, .14);
  --display: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --body: "Source Serif 4", Georgia, serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121517; --panel: #1b1f22; --ink: #eef0ee; --ink2: #b9bfc3; --ink3: #7d858b; --line: #2d3337;
  --accent: #4fc2b9; --s1: #3987e5; --s2: #d95926; --s3: #199e70;
  --ok: #6fd18f; --okbg: #17301f; --bad: #ff8a80; --badbg: #3a1d1b; --band: rgba(185, 191, 195, .14); color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #121517; --panel: #1b1f22; --ink: #eef0ee; --ink2: #b9bfc3; --ink3: #7d858b; --line: #2d3337;
  --accent: #4fc2b9; --s1: #3987e5; --s2: #d95926; --s3: #199e70;
  --ok: #6fd18f; --okbg: #17301f; --bad: #ff8a80; --badbg: #3a1d1b; --band: rgba(185, 191, 195, .14); color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 17px/1.55 var(--body); }
main { max-width: 760px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 40px; }
h1, h2, h3, h4 { font-family: var(--display); line-height: 1.15; text-wrap: balance; margin: 0; }
h1 { font-size: 2.1rem; font-weight: 800; letter-spacing: -.01em; }
h2 { font-size: 1.45rem; font-weight: 700; }
h3 { font-size: 1.1rem; font-weight: 700; margin-top: 8px; }
h4 { font-size: .95rem; font-weight: 700; color: var(--ink2); }
section { display: grid; gap: 14px; min-width: 0; }
p { margin: 0; max-width: 65ch; }
.eyebrow { font: 600 .75rem var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.note { font-size: .9rem; color: var(--ink2); }
.status { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; display: grid; gap: 10px; }
.status ol { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.stats div { display: grid; gap: 2px; border-top: 2px solid var(--ink); padding-top: 8px; }
.stats b { font: 600 1.6rem var(--mono); font-variant-numeric: tabular-nums; }
.stats span { font-size: .85rem; color: var(--ink2); }
.chart { margin: 0; display: grid; gap: 8px; }
.plot { overflow-x: auto; }
.plot svg { width: 100%; min-width: 420px; height: auto; display: block; }
.grid { stroke: var(--line); stroke-width: 1; }
.tick { fill: var(--ink3); font: 11px var(--mono); }
.axis { fill: var(--ink2); font: 12px var(--display); }
.band { fill: var(--band); }
.hit { fill: transparent; }
.hit:hover { fill: var(--band); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font: 13px var(--display); color: var(--ink2); }
.key { display: inline-flex; align-items: center; gap: 6px; }
.key i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.key i.bandkey { height: 10px; background: var(--band); }
.chains { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.chains li { display: grid; grid-template-columns: 14px 1fr; gap: 10px; align-items: start; }
.chains li > i { width: 14px; height: 14px; border-radius: 3px; margin-top: 4px; }
.chains li div { display: grid; gap: 2px; min-width: 0; }
.chains span { font: 13px/1.5 var(--mono); color: var(--ink2); overflow-wrap: anywhere; }
.chains em { font-size: .85rem; color: var(--ink2); }
.tablewrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; }
th, td { text-align: left; padding: 7px 10px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font: 600 .75rem var(--display); text-transform: uppercase; letter-spacing: .05em; color: var(--ink2); }
td { font-family: var(--mono); font-size: .82rem; font-variant-numeric: tabular-nums; }
.checks td span, .checks .why { font-family: var(--body); font-size: .85rem; color: var(--ink2); }
.checks td b { font-family: var(--display); }
.pill { display: inline-block; font: 700 .72rem var(--display); text-transform: uppercase; letter-spacing: .06em; padding: 3px 8px; border-radius: 99px; }
.ok .pill, .verdict.pass .pill.big { background: var(--okbg); color: var(--ok); }
.bad .pill, .verdict.fail .pill.big { background: var(--badbg); color: var(--bad); }
.verdict { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; display: grid; gap: 10px; }
.verdict header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.clips { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.clip { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; }
.clip span { font: 12px var(--mono); color: var(--ink3); }
.clip label { display: grid; gap: 4px; font: 12px var(--display); color: var(--ink2); }
.clip audio { width: 100%; }
a { color: var(--accent); }
</style>
<main>
<header style="display:grid;gap:10px">
  <span class="eyebrow">Mic &amp; audio test bench</span>
  <h1>Stream Audio Proof</h1>
  <p>Every audio change gets measured here before it goes near the stream: input and output of each filter, the final level, peaks, noise between words, the starts of words, and tone, against today's chain and your past stream recordings.</p>
</header>
${d.status ? `<section class="status">${d.status}</section>` : ''}
${renderSection(d.render)}
${curvesSection(d.curves)}
${baselineSection(d.baseline)}
</main>`;
}

/**
 * @param {string} file
 * @param {object} render results.json from `audio render`
 */
export function writeReport(file, render) {
    fs.writeFileSync(file, buildPage({ render }));
}
