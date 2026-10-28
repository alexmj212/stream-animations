/**
 * Self-contained HTML report for a motion-harness run (inline SVG charts,
 * keyframe filmstrips on a checkerboard so transparency is visible).
 */
import { velocities } from './analyze.js';

const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#86bcb6', '#d37295'];
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function chart({ series, xMax, yMin, yMax, markers = [], dots = [], title, yLabel, w = 760, h = 200 }) {
  const pad = { l: 56, r: 12, t: 22, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const span = (yMax - yMin) || 1;
  const sx = (x) => pad.l + (x / xMax) * iw;
  const sy = (y) => pad.t + ih - ((y - yMin) / span) * ih;
  const lines = series.map((s, i) => {
    const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
    return `<path d="${d}" fill="none" stroke="${s.color || PALETTE[i % PALETTE.length]}" stroke-width="1.5"><title>${esc(s.name)}</title></path>`;
  }).join('');
  const marks = markers.map(m => `<line x1="${sx(m.at)}" x2="${sx(m.at)}" y1="${pad.t}" y2="${pad.t + ih}" class="marker"/><text x="${sx(m.at) + 3}" y="${pad.t + 10}" class="mlabel">${esc(m.label)}</text>`).join('');
  const dotEls = dots.map(d => `<circle cx="${sx(d.x)}" cy="${sy(d.y)}" r="4" class="dot"><title>${esc(d.title)}</title></circle>`).join('');
  const ticks = [];
  const step = xMax > 4000 ? 1000 : xMax > 1500 ? 500 : 250;
  for (let x = 0; x <= xMax; x += step) ticks.push(`<text x="${sx(x)}" y="${h - 8}" class="tick" text-anchor="middle">${x}</text>`);
  ticks.push(`<text x="${pad.l - 6}" y="${sy(yMax) + 4}" class="tick" text-anchor="end">${Math.round(yMax)}</text>`);
  ticks.push(`<text x="${pad.l - 6}" y="${sy(yMin) + 4}" class="tick" text-anchor="end">${Math.round(yMin)}</text>`);
  return `<figure><figcaption>${esc(title)} <span class="unit">${esc(yLabel)}</span></figcaption>
<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" class="plot"/>${marks}${lines}${dotEls}${ticks.join('')}</svg></figure>`;
}

function runSection(run, fps) {
  const xMax = run.frames.length ? run.frames[run.frames.length - 1].t : 1000;
  const coverage = chart({
    title: 'Canvas coverage',
    yLabel: '% of pixels (solid = opaque, dashed = any)',
    xMax, yMin: 0, yMax: 100, markers: run.markers,
    series: [
      { name: 'opaque', color: '#4e79a7', points: run.frames.map(f => [f.t, (f.pixels?.opaque ?? 0) * 100]) },
      { name: 'visible', color: '#bab0ac', points: run.frames.map(f => [f.t, (f.pixels?.visible ?? 0) * 100]) }
    ]
  });

  const trackEntries = Object.entries(run.tracks).slice(0, 12);
  const steps = run.results.find(r => r.steps)?.steps || [];
  let posChart = '';
  let speedChart = '';
  if (trackEntries.length) {
    const xs = trackEntries.flatMap(([, t]) => t.map(p => p.x));
    const posSeries = trackEntries.map(([id, t]) => ({ name: id, points: t.map(p => [p.t, p.x]) }));
    const stepDots = steps.map(s => {
      const track = run.tracks[s.id] || [];
      const p = track.find(q => q.t >= s.t) || track[track.length - 1];
      return p ? { x: s.t, y: p.x, title: `${s.id} Δv=${s.jump}px/s` } : null;
    }).filter(Boolean);
    posChart = chart({
      title: 'Object positions (x)', yLabel: 'px — red dots mark velocity jumps', xMax,
      yMin: Math.min(...xs), yMax: Math.max(...xs), markers: run.markers, series: posSeries, dots: stepDots
    });
    const speedSeries = trackEntries.map(([id, t]) => ({
      name: id,
      points: velocities(t).filter(v => v.onscreen).map(v => [v.t, Math.min(Math.hypot(v.vx, v.vy), 20000)])
    }));
    const sMax = Math.max(1, ...speedSeries.flatMap(s => s.points.map(p => p[1])));
    speedChart = chart({ title: 'On-screen speed', yLabel: 'px/s', xMax, yMin: 0, yMax: sMax, markers: run.markers, series: speedSeries });
  }

  const work = chart({
    title: 'Update + draw CPU per frame', yLabel: `ms (frame budget at ${fps}fps = ${(1000 / fps).toFixed(1)}ms)`,
    xMax, yMin: 0, yMax: Math.max(1, run.work.max), markers: run.markers,
    series: [{ name: 'workMs', color: '#59a14f', points: run.frames.filter(f => f.ran).map(f => [f.t, f.workMs]) }]
  });

  const checks = run.results.map(r => `<tr class="${r.pass ? 'ok' : 'bad'}"><td>${r.pass ? '✓' : '✗'}</td><td>${esc(r.name)}</td><td>${esc(r.detail)}</td></tr>`).join('');
  const strip = run.shots.map(s => `<div class="shot"><img src="${esc(s.file)}" loading="lazy" alt="${esc(run.scenario)} at ${Math.round(s.at)}ms"><span>${Math.round(s.at)}ms</span></div>`).join('');

  return `<section id="${esc(run.scenario)}-${run.seed}">
<h2><span class="badge ${run.pass ? 'ok' : 'bad'}">${run.pass ? 'PASS' : 'FAIL'}</span> ${esc(run.scenario)} <small>seed ${run.seed}</small></h2>
<table class="checks">${checks}</table>
${strip ? `<div class="strip">${strip}</div>` : ''}
<div class="charts">${coverage}${posChart}${speedChart}${work}</div>
</section>`;
}

export function renderReport({ fps, width, height, runs }) {
  const passed = runs.filter(r => r.pass).length;
  const toc = runs.map(r => `<a href="#${esc(r.scenario)}-${r.seed}" class="${r.pass ? 'ok' : 'bad'}">${esc(r.scenario)} · ${r.seed}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Motion Report</title>
<style>
:root{--bg:#f7f7f5;--fg:#1d1d1b;--muted:#6b6b66;--card:#fff;--line:#e2e2dc;--ok:#2f7d32;--bad:#c62828;--plot:#fbfbf9}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ececea;--muted:#9a9a94;--card:#1f1f1d;--line:#33332f;--ok:#7bc67e;--bad:#ef6f6c;--plot:#191918}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{margin:0 0 4px}h2{margin:0 0 12px;font-size:18px}small{color:var(--muted);font-weight:400}
.meta{color:var(--muted);margin-bottom:16px}
nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}nav a{padding:3px 10px;border-radius:999px;border:1px solid var(--line);text-decoration:none}
a.ok{color:var(--ok)}a.bad{color:var(--bad)}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:20px}
.badge{font-size:12px;padding:2px 8px;border-radius:4px;color:#fff;vertical-align:2px}.badge.ok{background:var(--ok)}.badge.bad{background:var(--bad)}
table.checks{border-collapse:collapse;width:100%;margin-bottom:12px}table.checks td{padding:4px 8px;border-top:1px solid var(--line);vertical-align:top}
tr.ok td:first-child{color:var(--ok)}tr.bad td:first-child{color:var(--bad)}tr.bad td:nth-child(2){font-weight:600}
.strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px}
.shot{flex:0 0 auto;text-align:center;color:var(--muted);font-size:12px}
.shot img{display:block;width:240px;height:135px;border-radius:4px;border:1px solid var(--line);
background:repeating-conic-gradient(#3a3a3a 0 25%,#2a2a2a 0 50%) 0 0/16px 16px}
.charts{display:grid;gap:12px}figure{margin:0}figcaption{font-weight:600;margin-bottom:2px}.unit{font-weight:400;color:var(--muted)}
svg{width:100%;height:auto;display:block}.plot{fill:var(--plot);stroke:var(--line)}
.tick,.mlabel{font-size:10px;fill:var(--muted)}.marker{stroke:var(--muted);stroke-dasharray:3 3}.dot{fill:none;stroke:#e53935;stroke-width:2}
path[stroke="#bab0ac"]{stroke-dasharray:4 3}
</style></head><body><main>
<h1>Motion report</h1>
<div class="meta">${passed}/${runs.length} runs passed · ${width}×${height} @ ${fps}fps virtual clock · generated ${new Date().toISOString()}</div>
<nav>${toc}</nav>
${runs.map(r => runSection(r, fps)).join('\n')}
</main></body></html>`;
}
