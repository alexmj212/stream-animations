/**
 * Tunable numbers for the audio harness. They live here rather than in
 * src/config/config.js because they are tooling only and must not ship
 * inside the scene pages.
 */
import { config } from '../../src/config/config.js';

export const audioConfig = {
    /** OBS's mixer rate (Settings > Audio on Defiant, 2026-10-29). */
    sampleRate: 48000,

    checks: {
        // Twitch transcodes to AAC; peaks above -1 dBTP can clip after encoding (EBU R128 s1).
        maxTruePeakDbtp: -1,
        // AJ (2026-10-29): "audio should never peak above yellow in most cases". OBS's meter
        // turns red above -9 dBFS; "most cases" allows 1 meter update in 1000 (0.1%, about
        // one 50 ms blip every 50 s of sound) for a rare shout or crash.
        meterRedDbfs: -9,
        meterRedMaxPct: 0.1,
        // 1 LU is about the smallest level change listeners reliably notice.
        levelToleranceLu: 1,
        // Pauses may get 1 dB noisier at most, unless they stay below hearing in a stream mix.
        pauseNoiseMarginDb: 1,
        // -70 dBFS RMS sits under the noise floor of the AAC stream and any listener's room.
        inaudibleDbfs: -70,
        // The first 40 ms of a word may lose at most 1 dB more than today.
        onsetMarginDb: 1,
        // One extra spurious gate open a minute is the most we accept.
        chatterMarginPerMin: 1,
        // A 1/3-octave band more than 3 dB off past streams is an audible tone change.
        toneToleranceDb: 3,
        // The loudest moment may sit at most 2 LU further above (or below) the average than today.
        loudMomentsToleranceLu: 2,
        // Speech loudness spread may grow by at most 1 LU.
        spreadMarginLu: 1,
        // The limiter may be active (over 1 dB) at most 0.5% more of the time.
        limiterMarginPct: 0.5
    },

    clips: {
        // Length of each A/B listening clip, and the loudness both sides are matched to,
        // so the louder one doesn't win by being louder.
        seconds: 20,
        matchLufs: -18
    },

    /**
     * Where each kind of source should peak on OBS's meter, from the OBS
     * Audio Mixer Guide (obsproject.com/kb/audio-mixer-guide): speech in the
     * upper yellow to lower red, gameplay in the lower yellow, music and alert
     * sounds in the green. AJ's ceiling for everything is the top of yellow
     * (checks.meterRedDbfs); these are the finer targets, reported as warnings.
     */
    zones: {
        speech: { maxPeakDbfs: -9, why: 'speech peaks at the top of yellow' },
        game: { maxPeakDbfs: -14, why: 'gameplay sits in the lower yellow' },
        music: { maxPeakDbfs: -20, why: 'music and alert sounds stay in the green' },
        sfx: { maxPeakDbfs: -20, why: 'music and alert sounds stay in the green' }
    },

    /**
     * Every sound file a page plays, with the gain the page applies by
     * default, so `npm run audio -- assets` (in CI) can prove none of them
     * clips or goes into the red on OBS's meter (AJ, 2026-10-29: "no audio
     * clipping ever"). An audio file under src/ that isn't listed here
     * fails the check. `role` picks the OBS guide's target zone (docs/AUDIO.md).
     */
    assets: [
        {
            file: 'src/spheal/march.ogg',
            role: 'music',
            // The page multiplies ?volume (default 1) by this gain.
            gainDb: () => config.spheal?.song?.gainDb ?? 0
        }
    ]
};
