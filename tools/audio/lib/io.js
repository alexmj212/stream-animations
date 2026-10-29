/**
 * Decode and encode audio through ffmpeg (planar Float32 in memory).
 */
import { spawnSync } from 'node:child_process';

/**
 * Decode any file ffmpeg reads to planar Float32 at `fs`.
 * @param {string} file
 * @param {object} [opts]
 * @param {number} [opts.fs] sample rate (default 48000, OBS's rate)
 * @param {number} [opts.channels] channel count (default 2, OBS stereo)
 * @param {number} [opts.stream] audio stream index (0:a:N)
 * @param {number} [opts.start] seconds
 * @param {number} [opts.duration] seconds
 * @returns {{ channels: Float32Array[], fs: number }}
 */
export function decode(file, opts = {}) {
    const fs = opts.fs || 48000;
    const nc = opts.channels || 2;
    const args = ['-v', 'error'];
    if (opts.start) args.push('-ss', String(opts.start));
    if (opts.duration) args.push('-t', String(opts.duration));
    args.push('-i', file, '-map', `0:a:${opts.stream || 0}`, '-f', 'f32le', '-ac', String(nc), '-ar', String(fs), '-');
    const r = spawnSync('ffmpeg', args, { maxBuffer: 2 ** 32 });
    if (r.status !== 0) throw new Error(`ffmpeg decode failed for ${file}: ${r.stderr}`);
    const buf = r.stdout;
    const inter = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
    const frames = Math.floor(inter.length / nc);
    const channels = Array.from({ length: nc }, () => new Float32Array(frames));
    for (let i = 0; i < frames; i++) for (let c = 0; c < nc; c++) channels[c][i] = inter[i * nc + c];
    return { channels, fs };
}

/**
 * Encode planar Float32 to a file; the format comes from the extension
 * (.wav, .flac, .mp3, .m4a).
 * @param {string} file
 * @param {Float32Array[]} channels
 * @param {number} fs
 */
export function encode(file, channels, fs) {
    const nc = channels.length;
    const frames = channels[0].length;
    const inter = new Float32Array(frames * nc);
    for (let i = 0; i < frames; i++) for (let c = 0; c < nc; c++) inter[i * nc + c] = channels[c][i];
    const codec = file.endsWith('.mp3') ? ['-c:a', 'libmp3lame', '-b:a', '192k']
        : file.endsWith('.m4a') ? ['-c:a', 'aac', '-b:a', '192k'] : [];
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ac', String(nc), '-ar', String(fs), '-i', '-', ...codec, file],
        { input: Buffer.from(inter.buffer), maxBuffer: 2 ** 26 });
    if (r.status !== 0) throw new Error(`ffmpeg encode failed for ${file}: ${r.stderr}`);
}

/**
 * Copy a time range.
 * @param {Float32Array[]} channels
 * @param {number} fs
 * @param {number} start seconds
 * @param {number} duration seconds
 * @returns {Float32Array[]}
 */
export function slice(channels, fs, start, duration) {
    const a = Math.round(start * fs);
    const b = Math.min(channels[0].length, a + Math.round(duration * fs));
    return channels.map((c) => c.slice(a, b));
}

/**
 * Scale a copy by a dB amount (for loudness-matched listening).
 * @param {Float32Array[]} channels
 * @param {number} db
 * @returns {Float32Array[]}
 */
export function scaled(channels, db) {
    const g = Math.pow(10, db / 20);
    return channels.map((c) => c.map((v) => v * g));
}
