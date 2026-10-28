---
name: obs-inspect
description: Inspect how this repo's scenes are wired into AJ's live OBS (scene collection, browser source URLs, the stinger browser transition and its transition point, the epcot media loop). Use before a release or deploy, when checking that OBS matches the repo, or when asked what OBS is actually running. Read-only.
---

# Inspect the live OBS setup

Full reference: `docs/OBS.md`.

1. Run `python3 tools/obs/inventory.py` (WSL or Windows). It reads the active
   scene collection file, so it needs no password and changes nothing.
2. Compare it with the repo:
   - Stinger: the OBS transition duration should equal the URL's `duration`,
     and the transition point should be half of it (cut at 50%, since PR #2).
   - OBS loads `dist/` from the WSL clone at
     `/home/alex/Projects/stream-animations`. Check that clone's commit and
     `dist/*/index.html` timestamps against `origin/main` or the release tag.
   - Epcot on stream is a pre-recorded media file, so scene changes reach it
     only through a new recording (`tools/loopcut.sh`).
3. For live state (current scene, stream status, screenshots), use
   obs-websocket v5 on `ws://localhost:4455`. Authentication is on. Ask AJ
   before using the password, and never commit it.

Don't switch scenes, change settings, refresh sources or save the collection
without AJ's OK. AJ may be live. Check `GetStreamStatus` first.
