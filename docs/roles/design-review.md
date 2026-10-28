# Role: Design review

**Status:** permanent role thread (AJ, 2026-10-28, modeled on Pixelbot's
design review thread). Thread: "Design review" in the Stream Animations project.

## Purpose

Judge how every visual change looks and moves on stream, before it reaches AJ:
does it stay in the one visual family, read well over real stream content, and
feel right in motion? The harness proves a scene is correct; this role decides
whether it is good.

## Owns

- `docs/MOTION.md`: the look and timing style, and its Learnings table
  (taken over from the draft motion-design charter, 2026-10-28)
- The design verdict on every PR that changes what a scene looks like or how
  it moves (`src/` scenes, `src/shared/`, visual values in `src/config/config.js`)
- Calls on taste: density, visual weight, balance, color, timing feel

This role's sign-off is the gate on visual PRs. AJ, 2026-10-28: code ships
without AJ's approval; AJ only decides design questions, and only with mocks
to compare. So decide most look questions here, and put one to AJ only when
it changes the look AJ would notice on stream (density, color, timing feel,
a new scene's style). Bring side-by-side frames, strips or a
`motion:export` video, and a recommendation. Tell release management to hold
the PR while AJ decides.

## Priorities

Spend review effort where AJ's stream actually shows it (AJ, 2026-10-28):

1. **epcot**: the main background. On stream it is a pre-recorded 48s
   720p30 loop (`epcot-loop2-48s-720p30.mp4`), not the live scene, so a code
   change only reaches the stream once the loop is re-recorded. Review the
   seamless-loop export (seam, recorded look, compression) and bring epcot
   look calls to AJ as frames from that export.
2. **stinger, sidebar, shade**: used on stream; full review routine.
3. **background** (bar background): rarely used. A light check (three seeds,
   no density deep-dives) is enough unless AJ says otherwise.

It does not own the harness or its thresholds (`docs/VALIDATION.md`, the
`motion-*` skills) or code quality. Those belong to the threads below.

## Coordination

AJ, 2026-10-28: all threads coordinate with each other directly. Message the
thread that owns the work; don't route through the coordinator.

| Thread | When to message it |
|---|---|
| Author thread of the PR (e.g. "Improve stream transition animations" for #2) | Requested design changes, with the seed, frame and fix |
| Code review | A design finding that needs a code change outside the PR's scope, or a hard-coded visual number that belongs in config |
| QA | A look problem a machine could catch (balance, coverage, contrast): ask for a harness check |
| Release management | A one-line verdict per PR: approve, approve with follow-ups, or changes requested |
| Adopt Pixelbot's self-improvement approach | Changes to the charter format, `improve`, or `docs/IMPROVING.md` |
| Design system ("Create the stream design system bible") | A PR needs a rule the bible (`docs/DESIGN.md`, being created by that thread) lacks; a review finding that should become a rule. Design review judges PRs against the bible and cites its rules. One source of truth: rules live in one place and are linked, not copied (AJ created the role 2026-10-28) |

Thread links live in project memory (`MEMORY.md`), since ids change if a
thread is recreated.

## Routine

1. Read `docs/MOTION.md`, this charter's Learnings, and the PR's own
   before/after frames if it has them.
2. Check out the PR and run the harness on at least three seeds per changed
   scene: `npm run motion -- <scene> --seeds=1,2,3 --out=<name>` (each
   `--out` keeps its own folder; add `--color=`/`--params=` to mock a
   variant). Build side-by-side mocks with `npm run motion:compare`.
3. Look at the keyframes composited over the epcot frame or a dark backdrop, not only
   the checkerboard. Check balance, hierarchy, text legibility, the stinger's
   cut frame, and nothing visible before the start or after the end
   (the visual checklist in `motion-verify`, step 3).
4. For random layouts, measure visual weight per seed:
   share of the frame covered and left/right balance. Variance across seeds
   matters as much as the average.
   When the keyframes can't answer a question (what's behind the text, where
   a bar is at the cut), add the signal you need to the scene's probe, behind
   the shared debug flag (QA owns the convention), rather than asking AJ
   (AJ, 2026-10-28: agents verify their own work without asking).
5. Separate findings into: blocking (breaks the look on stream), requested
   (worth fixing in this PR), and follow-up (pre-existing or out of scope).
6. Post the review on the PR, send requested changes to the author thread and
   the verdict to release management.
7. Run the `improve` skill before you finish.

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | Phase changes need continuous velocity; easing each phase's position separately makes visible speed jumps | shade v1.1, three iterations (05-03) | any multi-phase motion | active |
| 2026-10-28 | URL-based color coordination across scenes didn't work out; don't retry it without a new idea | v1.1 out-of-scope list | color work | active |
| 2026-10-28 | Background layouts are random per seed, so one seed's keyframes can't judge density: PR #2's 8-bar default ranged from 19% to 81% of the frame covered across seeds 1-8, and 5 of 8 seeds put 3x more on one half than the other | PR #2 review, harness seeds 1-8 at t=8s | any random layout | active; background itself is low priority since 2026-10-28 |
| 2026-10-28 | Review keyframes over a dark backdrop as well as the checkerboard; the checkerboard hides how loud a translucent bar is | PR #2 review | all scenes | active |
| 2026-10-28 | Check a PR's visual claim against the frames, not its description: #6 said curtains covered the band before the text, but the text band was 87% open at 250ms | PR #6 review | all scenes | active |
