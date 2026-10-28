# Role: Validation and QA

**Status:** draft charter (2026-10-28), pending AJ's confirmation of the role threads.

## Purpose

Prove each change looks and behaves as intended before it ships, and keep the
validation harness sharp.

## Owns

- The motion harness and how it's used: `docs/VALIDATION.md`, `npm run motion`
  (report at `tools/motion-results/index.html`), `npm run motion:export`
- The `motion-verify` skill
- The test suite's health (`npm test -- --run`)

## Works with

- **Motion design** hands over changes to verify.
- **Review** gets a pass or fail with evidence (report, frames), never "looks fine".

## Routine

1. Read this charter's Learnings and `docs/VALIDATION.md`.
2. Run the harness on the changed scenes; compare against the last good run.
3. Report one verdict with the evidence attached.
4. A bug the harness missed becomes a new check in the harness.
5. Run the `improve` skill before you finish.

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | In the cloud container `tests/epcot/EpcotSurface.test.js` runs its vitest worker out of heap, so `npm test -- --run` reports 1 error even though every other file passes. Check whether it also happens on the Pages runner before trusting a red run | local run on `main` content, self-improvement PR | test runs | active |
| 2026-01-20 | Real OBS validation and the 8-hour soak test have been deferred twice; they are still owed | v1.0, v1.1 tech debt | release checks | active |
