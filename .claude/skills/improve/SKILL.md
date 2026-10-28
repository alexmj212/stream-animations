---
name: improve
description: End-of-task retro that turns what an agent redid, guessed or got wrong into a durable change (script, skill step, test, doc fix or Learnings row). Use before finishing any task, after a correction from AJ or a reviewer, and in each role's weekly audit.
---

# improve

AJ's standing rule (2026-10-28): every agent always seeks to improve itself.
This skill is the habit. It should take a minute, not an hour.

## 1. Look back

Answer briefly, from this task:

- What did I do by hand more than once?
- What did I have to guess, search for, or ask that a doc should have told me?
- What went wrong, or what did AJ or a reviewer correct?
- What worked well that the next agent should repeat?

If the honest answer to all four is "nothing", say "nothing new" and stop.

## 2. Pick the durable form

Take the one or two answers that would save the most next time:

| Lesson | Durable form |
|---|---|
| A routine I repeated | a script under `tools/` plus a row in `repeat-routines` |
| A mistake a machine can catch | a test, a harness check, or a config validation |
| A step I missed in a routine | a line in the skill that owns the routine |
| A doc that misled me | fix the doc (`docs-check` knows where things live) |
| A judgment call or AJ preference | a Learnings row in the owning role's charter (`docs/roles/`; message that role's thread), or `docs/MOTION.md` for style |
| A whole missing routine | a new skill, in its own PR |

Prefer the higher rows: a check enforces itself, a note only helps when read.

## 3. Write it

- Cite date and source on every rule.
- Small changes go in the current PR. A new skill, tool or process change
  gets its own PR and ships through code review; no approval from AJ needed
  (AJ, 2026-10-28).
- A lesson for another role goes to that role's thread as a message; don't edit
  its charter.
- If an existing rule was wrong or no longer needed, retire it and say why.

## 4. Say it

One line in your final reply or PR notes: what you made durable, or "nothing new".
