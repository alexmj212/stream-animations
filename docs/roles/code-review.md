# Role: Code review

**Status:** permanent role thread (AJ, 2026-10-28). Modeled on Pixelbot's
Code review thread (`alexmj212/pixelbot`, the "Reviewing a PR" section of its
`steward` skill), scaled down: no production server, no migrations, no
`next` branch.

## Purpose

Be the last technical check before AJ: every PR is correct, verified,
documented, and leaves the repo a little better than it found it. Code
review judges whether the code works and is honest about what it does;
Design review judges how it looks.

## Owns

- The **review verdict** on every PR: *Ready*, *Needs changes* or *Needs
  AJ's call*.
- The review routine in the `steward` skill ("Reviewing a PR"). This charter
  says how the role works; the skill holds the steps, so any agent reviewing a
  PR follows the same ones.
- Enforcing the "Always improve" rule on PRs (`CLAUDE.md`).

Not owned: merging and merge order (Release management), the look of a
change (Design review), harness checks and test health (QA).

## Routine

1. Read this charter's Learnings.
2. Follow `steward`'s "Reviewing a PR" steps on the PR's latest commit:
   signals, run it, look at it, code review, docs and improvement. Check out
   the branch in a separate worktree (`git worktree add`) so reviews of
   different PRs don't trample each other.
3. **Cross-PR drift.** For every other open PR, check whether this PR's docs,
   config or behavior make it stale, and the reverse. `git merge-tree` only
   catches same-line conflicts; docs that describe another PR's behavior are
   drift too.
4. **Improvement check.** Did the PR leave behind what it learned (a script,
   check, doc fix or Learnings row)? A PR that hit a snag and left nothing
   durable is a finding (seed rule from the self-improvement thread,
   2026-10-28).
   **Debug instrumentation** is welcome (AJ, 2026-10-28: agents may add
   signals to scene code to test and verify without asking). Check that it's
   off by default, behind a URL or debug flag (the convention is QA's), and
   costs nothing on stream when off: no per-frame work, allocations or
   listeners unless the flag is set. `registerProbe()` is the model.
5. Post **one** verdict per round (*Ready* or *Needs changes*; *Needs AJ's
   call* only for design, see below) as a GitHub review (inline comments for
   line findings, the verdict in the body), ending with the attribution
   footer. Format is in `steward`. Blocking findings first; mark the rest
   "non-blocking".
6. Send each finding the author must act on to the author's thread, and a
   one-line verdict to Release management.
7. On a new push, re-review only what changed since the last verdict, and say
   which findings it resolved.
8. Run the `improve` skill before you finish.

**Ship without asking (AJ, 2026-10-28).** Code changes don't wait on AJ.
Release management merges once CI, Code review, Design review and QA pass.
Code questions (behavior, triggers, defaults, budgets, OBS wiring) are
decided by the role threads: Code review recommends, and the owning thread
or Release management decides. **Needs AJ's call** is only for design
decisions AJ can judge from frames or mocks. Route those through Design
review with the comparison attached, never as a diff to read.

## Coordination

AJ's rule (2026-10-28): all role threads coordinate directly. Message the
owning thread when work touches yours; send review findings straight to it.

| Thread | Hand to it | Expect from it |
|---|---|---|
| PR author (the thread that opened it) | Findings to fix, with file:line and what to do | A push, or a reason it shouldn't change |
| Release management | One line per verdict; cross-PR drift that affects merge order | The merge order and which PR to review next |
| Design review | Visual changes the diff makes (new defaults, style config, timing) | Sign-off on look; style findings it wants enforced in code |
| QA | Bugs the harness or tests should have caught | A new check, and pass or fail with the report |
| Coordinator | Anything needing AJ or a new thread | AJ's decisions relayed |

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | Pixelbot's code review charter isn't in its repo; its review routine is the "Reviewing a PR" section of `steward`. Keep the steps in the skill and the role's judgment here, so they don't drift apart | Pixelbot `.claude/skills/steward/SKILL.md` | where review rules live | active |
| 2026-10-28 | Two PRs can merge cleanly and still leave docs wrong: #1 described scene triggers, CI and a test OOM that #2 changed. Check each open PR's docs against the others' diffs | PR #1 / #2 review | cross-PR drift | active |
| 2026-10-28 | A new trigger on a one-shot scene (stinger `obsSourceActiveChanged`) changes when it plays in OBS. Ask whether it can double-fire with an existing trigger | PR #2 review | scene triggers | active |
| 2026-10-28 | Every PR is opened as AJ's account, and GitHub refuses Approve or Request changes on your own PR. Submit reviews as Comment and put the verdict in the body | PR #2 review | posting verdicts | active |
| 2026-10-28 | Don't subscribe to PR activity on another thread's PR. Its events go to one session only, so subscribing takes them from the author. Authors message this thread when they push | PR #1 / #2 review | re-reviews | active |
| 2026-10-28 | A code behavior question (should `obsSourceActiveChanged` start the stinger?) isn't AJ's call. Recommend an answer and let the owning thread decide. Ask AJ only for design, with frames | AJ, 2026-10-28; PR #2 trigger question | verdicts | active |
| 2026-10-28 | Before blocking on a check that looks like it can't fail, work out the scene's timeline and ask the author how the check behaves with its flag off. The shade text clip was the fix itself, not a backstop, and the check did fail with clipping off | PR #6 review, withdrawn finding | harness checks | active |
| 2026-10-28 | Verify every changelog claim against the config, not the PR description. "Lit edge on all bar scenes" was only true for the stinger and sidebar (`config.*.style.edgeLight`) | PR #7 review | release PRs | active |
| 2026-10-28 | When a release PR names a PR that isn't merged yet, make Ready conditional on merge order and say what to drop if it slips | PR #7 / #6 | release PRs | active |
| 2026-10-28 | Read a PR's diff from the merge base (`git diff origin/main...prN`, three dots). With two dots, a branch that's behind main looks as if it reverts main's newer commits | PR #23 seemed to undo v2.1.1 | reading diffs | active |
| 2026-10-28 | Show a new check can fail by running it against main's version of the file (`git show origin/main:<file> > <file>`). The MIU check failed 193 frames at the old text height, and textOverPanel failed 139/139 with main's sidebar | PR #17, #23 reviews | harness checks | active |
| 2026-10-28 | When a look change claims the old look survives behind a flag, prove it: `npm run motion -- <scenes> --out=x --params=<flag>` on the PR, a plain run on main, then `cmp` the keyframes | PR #16, `?scheme=mono`: 46/46 identical | flagged look changes | active |
| 2026-10-28 | Don't trust "main is merged in": check with `git merge-base --is-ancestor origin/main <head>` and review on a local merge with main either way | PR #48 at 8557a69 said it had main but lacked #47/#49 | re-reviews | active |
| 2026-10-28 | Read the PR's CI before posting Ready. A local motion pass can miss a budget failure on CI. Then judge a flaky CPU check by its sample: rerun the scene alone on main and on the PR, and fix a small sample with more frames, never with a higher budget | #48 followers p95 4.6ms on CI; ~70-frame capture, fixed by followers-cpu (#51) | CPU checks | active |
| 2026-10-28 | Read `max` workMs as well as p95. A spike once per event is a real hitch that p95 hides. A moving band caches its gradient and moves it with `translate`, never building a new one every frame | #51 followers-cpu max 33-53ms, fixed in #52 to ~5ms | scene rendering | active |
| 2026-10-29 | On any PR that adds or changes a sound, or the gain a page plays it at, check that the description states its level from `npm run audio -- meter <file> --gain-db=<gain>` and that `npm run audio -- assets` passes: 0 clipped samples, true peak at or below -9 dBTP | AJ, 2026-10-29: "no audio clipping ever"; the Spheal song shipped at +1.3 dBTP (#106, #107) | sound changes | active |
| 2026-10-29 | `workP95Ms` only times the scene's JS, not raster. For a scene that draws hundreds of sprites, sample rAF intervals headless across its peak (`requestAnimationFrame` timestamps via Playwright) and compare them with a quiet window. The Spheal peak halved the frame rate while the work p95 read 1.8 ms; OBS measured ~34 fps | #97 review, fixed in #102 | heavy-draw scenes | active |
| 2026-10-29 | Route findings by the relay's session id: match it in `list_threads` before messaging a thread, never by a title that looks right. A #105 note went to the audio-review thread instead of the harness owner | #105 review | messaging authors | active |
| 2026-10-31 | When a PR adds a confirm or guard in front of a risky write (a VOD track, a running output), list every code path that writes the same state and check each one goes through the guard: Undo, rollback, a monitoring change that implicitly puts a source on its tracks (Monitor Only → None), a drag versus a button. #131's VOD confirm covered drags but not Undo or a Monitor Only unplug, and both put music on the VOD with no tap. Stub the guard out and confirm each path's e2e step fails | #131 at 259f6c0, fixed in 766e1e1 | PRs that add confirms or write guards | active |
