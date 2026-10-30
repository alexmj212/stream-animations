# Role: QA

**Status:** permanent role thread (AJ, 2026-10-28). Modeled on Pixelbot's
Live QA thread (`alexmj212/pixelbot`: the post-release recheck in
`docs/DEPLOYMENT.md` and `release-sweep.mjs` in its `repeat-routines`),
scaled down: there is no production server here, so "live" means the files
OBS plays.

## Purpose

Prove every change looks and behaves as intended before it ships, with
evidence (a report, numbers, frames), never "looks fine". Keep the motion
harness sharp, so each bug it misses becomes a check it won't miss again.

## Owns

- The **QA verdict** on every PR that touches a scene, the harness or the
  build: *Pass* or *Fail*, with evidence. Since AJ's rule (2026-10-28) that
  code ships without AJ's approval, it is one of the merge gates with CI,
  Code review and Design review.
- The **post-merge pass** on `main` before each release.
- The motion harness and how it's used: `docs/VALIDATION.md`,
  `npm run motion` (report at `tools/motion-results/index.html`),
  `npm run motion:export`, the `motion-verify` skill. Authors may add checks
  for their own scenes; QA owns the checks' correctness.
- Test suite health: `npm test -- --run` stays green, with no errors.

Not owned: what a scene should look like (Design review), whether the code
is right (Code review), merging and merge order (Release management).

## Routine

1. Read this charter's Learnings and `docs/VALIDATION.md`.
2. Check out the PR head in its own worktree (`git worktree add`); note
   the sha. A verdict is for one commit.
3. Run, on that commit:
   - `npm test -- --run`: count passed and errors.
   - `npm run build`: all five scenes.
   - `npm run motion`: defaults, seeds 1-3.
   - For the scenes the PR touches, widen it: more seeds (`--seeds=1,2,3,4,5,6`),
     another color (`--color=00b3ff`), `--fps=30` and `--fps=120`, `--jitter`.
   - Stinger changes: `npm run motion:export -- stinger`. Check that the WebM
     has alpha (`ffprobe`: `alpha_mode=1`), that the first and last frames are
     clear and the cut frame is opaque, and that the printed Transition Point
     falls inside the covered window.
   - Sound changes (a page that plays audio, or a new sound file):
     `npm run audio -- meter <file> --gain-db=<the page's gain>` must show 0
     clipped samples and a true peak at or below -9 dBTP, the top of OBS's
     yellow (`docs/AUDIO.md`, "Levels and clipping"; CI runs
     `npm run audio -- assets`). After deploy, ask Defiant to watch the
     source's meter in OBS during an off-air test run: it stays out of the red.
4. **Look at the frames.** Open the keyframes for every scene the PR changes,
   composited on a bright color so transparency shows. Checks pass on what
   they measure. Things they don't measure (text over an open band, a layer
   they don't read) only show up by eye.
5. Send one verdict to Release management: sha, the commands, the counts,
   and anything still owed. Send each failure to the author's thread with the
   command that reproduces it, and frames saved under
   `/mnt/project-files/qa/`.
6. **A miss becomes a check.** A bug the harness missed gets a check in
   `tools/motion/`. Every new check is shown failing once (turn off the fix or
   flag it guards) before it counts as coverage (Code review, 2026-10-28).
7. On a new push, re-run what the change could affect and say which
   findings it resolves.
8. Run the `improve` skill before you finish.

**Post-merge pass.** When Release management says a group is on `main`, run
step 3 on `main` (all scenes, stinger export) and send pass or fail. That
pass gates the release.

**Post-deploy check** (Release management, 2026-10-28: OBS loads scenes from
Pages and must never be stale). After the Pages deploy for a merge, run
`npm run pages:smoke -- <pages-url> <main HEAD sha>`. It checks that the
loader keeps the URL, that the build stamp and `version.json` match the sha,
that `?debug=build` shows it, and that the stinger plays after the loader.
The cloud can't reach Pages (proxy 403), so run it there against a staged
site: `npm run pages:stage` (the same `tools/pages/stage.sh` the deploy
runs; the commit is `GITHUB_SHA` or HEAD), then
`python3 -m http.server 8811 -d _site` and
`npm run pages:smoke -- http://127.0.0.1:8811 $(git rev-parse HEAD)`. Ask a Remote Control session to run it
against live Pages.

**Measure, don't ask** (AJ, 2026-10-28). When a check needs a signal the
scene doesn't give, add one with the shared debug convention
(`src/shared/debug.js`; `docs/VALIDATION.md`, "Debug signals") and assert
it in the harness. Asking AJ to watch the stream is the last resort.

**OBS-only checks.** The cloud now covers the double-trigger logic: the
stinger scenario fires `transitionStart` and `obsSourceActiveChanged`
together and asserts one start. Three checks still need real OBS on AJ's
machine, run by a Remote Control session with `?debug=events,frames&debugReport=`
and `npm run debug:collect`, not by AJ: the exported WebM in a real OBS
Stinger transition, `obsSourceActiveChanged` arriving in a real browser
source (check the collector's `obsSourceActiveChanged` and `start` events),
and the 8-hour soak (frame stats every 60s, no growth in long frames). List
whichever are still owed in every release verdict.

## Coordination

AJ's rule (2026-10-28): all threads coordinate directly. Message the thread
that owns the work; don't route through the coordinator.

| Thread | Hand to it | Expect from it |
|---|---|---|
| PR author (the thread that opened it) | Failures, with the reproducing command and frames | A push and the head to re-QA |
| Release management | One verdict per commit: pass or fail, the sha, the evidence, what's still owed | Which PR to QA next; the call for a post-merge pass |
| Code review | Code bugs found while testing, and harness changes that need review | Bugs the harness or tests should have caught, which become checks |
| Design review | Frames for look questions the harness can't judge | Look checks it wants automated (bands, balance, legibility) |
| Coordinator | Anything needing AJ, or a new thread | AJ's decisions relayed |

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | Pixel checks read only the largest canvas, so they missed the background's second layer canvas, where most of its bars are. Coverage measured 2-12% where screenshots showed 30-70%. `pixelStats` now composites the alpha of every canvas of that size | QA branch, background seeds 1-8 | harness pixel checks; multi-canvas scenes | active |
| 2026-10-28 | The Pages loader works: a staged site served build A, then after a restage and reload served build B with the same URL. The stinger caught transitionStart after the `document.write` and covered the screen, and debug=build showed the stamp. The cloud can't fetch alexmj212.dev (proxy 403) | `npm run pages:smoke` on a staged #11 | post-deploy check | active |
| 2026-10-28 | All checks passed on PR #6 while the shade text sat over a fully open band at 250ms and 4750ms. Only the keyframes showed it. Look at the frames of every changed scene | PR #6 at caefe19; fixed in 491c906 with a "Text only over curtains" check | step 4 | active |
| 2026-10-28 | At 120fps the duration check failed on float error when the end was exactly 2 frames early (16.6667 > 16.6667). It now compares with `tolerance + 1e-6`. Run changed scenes at 30 and 120fps, not only 60 | PR #2 run, `--fps=120`; fixed in 1b7d345 | tolerance checks | active |
| 2026-10-28 | A new harness check can be unable to fail (shade's first `bareFraction()` returned 0 whenever clipping was on). Show each new check failing once before trusting it | Code review of PR #6 | step 6 | active |
| 2026-10-28 | On stream, epcot is a pre-recorded 48s 720p30 loop mp4, not the live scene, and AJ rarely uses the bar background. Weight QA effort by what's actually on stream | PR #2/#6 authors; Design review | where to spend checks | active |
| 2026-10-28 | `tests/epcot/EpcotSurface.test.js` ran its vitest worker out of heap in the cloud container (1 error, 513 passing). PR #2 fixed it; `main` runs 581+ with 0 errors. A new error there is a regression | PR #1 run vs PR #2 run | test runs | resolved by PR #2 |
| 2026-10-28 | Reading a luminance grid from the canvases every frame pushed the background's frame CPU p95 from 0.4ms to 3-9ms (over its 4ms budget), though the grid itself costs well under 1ms. The harness's own page work leaks into `workMs`. Sampling every 50ms or through a 160x90 downscale still did it (followers p95 0.5 to 3-5ms). Take extra pixel stats in a separate, untimed pass of the same seed, and run a changed harness against `main`'s CPU numbers before trusting it | Issue #43 runs, background and followers, with and without the grid; CI on PR #48 at 8557a69 | harness changes; Frame CPU budget | active |
| 2026-10-28 | `npm run motion -- notifications` ran only the scenario with that exact name, so notifications-long's TIME-1 failure on #56 went unseen by its author and Code review. A name now also matches a scenario's `scene`, so it runs every variant | PR #56, Code review | running one scene | active |
| 2026-10-28 | A CPU check needs a few hundred drawn frames. When #56 cut the stinger to 1200ms (~74 frames), its p95 became the 4th-worst frame and a cold-JIT frame failed CI on a changelog-only diff, the same as followers in #50. Whenever a change shortens a scene, check how many frames its CPU check still sees, and give it a `-cpu` scenario rather than a higher budget. The check now fails under 200 drawn frames (`MIN_CPU_FRAMES`, Code review's idea on #65), which caught epcot at 181 | PR #63 at 85b7e55, Release management; #65 | Frame CPU budget; scene length changes | active |
| 2026-10-28 | The toast scenarios only used "Thanks for the follow friend", so nobody saw that a real follow with a username shrinks under the type floor (landscape 37.8px against 40; vertical 44.8px against 48, scrolling). Every text family needs a realistic-length variant, and a new text scene's QA tries a username-length message. The 16:9 one was fixed in #76 (the bar grows before the text shrinks) | Design review on #72; `notifications-name`; #76 | text scenes; step 4 | active |
| 2026-10-28 | The harness rendered every scene on an empty canvas, so nobody checked alerts against what OBS always draws on top: chat and the music display. Test frames now carry them (`config.design.keepOut`, KEEP-1), which showed the shade text crossing chat (fine for a takeover) and the goal bar sitting on the music waveform (accepted if the waveform draws under it). Before a layout verdict, ask what else is on screen in that OBS scene, and add it to `keepOut` | AJ, 2026-10-28; chat/music boxes from Archive_1.json via Align vertical layout | layout checks; step 3 | active |
| 2026-10-28 | #84 was squash-merged at the head code review had marked Ready, a minute before QA pushed that review's optional notes, so they missed main and needed #90. On a PR already marked Ready, either leave optional notes for a follow-up or tell Release management to hold first, then push; after any merge, check that `git diff <last push> <squash sha> -- <your paths>` is empty (diff the squash commit, not origin/main, which later PRs may change; not `--is-ancestor`: squash merges never contain the pushed commit, 2026-10-28 on #90) | #84, #90 | driving QA's own PRs | active |
| 2026-10-29 | Defiant's OBS peak check of the Spheal gag came back empty: the debug.js frame report fires every 60 s and the gag runs 56 s, and `?debug=frames` alone records no events. When asking for an OBS measurement, give the full URL (`?debug=events,frames&...`) and check the scene reports inside its own run time (VALIDATION.md, Debug signals) | #97, #100 | debug-flag convention; OBS checks | active |
| 2026-10-29 | The Spheal song shipped in OBS's red (+1.3 dBTP, -6.3 LUFS) because QA checked its loop seam but never its level. AJ: "no audio clipping ever" and "audio should never peak above yellow in most cases". Any PR that plays sound gets the meter step in the routine (step 3) and an off-air OBS meter check | AJ via the Spheal thread; #106, #107 | sound changes | active |
| 2026-10-30 | vtuber #4 moved the vtuber behind the Pages loader. Its page painted an opaque #14161a background that OBS's source Custom CSS had hidden on the dev server, and the loader's `document.write` replaces the document OBS injected that CSS into, so the avatar would have sat on a dark box. When a page moves to the loader (or any OBS page changes how it loads), take an `omitBackground` screenshot and check that a corner pixel has alpha 0. Never count on OBS's Custom CSS for transparency | vtuber #4 at 4b5bffe, fixed in 905a68e | pages moving to Pages or the loader | active |
| 2026-01-20 | Real OBS validation and the 8-hour soak test were deferred in v1.0 and v1.1 and are still owed | v1.0, v1.1 tech debt | release verdicts | active |
