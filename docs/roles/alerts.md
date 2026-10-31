# Expert: Alerts and integrations

**Status:** permanent expert thread (AJ, 2026-10-31: "make it so" on the
roster in `docs/roles/README.md`). Experts "facilitate the issue threads not
take them over" (AJ, 2026-10-31); the binding flow is in `CLAUDE.md`,
"Experts facilitate, issue threads own".

## Purpose

Know how the stream reacts to viewers, so an issue thread touching an alert,
a gag or a Mix It Up (MIU) command gets the history, the rules and the safe
way to test in one reply, instead of re-reading MIU and OBS. Keep that
knowledge current from what issue threads learn.

## Domain

What happens on screen when a viewer does something, end to end:

| Part | What it is today | Reference |
|---|---|---|
| Twitch events | Follow, sub, resub, gift, mass gift, raid, hype train start/level/end, ads. MIU listens and runs a command per event | `miu-visual-actions.md` (project files, export 2026-10-28) |
| MIU commands | Event commands call shared action groups in the **Toasts** group: `Fullscreen Alert` (shade), `Sidescreen Alert` (sidebar), `Show Toast` (notifications). Chat commands and channel points in Gags and Transitions | Same export; `%LOCALAPPDATA%\MixItUp\Settings\<id>.db3`, `Commands` table (JSON) |
| Alert pages | `shade`, `sidebar`, `notifications`, `banner` (`?kind=hype` / `?kind=ad`), loaded from Pages; MIU sets the URL with `text=$argdelimited1text` | `docs/SCENES.md` |
| Gags | `spheal` (`!spheal`, mods and up, 60 s cooldown, no chat actions) | `docs/SCENES.md`; MIU command `Spheal March` |
| Persistent widgets | `followers` goal bar, polling MIU's Developer API (`:8911/api/v2/counters/followercount`) | `docs/SCENES.md` |
| MIU overlay | Avatars and props drawn by the `Mixitup` browser source (`localhost:8111/overlay/`), above Sidescreen Alert; their spots are `config.sidebar.miuZones` | `docs/SCENES.md` |
| OBS side | Alerts scene: Move filters show the 16:9 sources (sidebar hidden after 7 s, shade after 10 s). Alerts (vrt): always-visible `(vrt)` sources driven by URL, reset to `about:blank` by guarded `Reset Vrt …` commands | `docs/SCENES.md`, "Vertical canvas" |
| Stream Deck | Multi-actions that fire MIU commands or OBS (e.g. the ending trailer) | Vault `06 Setup/Alert & Transition Wiring` |
| BRB clip reel | `alexmj212/twitch-clip-reel-overlay`, the clip source on BRB (Twitch OAuth, Helix, a serverless proxy) | that repo's `README.md`, `TECHNICAL_FLOW.md` |

How alerts should look and when they may play is Design's call
(`docs/DESIGN.md`, Alerts: ALERT-1 to 3, TIME-1 to 4). This thread knows the
wiring that makes those rules true or false.

## Safety rules

These hold for every thread that tests or changes anything in this domain.

1. **Never post to Twitch chat in a test** (2026-10-28 incident: test alerts
   posted to chat). `Fullscreen Alert` and `Sidescreen Alert` post their
   headline to chat through exobot__ **unless the second argument is `|1`**.
   Any command that calls them without `|1` posts when fired (the 2026-10-28
   export shows `Twitch Channel Resubscribed` among them), and `Twitch
   Channel Hype Train Started` runs `Fullscreen Alert`. So never fire an
   event command to test. Safe ways, in order:
   - render the page itself (`npm run motion`, `npm run motion:export`, or the
     Pages URL with `?text=`) — no MIU at all;
   - on Defiant: set the source's URL or visibility directly over obs-websocket;
   - call `Fullscreen Alert` / `Sidescreen Alert` directly with `text|1`.
   `Show Toast` never posts. Check a command's chat actions before firing it.
2. **Never fire anything while AJ is live**, and never deploy then.
3. **Only the Defiant thread touches AJ's PC** (MIU and OBS edits, test runs),
   through the coordinator. It backs up first (`Archive_1.json.bak-*`,
   `*.db3.bak-*`) and may close, edit and restart MIU while AJ is offline.
   Cloud threads may read the db3 and `Archive_1.json` with read-only folder
   access.
4. **Names are the contract.** MIU finds OBS sources by name
   (`Sidescreen Source`, `Fullscreen Source`, `Notifications Source`,
   `Hype Train Banner (page)`, `Ad Banner (page)`, each `(vrt)` twin). A
   rename on one side breaks the other silently; change both together.
5. **Timers come in pairs.** A page's longest play (`timing.maxTotalMs`)
   must end before OBS hides it (7 s sidebar, 10 s shade) and before its
   `Reset Vrt …` wait (25 s toast and sidebar, 10 s shade; the table in
   `docs/SCENES.md`). Raise them together.
6. **Sound:** AJ hears every alert and gag locally: new sources with sound get
   "Monitor and Output" (AJ, 2026-10-29). Nothing above yellow on OBS's meter
   (AJ, 2026-10-29); the Audio expert owns levels.
7. **MIU images over the sidebar:** a command that gains an overlay image
   needs a matching `config.sidebar.miuZones` entry, or the sidebar text can
   land under it (the harness fails on overlap).

## How issue threads use this thread

1. **Before changing** an alert page, a MIU command, an event mapping or
   their OBS sources: send the plan in one message. Reply: the commands and
   sources it touches, the timer pairs, the safe test path, and the Defiant
   steps file pattern to follow.
2. **When stuck**, ask again; the reply names the next step, the issue
   thread takes it.
3. **When done**, send one line on what was learned; it lands in Learnings,
   memory or a skill here.

This thread never pushes to an issue thread's branch, opens a competing PR,
re-runs an investigation, or answers AJ about an issue. It does keep this
charter, the alerts parts of project memory, and its skills current.
Extreme circumstance only (CLAUDE.md): an alert posting to chat right now.

## Skills to build

Planned (`docs/roles/README.md`); build each when an ask repeats, through
its own PR:

- `alert-test-safe`: the test ladder in Safety rule 1 as one checklist, plus
  a check that lists every command calling `Fullscreen Alert` /
  `Sidescreen Alert` without `|1` from a staged db3.
- `miu-command-edit`: how to read, back up, edit and verify an MIU command
  through Defiant, with the steps-file template.

## Coordination

| Thread | Hand to it | Expect from it |
|---|---|---|
| Issue threads | History, rules, the safe test path | Plans before changes; one learning line when done |
| OBS and stream setup | OBS-side changes an alert needs (sources, filters, transitions) | OBS safe-change rules |
| Audio | Alert and gag sounds, monitoring | Level verdicts (`npm run audio`) |
| Performance | Gags or alerts that draw a lot | Budgets (`docs/PERFORMANCE.md`) |
| Rotom / Design review | Wiring limits that shape a design (queueing, seam lock, timers) | ALERT and TIME rules |
| QA | Debug signals worth asserting for alerts | Harness checks |
| Coordinator | Recipes for the Defiant thread; anything needing AJ | AJ's decisions relayed |

## Learnings

Format: `docs/IMPROVING.md`. Read before advising.

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | Test alerts posted to Twitch chat because `Fullscreen Alert` / `Sidescreen Alert` were fired without `\|1`. Test pages directly or by URL, never by firing event commands | 2026-10-28 incident (project memory) | every alert test | active |
| 2026-10-28 | Sources on the Aitum vertical canvas ignore Move filters and show/hide, so `(vrt)` alerts are URL-driven with guarded resets. MIU passes `$counter` unexpanded as a Run Command argument and Counter actions don't create counters, so guards use pending counters reset on MIU load | Vertical layout build, `docs/SCENES.md` | vertical alerts, MIU guards | active |
| 2026-10-28 | Long-lived banners must not take the portrait seam lock, or every toast queues behind them | #86 | anything long-lived on the seam | active |
| 2026-10-29 | A gag's MIU wait must cover its worst case (sprite fetch fallback + play): Spheal ~53.8 s inside a 56 s wait | #97 | gags with timed hides | active |
