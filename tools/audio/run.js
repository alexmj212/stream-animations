#!/usr/bin/env node
/**
 * Audio harness CLI (docs/AUDIO.md). Proves an OBS audio change against
 * today's chain and past streams before it goes anywhere near the stream.
 *
 *   npm run audio -- baseline <files...> [--out=dir]
 *   npm run audio -- curves --collection=Archive_1.json [--proposal=p.json ...] [--out=dir]
 *   npm run audio -- render --collection=Archive_1.json --source=Mic --raw=raw.flac
 *       [--ns=ns.flac] [--proposal=p.json ...] [--baseline=dir/baseline.json]
 *       [--start=s] [--duration=s] [--match-level] [--out=dir]
 *   npm run audio -- verify --collection=Archive_1.json --source=Mic --raw=raw.flac --obs=obs.flac
 *   npm run audio -- report [--baseline=b.json] [--curves=c.json] [--render=results.json] [--status=status.html] --out=page.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { audioConfig } from './config.js';
import { decode, encode, slice, scaled } from './lib/io.js';
import { analyze, framePowers, speechActivity } from './lib/analyze.js';
import { sourceChain, applyChange, runChain, unemulated, describeChain } from './lib/chain.js';
import { runChecks } from './lib/checks.js';
import { transferCurve, frequencyResponse, burstPeak } from './lib/curves.js';
import { loudness } from './lib/loudness.js';
import { dbToMul, mulToDb } from './lib/obsFilters.js';
import { THIRD_OCTAVES } from './lib/spectrum.js';
import { writeReport, buildPage } from './report.js';

const FS = audioConfig.sampleRate;

function parseArgs(argv) {
    const args = { _: [] };
    for (const a of argv) {
        const m = a.match(/^--([^=]+)(?:=(.*))?$/);
        if (!m) { args._.push(a); continue; }
        const v = m[2] ?? true;
        if (args[m[1]] === undefined) args[m[1]] = v;
        else args[m[1]] = [].concat(args[m[1]], v);
    }
    return args;
}

const list = (v) => (v === undefined ? [] : [].concat(v));
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const round = (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
const strip = (r) => { const { series, ...rest } = r; return rest; };

function median(a) {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN;
}

/** Measure past stream recordings into baseline.json. */
function baseline(args) {
    const out = args.out || 'tools/audio-results/baseline';
    fs.mkdirSync(out, { recursive: true });
    const rows = [];
    for (const file of args._.slice(1)) {
        const { channels } = decode(file, { fs: FS });
        const r = analyze(channels, FS);
        if (!Number.isFinite(r.integratedLufs) || r.speechPct < 10) {
            console.log(`skip ${path.basename(file)}: almost no speech (${r.speechPct.toFixed(0)}%)`);
            continue;
        }
        console.log(`${path.basename(file)}: ${r.integratedLufs.toFixed(1)} LUFS, peak ${r.truePeakDbtp.toFixed(1)} dBTP, speech ${r.speechPct.toFixed(0)}%`);
        rows.push({ file: path.basename(file), ...strip(r), momentary: r.series.momentary.filter((_, i) => i % 10 === 0) });
    }
    const agg = {
        files: rows.length,
        integratedLufs: {
            min: Math.min(...rows.map((r) => r.integratedLufs)),
            median: median(rows.map((r) => r.integratedLufs)),
            max: Math.max(...rows.map((r) => r.integratedLufs))
        },
        truePeakDbtp: { max: Math.max(...rows.map((r) => r.truePeakDbtp)) },
        speechBands: THIRD_OCTAVES.map((_, i) => median(rows.map((r) => r.speechBands[i]))),
        pauseRmsDbfs: { median: median(rows.map((r) => r.pauseRmsDbfs)) },
        speechLoudnessSpreadLu: { median: median(rows.map((r) => r.speechLoudnessSpreadLu)) }
    };
    fs.writeFileSync(path.join(out, 'baseline.json'), JSON.stringify({ aggregate: agg, rows }, round, 1));
    console.log(`baseline: ${rows.length} files, median ${agg.integratedLufs.median.toFixed(1)} LUFS → ${out}/baseline.json`);
}

function loadChains(args, sourceName) {
    const collection = readJson(args.collection);
    const current = sourceChain(collection, sourceName);
    const proposals = list(args.proposal).map((f) => {
        const p = readJson(f);
        const change = p.changes?.[sourceName];
        if (!change) throw new Error(`${f} has no change for "${sourceName}"`);
        return { meta: p, chain: applyChange(current, change) };
    });
    return { collection, current, proposals };
}

/** Emulator-only view: transfer curve and frequency response per chain. */
function curves(args) {
    const out = args.out || 'tools/audio-results/curves';
    fs.mkdirSync(out, { recursive: true });
    const sourceName = args.source || 'Mic';
    const { current, proposals } = loadChains(args, sourceName);
    const chains = [{ name: 'current', title: 'Today', chain: current }, ...proposals.map((p) => ({ name: p.meta.name, title: p.meta.title, chain: p.chain }))];
    const result = chains.map((c) => ({
        name: c.name,
        title: c.title,
        describe: describeChain(c.chain),
        notEmulated: unemulated(c.chain),
        transfer: transferCurve(c.chain, FS),
        response: frequencyResponse(c.chain, FS),
        burstPeakDbfs: burstPeak(c.chain, FS)
    }));
    fs.writeFileSync(path.join(out, 'curves.json'), JSON.stringify({ source: sourceName, chains: result }, round, 1));
    for (const c of result) console.log(`${c.name}: ${c.describe}${c.notEmulated.length ? ` (not emulated: ${c.notEmulated.join(', ')})` : ''}`);
    console.log(`→ ${out}/curves.json`);
    return result;
}

/**
 * Render each chain over the same raw input and measure everything.
 * Chains whose first enabled filter only runs inside OBS (NVIDIA noise
 * suppression) take the `--ns` capture: the same mic recorded in OBS with
 * only that filter on, and the rest of the chain runs from there.
 */
function render(args) {
    const out = args.out || 'tools/audio-results/render';
    fs.mkdirSync(path.join(out, 'clips'), { recursive: true });
    const sourceName = args.source || 'Mic';
    const { current, proposals } = loadChains(args, sourceName);
    const base = args.baseline ? readJson(args.baseline).aggregate : null;
    const read = (f) => {
        const d = decode(f, { fs: FS, start: args.start ? Number(args.start) : 0, duration: args.duration ? Number(args.duration) : 0 });
        return d.channels;
    };
    const raw = read(args.raw);
    const ns = args.ns ? read(args.ns) : null;
    const n = Math.min(raw[0].length, ns ? ns[0].length : Infinity);
    const rawIn = raw.map((c) => c.subarray(0, n));
    const nsIn = ns ? ns.map((c) => c.subarray(0, n)) : null;

    // One speech/pause mask from the raw mic, used for every render.
    const refPowers = framePowers(rawIn, FS);
    const { active } = speechActivity(refPowers);

    const chains = [{ name: 'current', title: 'Today', chain: current }, ...proposals.map((p) => ({ name: p.meta.name, title: p.meta.title, meta: p.meta, chain: p.chain }))];
    const results = [];
    for (const c of chains) {
        const missing = unemulated(c.chain);
        let input = rawIn, startAfter;
        if (missing.length) {
            const first = c.chain.filters.find((f) => f.enabled);
            if (missing.length === 1 && first.name === missing[0] && nsIn) {
                input = nsIn;
                startAfter = first.name;
            } else {
                console.log(`skip ${c.name}: ${missing.join(', ')} only run inside OBS; record them there (docs/AUDIO.md, Capturing inputs)`);
                results.push({ name: c.name, title: c.title, skipped: missing });
                continue;
            }
        }
        let chain = c.chain;
        let r = runChain(chain, input, FS, { startAfter, taps: true });
        let faderNote = null;
        if (args['match-level'] && c.name !== 'current') {
            // Find the fader that puts this chain at the past streams' level
            // (or today's), the way AJ sets levels: by fader, not a limiter.
            const target = base?.integratedLufs?.median ?? loudness(results[0].output, FS).integrated;
            const have = loudness(r.output, FS).integrated;
            const newDb = mulToDb(chain.volume) + (target - have);
            chain = { ...chain, volume: dbToMul(newDb) };
            r = runChain(chain, input, FS, { startAfter, taps: true });
            faderNote = newDb;
        }
        const m = analyze(r.output, FS, { activity: active, refPowers });
        const stages = r.stages.map((s) => ({
            name: s.name,
            id: s.id,
            settings: s.settings,
            stats: s.stats,
            out: (() => { const a = analyze(s.tap, FS, { activity: active, spectrum: false }); return { lufs: a.integratedLufs, peak: a.samplePeakDbfs, speech: a.speechRmsDbfs, pause: a.pauseRmsDbfs }; })()
        }));
        results.push({
            name: c.name, title: c.title, meta: c.meta, describe: describeChain(chain), startAfter,
            faderDb: mulToDb(chain.volume), faderMatchedDb: faderNote, metrics: m, stages, output: r.output
        });
        console.log(`${c.name}: ${m.integratedLufs.toFixed(1)} LUFS, ${m.truePeakDbtp.toFixed(1)} dBTP, pauses ${m.pauseRmsDbfs.toFixed(1)} dBFS${faderNote !== null ? `, fader ${faderNote.toFixed(1)} dB` : ''}`);
    }
    const rawMetrics = analyze(rawIn, FS, { activity: active });
    const cur = results[0];
    for (const r of results.slice(1)) {
        if (r.skipped) continue;
        r.checks = runChecks(cur.metrics, r.metrics, audioConfig.checks, base,
            { current: cur.stages, proposed: r.stages });
        r.verdict = r.checks.every((x) => x.pass) ? 'pass' : 'fail';
        console.log(`${r.name}: ${r.verdict.toUpperCase()}`);
        for (const x of r.checks) console.log(`  ${x.pass ? 'ok  ' : 'FAIL'} ${x.title}: ${x.detail}`);
    }

    // Listening clips: the busiest stretch of speech, every render, as-is and
    // loudness-matched so the louder version doesn't win by being louder.
    const len = audioConfig.clips.seconds;
    const start = busiestStart(active, len);
    const clips = [];
    const addClip = (name, title, audio) => {
        const part = slice(audio, FS, start, len);
        const lufs = loudness(part, FS).integrated;
        encode(path.join(out, 'clips', `${name}.mp3`), part, FS);
        encode(path.join(out, 'clips', `${name}-matched.mp3`), scaled(part, audioConfig.clips.matchLufs - lufs), FS);
        clips.push({ name, title, file: `clips/${name}.mp3`, matched: `clips/${name}-matched.mp3`, lufs });
    };
    addClip('raw', 'Raw mic (no filters)', rawIn);
    for (const r of results) if (!r.skipped) addClip(r.name, r.title, r.output);

    const summary = {
        source: sourceName,
        input: { raw: path.basename(args.raw), ns: args.ns ? path.basename(args.ns) : null, seconds: n / FS },
        baseline: base,
        raw: strip(rawMetrics),
        clipStartSec: start,
        clips,
        chains: results.map(({ output, ...r }) => ({ ...r, metrics: r.metrics ? { ...strip(r.metrics), momentary: r.metrics.series.momentary } : undefined }))
    };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(summary, round, 1));
    writeReport(path.join(out, 'index.html'), summary);
    console.log(`→ ${out}/index.html`);
}

function busiestStart(active, seconds) {
    const w = Math.round(seconds / 0.02);
    let best = 0, bestAt = 0, sum = 0;
    for (let i = 0; i < active.length; i++) {
        sum += active[i];
        if (i >= w) sum -= active[i - w];
        if (sum > best) { best = sum; bestAt = i - w + 1; }
    }
    return Math.max(0, bestAt) * 0.02;
}

/**
 * Null test: render today's chain over the raw capture and subtract what
 * OBS itself recorded through the same chain. A deep null (residual far
 * below the signal) proves the emulator matches OBS on AJ's real voice.
 */
function verify(args) {
    const sourceName = args.source || 'Mic';
    const collection = readJson(args.collection);
    const chain = sourceChain(collection, sourceName);
    const raw = decode(args.raw, { fs: FS }).channels;
    const obs = decode(args.obs, { fs: FS }).channels;
    const r = runChain(chain, raw, FS, { startAfter: args['start-after'] });
    const emu = r.output;
    const lag = bestLag(emu[0], obs[0], FS);
    const n = Math.min(emu[0].length, obs[0].length - Math.max(0, lag)) - Math.max(0, -lag);
    let sig = 0, res = 0;
    for (let i = Math.max(0, -lag); i < n; i++) {
        const o = obs[0][i + lag];
        sig += o * o;
        const d = o - emu[0][i];
        res += d * d;
    }
    const nullDb = 10 * Math.log10(res / sig);
    const ok = nullDb <= -40;
    console.log(`lag ${lag} samples; residual ${nullDb.toFixed(1)} dB under the OBS signal → ${ok ? 'emulator matches OBS' : 'MISMATCH (expect ≤ -40 dB with a lossless capture)'}`);
    if (r.skipped.length) console.log(`(not emulated, so they must be off in the capture: ${r.skipped.join(', ')})`);
    process.exitCode = ok ? 0 : 1;
}

/** Lag (samples) of b against a, by cross-correlating 50 ms energy envelopes then refining. */
function bestLag(a, b, fs) {
    const env = (x, hop) => {
        const e = new Float64Array(Math.floor(x.length / hop));
        for (let i = 0; i < e.length; i++) { let s = 0; for (let k = 0; k < hop; k++) s += Math.abs(x[i * hop + k]); e[i] = s; }
        return e;
    };
    const search = (ea, eb, range) => {
        let best = -Infinity, at = 0;
        for (let l = -range; l <= range; l++) {
            let s = 0;
            for (let i = Math.max(0, -l); i < ea.length && i + l < eb.length; i++) s += ea[i] * eb[i + l];
            if (s > best) { best = s; at = l; }
        }
        return at;
    };
    const hop = Math.round(fs * 0.005);
    const coarse = search(env(a, hop), env(b, hop), 400) * hop;
    let best = -Infinity, at = coarse;
    const span = Math.min(a.length, fs * 20);
    for (let l = coarse - hop; l <= coarse + hop; l++) {
        let s = 0;
        for (let i = Math.max(0, -l); i < span && i + l < b.length; i++) s += a[i] * b[i + l];
        if (s > best) { best = s; at = l; }
    }
    return at;
}

/** One page from whichever results exist so far. */
function report(args) {
    const opt = (f) => (f ? readJson(f) : undefined);
    const html = buildPage({
        baseline: opt(args.baseline),
        curves: opt(args.curves),
        render: opt(args.render),
        status: args.status ? fs.readFileSync(args.status, 'utf8') : undefined
    });
    fs.writeFileSync(args.out || 'tools/audio-results/index.html', html);
    console.log(`→ ${args.out || 'tools/audio-results/index.html'}`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const commands = { baseline, curves, render, verify, report };
if (!commands[cmd]) {
    console.log('usage: npm run audio -- <baseline|curves|render|verify> ... (see docs/AUDIO.md)');
    process.exitCode = 1;
} else {
    commands[cmd](args);
}
