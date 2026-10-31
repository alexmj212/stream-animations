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
 *   npm run audio -- meter <files...> [--gain-db=n]
 *   npm run audio -- music <track1> <track2|silent> [...pairs] [--gain-db=n]
 *   npm run audio -- assets   (CI: every sound file a page plays, at its configured gain)
 *   npm run audio -- report [--baseline=b.json] [--curves=c.json] [--render=results.json] [--status=status.html] --out=page.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { audioConfig } from './config.js';
import { decode, encode, slice, scaled } from './lib/io.js';
import { analyze, framePowers, speechActivity, meterPeaks } from './lib/analyze.js';
import { sourceChain, applyChange, runChain, unemulated, describeChain } from './lib/chain.js';
import { runChecks } from './lib/checks.js';
import { transferCurve, frequencyResponse, burstPeak } from './lib/curves.js';
import { loudness, peaks } from './lib/loudness.js';
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
    const r = runChain(chain, raw, FS, { startAfter: args['start-after'], block: args.block ? Number(args.block) : undefined });
    const emu = r.output;
    const lag = bestLag(emu[0], obs[0], FS);
    // Skip the first second: OBS's filters were already running when the
    // capture started, while the emulator starts from zero state.
    const from = Math.max(FS, -lag);
    const to = Math.min(emu[0].length, obs[0].length - lag);
    const win = Math.round(0.4 * FS);
    let sig = 0, res = 0, worst = -Infinity, worstAt = 0;
    for (let w = from; w + win <= to; w += win) {
        let ws = 0, wr = 0;
        for (const [ci, e] of emu.entries()) {
            for (let i = w; i < w + win; i++) {
                const o = obs[ci][i + lag];
                const d = o - e[i];
                ws += o * o;
                wr += d * d;
            }
        }
        sig += ws;
        res += wr;
        // Only windows with signal (above -60 dBFS RMS) can show a stage mismatch.
        if (ws / (win * emu.length) > 1e-6) {
            const db = 10 * Math.log10(wr / ws);
            if (db > worst) { worst = db; worstAt = w / FS; }
        }
    }
    const nullDb = 10 * Math.log10(res / sig);
    const ok = nullDb <= -40 && worst <= -20;
    console.log(`lag ${lag} samples; residual ${nullDb.toFixed(1)} dB under the OBS signal overall, worst 400 ms window ${worst.toFixed(1)} dB at ${worstAt.toFixed(1)} s`);
    console.log(ok ? 'emulator matches OBS' : 'MISMATCH: expect at most -40 dB overall and -20 dB in every window, from a lossless capture');
    if (r.skipped.length) console.log(`(not emulated, so they must be off in the capture: ${r.skipped.join(', ')})`);
    if (r.sidechained.length) console.log(`warning: ${r.sidechained.join(', ')} use a sidechain, which OBS feeds through a buffer; offline alignment is approximate`);
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

/**
 * How a sound file (an alert, a gag's song, a clip) reads on OBS's meter at
 * a given gain, whether it clips, and the gain that keeps it out of the red
 * and clear of clipping. AJ sets levels by fader, so this answers "what
 * fader (or page volume) should this source have".
 */
function meter(args) {
    const gainDb = args['gain-db'] !== undefined ? Number(args['gain-db']) : 0;
    const rows = [];
    for (const file of args._.slice(1)) {
        const { channels } = decode(file, { fs: FS });
        const g = Math.pow(10, gainDb / 20);
        const x = channels.map((c) => c.map((v) => v * g));
        const m = meterPeaks(x, FS);
        const l = loudness(x, FS);
        const pk = peaks(x);
        const flat = flatTopRuns(channels);
        const safeGain = gainDb + (audioConfig.checks.meterRedDbfs - pk.truePeak);
        const row = {
            file: path.basename(file), gainDb, lufs: l.integrated, samplePeakDbfs: pk.samplePeak, truePeakDbtp: pk.truePeak,
            clippedSamples: pk.clipped, overFullScale: x.reduce((n, c) => n + c.filter((v) => Math.abs(v) > 1).length, 0),
            redPct: m.redPct, flatTopRuns: flat, gainForYellowDb: safeGain
        };
        rows.push(row);
        const ok = row.redPct <= audioConfig.checks.meterRedMaxPct && row.clippedSamples === 0;
        console.log(`${row.file} at ${gainDb >= 0 ? '+' : ''}${gainDb} dB: ${num1(row.lufs)} LUFS, peak ${num1(row.samplePeakDbfs)} dBFS (true ${num1(row.truePeakDbtp)}), red ${row.redPct.toFixed(1)}% of the time, ${row.clippedSamples} samples at full scale → ${ok ? 'OK' : 'FAIL'}`);
        if (flat) console.log(`  ${flat} flat-topped runs in the file itself: clipping baked in before it reached us; lowering the volume won't remove that distortion`);
        console.log(`  gain to stay in the yellow (true peak ≤ ${audioConfig.checks.meterRedDbfs} dBFS): ${num1(safeGain)} dB (${Math.pow(10, safeGain / 20).toFixed(3)}x)`);
        if (!ok) process.exitCode = 1;
    }
    if (args.out) fs.writeFileSync(args.out, JSON.stringify(rows, round, 1));
}

/**
 * Music level in past streams. Track 2 (VOD) is track 1 without the music,
 * so track 1 minus track 2 is the music alone (they are encoded from the
 * mix in one recording, so they line up to the sample; `--lag` if not). Pass `silent` for a track 2
 * excerpt that is digital silence (Starting/Ending, where only music
 * plays). `--gain-db` previews a fader change, such as a fade to 25%.
 */
function music(args) {
    const files = args._.slice(1);
    const gainDb = args['gain-db'] !== undefined ? Number(args['gain-db']) : 0;
    const g = dbToMul(gainDb);
    const rows = [];
    for (let i = 0; i + 1 < files.length; i += 2) {
        const a = decode(files[i], { fs: FS }).channels;
        const b = files[i + 1] === 'silent' ? a.map((c) => new Float32Array(c.length)) : decode(files[i + 1], { fs: FS }).channels;
        const n = Math.min(a[0].length, b[0].length);
        const lag = Number(args.lag || 0);
        const m = a.map((c, ch) => {
            const o = new Float32Array(n);
            for (let k = 0; k < n; k++) { const j = k + lag; o[k] = g * (c[k] - (j >= 0 && j < n ? b[ch][j] : 0)); }
            return o;
        });
        const rest = loudness(b.map((c) => c.subarray(0, n)), FS).integrated;
        const l = loudness(m, FS), pk = peaks(m), mp = meterPeaks(m, FS);
        const row = { file: path.basename(files[i]), lag, musicLufs: l.integrated, restLufs: rest, samplePeakDbfs: pk.samplePeak, truePeakDbtp: pk.truePeak, redPct: mp.redPct, p999Dbfs: mp.p999Dbfs };
        rows.push(row);
        const gap = Number.isFinite(rest) ? `, ${num1(rest - l.integrated)} LU under the rest of the mix (${num1(rest)} LUFS)` : ', nothing else playing';
        const zone = pk.samplePeak > audioConfig.checks.meterRedDbfs ? 'red' : pk.samplePeak > -20 ? 'yellow' : 'green';
        console.log(`${row.file}${gainDb ? ` at ${gainDb >= 0 ? '+' : ''}${gainDb} dB` : ''}: music ${num1(l.integrated)} LUFS, peak ${num1(pk.samplePeak)} dBFS (${zone}), true ${num1(pk.truePeak)} dBTP${gap}${lag ? `; lag ${lag}` : ''}`);
    }
    if (args.out) fs.writeFileSync(args.out, JSON.stringify(rows, round, 1));
}

const num1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : String(v));

/**
 * CI gate: every audio file under src/ must be registered in
 * audioConfig.assets and, at the gain its page applies, must never clip and
 * stay out of OBS's red zone. Music and sound effects past the OBS guide's
 * green zone only warn.
 */
function assets() {
    const found = walk('src').filter((f) => /\.(ogg|mp3|wav|m4a|opus|flac|aac|webm|mp4)$/i.test(f));
    const known = new Set(audioConfig.assets.map((a) => a.file));
    let failed = false;
    for (const f of found) {
        if (!known.has(f)) {
            console.log(`FAIL ${f}: not in audioConfig.assets (tools/audio/config.js); register it with the gain its page applies`);
            failed = true;
        }
    }
    for (const a of audioConfig.assets) {
        if (!fs.existsSync(a.file)) {
            console.log(`FAIL ${a.file}: registered but missing`);
            failed = true;
            continue;
        }
        const gainDb = a.gainDb();
        const { channels } = decode(a.file, { fs: FS });
        const g = Math.pow(10, gainDb / 20);
        const x = channels.map((c) => c.map((v) => v * g));
        const pk = peaks(x);
        const m = meterPeaks(x, FS);
        const l = loudness(x, FS);
        const lim = audioConfig.checks;
        const problems = [];
        if (pk.clipped > 0) problems.push(`${pk.clipped} samples clip (at or above -0.1 dBFS)`);
        if (pk.truePeak > lim.meterRedDbfs) problems.push(`true peak ${num1(pk.truePeak)} dBTP is in OBS's red zone (above ${lim.meterRedDbfs} dBFS); set its gain to ${num1(gainDb + lim.meterRedDbfs - 1 - pk.truePeak)} dB or lower`);
        const flat = flatTopRuns(channels);
        if (flat) problems.push(`${flat} flat-topped runs: the file itself was clipped before encoding; replace it with a clean source`);
        console.log(`${problems.length ? 'FAIL' : 'ok  '} ${a.file} at ${num1(gainDb)} dB: ${num1(l.integrated)} LUFS, true peak ${num1(pk.truePeak)} dBTP, red ${m.redPct.toFixed(1)}%`);
        for (const p of problems) console.log(`     ${p}`);
        const zone = audioConfig.zones[a.role];
        if (!problems.length && zone && pk.truePeak > zone.maxPeakDbfs) {
            console.log(`     warning: the OBS guide keeps ${a.role} under ${zone.maxPeakDbfs} dBFS (${zone.why}); this peaks at ${num1(pk.truePeak)}`);
        }
        if (problems.length) failed = true;
    }
    process.exitCode = failed ? 1 : 0;
}

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        // Registered paths use '/', so normalise Windows separators (Defiant).
        return e.isDirectory() ? walk(p) : [p.split(path.sep).join('/')];
    });
}

/** Runs of 3+ identical samples at |x| ≥ 0.98: a waveform clipped before it was encoded. */
function flatTopRuns(channels) {
    let runs = 0;
    for (const c of channels) {
        let len = 0;
        for (let i = 1; i < c.length; i++) {
            if (Math.abs(c[i]) >= 0.98 && Math.abs(c[i] - c[i - 1]) < 1e-4) {
                if (++len === 2) runs++;
            } else {
                len = 0;
            }
        }
    }
    return runs;
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
const commands = { baseline, curves, render, verify, report, meter, music, assets };
if (!commands[cmd]) {
    console.log('usage: npm run audio -- <baseline|curves|render|verify|meter|music|assets|report> ... (see docs/AUDIO.md)');
    process.exitCode = 1;
} else {
    commands[cmd](args);
}
