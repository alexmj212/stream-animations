# Proving audio changes

AJ (2026-10-29): audio changes are "incredibly perceptible", so no change to a
filter, fader, ducking or fade ships on a suggestion. It ships when
`npm run audio` shows it is as good as or better than today's chain and past
streams, on AJ's real voice, and AJ has heard the level-matched clips. AJ
tames loud sources with the fader rather than a limiter, so every limiter
proposal is tested against a fader-only version.

## Levels and clipping

AJ (2026-10-29): "no audio clipping ever", and "audio should never peak above
yellow in most cases". The Spheal march shipped with its song in the red the
whole time (true peak +1.3 dBTP, 1408 samples at full scale) because nothing
measured it. These rules exist so that can't happen again.

**OBS's meter.** OBS's mixer meter is a sample-peak meter, post-fader: green
below -20 dBFS, yellow from -20 to -9 dBFS, red above -9 dBFS (-20 is the
alignment level, about average speech; -9 is the permitted maximum, above
which a sound "may get clipped before it reaches the viewer";
[OBS Audio Mixer Technical Details](https://obsproject.com/kb/audio-mixer-technical-details)).
OBS mixes in floating point, so a source can go over 0 dBFS inside OBS without
showing it, but the stream and recording clip at 0 dBFS.

**The rules.**

1. Nothing clips, ever: no sample at or above -0.1 dBFS, and true peak at
   or below -1 dBTP. True peak, not sample peak, because AAC re-encoding
   (Twitch, VODs, the recording) brings back peaks between samples.
2. Nothing goes into OBS's red: true peak at or below -9 dBTP. Renders may
   blip into the red for at most 1 meter update in 1000 (a rare shout).
   Sound files a page plays may not go into the red at all.
3. Target zones from the
   [OBS Audio Mixer Guide](https://obsproject.com/kb/audio-mixer-guide):
   speech peaks at the top of yellow, gameplay in the lower yellow, music
   and alert sounds in the green (under -20 dBFS). The harness warns when a
   source is above its zone.
4. Set levels with gain or the fader, not a limiter (AJ). A page that plays
   sound applies a gain from config (`config.<scene>....gainDb`), sized with
   `npm run audio -- meter <file>`; a file that was clipped before it was
   encoded (flat-topped waveform) is replaced, since no gain fixes that.
5. Every sound file under `src/` is registered in `audioConfig.assets`
   (`tools/audio/config.js`) with the gain its page applies.
   `npm run audio -- assets` checks them all and runs in CI, so a new sound,
   or a gain change that pushes one into the red, fails the PR.

Past streams meet this: on 2026-10-25 the full mix (track 1) peaked between
-12.4 and -7.3 dBFS and went into the red for 0.1% of one 100 s section;
the mic track never did.

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
| True peak (4x oversampled), clipped samples, time in OBS's red zone | Overs distort after Twitch's AAC encode; AJ wants nothing above yellow |
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
| `npm run audio -- meter <files...> [--gain-db=n]` | How a sound file reads on OBS's meter at a gain: loudness, true peak, time in the red, clipped samples, baked-in clipping, and the gain that keeps it in the yellow |
| `npm run audio -- music <track1> <track2\|silent> [...pairs] [--gain-db=n] [--kbps=160]` | Music level in past streams: track 2 (VOD) is track 1 without the music, so track 1 minus track 2 is the music, down to an AAC coding-noise floor it estimates per excerpt. Gives its loudness, peak and meter zone, and how far it sits under the rest of the mix. Pass `silent` where track 2 is digital silence (Starting, Ending); `--gain-db` previews a fader change |
| `npm run audio -- assets` | CI gate: every sound file under `src/` at its configured gain (rules above) |
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

## Applying a change in OBS

A filter's `enabled` flag in the scene collection proves nothing on its
own. On 2026-10-31 the Mic's NVIDIA filter (`nvidia_audiofx_filter`, left
over from an older OBS) was switched on to stop fan noise. OBS 33 no longer
registers that kind, so the filter was hidden and did nothing, and a quiet
meter reading (the gate closing) was misread as proof that it worked. AJ
found it by opening the filter list. So, after any change on Defiant:

1. Check that every filter's kind is in `GetSourceFilterKindList`. A kind
   OBS doesn't load is kept in the JSON but is inert. Noise suppression is
   `noise_suppress_filter_v2`, method `denoiser` (NVIDIA) or `rnnoise`.
2. Read the filter back with `GetSourceFilterList` and confirm it's there.
3. Measure something the change should move, at a moment where the old
   chain would show the problem, such as a pause with the fan running for
   noise. A reading the gate alone explains isn't evidence.

The harness treats both NVIDIA kinds as unemulated (`--ns` captures stand in
for them), so it can't catch this either.

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

## Music level (2026-10-31)

Measured with `npm run audio -- music` on 8-minute excerpts from the start
and end of the 10-08, 10-15 and 10-25 streams, plus two 5-minute excerpts
from the middle of 10-25.

Track 1 minus track 2 isn't quite the music alone. Each track is AAC-encoded
on its own, so their coding noise doesn't cancel. It leaves a floor about
20 to 30 LU under the rest of the mix (code review, #128). The command
estimates that floor per excerpt by re-encoding both tracks. It also measures
the music where track 2 is silent, which has no floor, and that's the number
to trust while AJ talks. The recordings use CoreAudio AAC at 160 kb/s on every
track (profile Exogenesis, checked 2026-10-31). The command re-encodes with
ffmpeg's AAC at the same bitrate, which is noisier than CoreAudio, so its
floor errs high.

| Moment | Music | Peak | How it was measured |
|---|---|---|---|
| Starting (all three streams) | -26 to -28 LUFS | -16 to -18 dBFS (yellow) | 20+ dB above the floor |
| Ending (10-08, 10-25) | -26 LUFS | -16 to -18 dBFS | 20 dB above the floor |
| Talking and gameplay, 10-25 | -44 to -47 LUFS | about -25 dBFS (green) | in 12 to 100 s of gaps per excerpt where track 2 is silent; the mix-wide figure sits at the floor |
| Talking and gameplay, 10-15 | below about -50 LUFS | | at the floor, with no gaps, so it can't be measured |
| Talking and gameplay, 10-08 | off | | track 1 equals track 2 |

The 18 dB step between Starting/Ending and talking is the Music Fade
Up/Down automations: BG Music moves between 25% and 3% over 3 s. Since the
game picker (2026-10-30), the music plays through
`App Audio: Spotify.exe (Music)`, which copied BG Music's fader, tracks and
Limiter but not its two fade filters. So the music stays at 3% everywhere.
A live read on 2026-10-31 had it peaking at -38 dBFS while AJ talked. That's
quieter than 10-25 and within what 10-15 allows. On Starting and Ending it
is about 18 dB below where it used to be.
