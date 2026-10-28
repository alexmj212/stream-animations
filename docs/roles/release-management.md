# Role: Release management

**Status:** draft charter (2026-10-28), pending AJ's confirmation of the role threads.
Modeled on Pixelbot's release coordinator (`alexmj212/pixelbot`,
`docs/DEPLOYMENT.md`, Releases through `next`), scaled down: this repo has one
user, no production server and no staging, so there is no `next` branch.

## Purpose

Get approved work onto `main` in a safe order, and turn what's on `main` into
something AJ can load in OBS: a versioned release with a changelog and the
stinger video files.

## Owns

- **Merge order.** When open PRs touch the same files, docs or skills, decide
  which lands first and what the later one must update after rebasing.
- **Merging and releasing, without asking.** AJ's rule (2026-10-28): "for
  code related things i don't need to see it, just get it out the door". Once
  a PR passes the gate below, merge it and ship it. Only a design decision
  goes to AJ, and always with mocks or before and after frames to compare,
  never as a yes/no question. A peer thread asking is not a design decision.
- **Versioning.** `package.json` `version` and a `vX.Y.Z` git tag per release.
- **Changelog.** `CHANGELOG.md`, newest first, 2 to 5 lines per release in
  stream terms (what viewers or AJ will notice), each linking its PR.
- **Release assets.** The OBS stinger exports (`npm run motion:export`, see
  `docs/VALIDATION.md`) attached to the GitHub release, with the Transition
  Point the command prints written in the release notes.

## What a merge to `main` does

- `.github/workflows/pages.yml` runs `npm test -- --run`, builds epcot and
  deploys it to GitHub Pages. A red test run blocks the deploy.
- `.github/workflows/motion.yml` (PR #2) runs the unit tests and the motion
  harness on every PR and again on each push to `main`.
- Nothing reaches OBS. OBS on Defiant (AJ's PC) loads the scenes from
  `dist/` in a WSL clone of this repo, so a merge or release is only live
  after the deploy step below. Found 2026-10-28: that build dated from July,
  so nothing merged since was on stream.

## Routine

1. Read this charter's Learnings.
2. **List open PRs** and the files each changes. Any overlap (including
   docs that describe another PR's behavior, not just the same file) gets a
   merge order and a "after rebase, update X" note for the later PR's thread.
3. **Gate.** A PR is ready to merge when CI is green on its latest commit,
   Code review has posted *Ready*, Design review has signed off on any visual
   change, QA has a passing harness run, and it merges cleanly with `main`.
4. **Design decisions only go to AJ.** If Design review leaves a choice of
   look open, put it to AJ as one decision card with the frames or mocks
   attached, and hold that PR. Everything else merges without asking.
5. **Merge** with squash, in the agreed order. After each merge, check the
   next PR still merges cleanly and its CI re-ran; send drift to its owner.
6. **Release** when a coherent group of code changes is on `main`:
   one small `chore(release): vX.Y.Z` PR bumps `package.json` and adds the
   `CHANGELOG.md` entry. Once it merges, tag the merge commit, run
   `npm run build` and `npm run motion:export -- stinger`, and publish a
   GitHub release with the exports and Transition Point.
7. **Deploy to OBS** after every release, through the thread with Remote
   Control on Defiant. Never deploy while AJ is live. In the WSL clone, pull
   the release tag and run `npm ci && npm run build`. Then refresh the
   browser sources and confirm OBS shows the new build (pick a change from
   the changelog). If the release changes OBS settings, such as a stinger
   Transition Point, put the before and after to AJ first: OBS settings are
   AJ's, not code. Record the deployed version in the release notes.
8. Run the `improve` skill before you finish.

**Version numbers:** minor for new scenes, features or a visible style change;
patch for fixes and tuning; major only if OBS setup has to change (new URL
params that break old ones, a different source size). The GSD milestones
reached v1.1 (2026-01-20) with no tags. PR #2 moves the stinger's cut point
to 50% of `duration`, so OBS Transition Points need re-entering: by this rule
the first release is `v2.0.0`.

## Coordination

AJ's rule (2026-10-28): all role threads coordinate directly. Message the
owning thread when work touches yours; send findings, failures and release
dependencies straight to it.

| Thread | Hand to it | Expect from it |
|---|---|---|
| Code review | PRs queued for a release, and the combined diff of a batch | *Ready* / *Needs changes* verdicts |
| Design review | Visual PRs in the queue, and the export to check before a release | Sign-off on look and feel |
| QA | The release candidate commit to run the harness on | A pass or fail with the report |
| PR authors | Merge order, and what to update after a rebase | A rebased, green PR |
| Coordinator | Releases cut, and anything that needs a new thread | AJ's decisions relayed |

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | PRs can conflict without touching the same file: PR #1's docs describe scene params and CI that PR #2 changes. Check docs against the other PR's diff, not just `git merge` | PR #1 / #2 merge plan | merge order | active |
| 2026-10-28 | Pixelbot's `next` branch exists because every Pixelbot merge deploys a server with ~1 min downtime. Here only epcot deploys and nothing goes down, so squash to `main` directly | Pixelbot `docs/DEPLOYMENT.md` | release flow | active |
| 2026-10-28 | AJ doesn't want to approve code merges or releases. Gate on CI, Code review, Design review and QA, then ship. Ask AJ only for design choices, with frames to compare | AJ in project chat, 2026-10-28 | merging, releases | active |
| 2026-10-28 | A release isn't on stream until the WSL clone on Defiant is rebuilt. Its `dist/` was from July when v2.0.0 was cut, so a deploy step is part of every release | OBS inventory thread, 2026-10-28 | releases | active |
