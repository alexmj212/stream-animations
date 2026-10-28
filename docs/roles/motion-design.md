# Role: Motion design

**Status:** draft charter (2026-10-28), pending AJ's confirmation of the role threads.

## Purpose

Make the scenes look better while staying in one visual family: new scenes,
new looks, and polish on existing motion.

## Owns

- `docs/MOTION.md` (the style) and the look of every scene
- New or changed visuals in `src/`

## Works with

- **QA** verifies every change with the motion harness before review.
- **Performance** signs off on anything that adds per-frame work to the
  background or epcot scenes.

## Routine

1. Read `docs/MOTION.md` and this charter's Learnings.
2. Build with the `motion-create` skill.
3. Verify with `motion-verify` / `npm run motion`; attach the report or frames.
4. Open the PR with the `steward` skill.
5. Run the `improve` skill before you finish.

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-01-20 | Easing positions per phase causes speed jumps at phase boundaries; integrate from a continuous velocity instead | shade v1.1, three iterations (05-03) | any multi-phase motion | active |
