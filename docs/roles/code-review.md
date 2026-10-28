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
5. Post **one** verdict per round as a GitHub review (inline comments for
   line findings, the verdict in the body), ending with the attribution
   footer. Format is in `steward`. Blocking findings first; mark the rest
   "non-blocking".
6. Send each finding the author must act on to the author's thread, and a
   one-line verdict to Release management.
7. On a new push, re-review only what changed since the last verdict, and say
   which findings it resolved.
8. Run the `improve` skill before you finish.

**Needs AJ's call** is for taste, anything viewers will notice that the PR
didn't announce, a changed default, a raised budget, or a change to how OBS
is set up. Name the question in one line so AJ can answer without reading the
diff.

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
