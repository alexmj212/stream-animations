---
name: obs-restart
description: Safely restart OBS on Defiant (off-air, after AJ's OK) and bring back the replay buffer, vertical backtrack, Mix It Up and docks. Use when AJ asks to restart OBS, or when a GPU reset leaves NVIDIA effects broken.
---

# OBS safe restart

Source of truth: `tools/obs/obs-restart-skill.md` in alexmj212/stream-animations.
Deployed copy: `F:\exogenesis\.claude\skills\obs-restart\SKILL.md`. Edit the repo
copy and redeploy; don't edit the vault copy by hand.

Added 2026-10-31 (AJ: "restart obs, create a script or skill to do this in the
future") after a GPU driver reset left the camera's NVIDIA Background Removal
broken.

## When to use

- AJ asks for an OBS restart in words in the Defiant thread. Every restart
  needs that OK; a pick on another thread's card is not enough.
- **GPU reset**: the OBS log shows `Device Remove/Reset! Rebuilding all assets`
  (D3D11 `887A0005` / `887A0006`, Windows System event `nvlddmkm` 153). OBS
  rebuilds its own textures, but NVIDIA video effects (Background Removal on
  `Cam Base`) keep failing with `error -1999` and pass the camera through
  untouched. Toggling the filter or switching its mode does **not** fix it
  (tried 2026-10-31). Only a restart does.

## Never

- While AJ is live, either canvas. The script checks this and refuses.
- Kill OBS (`taskkill /F`, End task). A kill skips saving the scene
  collection and Aitum's `config.json`. If OBS won't close, look for a
  dialog on screen and report back.
- Fire Mix It Up commands to test the connection. Some of them post to
  Twitch chat.

## Steps

1. In the stream-animations checkout on Defiant (the WSL one; Windows has no
   Node), run `git pull`. It needs Node 22 or newer (`node --version`). From
   WSL the script reaches Windows through interop (`tasklist.exe`,
   `powershell.exe`, `/mnt/c/...`) and tries the websocket at 127.0.0.1, then
   at the Windows host's WSL address. If neither connects, pass the address
   OBS's Tools > WebSocket Server Settings > Show Connect Info gives:
   `--url=ws://<ip>:4455`. The output's `url` says which one worked.
   Set `OBS_WS_PASSWORD` in the shell; never write it to a file.
2. Run `npm run obs:restart -- --dry-run`. It must say `"ok": true`. If it
   aborts as live, stop and report. It also aborts when it can't read the
   vertical canvas status (`verticalRaw` in the output shows what Aitum
   returned). Report that rather than working around it.
3. Run `npm run obs:restart -- --camera`. The script will:
   - back up `Archive_1.json` to `Archive_1.json.bak-<stamp>`,
   - stop the Replay Buffer (which also stops the backtrack) and the Virtual
     Camera, because with either running OBS asks "exit anyway?" on close,
   - close OBS cleanly and wait for `obs64.exe` to exit,
   - relaunch OBS and wait for the websocket,
   - start the Replay Buffer and Vertical Backtrack (they don't start on launch),
   - switch to Just Chatting, then Full 16:9 for 12 s, and screenshot
     `Cam Base` to the Desktop `claude` folder,
   - switch back to the scene that was on program before,
   - list error lines from the new OBS log written after `Startup complete`.

   Leave out `--camera` when the camera isn't the reason for the restart.
4. Manual checks, which the script can't do:
   - Look at the camera screenshot. In Full 16:9 the room behind AJ must
     be removed. Removal takes 4 to 9 s to kick in.
   - Mix It Up shows OBS connected (its connection status or log). If it
     doesn't, use MIU's reconnect button. Don't run a command. MIU tries to
     start the Replay Buffer when it reconnects, so a log line
     "OBS is not ready to perform the request" from StartReplayBuffer is
     harmless (seen 2026-10-31). The script starts the buffer anyway.
   - The vertical camera in Chatting/Game (vrt) is Camlink with no filters,
     so it always shows the room. That's expected, not a failure.
   - The Game Switcher and Audio Routing docks show connected.
   - Screenshot the vertical canvas preview.
5. Report back to the requesting thread: the JSON summary, the backup name,
   the screenshot paths and the manual checks.
6. Add a dated entry to the vault `06 Setup/Troubleshooting Log`
   (append-only) with the reason for the restart.
