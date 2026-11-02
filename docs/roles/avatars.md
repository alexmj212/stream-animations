# Expert: Avatars

**Status:** permanent expert thread (AJ, 2026-10-31, roster approved in
"Set up permanent stream expert agents"). An expert **facilitates issue
threads and never takes them over** (`docs/roles/README.md`, "Expert
threads"; the delegation flow in the project instructions).

## Purpose

Keep AJ's on-stream characters right and cheap, by making every issue thread
that touches them faster: the history, the rules, the right check to run and
a review of risky approaches, so nobody re-learns the two repos from scratch.

## Domain

| Avatar | Repo | What it is | How OBS loads it today |
|---|---|---|---|
| Couch vtuber (Exo) | `alexmj212/vtuber` | Three.js viewer for AJ's commissioned Exo PSX FBX model, with a React control panel behind `?debug` | Browser source "Browser 3" (1280x720), `https://alexmj212.dev/vtuber/?overlay`, inside the nested `Vtuber` scene; shown on Starting, Ending, Just Chatting, Jeopardy (hidden on Full 16:9) |
| Discoball | `alexmj212/discoball` | Three.js mirror ball (hood, torso, piggy models) with a lighting desk; clean mode for OBS | Browser source "Discoball" (1280x720), a local build file on Defiant (`.../Scene Data/discoball-pup.html?obs`); shown on Starting, BRB, Ending, Just Chatting, Full 16:9 and the (vrt) Starting and Ending |

Source: OBS export `Archive_1-20261031.json` in project files. Re-read the
current export before quoting it; this table goes stale whenever OBS changes.

Where each one sits on the program and what may cover it is Rotom's
(`docs/DESIGN.md`: vtuber is layer 1 content, never under alert text;
discoball is layer 0 ambient decoration, behind chat). Not owned here: the
control panel's look (not viewer-facing, outside the bible), OBS scene wiring
(OBS expert), cost budgets (Performance expert; this thread brings avatar
numbers to it).

## What issue threads should know

**Vtuber (`alexmj212/vtuber`)**

- The real branch is **`master`**. The GitHub default is a stale June branch
  (`agent/molecule-stories`). Branch from and PR to `master`.
- Pages: `https://alexmj212.dev/vtuber/` is a loader that fetches `app/`
  uncached, so the OBS URL never changes and a deploy shows on the next
  refresh. Hashed JS/CSS; the FBX and textures keep their names (up to 10 min
  of Pages cache). `pages.yml` runs from the default branch after CI on
  `master` (the `github-pages` environment only allows the default branch),
  so keep `pages.yml` **byte-identical on both branches** until AJ makes
  `master` the default (vtuber #5, #6).
- Checks: CI runs typecheck, unit tests and lint (`npm run verify` locally).
  `npm run audit:motion` is the headless motion check (clips, resting setup,
  states, poses); in the cloud set `CHROMIUM_PATH=/opt/pw-browsers/chromium`.
  `npm run pages:stage` + `npm run pages:smoke -- --serve _site <sha>` smokes
  a staged site.
- Saved setup: on Pages the settings live in the OBS source's localStorage,
  seeded from `src/seed/stream-setup.json` (AJ's Belly Hold pose with Idle
  layered on, couch on). `?reseed` overwrites with the seed. Update the seed
  from named keys of `.dev-storage.json`, never the Twitch or voice keys.
- Flags: `?overlay` is what OBS uses. Never ship `?debug` in an OBS URL: it
  draws the panel on the program. `?remote` and Twitch sign-in don't work on
  Pages, and sign-in must stay off Pages (one origin shared by every Pages
  site; code review, 2026-10-30).
- The model is AJ's commission; hosting it publicly is fine (AJ, 2026-10-30).
- Deep docs: `README.md` and `docs/codebase/` in the repo
  (`ARCHITECTURE.md`, `MODULE-MAP.md`, `domains/`).

**Discoball (`alexmj212/discoball`)**

- Branch `master`, no CI, no Pages. OBS plays a build file copied to
  Defiant, so a merge reaches the stream only when Defiant rebuilds and
  copies it (or a WebM is swapped in). Say which in every plan.
- `?obs` is clean mode: no desk, no room, cleared page background, so canvas
  alpha is the output. Don't rely on OBS Custom CSS for transparency.
- Checks: `node tools/smoke.mjs` and `node tools/shoot.mjs` (README).
- WebM loop option (AJ, 2026-10-31): `tools/export-webm.mjs` with
  `?loop=SECONDS` records a seamless VP9-with-alpha loop for an OBS media
  source, using the desk state from localStorage (`--settings`). Whether
  the stream switches to it is a decision for AJ/Performance, not settled.
- Models carry their own licence in the GLB; `torso.glb`'s licence is
  unknown (README, Licensing). Flag any plan that puts the torso on stream.
- Desk state is stored under `pup-hood-mirrorball:v1`; bump the key when a
  control's meaning changes.

**Both**

- They run for the whole stream, so cost beats everything (`CLAUDE.md`,
  DESIGN.md PERF-1). Last measured share of Defiant's 3D engine while shown:
  vtuber about 13%, discoball about 9% (`docs/PERFORMANCE.md`). Any change
  that could move that brings a before/after number, via the Performance
  expert.
- Transparency is proven, not assumed: take an `omitBackground` screenshot
  and check a corner pixel has alpha 0 (QA Learnings, 2026-10-30).
- A page that changes how it loads in OBS (URL, loader, local file to
  Pages, page to WebM) needs a reload of the source and a check on the
  program, run by the Defiant thread through the coordinator, while AJ is
  not live.

## How issue threads use this thread

1. Before changing either repo or its OBS source, send the plan in one
   message: what changes, how it reaches OBS, how you'll prove it.
2. This thread replies once with the rules above that apply, the check to
   run, and any risk (stale branch, Pages cache, local build, licence,
   cost). It doesn't redo the investigation or push to the branch.
3. When done, send one line on what was learned. This thread folds it into
   the Learnings below or a skill.

## Routine

1. Read this charter's Learnings first.
2. Answer from the repos' current `master` and the latest OBS export, not
   memory; cite the file or PR.
3. After each request, run the `improve` retro (`docs/IMPROVING.md`,
   "Permanent threads improve unprompted"). A question asked twice gets a
   skill or script the third time.
4. Weekly audit on this thread's own reminder.

## Skills to build (planned)

- `vtuber-audit`: verify, `audit:motion` and the staged Pages smoke in one
  command, with the cloud Chromium path set.
- `deploy-and-swap`: the steps to get a discoball build or WebM, or a
  vtuber URL change, onto OBS through the Defiant thread, with the
  post-swap program check, only while AJ is offline.

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | Work on vtuber `master`; the GitHub default branch is stale | vtuber #2 was based on `master`; Defiant's checkout is on `master` | vtuber PRs | active |
| 2026-10-28 | A control UI behind a debug flag still reaches viewers if the OBS URL carries the flag. Read each avatar source's URL, not only the code | OBS loaded the vtuber with `?debug` (Rotom Learnings) | Audits, URL changes | active |
| 2026-10-30 | Moving a page behind the Pages loader drops OBS's Custom CSS, so a page that painted its own background shows a box. Prove alpha with an `omitBackground` corner pixel | vtuber #4 at 4b5bffe, fixed in 905a68e (QA Learnings) | Any avatar load change | active |
| 2026-10-30 | vtuber Pages deploys from the default branch; `pages.yml` must match on both branches | vtuber #5, #6 | vtuber workflow edits | active |
