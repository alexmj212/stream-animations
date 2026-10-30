import { describe, it, expect } from 'vitest';
import { parseGpuCsv, summarizeGpu } from '../../tools/gpu/summary.js';

const csv = [
    'time,obs_running,obs_3D,obs_VideoEncode,browser_3D,all_3D',
    '2026-10-30T22:50:00,1,20.0,25.0,3.0,30.0',
    '2026-10-30T22:50:05,1,24.0,21.0,5.0,33.0',
    '2026-10-30T22:50:10,1,22.0,23.0,4.0,31.0',
    '2026-10-30T22:50:15,0,0.0,0.0,0.0,2.0',
    ''
].join('\r\n');

describe('gpu summary', () => {
    it('parses numbers and keeps the time as text', () => {
        const rows = parseGpuCsv(csv);
        expect(rows).toHaveLength(4);
        expect(rows[0].time).toBe('2026-10-30T22:50:00');
        expect(rows[1].obs_3D).toBe(24);
    });

    it('summarises only samples where OBS was running', () => {
        const { samples, columns } = summarizeGpu(parseGpuCsv(csv));
        expect(samples).toBe(3);
        expect(columns.obs_3D).toEqual({ median: 22, p95: 24, max: 24 });
        expect(columns.obs_VideoEncode.median).toBe(23);
        expect(columns.time).toBeUndefined();
    });

    it('copes with no OBS samples', () => {
        expect(summarizeGpu([])).toEqual({ samples: 0, columns: {} });
    });
});
