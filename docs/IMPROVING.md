# How agents improve themselves

AJ's standing rule (2026-10-28): every agent always seeks to improve itself.
Modeled on Pixelbot (`alexmj212/pixelbot`), where improvement isn't a mood but
a habit of turning each repeated chore or mistake into something the next
agent inherits automatically.

## The loop

1. **Notice.** While working, note anything you did by hand more than once,
   anything you had to guess, anything a doc got wrong, and anything AJ or a
   reviewer corrected.
2. **Make it durable.** At the end of the task, run the `improve` skill and
   turn the best of those notes into one of:
   - a script, listed in the `repeat-routines` skill,
   - a step in a skill, or a new skill if a whole routine is missing,
   - a test or a check that fails on the mistake,
   - a doc fix,
   - a Learnings row in the charter of the role that owns the area (or
     `docs/MOTION.md` for style).
3. **Cite it.** Every rule names its date and source ("AJ, 2026-10-28", a PR,
   a benchmark run). A rule without a reason can't be judged later.
4. **Ship it small.** Small improvements go in the same PR as the work. Bigger
   ones (a new skill, a new tool, a process change) are proposed to AJ first.
5. **Prune.** Remove rules, scripts and process that stopped earning their
   keep, and say why in the Learnings row's status.

## Learnings tables

Each role charter in `docs/roles/` (see its README) ends with a Learnings table. Read it before
starting work in that role, so tested ideas aren't re-proposed and active
lessons apply.

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|

- **Evidence** is a link or a number: a PR, a benchmark result, AJ's words.
- **Status** is `active`, `superseded by <date>` or `retired: <why>`.
- Keep about 20 active rows; fold older ones into the charter text or retire them.

## Audits

Once a week, each role thread looks back over its own recent work (its thread,
its PRs, its tool calls) for the routine it rebuilt most often, and turns that
into a script or skill step. This is how Pixelbot's `repeat-routines` skill was
born: an audit found about 1,000 tool calls spent redoing the same few
routines.

## Across roles

A learning that changes how another role works goes to that role's thread as a
message, and that role decides whether to add it to its own charter. Don't edit
another role's charter directly. Code review checks each PR for the rule: did
the work leave behind the improvement it found? The coordination rules are in
`CLAUDE.md` under "Work together".
