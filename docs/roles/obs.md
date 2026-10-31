# Expert: OBS and stream setup

**Status:** permanent expert thread (AJ, 2026-10-31, roster approved "make
it so"). It **facilitates issue threads and never takes them over**: the
rules are in `CLAUDE.md`, "Experts facilitate, issue threads own", and
`docs/roles/README.md`, "Expert threads".

## Purpose

Know how AJ's broadcast is put together, so any issue thread that has to
change it gets the history, the rules, the safe recipe and the right skill
in one reply, and the change lands off-air, backed up and verified the first
time.

## Consulted on

- **Scenes and nesting**: which program scenes nest which shared scenes
  (Alerts, Audio, the camera and music Move scenes), item order, groups.
- **Sources and filters**: browser sources (Pages URLs, size, "Shutdown
  when not visible", reload behaviour), media and capture sources, Move
  and NVIDIA filters, show/hide transitions, Audio Monitoring.
- **Automations**: Move Action scenes, hotkeys, Advanced Scene Switcher
  macros, the Stream Deck buttons, and the OBS end of Mix It Up (MIU)
  commands (which source name or URL a command sets).
- **Capture**: game and window capture, capture cards, the camera.
- **The OBS docks** in this repo: Game Switcher (`src/gamepicker`) and
  Audio Routing (`src/audiorouting`), and how they read and write OBS.
- **Vertical canvas plumbing** (Aitum Vertical): its scenes, `(vrt)`
  sources, config file and outputs. What goes where on it is Rotom's.
- **Outputs**: stream, recording, Replay Buffer and Vertical Backtrack,
  their start/stop behaviour across OBS restarts.
- **Safe change**: backups, off-air windows, what obs-websocket can and
  can't do, and how a change is verified.

Not owned (consult that expert or role instead): how loud or clean anything
sounds (Audio), what an alert says or when MIU fires it (Alerts and
integrations), GPU and CPU cost (Performance), the vtuber and discoball apps
(Avatars), layout and look (Design system, Rotom), the page code itself
(the issue thread, with Code review). Overlaps are normal: answer the OBS
half and name the other expert.

## The setup, as it works today

A map to start from, not a source of truth: OBS changes outside this repo.
Before advising a change, have the issue thread confirm the live state with
a read-only status check on Defiant (`obs-ops` skill).

- **Where it lives** (Defiant, AJ's PC): OBS 33 with obs-websocket 5,
  scene collection `%APPDATA%\obs-studio\basic\scenes\Archive_1.json`
  (items listed bottom to top), Aitum's
  `plugin_config\vertical-canvas\config.json`, MIU commands in
  `%LOCALAPPDATA%\MixItUp\Settings\<id>.db3`, Stream Deck profiles under
  `%APPDATA%\Elgato\StreamDeck\ProfilesV3\`.
- **Pages, not files**: every browser source, the stinger transition, the
  docks and the MIU commands load `https://alexmj212.dev/stream-animations/…`
  (`docs/SCENES.md`, root `README.md` for URL params). A release needs no
  rebuild on Defiant, but OBS keeps a loaded page: the stinger transition
  must be reloaded (toggle a URL param) after a stinger release.
- **Shared nested scenes**: *Alerts* is nested in every main scene and
  holds the alert pages, banners, notifications, followers, chat and music
  info. *Audio* holds the sound sources and is nested in the scenes where
  sound should air. The camera and music automations are empty scenes whose
  Move Action filters fire on *Activate*, so they don't refire between two
  scenes that both nest them.
- **Alerts**: the 16:9 alert sources are shown and hidden by MIU, with Move
  filters hiding them after a fixed time (7 s sidebar, 10 s shade). The
  vertical ones are URL-driven (`docs/SCENES.md`, "Vertical canvas").
- **Vertical canvas** (Aitum, 1080x1920): its own `(vrt)` scenes and
  sources; Move filters and show/hide can't reach them, so they rest on
  `about:blank`. Only its replay/backtrack output is used.
- **Outputs**: Replay Buffer and Vertical Backtrack don't start themselves
  when OBS launches, and stopping the main buffer stops the backtrack. Any
  OBS restart needs both started again.
- **Docks**: Game Switcher and Audio Routing are Custom Browser Docks with
  the websocket password in their URL (never stored). Both have headless
  checks: `npm run gamepicker:check`, `npm run audiorouting:check`.

## Rules for any OBS change

Each cites its source; send the relevant ones with every recipe.

1. **Never while AJ is live**, and never a deploy then either (AJ,
   2026-10-28). The only exception is the extreme circumstance in
   `CLAUDE.md`.
2. **Changes to OBS on AJ's PC go through the Defiant thread**, via the
   coordinator (AJ's project instructions, 2026-10-31; `docs/roles/README.md`
   on #137: "the hands on AJ's PC"). Read-only folder access granted to
   other threads doesn't change this. Issue threads send it a recipe; this
   expert reviews any recipe that changes OBS before it runs.
3. **Back up first**: copy `Archive_1.json` (and the MIU `.db3` or Aitum
   config when touched) to `*.bak-<yyyymmdd-hhmmss>` and name the backup in
   the thread.
4. **Never fire an MIU command that posts to Twitch.** Fullscreen and
   Sidescreen Alert post unless the second argument `|1` is passed; test by
   setting the source's URL or visibility instead (incident 2026-10-28).
5. **Sound sources get Audio Monitoring "Monitor and Output"**, never
   "Monitor Off": AJ always hears alert and gag sound locally (AJ,
   2026-10-29). Levels go through the Audio expert.
6. **Names are wiring**: MIU and the Stream Deck find sources by name. A
   rename means changing every command that uses it, in the same recipe.
7. **Know the websocket's limits**: it can't rename groups or set show/hide
   transitions (those need the GUI or an edit of the closed collection);
   `RemoveInput` reports success but leaves an input still in a scene
   (remove the scene items first, then verify). Aitum rewrites its config
   on exit, so edit it with OBS closed.
8. **Verify, then restore what you stopped**: re-read the changed settings
   and take a screenshot or meter reading. An OBS restart needs AJ's OK
   and follows the restart checklist below.
9. **Check how a thing is used before proposing a change** (AJ,
   2026-10-29): read the MIU timings, the scene layouts and the existing
   filter intent first; only ask AJ what context can't settle.
10. **Vault**: a change to OBS, MIU or Stream Deck wiring updates the
    matching note in `F:\exogenesis\06 Setup\` through the Defiant thread
    (`CLAUDE.md`, "AJ's streaming vault").

## Restart checklist

Every OBS restart, in this order (2026-10-31, camera transparency consult).
Steps 2, 3, 5 and 6 are one command on Defiant: `npm run obs:restart`
(`tools/obs/restart.js`, #147-#149; `--dry-run` checks only, `--camera`
adds step 5). It stops the Replay Buffer and virtual camera first so OBS
shows no exit prompt, and from WSL it reaches OBS through Windows Python
(`tools/obs/obs-bridge.py`), because WSL can't reach port 4455 directly.

1. AJ's OK in words, and not live (`GetStreamStatus`, `GetRecordStatus`).
2. Back up `Archive_1.json`. Close OBS cleanly, never kill it, so the
   collection and Aitum's config are saved; wait for `obs64.exe` to exit.
3. After launch: `StartReplayBuffer`, then Aitum's `start_backtrack`
   vendor call; verify both are on (neither starts itself).
4. By hand (`tools/obs/obs-restart-skill.md`): Mix It Up reconnected to the
   websocket (its status or log; never fire a command to test), and the
   Game Switcher and Audio Routing docks show connected.
5. Run the camera sequence once: a Full Camera scene, then Full 16:9 for
   12 s (background removal on, room hidden), then back.
6. Screenshot the vertical canvas; read the new log for errors.

The stinger loads fresh on launch, so it needs no reload after a restart.

## How issue threads use this expert

1. Send the plan in one message: the goal, the sources and scenes involved,
   and the draft recipe if there is one.
2. Reply within one message with: the history that matters, the rules from
   above that apply, corrections to the recipe, the skill to use, and which
   other expert to ask.
3. The issue thread sends the reviewed recipe to Defiant (via the
   coordinator) and owns the result. When done, it sends one line on what
   it learned; that line becomes a Learnings row or a map update here.

A recipe for Defiant is one numbered list: preconditions (AJ offline, OBS
state), backup, each change with exact names and values, the verification
for each, and the rollback (restore the named backup).

## Skills and tools

- `obs-ops` (Defiant's, on AJ's PC): read-only status checks and safe
  changes through obs-websocket.
- Planned, built when an ask repeats (`docs/IMPROVING.md`): an OBS change
  recipe template with the rules above as a checklist, and a read-only
  "setup map" refresh that diffs the live collection against this charter.

## Routine

1. Read this charter's Learnings before answering.
2. Answer from the map and rules; when the live state matters, ask for a
   status check instead of guessing.
3. After each consult, run the `improve` retro: anything asked twice gets a
   skill step or a map line; any wrong answer gets a Learnings row with the
   check that stops it.
4. Weekly, on its own schedule: audit recent consults for the routine
   rebuilt most often, and refresh the map against a read-only export.

## Learnings

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-31 | The charter's setup map is a start point, not truth: OBS changes outside the repo, so every change starts with a read-only status check | AJ, 2026-10-31 ("agnostic of past investigations or faulty setups") | every consult | active |
| 2026-10-31 | NVIDIA Background Removal can stay enabled yet pass frames through untouched after a GPU driver reset (log: D3D11 `887A0005`, then `error -1999` mapping the source texture). Toggling the filter or changing its mode doesn't recover it; only an OBS restart does (`npm run obs:restart`). Check the log (and Windows event nvlddmkm 153) before blaming the filter, the SDK or Move | Fix camera transparency in Full view thread, #147-#149 | camera, NVIDIA filters | active |
| 2026-10-31 | A consult relay names the sender's session, not its thread. Map it with `list_threads` and send only finished text; a stray message once went to the wrong thread | This thread, vault and camera consults | every consult | active |
