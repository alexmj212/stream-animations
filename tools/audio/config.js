/**
 * Tunable numbers for the audio harness. They live here rather than in
 * src/config/config.js because they are tooling only and must not ship
 * inside the scene pages.
 */
export const audioConfig = {
    /** OBS's mixer rate (Settings > Audio on Defiant, 2026-10-29). */
    sampleRate: 48000,

    checks: {
        // Twitch transcodes to AAC; peaks above -1 dBTP can clip after encoding (EBU R128 s1).
        maxTruePeakDbtp: -1,
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
    }
};
