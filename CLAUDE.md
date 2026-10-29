# Stream Animations - project context

HTML5 Canvas scenes for AJ's OBS stream: stinger (scene transition), sidebar
(notification), shade (raid/alert banner), background (continuous loop) and
epcot (Spaceship Earth lattice, deployed to GitHub Pages). Vanilla JS, no
framework. Every scene builds to a single self-contained HTML file for an OBS
Browser Source (Chromium). Personal use only: no mobile, accessibility or
public-library concerns.

The background and epcot scenes run for the whole stream, so they must stay
cheap on CPU and GPU. That beats every other goal.

## Always improve

AJ's standing rule (2026-10-28): every agent always seeks to improve itself.
Before you finish any task, ask what you redid by hand, guessed at, or got
wrong, and turn the answer into one durable change:

- a script for a routine you repeated (add it to `repeat-routines`),
- a step in a skill, a test or a check that catches the mistake next time,
- a doc fix where a doc misled you,
- a Learnings entry in the charter of the role that owns the area (`docs/roles/`).

Make small ones in the same PR; bigger ones go through the owning role
thread like any other change (see Shipping). Every rule you add
names its date and source, so the next agent knows why it exists and when it
stops applying. Delete rules and process that no longer earn their keep. How
this works in detail: the `improve` skill and `docs/IMPROVING.md`.

## Shipping without approval

AJ (2026-10-28): "for code related things i don't need to see it, just get it
out the door." Run the most efficient workflow with the fewest approval stops.

- **Code, docs, tooling, tests, performance, process**: don't ask AJ. A PR
  ships once code review says Ready and CI is green (plus design review and
  QA sign-off when it changes visuals); release management merges
  it, in order when PRs overlap. Fix review and QA findings yourself and keep
  going.
- **Design decisions only** go to AJ: a change in how a scene looks or moves
  that taste has to settle. Bring mocks to compare side by side (frames,
  strips or videos from `npm run motion` / `npm run motion:export`), with a
  recommendation. Design review decides which questions need AJ.
- Still never: skip or disable a test, or raise a performance budget, to get
  a PR green.
- **Measure it yourself** (AJ, 2026-10-28): add whatever signals you need to
  the scene code to test and verify without asking AJ. Use the shared debug
  convention, so every thread reads the same signals: `createDebug(scene)`
  from `src/shared/debug.js`, `?debug=` channels, `window.__debug[scene]`,
  and `?debugReport=` with `npm run debug:collect` for runs inside OBS.
  Off by default, so it costs nothing on stream. Details in
  `docs/VALIDATION.md`, "Debug signals".

## Work together

AJ (2026-10-28): all threads coordinate with each other. The permanent role
threads are code review, design review, release management and QA
(`docs/roles/README.md`); everything else is a work thread.

- **Before you start**, check whether another thread owns the files or the
  area you are about to change. Agree on who owns which paths, and keep off the
  other thread's paths.
- **When your work affects another thread**, message that thread directly:
  a shared file, a convention it documents, a PR that will conflict with
  its PR, or a learning for its charter.
- **Route reviews to the roles**: a PR with visual changes goes to design
  review and QA, every PR goes to code review, and anything that changes how
  work ships goes to release management.
- **Lessons go to the owner**: send a learning to the thread whose charter
  owns it. Don't edit another role's charter yourself.
- Message only when there's something to act on. Status updates belong in
  your own thread.

## Where things are documented

All docs live in `docs/` (index: `docs/README.md`). The root `README.md` is the
user-facing overview and the full URL parameter reference.

- `docs/SCENES.md`: each scene, its entry point, URL params and OBS setup
- `docs/DESIGN.md`: the stream bible, how everything on stream looks and moves, with rule ids, tokens (`config.design`) and do/don't figures; owned by the design system role (Rotom)
- `docs/MOTION.md`: the shared motion style (timing, brightness, bar shapes, text); follow it for any visual change; owned by design review
- `docs/PERFORMANCE.md`: frame and memory budgets, how to benchmark
- `docs/VALIDATION.md`: how motion is built and verified with the motion harness
- `docs/AUDIO.md`: how OBS mic and audio changes are proven against past streams (`npm run audio`); no audio change ships without it (AJ, 2026-10-29)
- `docs/DECISIONS.md`: past decisions and why, newest first
- `docs/IMPROVING.md`: the self-improvement loop and the Learnings format
- `docs/roles/`: one charter per permanent role thread (code review, design review, release management, QA)

**AJ's streaming vault** (2026-10-28): `F:\exogenesis` on Defiant, an Obsidian
vault that documents the whole stream setup. It has notes on this repo in
`06 Setup/`: `Stream Animations` (hosting and scenes), `Alert & Transition
Wiring` (OBS and Mix It Up), `Overlay Release Process` and `Stream Animations
Agent Team`. The repo docs stay the reference; the vault links to them and
holds the OBS-side picture. When you change something those notes describe
(hosting, OBS or MIU wiring, the release flow, the team rules, a design
decision AJ made), update the note through a thread with folder access to
Defiant, and follow the vault's own `CLAUDE.md`: wiki links, `type:`/`tags:`
frontmatter, no metrics in notes, and append-only `Decisions` and
`Troubleshooting Log`.

## Commands

```bash
npm install
npm run dev                 # Vite dev server; open /src/<scene>/index.html
npm test -- --run           # vitest, single run (CI runs this)
npm run build               # every scene to a single-file HTML
npm run motion              # motion harness: renders and checks every scene (docs/VALIDATION.md)
npm run motion:export -- stinger  # transparent video of a scene for OBS
npm run bench               # headless benchmark, see docs/PERFORMANCE.md
npm run audio -- curves --collection=Archive_1.json  # audio harness, see docs/AUDIO.md
tools/loopcut.sh --help     # frame-exact loop cuts from OBS recordings
```

## Skills

- `steward`: opening, reviewing and driving a PR
- `repeat-routines`: one-command scripts for routines agents keep redoing
- `docs-check`: catch doc drift after a source change (a commit hook prompts it)
- `improve`: the end-of-task retro that turns lessons into durable changes
- `motion-create` and `motion-verify`: building and checking motion (with `docs/VALIDATION.md`)

## Conventions

- **Config**: tunable numbers live in `src/config/config.js` with a comment
  saying why; don't hard-code them in a scene.
- **Timing** is in milliseconds or per-second rates, never per frame. Use
  delta time so scenes look the same at 30, 60 and 120 Hz. Legacy exceptions,
  not to be copied: `config.stinger.timing.fps` and `config.sidebar.timing.fps`
  (60) and the sidebar hold `velocityMin/Max` in px/frame. Convert them when
  you next touch that code.
- **Testable math**: put animation math in pure functions
  (`src/shared/animations/`) and unit-test it; classes hold state.
- **Rendering**: cache expensive drawing in offscreen canvases; use `hsla()`
  colors instead of `globalAlpha`.
- **Style**: 4-space indent, semicolons, explicit `.js` in imports, JSDoc on
  exported functions.
- **Planning**: one GitHub issue (or project thread) and one PR per change.
  Decisions go in `docs/DECISIONS.md`. The GSD `.planning/` workflow was
  retired on 2026-10-28 (AJ, following Pixelbot).
