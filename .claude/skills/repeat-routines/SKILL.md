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
| Measure what an OBS change costs (GPU per engine, OBS CPU), off-air on Defiant | the `gpu-check` skill's recipe, then `npm run gpu:summary -- <csv>` |
| Find what in Mix It Up and OBS touches a source, URL or transition, or which MIU calls post to Twitch chat (read-only, from a staged db3 and `Archive_1.json`) | `npm run alerts:wiring -- find <term> --miu=<db3> --obs=<Archive_1.json>`; `npm run alerts:wiring -- chat --miu=<db3>` |
| Cut a seamless loop from an OBS recording | `tools/loopcut.sh <recording.mkv>` (`--help` for options) |
| Render scene text in Jost in the cloud container (else Arial; 2026-10-28) | `tools/fonts/install-jost.sh` |
| Prepare a PR for review (worktree, full sha, merge with main, diff stat, table rows), or check a squash merge | `tools/review/prep.sh <pr>` / `tools/review/prep.sh --squash <pr> <merged-sha>` |
| Rebuild the WeatherStar icon strips from a ws4kp checkout | `python3 tools/weather/build_ws4000_icons.py <ws4kp>/server/images/icons` |
| Mock frames of the weather page (each page on demo data, every ad with `--ads`) | `npm run weather:shots -- --out=<dir> [--pages=current,ad] [--ads]` |
| What a Twitch encode (x264 veryfast CBR 720p60) does to the weather page's text, noise on vs off (PSNR + stills) | `npm run weather:encode -- [--seconds=20] [--kbps=6000] [--out=<dir>]` |
| Cut a real photo out of its background for an ad picture (rembg; setup in the script's header) | `/tmp/rbg/bin/python tools/weather/cutout.py <photo> src/weather/photos/<name>.png` (the venv from the script header) |
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
