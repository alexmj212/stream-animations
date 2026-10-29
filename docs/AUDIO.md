# Proving audio changes

AJ (2026-10-29): audio changes are "incredibly perceptible", so no change to a
filter, fader, ducking or fade ships on a suggestion. It ships when
`npm run audio` shows it is as good as or better than today's chain and past
streams, on AJ's real voice, and AJ has heard the level-matched clips. AJ
tames loud sources with the fader rather than a limiter, so every limiter
proposal is tested against a fader-only version.

## What the harness does

`tools/audio/` has sample-exact ports of OBS's own audio filters
(`lib/obsFilters.js`: gain, noise gate, compressor with sidechain, expander,
upward compressor, 3-band EQ, limiter, each ported from
`plugins/obs-filters` with OBS's block size and state handling). It reads each
source's chain and fader from the scene collection (`Archive_1.json`), applies
a proposal from `tools/audio/proposals/`, and renders today's chain and every
proposal over the same raw input. Then it measures each render, and the audio
after every stage of the chain:

| Measurement | Why |
|---|---|
| Integrated loudness, LRA (BS.1770-4 / EBU R128) | The voice level against past streams and the rest of the mix |
| True peak (4x oversampled), clipped samples | Overs distort after Twitch's AAC encode |
| Noise in pauses | Room noise, fans and hum between sentences |
| Word-onset survival | A slow gate eats the first consonant of each word |
| Spurious gate opens per minute | Chatter on breaths and keyboard |
| Speech loudness spread | How even the voice is |
| 1/3-octave tone vs past streams | Whether the voice sounds like it always has |
| Limiter activity | AJ prefers a fader to a working limiter |

`lib/checks.js` turns these into pass/fail checks; the limits and the reason
for each are in `tools/audio/config.js`. Speech and pauses come from the raw
mic once, so every render is measured over the same moments.

## Commands

| Command | What it does |
|---|---|
| `npm run audio -- baseline <files...>` | Measure past stream recordings (track 3 is mic plus MIU sounds, no game or music) into `baseline.json` |
| `npm run audio -- curves --collection=Archive_1.json --proposal=p.json` | Level-in/level-out curve, frequency response and burst peak of each chain, from test tones. Needs no recording |
| `npm run audio -- render --collection=... --source=Mic --raw=raw.flac --ns=ns.flac --proposal=p.json --baseline=baseline.json --match-level` | Render and check every chain over a capture; writes `index.html`, `results.json` and A/B clips (as recorded and level-matched) |
| `npm run audio -- verify --collection=... --source=Mic --raw=raw.flac --obs=current.flac` | Null test: today's chain emulated over the raw mic minus what OBS recorded through it, skipping the first second (OBS's filters were already running). Passes at 40 dB of cancellation overall and 20 dB in the worst 400 ms window, so a gate that opens a block late fails |
| `npm run audio -- report --baseline=... --curves=... --render=... --out=page.html` | One page from whatever results exist, to publish for AJ |

Output goes to `tools/audio-results/` (gitignored). `--match-level` sets each
proposal's fader so it lands at the past streams' level, the way AJ would.

### Limits of the emulation

- It matches OBS up to float rounding: state is kept in float32 like OBS, but
  intermediate maths runs in doubles.
- OBS runs an async source's filters on each device packet (often 480 frames
  for WASAPI); the harness uses 1024 unless `--block=480`. Block size only
  changes the compressor and limiter on true stereo (their envelope carries
  across blocks as a max over channels), so a mono mic is unaffected but game
  audio can differ slightly.
- OBS feeds a sidechain key through a capture buffer, so ducking renders are
  aligned by assumption; `verify` warns when a chain has a sidechain.

## Capturing inputs

Past recordings only hold the processed mix, so the raw mic has to be
recorded once, off-air, inside OBS. NVIDIA noise suppression and VSTs run
only inside OBS; the harness takes a capture with just that filter on
(`--ns`) and runs the rest of the chain from there.

The Defiant thread does this in a copy of the scene collection and profile
(nothing in `Archive_1` changes), with lossless PCM recording on all six
tracks: track 1 Mic as on stream, 2 the same mic with no filters, 3 noise
suppression only, 4 the proposal built in OBS, 5 game audio with no filters,
6 BG Music with no filters. AJ talks for about three minutes: normal talk,
quiet talk, a laugh and a shout, plosives and S sounds, keyboard and mouse
in a pause, and 20 seconds of silence, with a game and music playing. Steps:
`/mnt/project-files/audio/capture-steps.md`.

From one capture:

1. `verify` track 2 against track 1 proves the emulator matches OBS on AJ's
   voice (and track 3 plus the proposal against track 4 checks the noise
   suppression hand-off).
2. `render` checks every mic proposal from tracks 2 and 3.
3. Game, ducking and alert proposals render from tracks 5 and 6 with the mic
   as the sidechain key.

## Results so far (2026-10-29)

- Past streams are consistent: voice at -24.5 LUFS median (range -25.5 to
  -23.9) on track 3, peaks -11 to -13 dBTP, and the gate holds pauses at
  digital silence.
- Today's chain squeezes 32 dB of input range into about 6.5 dB, and its EQ
  lifts everything under 300 Hz by about 9 dB relative to 1 kHz. That boom is
  part of how AJ has sounded, so a proposal that removes it is a tone change
  for AJ to hear, not a fix.
- OBS's 3-band EQ splits are summed without phase alignment: a +10 dB low
  band dips 1 kHz instead of lifting it (`tests/audio/obsFilters.test.js`).
- The review's proposed mic chain (`mic-review-v1`) compresses far less:
  talk comes out 6 dB louder and a shout 13 dB louder than today, so with the
  fader matched to past streams, shouts would land about 7 dB further above
  talk than viewers are used to. Its limiter never engages on that shout
  (same peak with and without it).
