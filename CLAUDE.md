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

Make small ones in the same PR; propose bigger ones to AJ. Every rule you add
names its date and source, so the next agent knows why it exists and when it
stops applying. Delete rules and process that no longer earn their keep. How
this works in detail: the `improve` skill and `docs/IMPROVING.md`.

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
- `docs/MOTION.md`: the shared motion style (timing, brightness, bar shapes, text); follow it for any visual change; owned by design review
- `docs/PERFORMANCE.md`: frame and memory budgets, how to benchmark
- `docs/VALIDATION.md`: how motion is built and verified with the motion harness
- `docs/DECISIONS.md`: past decisions and why, newest first
- `docs/IMPROVING.md`: the self-improvement loop and the Learnings format
- `docs/roles/`: one charter per permanent role thread (code review, design review, release management, QA)

## Commands

```bash
npm install
npm run dev                 # Vite dev server; open /src/<scene>/index.html
npm test -- --run           # vitest, single run (CI runs this)
npm run build               # every scene to a single-file HTML
npm run motion              # motion harness: renders and checks every scene (docs/VALIDATION.md)
npm run motion:export -- stinger  # transparent video of a scene for OBS
npm run bench               # headless benchmark, see docs/PERFORMANCE.md
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
