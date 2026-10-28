# OBS live setup

How the scenes in this repo are wired into OBS on the streaming PC (Defiant),
and how to inspect that setup. Snapshot taken 2026-10-27 from the active scene
collection. Re-run the inventory (below) before relying on it.

## Where things live

| What | Value |
|---|---|
| OBS | `C:\Program Files\obs-studio\bin\64bit\obs64.exe` |
| Profile | `Exogenesis` |
| Active scene collection | `Archive 1` → `%APPDATA%\obs-studio\basic\scenes\Archive_1.json` |
| Other collections | `Scenes_3.json` (older, last saved 2026-09-12), `lowMem.json` (2024) |
| Repo clone OBS loads from | WSL `Ubuntu-24.04`, `/home/alex/Projects/stream-animations` |
| URL prefix | `file://wsl.localhost/Ubuntu-24.04/home/alex/Projects/stream-animations/dist/` |

OBS reads the built `dist/` folder of that clone directly. A merged PR changes
nothing on stream until that clone is pulled and rebuilt (`npm run build`).

## Scenes from this repo

| Repo scene | OBS name | Kind | Where it's used | Settings |
|---|---|---|---|---|
| stinger | Transition **Browser** | `browser_transition` (obs-browser-transition plugin) | Default transition, and the per-scene override on Starting, BRB, Ending | URL `stinger/index.html?duration=2000&color=b00bee`, transition duration 3000 ms, transition point type *time* at 1000 ms, 60 fps custom, page control level 2 |
| sidebar | **Sidescreen Source** | Browser source, 1920×1080 | Inside scene *Sidescreen Alert* (nested in *Alerts*), hidden until an alert shows it | `sidebar/index.html?duration=3000&color=b00bee&text=…`, shutdown when hidden, refresh when active |
| shade | **Fullscreen Source** | Browser source, 1920×1080 | Inside scene *Fullscreen Alert* (nested in *Alerts*), hidden until an alert shows it | `shade/index.html?duration=3000&color=b00bee&text=…`, shutdown when hidden |
| background | **BG Source** | Browser source, 960×540 @ 30 fps | Scene *BG*, currently **hidden** | `background/index.html?color=b00bee` (no `density`, so it gets the default) |
| epcot | **Media** | Media source (`ffmpeg_source`), not a browser source | Scene *BG*, visible; *BG* is nested in Starting, BRB, Ending, Full 16:9 | `F:/Stream Recordings/Streams/epcot-loop2-48s-720p30.mp4`, looping, hw decode. A pre-recorded loop cut with `tools/loopcut.sh` |
| epcot (live) | **Browser 4** | Browser source, 1920×1080 | Scene *BG*, **hidden** | `http://localhost:3000/?pattern=orbit&scheme=illuminations&overlay=night&…` (a dev server, not running at snapshot time) |

The `text` in sidebar and shade URLs is rewritten per alert by the alert tooling
(Mix It Up runs the overlays on `localhost:8111`), so the value you see in the
file is just the last one used.

Other transitions in the collection: *Stinger* (native, globe video, used only
by Breaking News), *Windows 98* (native stinger), *Move*, *Move (2)*, Fade, Cut.

## Stinger timing in OBS

Since PR #2 the stinger runs exactly `duration` ms and the cut point is 50% of
it. The OBS transition must agree with the page:

- OBS transition **duration** = the URL's `duration`.
- **Transition point** (time) = half of it.

Example: `?duration=2000` → duration 2000 ms, transition point 1000 ms.
## Which transition runs: Transition Table

The **Transition Table** plugin picks the transition and duration for each
switch between scenes. It's stored in the collection under
`modules["transition-table"]`, and it takes precedence over the default
transition. The stinger-related entries:

| From | To | Transition | Duration |
|---|---|---|---|
| Any | Starting, BRB, Ending | Browser | 3000 ms |
| Just Chatting | Starting, BRB, Ending | Browser | 3000 ms |

Scenes also carry matching per-scene overrides (`private_settings.transition`).
To change the stinger's duration, edit both places. The table also has an entry
for a scene named "Scene Transition" that no longer exists. StreamUP's *Scene as
Transition* plugin is installed but unused.

## Inspecting the setup

Read-only. Never switch scenes, change settings or save the collection while
AJ may be live.

**From the scene file (no password needed).** OBS saves the active collection
whenever it changes, so the file is current to within a few seconds:

```bash
python3 tools/obs/inventory.py            # from WSL; finds the Windows APPDATA path
python3 tools/obs/inventory.py --json     # machine-readable
```

**Live, over obs-websocket.** v5 protocol, `ws://localhost:4455` on Defiant,
authentication **on**. The password is in
`%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json`
(`server_password`); ask AJ before using it, and never commit it. Useful
read-only requests: `GetSceneList`, `GetSceneItemList`, `GetInputSettings`,
`GetCurrentSceneTransition`, `GetStreamStatus` (check this first),
`GetSourceScreenshot`.
