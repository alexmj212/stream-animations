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
     `docs/MOTION.md` for style),
   - an update to AJ's streaming vault (`F:\exogenesis` on Defiant), when
     the task changed hosting, OBS or Mix It Up wiring, the release flow,
     the team rules or a design decision AJ made (2026-10-28, code review
     on #26; which notes to update is in `CLAUDE.md`).
3. **Cite it.** Every rule names its date and source ("AJ, 2026-10-28", a PR,
   a benchmark run). A rule without a reason can't be judged later.
4. **Ship it small.** Small improvements go in the same PR as the work. Bigger
   ones (a new skill, a new tool, a process change) go in their own PR and
   ship through code review like any other change; AJ is only asked about
   design (`CLAUDE.md`, Shipping without approval).
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

## Permanent threads improve unprompted

AJ (2026-10-31): "the permanent threads should be self-improving, they should
adapt themselves over time and seek to reduce mistakes they make, as well as
optimize all of their requests and work unprompted." This applies to every
role and expert thread (`docs/roles/README.md`). Nobody has to ask.

- **After every request**, run the `improve` retro on it: what took more
  turns, tool calls or messages than it should have, and what went wrong.
  Make the one durable change before going idle.
- **Mistakes log.** Every mistake (a wrong claim, a check that missed, a
  correction from AJ or another thread) becomes a Learnings row with the
  check, skill step or script that stops it recurring. A repeat of a logged
  mistake means the fix didn't work: replace it.
- **Optimize requests.** When an issue thread asks the same kind of question
  twice, answer the third time with a skill or script instead of prose, and
  add it to the charter. Shorten the messages and recipes the thread sends
  (one message, exact steps, nothing to re-investigate).
- **Adapt the charter.** Edit your own scope, routine and Learnings as the
  work changes; retire rows and process that no longer earn their keep.
- **Audit without being asked**: the weekly audit above runs on the
  thread's own schedule (a `send_later` reminder), not when AJ asks.

## Across roles

A learning that changes how another role works goes to that role's thread as a
message, and that role decides whether to add it to its own charter. Don't edit
another role's charter directly. Code review checks each PR for the rule: did
the work leave behind the improvement it found? The coordination rules are in
`CLAUDE.md` under "Work together".
