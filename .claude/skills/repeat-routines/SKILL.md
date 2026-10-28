---
name: repeat-routines
description: One-command scripts for routines agents keep redoing in stream-animations. Use before rendering frames, benchmarking, exporting or cutting loops, and add to it whenever a routine repeats.
---

# Repeat routines

A thread pays for its whole context on every turn, so a routine done in ten
tool calls costs ten re-reads. Run the script, read its answer, move on.

| Routine | Command |
|---|---|
| Run the tests once | `npm test -- --run` |
| Build every scene | `npm run build` (one scene: `npm run build:<scene>`) |
| Verify motion for the changed scenes | `npm run motion` (report: `tools/motion-results/index.html`; see `docs/VALIDATION.md`) |
| Export a scene as transparent video for OBS | `npm run motion:export -- <scene>` |
| Benchmark frame time and Canvas cost | `npm run bench` (one scene: `node tools/benchmark/run.js <scene>`) |
| Cut a seamless loop from an OBS recording | `tools/loopcut.sh <recording.mkv>` (`--help` for options) |
| Render scene text in Jost in the cloud container (else Arial; 2026-10-28) | `tools/fonts/install-jost.sh` |
| Check a scene live | `npm run dev`, then `/src/<scene>/index.html?perf=true` |

In the cloud container, headless Chrome is at `/opt/pw-browsers/chromium`;
pass it to tools that need a browser binary.

## Habits

- Edit docs and charters with the Edit tool, not heredoc rewrites.
- Batch deferred-tool loads into one `ToolSearch select:a,b,c`.
- Start long waits (benchmarks, harness runs) in the background and end the
  turn instead of polling.

If a routine repeats and isn't here, add it: write the script under `tools/`,
add a row above, and note it in your role's Learnings.
