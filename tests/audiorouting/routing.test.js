import { describe, it, expect } from 'vitest';
import {
    carriesSound, sourceGroup, audioFilters, tracksFromMask, tracksOn, outputsFrom, outputsOfTrack,
    changeTracks, channelTracks, touchesRunning, addsToVod, sortSources, wirePath, OUTPUT_PARAMS
} from '../../src/audiorouting/routing.js';

const p = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { parameterValue: v, defaultParameterValue: null }]));

describe('carriesSound', () => {
    it('counts a browser page only with "Control audio via OBS"', () => {
        expect(carriesSound('browser_source', { reroute_audio: true })).toBe(true);
        expect(carriesSound('browser_source', {})).toBe(false);
    });
    it('counts a window or game capture only with "Capture audio"', () => {
        expect(carriesSound('game_capture', { capture_audio: true })).toBe(true);
        expect(carriesSound('window_capture', {})).toBe(false);
    });
    it('leaves out images, colours, text and scenes; keeps devices and media', () => {
        for (const k of ['image_source', 'color_source_v3', 'text_gdiplus_v3', 'scene', 'monitor_capture']) expect(carriesSound(k)).toBe(false);
        for (const k of ['wasapi_input_capture', 'wasapi_process_output_capture', 'ffmpeg_source', 'dshow_input']) expect(carriesSound(k)).toBe(true);
    });
});

describe('sourceGroup and sortSources', () => {
    it('puts inputs first, then desktop and apps, media, browser, others', () => {
        expect(sourceGroup('wasapi_input_capture').rank).toBe(0);
        expect(sourceGroup('wasapi_output_capture').rank).toBe(1);
        expect(sourceGroup('wasapi_process_output_capture').rank).toBe(1);
        expect(sourceGroup('ffmpeg_source').rank).toBe(2);
        expect(sourceGroup('browser_source').rank).toBe(3);
        expect(sourceGroup('dshow_input').rank).toBe(4);
    });
    it('sorts by group, then name without case', () => {
        const out = sortSources([
            { name: 'b media', kind: 'ffmpeg_source' }, { name: 'Mic', kind: 'wasapi_input_capture' },
            { name: 'A media', kind: 'ffmpeg_source' }, { name: 'Alerts', kind: 'browser_source' }
        ]);
        expect(out.map(s => s.name)).toEqual(['Mic', 'A media', 'b media', 'Alerts']);
        expect(out[1].group).toBe('Media');
    });
});

describe('audioFilters', () => {
    it('gives each audio filter an icon in chain order and keeps disabled ones, marked', () => {
        const out = audioFilters([
            { filterName: 'NR', filterKind: 'nvidia_audiofx_filter', filterEnabled: true },
            { filterName: 'Crop', filterKind: 'crop_filter', filterEnabled: true },
            { filterName: 'EQ', filterKind: 'basic_eq_filter', filterEnabled: false },
            { filterName: 'Fade', filterKind: 'move_audio_value_filter', filterEnabled: true },
            { filterName: 'Lim', filterKind: 'limiter_filter', filterEnabled: true }
        ]);
        expect(out.map(f => f.icon)).toEqual(['denoise', 'eq', 'automation', 'limiter']);
        expect(out[1].enabled).toBe(false);
        expect(out[0].label).toBe('Noise suppression');
    });
    it('shows an unknown kind as a generic audio filter only when it sounds like one', () => {
        expect(audioFilters([{ filterName: 'R', filterKind: 'my_reverb_filter' }])[0].icon).toBe('other');
        expect(audioFilters([{ filterName: 'S', filterKind: 'obs_stroke_filter' }])).toEqual([]);
        expect(audioFilters([{ filterName: 'M', filterKind: 'move_value_filter' }])).toEqual([]);
    });
});

describe('tracks', () => {
    it('reads masks and track objects', () => {
        expect(tracksFromMask(7)).toEqual([1, 2, 3]);
        expect(tracksFromMask('57')).toEqual([1, 4, 5, 6]); // 0b111001, BG Music
        expect(tracksFromMask(null)).toEqual([]);
        expect(tracksOn({ 1: true, 2: false, 3: true })).toEqual([1, 3]);
    });
    it('adds, removes and moves', () => {
        expect(changeTracks([1, 4], { add: 2 })).toEqual([1, 2, 4]);
        expect(changeTracks([1, 4], { remove: 1 })).toEqual([4]);
        expect(changeTracks([1, 3], { remove: 3, add: 2 })).toEqual([1, 2]);
        expect(changeTracks([1], { add: 1 })).toEqual([1]);
    });
});

describe('outputsFrom', () => {
    it('reads advanced mode: stream track, VOD track, recording tracks and names', () => {
        const o = outputsFrom(p({
            'Output.Mode': 'Advanced', 'AdvOut.TrackIndex': '1', 'AdvOut.VodTrackEnabled': 'true', 'AdvOut.VodTrackIndex': '2',
            'AdvOut.RecType': 'Standard', 'AdvOut.RecTracks': '7', 'AdvOut.Track3Name': 'Mic only'
        }));
        expect(o.mode).toBe('Advanced');
        expect(o.outputs).toEqual([
            { id: 'stream', label: 'Stream', tracks: [1] },
            { id: 'vod', label: 'Twitch VOD', tracks: [2] },
            { id: 'record', label: 'Recording', tracks: [1, 2, 3] },
            { id: 'replay', label: 'Replay buffer', tracks: [1, 2, 3] }
        ]);
        expect(o.names[3]).toBe('Mic only');
        expect(o.names[4]).toBe('Track 4');
    });
    it('leaves the VOD out when off, and uses FFmpeg recording\'s own tracks', () => {
        const o = outputsFrom(p({ 'Output.Mode': 'Advanced', 'AdvOut.TrackIndex': '3', 'AdvOut.RecType': 'FFmpeg', 'AdvOut.FFAudioMixes': '48' }));
        expect(o.outputs).toEqual([
            { id: 'stream', label: 'Stream', tracks: [3] },
            { id: 'record', label: 'Recording', tracks: [5, 6] }
        ]);
    });
    it('reads simple mode: track 1, unless recording has a quality of its own', () => {
        expect(outputsFrom({}).outputs.map(o => o.tracks)).toEqual([[1], [1], [1]]);
        const own = outputsFrom(p({ 'Output.Mode': 'Simple', 'SimpleOutput.RecQuality': 'Small', 'SimpleOutput.RecTracks': '3' }));
        expect(own.outputs.find(o => o.id === 'record').tracks).toEqual([1, 2]);
        expect(own.names[1]).toBe('Track 1');
    });
    it('falls back to OBS\'s default when a parameter isn\'t set', () => {
        const o = outputsFrom({ 'Output.Mode': { parameterValue: null, defaultParameterValue: 'Advanced' }, 'AdvOut.RecTracks': { parameterValue: null, defaultParameterValue: '1' } });
        expect(o.mode).toBe('Advanced');
        expect(o.outputs.find(x => x.id === 'record').tracks).toEqual([1]);
    });
    it('asks for every parameter it reads', () => {
        expect(OUTPUT_PARAMS.map(x => x.join('.'))).toContain('AdvOut.Track6Name');
    });
    it('lists the outputs of a track', () => {
        const { outputs } = outputsFrom(p({ 'Output.Mode': 'Advanced', 'AdvOut.VodTrackEnabled': 'true', 'AdvOut.RecTracks': '7' }));
        expect(outputsOfTrack(2, outputs)).toEqual(['vod', 'record', 'replay']);
        expect(outputsOfTrack(4, outputs)).toEqual([]);
    });
});

describe('channelTracks', () => {
    it('splits tracks every app has from tracks only some have', () => {
        expect(channelTracks([[1, 2, 4], [1, 4]], null)).toEqual({ all: [1, 4], some: [2], planned: false });
    });
    it('shows the saved tracks for a channel with no apps yet', () => {
        expect(channelTracks([], [1, 2])).toEqual({ all: [1, 2], some: [], planned: true });
        expect(channelTracks([], null)).toEqual({ all: [], some: [], planned: true });
    });
});

describe('touchesRunning', () => {
    const outputs = [{ id: 'stream', label: 'Stream', tracks: [1] }, { id: 'record', label: 'Recording', tracks: [1, 2, 3] }];
    it('names the running outputs a track change reaches', () => {
        expect(touchesRunning([1], outputs, { stream: true, record: true })).toEqual(['Stream', 'Recording']);
        expect(touchesRunning([2], outputs, { stream: true })).toEqual([]);
        expect(touchesRunning([], outputs, { stream: true })).toEqual([]);
    });
});

describe('addsToVod', () => {
    it('is true only for the profile\'s VOD track', () => {
        const outputs = [{ id: 'stream', tracks: [1] }, { id: 'vod', tracks: [4] }];
        expect(addsToVod(4, outputs)).toBe(true);
        expect(addsToVod(2, outputs)).toBe(false);
        expect(addsToVod(undefined, outputs)).toBe(false);
        expect(addsToVod(4, [{ id: 'stream', tracks: [4] }])).toBe(false);
    });
});

describe('wirePath', () => {
    it('leaves and arrives level', () => {
        expect(wirePath(0, 0, 100, 50)).toBe('M0,0 C50,0 50,50 100,50');
        expect(wirePath(0, 0, 10, 0)).toBe('M0,0 C24,0 -14,0 10,0');
    });
});
