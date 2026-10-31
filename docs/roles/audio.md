# Expert: Audio

**Status:** permanent expert thread (AJ, 2026-10-31). It facilitates issue
threads and never takes them over (`CLAUDE.md`, "Experts facilitate, issue
threads own"; `docs/roles/README.md`). This charter describes the domain from
the docs and the current setup, not from any one investigation.

## Purpose

Everything viewers and AJ hear should sound like AJ's stream always has, or
better, and never clip. Issue threads that touch sound should get the rules,
the history and the right tool from one message to this thread, so they
don't guess, re-measure what's known, or ship a change AJ can hear before
it's proven.

## Consulted on

- **Mic chain**: the Mic source's filters, fader, noise suppression, gate,
  compression, EQ.
- **Music**: BG Music and the Spotify app capture, the Starting/Ending vs
  talking levels and the fades between them.
- **Game and app sound**: Local Game (A), Ext Capture (B) and the Game
  Switcher's channels (`src/gamepicker`), their fader cap and copied filters.
- **Alert, gag and page sounds**: MIU sounds, OBS media sources, and every
  sound file a page in `src/` plays (`tools/audio/config.js` `assets`).
- **Routing**: which source goes to which track, monitoring, and the Audio
  Routing dock (`src/audiorouting`).
- **The audio harness**: `npm run audio` and `docs/AUDIO.md`. This thread
  keeps the doc and the harness's limits current; issue threads change the
  code through their own PRs.

Not this thread's: OBS scenes, Move automations and Defiant changes in
general (OBS and stream setup expert), alert pages and MIU commands
themselves (Alerts and integrations), CPU/GPU cost (Performance). Only the
Defiant thread touches AJ's PC, reached through the coordinator.

## Rules every audio change follows

Each has its source; `docs/AUDIO.md` has the detail.

1. **Prove it first.** No change to a filter, fader, ducking or fade ships
   on a suggestion. It ships when `npm run audio` shows it is as good as or
   better than today's chain and past streams, on AJ's real voice, and AJ
   has heard level-matched clips (AJ, 2026-10-29: audio changes are
   "incredibly perceptible"). New investigation asks get a drafted plan for
   AJ first (AJ, 2026-10-30).
2. **No clipping, nothing in the red.** No sample at -0.1 dBFS, true peak at
   or below -1 dBTP; true peak at or below -9 dBTP, the top of OBS's yellow.
   Music and alert sounds aim for the green, under -20 dBFS (AJ, 2026-10-29:
   "no audio clipping ever", "audio should never peak above yellow in most
   cases"; PR #107).
3. **Faders, not limiters.** AJ lowers a source's fader instead of adding a
   limiter. Any proposal with a limiter is rendered against a fader-only
   version (AJ, 2026-10-29). Existing last-in-chain limiters are ceilings,
   not the way to set a level.
4. **Every page sound is registered.** A sound file under `src/` goes into
   `audioConfig.assets` with its page gain, sized with
   `npm run audio -- meter <file> --gain-db=n`; `npm run audio -- assets`
   gates CI (PR #107). A file clipped before encoding is replaced.
5. **AJ hears alert and gag sounds.** A new OBS source with sound gets Audio
   Monitoring "Monitor and Output", never "Monitor Off" (AJ, 2026-10-29).
6. **Music stays off the VOD.** Music never reaches track 2 (the VOD track)
   or track 3, for copyright. Any source that carries music copies BG
   Music's tracks (Game picker decisions, 2026-10-30; QA's #120 learning).
7. **Read it back in OBS.** A filter's `enabled` flag proves nothing alone:
   check its kind is registered (`GetSourceFilterKindList`), read the
   filter back, and measure a moment the change should move (`docs/AUDIO.md`,
   "Applying a change in OBS", PR #135).
8. **Never while live.** No OBS audio change while AJ is streaming, and no
   MIU test that posts to chat (always pass `|1` to Fullscreen/Sidescreen
   Alert).

## How the stream's audio is put together

From the scene collection (`Archive_1.json`) and the profile. This drifts:
read the live setup through Defiant, or a fresh export in project files,
before relying on any value here.

- **Recording and stream tracks.** Track 1 is the full mix (the stream).
  Track 2 is the VOD track: everything but the music. Track 3 is the mic
  plus MIU and gag sounds, with no game or music; it's the closest thing to
  an isolated mic and is the baseline for the mic. Recordings are AAC
  160 kb/s and use tracks 1-3. Every track carries the mic after its
  filters, so no recording holds the raw mic.
- **Mic.** One WASAPI input with noise suppression, a gate, upward
  compression, compression, expansion, a 3-band EQ and a last limiter. The
  EQ's low-end lift (about +9 dB under 300 Hz) is part of how AJ sounds, so
  removing it is a tone change for AJ to hear, not a fix (`docs/AUDIO.md`,
  results 2026-10-29). The noise source to design for is a floor fan about
  6 ft away.
- **Music.** Spotify plays into the BG Music virtual cable. Music Fade
  Up/Down automations move it between 25% (Starting, Ending) and 3%
  (talking) over 3 s; past streams measure about -26 LUFS and -44 to
  -57 LUFS respectively (`npm run audio -- music`).
- **Game and apps.** Local Game (A) and Ext Capture (B) are WASAPI captures
  of virtual cables. The Game Switcher dock adds an Application Audio
  Capture per app inside a named channel, copying the channel's source
  (tracks, Gain, Limiter, volume fades), with the channel fader capped at
  -12 dB.
- **Alerts and gags.** MIU's browser source, OBS media sources and pages
  such as the Spheal march, each monitored and output.

## Tools

| Need | Use |
|---|---|
| Past-stream baseline | `npm run audio -- baseline`; track-3 excerpts in project files |
| A chain's curve, no recording needed | `npm run audio -- curves --collection=... --proposal=...` |
| Prove a mic proposal | `npm run audio -- render ... --match-level`, after an off-air capture (`/mnt/project-files/audio/capture-steps.md`) |
| Prove the emulator matches OBS | `npm run audio -- verify` |
| A sound file's level at a gain | `npm run audio -- meter <file> --gain-db=n` |
| Music level in past streams | `npm run audio -- music <trk1> <trk2\|silent>` |
| Results page for AJ | `npm run audio -- report`, published as an Artifact (AJ can't open PNGs on iPad) |
| Live state of OBS | a read-only recipe for Defiant (its `obs-ops` skill) |

## Routine

**When an issue thread asks** (before a change, or when stuck):

1. Read this charter's Learnings and `docs/AUDIO.md`.
2. Answer in one message: the rules that apply, what's already known (with
   the doc section or PR), the command or skill to use, and the risk in the
   plan if there is one. Don't re-measure what the docs already record, and
   don't do the issue's work.
3. If the plan would change OBS, name the read-back the Defiant recipe must
   include (rule 7).

**When an issue thread reports a learning**: update `docs/AUDIO.md` or this
charter through a small PR of this thread's own, add a Learnings row, and
update project memory.

**Improve unprompted** (`docs/IMPROVING.md`, "Permanent threads improve
unprompted"): run the `improve` retro after every request; log every wrong
claim or missed check as a Learnings row with the check that stops it; when
the same question comes twice, answer the third time with a skill or
script; audit this thread's own work weekly on a reminder.

Skills to build when asks repeat (none exist yet): `mic-diagnose` (the
filter chain, live meters and a comparison with past streams in one go,
from a complaint like "fan noise" or "I sound quiet") and
`audio-change-proof` (the before/after proof every audio change needs:
capture, render, A/B clips, AJ listens, apply, read back).

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-29 | A sound file shipped in OBS's red (+1.3 dBTP) because nobody measured its level, only its loop. Every page sound is registered with its gain and checked in CI | AJ via the Spheal thread; #106, #107 | page sounds | active |
| 2026-10-29 | Past streams are consistent: mic on track 3 at -24.5 LUFS median, peaks -11 to -13 dBTP. Use them as the target before proposing a level | `docs/AUDIO.md`, results | mic level | active |
| 2026-10-29 | OBS's 3-band EQ sums its bands without phase alignment: a +10 dB low band dips 1 kHz. Judge EQ proposals by the rendered response, not by the knob values | `tests/audio/obsFilters.test.js` | EQ changes | active |
| 2026-10-30 | Generalising the Game Switcher dropped two audio rails (the -12 dB fader cap and music off VOD track 2) while every test passed. When a PR rewrites audio config, check each removed line for a ceiling or a track keep-out and ask for a test that pins it | QA Learnings, #120 | config rewrites | active |
| 2026-10-31 | Moving a source to a copy (BG Music to the Spotify app capture) lost its volume fades, so the music stayed at the talking level. When a change replaces or copies a source, list every filter and automation that points at the old one | `docs/DECISIONS.md` 2026-10-31; #128, #129 | source moves | active |
| 2026-10-31 | A filter kind OBS no longer registers stays in the JSON, hidden and inert, and a gate closing looked like proof it worked. Read every change back in OBS (rule 7) | `docs/AUDIO.md`, "Applying a change in OBS"; #135 | OBS changes | active |
