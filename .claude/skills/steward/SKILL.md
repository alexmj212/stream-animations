---
name: steward
description: How to open, review and drive a stream-animations pull request to mergeable. Use when opening a PR, reviewing one, or handling its CI and review events.
---

# Stream Animations PR routine

Merging to `main` runs the tests and deploys the epcot scene to GitHub Pages
(`.github/workflows/pages.yml`). The other scenes reach OBS when AJ rebuilds
them locally. Every PR runs `.github/workflows/motion.yml`: unit tests plus the motion
harness, with the report uploaded as an artifact. PRs go straight to `main`
(no release branch: only epcot deploys, with no downtime; see
`docs/roles/release-management.md`).

Reviews come from the role threads (`docs/roles/README.md`): code review on
every PR, design review and QA on visual changes, release management on
anything that changes how work ships. Ask them by messaging their threads.

## Opening a PR

- **One PR per change**, branched from the latest `main`, targeting `main`.
- **Title**: conventional prefix with the scene as scope, e.g.
  `feat(epcot): ...`, `fix(stinger): ...`, `perf(background): ...`,
  `docs: ...`, `chore(tools): ...` (matches the git history).
- **Description**: Before and After are what the stream shows, not code.
  Attach evidence for visual changes (harness report, frames or a strip) and
  numbers for performance changes (`npm run bench` before and after).
- **Decisions** go in `docs/DECISIONS.md` in the same PR.
- **Config** values you add or change keep their "why" comment.
- **Improvement**: the PR includes whatever the work taught you (see the
  `improve` skill), or says "nothing new" in Notes.

## Before every push

```bash
npm test -- --run      # what the Pages workflow runs
npm run build          # every scene still builds to a single file
npm run motion         # the motion harness, as CI runs it (docs/VALIDATION.md)
```

Put all of a round's fixes in one push.

**Syncing a long-lived branch with main** (Rotom on #92, 2026-10-28): use a
plain `git merge origin/main`, never `git merge -s ours origin/main`. Once
main has moved past your last merge, `-s ours` silently drops everything
new on main from your branch (#84's files vanished from Rotom's branch
after #87). After the merge, `git diff origin/main --stat` must show only
your new work. To restart a branch on main after a squash-merge when
force-push is blocked, do the reverse: `git checkout -B <branch> origin/main`,
then `git merge -s ours origin/<branch>` keeps main's tree and only joins
the old history.

## Reviewing a PR

Work through these in order and post **one** verdict comment.

1. **Signals**: does the description match the diff? A config change, new URL
   param or new dependency the description doesn't mention is a finding.
2. **Test it**: check out the branch and run the three commands above.
3. **Look at it**: open the harness report or frames for each changed scene.
   Check against `docs/MOTION.md`. A change to the background or epcot scene
   needs before and after `npm run bench` numbers against `docs/PERFORMANCE.md`.
4. **Code review**: run the `code-review` skill on the diff.
5. **Docs and improvement**: run `docs-check`. Did the PR leave behind what it
   learned? If the work hit a snag and left nothing, that's a finding.

Verdict format, ending with the attribution footer:

```
**Review: Ready** | **Needs changes** | **Needs AJ's call**

Checked: tests, build, motion harness, bench (if perf-sensitive), code review, docs.

- <finding, file:line, what to do>  (blocking first)
```

`Needs AJ's call` is only for design decisions: how a scene looks or moves,
when taste has to settle it. Attach mocks to compare and a recommendation.
Everything else is Ready or Needs changes (AJ, 2026-10-28: "for code related
things i don't need to see it, just get it out the door").

## Merging

Once code review says Ready and CI is green (plus design review and QA
sign-off on visual changes), release management merges, in
the order it sets when PRs overlap. No approval from AJ is needed for code.

## Never

Skip or disable a test to get green, raise a performance budget without a
reason in the PR, or merge a PR code review hasn't marked Ready.
