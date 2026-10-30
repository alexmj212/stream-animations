#!/usr/bin/env node
/**
 * Summarises a CSV from tools/gpu/obs-gpu-log.ps1: median, p95 and max GPU
 * use per engine for OBS, its browser pages and the whole machine, so an
 * idle or live stretch can be compared before and after a change
 * (docs/PERFORMANCE.md, "OBS GPU").
 *
 * Usage:
 *   npm run gpu:summary -- tools/gpu-results/obs-gpu-2026-10-30.csv
 *   npm run gpu:summary -- idle.csv --from=22:50 --to=23:00
 *
 * --from/--to compare the local HH:MM only, so they can't select a stretch
 * that crosses midnight; split such a file by date first.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Parse the logger's CSV into rows of numbers keyed by column.
 * @param {string} text - CSV text with a header line
 * @returns {Array<Object>} rows; `time` stays a string
 */
export function parseGpuCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift().split(',');
    return lines.filter(Boolean).map(line => {
        const cells = line.split(',');
        const row = {};
        header.forEach((key, i) => {
            row[key] = key === 'time' ? cells[i] : Number(cells[i]);
        });
        return row;
    });
}

/**
 * Median, p95 and max of every engine column, over the rows where OBS ran.
 * @param {Array<Object>} rows - from parseGpuCsv
 * @returns {{samples: number, columns: Object<string, {median: number, p95: number, max: number}>}}
 */
export function summarizeGpu(rows) {
    const running = rows.filter(r => r.obs_running === 1);
    const keys = running.length ? Object.keys(running[0]).filter(k => k !== 'time' && k !== 'obs_running') : [];
    const columns = {};
    for (const key of keys) {
        const values = running.map(r => r[key]).filter(Number.isFinite).sort((a, b) => a - b);
        const at = q => values[Math.min(values.length - 1, Math.floor(q * values.length))];
        columns[key] = { median: at(0.5), p95: at(0.95), max: values[values.length - 1] };
    }
    return { samples: running.length, columns };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const file = args.find(a => !a.startsWith('--'));
    const flag = name => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
    if (!file) {
        console.error('Usage: npm run gpu:summary -- <csv> [--from=HH:MM] [--to=HH:MM]');
        process.exit(1);
    }
    const from = flag('from'), to = flag('to');
    const rows = parseGpuCsv(readFileSync(file, 'utf8')).filter(r => {
        const hhmm = r.time.slice(11, 16);
        return (!from || hhmm >= from) && (!to || hhmm < to);
    });
    const { samples, columns } = summarizeGpu(rows);
    console.log(`${samples} samples with OBS running`);
    console.log('column'.padEnd(18), 'median', '   p95', '   max');
    for (const [key, s] of Object.entries(columns)) {
        if (s.max === 0) continue;
        console.log(key.padEnd(18), ...[s.median, s.p95, s.max].map(v => v.toFixed(1).padStart(6)));
    }
}
