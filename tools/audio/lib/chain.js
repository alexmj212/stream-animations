/**
 * Read audio sources and their filter chains from an OBS scene collection
 * (Archive_1.json), apply a proposal on top, and run a chain over audio with
 * a measurement tap after every stage.
 */
import { createFilter, dbToMul, mulToDb, EMULATED, OBS_BLOCK } from './obsFilters.js';

/**
 * @typedef {object} SourceChain
 * @property {string} name OBS source name
 * @property {Array<{ name: string, id: string, enabled: boolean, settings: object }>} filters
 * @property {number} volume fader as a linear multiplier
 * @property {boolean} muted
 * @property {number} mixers bitmask of audio tracks (bit 0 = track 1)
 * @property {number} monitoringType 0 off, 1 monitor only, 2 monitor and output
 */

/**
 * Pull one source's audio settings out of a scene collection.
 * @param {object} collection parsed scene collection JSON
 * @param {string} name source name
 * @returns {SourceChain}
 */
export function sourceChain(collection, name) {
    const src = (collection.sources || []).find((s) => s.name === name);
    if (!src) throw new Error(`No source named "${name}" in the scene collection`);
    return {
        name,
        filters: (src.filters || []).map((f) => ({
            name: f.name,
            id: f.id,
            enabled: f.enabled !== false,
            settings: f.settings || {}
        })),
        volume: src.volume ?? 1,
        muted: !!src.muted,
        mixers: src.mixers ?? 0x3f,
        monitoringType: src.monitoring_type ?? 0
    };
}

/**
 * List every source that has audio settings worth checking.
 * @param {object} collection
 * @returns {SourceChain[]}
 */
export function audioSources(collection) {
    return (collection.sources || [])
        .filter((s) => (s.filters || []).some((f) => /filter$/.test(f.id) && f.id !== 'move_source_filter')
            || /input_capture|output_capture|ffmpeg_source|vlc_source|browser_source/.test(s.id))
        .map((s) => sourceChain(collection, s.name));
}

/**
 * Apply a proposal to a source chain. A proposal replaces the chain
 * (`filters`), or edits it in place (`set`, `remove`, `insert`), and can set
 * the fader (`volumeDb`).
 * @param {SourceChain} chain
 * @param {object} change one source's entry from a proposal file
 * @returns {SourceChain} a new chain
 */
export function applyChange(chain, change = {}) {
    let filters = chain.filters.map((f) => ({ ...f, settings: { ...f.settings } }));
    if (change.filters) {
        filters = change.filters.map((f) => ({ enabled: true, settings: {}, ...f }));
    }
    for (const name of change.remove || []) {
        const i = filters.findIndex((f) => f.name === name);
        if (i < 0) throw new Error(`remove: no filter "${name}" on ${chain.name}`);
        filters.splice(i, 1);
    }
    for (const [name, patch] of Object.entries(change.set || {})) {
        const f = filters.find((x) => x.name === name);
        if (!f) throw new Error(`set: no filter "${name}" on ${chain.name}`);
        if ('enabled' in patch) f.enabled = patch.enabled;
        Object.assign(f.settings, patch.settings || {});
    }
    for (const ins of change.insert || []) {
        const entry = { enabled: true, settings: {}, ...ins.filter };
        const at = ins.after ? filters.findIndex((f) => f.name === ins.after) + 1
            : ins.before ? filters.findIndex((f) => f.name === ins.before) : filters.length;
        filters.splice(at, 0, entry);
    }
    if (change.order) {
        filters = change.order.map((name) => {
            const f = filters.find((x) => x.name === name);
            if (!f) throw new Error(`order: no filter "${name}" on ${chain.name}`);
            return f;
        });
    }
    return {
        ...chain,
        filters,
        volume: change.volumeDb !== undefined ? dbToMul(change.volumeDb) : chain.volume
    };
}

/**
 * Filters in a chain that are on but can't be emulated offline (NVIDIA
 * noise suppression, VSTs). Their effect has to come from a capture made
 * inside OBS; see "Capturing inputs" in docs/AUDIO.md.
 * @param {SourceChain} chain
 * @returns {string[]} filter names
 */
export function unemulated(chain) {
    return chain.filters.filter((f) => f.enabled && !EMULATED.has(f.id)).map((f) => f.name);
}

/**
 * Run a chain over planar audio. Returns the output (post-fader) and a tap
 * per stage: the audio after that stage, so each stage's input and output
 * can be measured.
 * @param {SourceChain} chain
 * @param {Float32Array[]} input planar audio (not modified)
 * @param {number} sampleRate
 * @param {object} [opts]
 * @param {string} [opts.startAfter] the input was captured after this filter
 *   (for example after a noise suppressor OBS ran), so start the chain there
 * @param {Object<string, Float32Array[]>} [opts.keys] sidechain sources by
 *   name, post-filter and pre-fader as OBS feeds them
 * @param {boolean} [opts.taps] keep a copy of the audio after every stage
 * @param {number} [opts.block] frames per block (default OBS_BLOCK; 480 for a WASAPI packet)
 * @returns {{ output: Float32Array[], preFader: Float32Array[], stages: object[], skipped: string[] }}
 */
export function runChain(chain, input, sampleRate, opts = {}) {
    let filters = chain.filters.filter((f) => f.enabled);
    if (opts.startAfter) {
        const i = filters.findIndex((f) => f.name === opts.startAfter);
        if (i < 0) throw new Error(`startAfter: no enabled filter "${opts.startAfter}" on ${chain.name}`);
        filters = filters.slice(i + 1);
    }
    const skipped = [];
    const stages = [];
    for (const f of filters) {
        const impl = createFilter(f, sampleRate);
        if (!impl) {
            skipped.push(f.name);
            continue;
        }
        stages.push({ name: f.name, id: f.id, settings: f.settings, impl });
    }
    const audio = input.map((c) => Float32Array.from(c));
    const n = audio[0].length;
    const taps = opts.taps ? stages.map(() => input.map(() => new Float32Array(n))) : null;
    const blockSize = opts.block || OBS_BLOCK;
    for (let start = 0; start < n; start += blockSize) {
        const len = Math.min(blockSize, n - start);
        const block = audio.map((c) => c.subarray(start, start + len));
        stages.forEach((st, si) => {
            let key;
            if (st.impl.sidechain) {
                const k = opts.keys?.[st.impl.sidechain];
                key = k ? k.map((c) => c.subarray(start, start + len)) : block.map(() => new Float32Array(len));
            }
            st.impl.process(block, len, key);
            if (taps) block.forEach((c, ci) => taps[si][ci].set(c, start));
        });
    }
    const preFader = audio.map((c) => Float32Array.from(c));
    const vol = chain.muted ? 0 : chain.volume;
    for (const c of audio) for (let i = 0; i < n; i++) c[i] *= vol;
    return {
        output: audio,
        preFader,
        skipped,
        sidechained: stages.filter((st) => st.impl.sidechain).map((st) => st.name),
        stages: stages.map((st, si) => ({
            name: st.name,
            id: st.id,
            settings: st.settings,
            stats: summarizeStats(st.impl.stats),
            tap: taps ? taps[si] : null
        }))
    };
}

function summarizeStats(s) {
    if (!s.samples) return null;
    return {
        meanGrDb: s.grSum / s.samples,
        maxGrDb: s.grMax,
        pctOver1dB: (100 * s.grOver1dB) / s.samples,
        ...(s.opens !== undefined ? { gateOpens: s.opens } : {})
    };
}

/**
 * Describe a chain on one line, for reports.
 * @param {SourceChain} chain
 * @returns {string}
 */
export function describeChain(chain) {
    const parts = chain.filters.filter((f) => f.enabled).map((f) => f.name);
    parts.push(`fader ${mulToDb(chain.volume).toFixed(1)} dB`);
    return parts.join(' → ');
}
