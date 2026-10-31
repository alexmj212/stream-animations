# Role charters

AJ runs permanent role threads (2026-10-28). Each one writes and owns its own
charter here: `<role>.md`, ending with a Learnings table in the format from
[IMPROVING.md](../IMPROVING.md).

| Role | Charter | Owns |
|---|---|---|
| Code review | `code-review.md` | Reviewing every PR for correctness and the "Always improve" rule |
| Design system (📺 Rotom) | `design-system.md` | The stream bible (`docs/DESIGN.md`), `config.design` tokens, direction and new designs, design audits |
| Design review | `design-review.md` | The design gate on visual PRs, judged against the bible, and `docs/MOTION.md` |
| Release management | `release-management.md` | How changes reach `main`, Pages and OBS; merge order |
| QA | `qa.md` | Verifying changes with the motion harness (`docs/VALIDATION.md`) and keeping the tests healthy |

Work threads (a feature, a fix) don't get a charter. They follow `CLAUDE.md`,
send their lessons to the role that owns the area, and get reviewed by the
roles above.

## Expert threads (AJ, 2026-10-31)

Experts are permanent threads that **facilitate issue threads, never take
them over** (AJ: "they should facilitate the issue threads not take them
over"; the flow "cannot be subverted unless there is an extreme
circumstance"). The rules are in `CLAUDE.md`, "Experts facilitate, issue
threads own". Each expert writes its own charter here when its thread
starts, with the same Learnings table.

| Expert | Consulted on | Skills it keeps for issue threads | Charter |
|---|---|---|---|
| Audio | Mic chain, music levels and fades, alert and gag sound levels, no clipping and no limiters (`docs/AUDIO.md`, `npm run audio`) | `mic-diagnose`, `audio-change-proof` | `audio.md` |
| OBS and stream setup | Scenes, sources, filters, Move automations, MIU wiring, OBS quirks on Defiant, backups and safe-change rules | The recipes the Defiant thread runs; `obs-ops` with Defiant | `obs.md` |
| Alerts and integrations | Alert and gag pages, MIU commands, Twitch events, the BRB clip reel (`alexmj212/twitch-clip-reel-overlay`) | `alert-test-safe` (never posts to chat), `miu-command-edit` | `alerts.md` |
| Performance | CPU and GPU budgets for scenes and OBS (`docs/PERFORMANCE.md`, `npm run bench`, `npm run gpu:summary`) | `gpu-check`, `bench-compare` | `performance.md` |
| Docks and capture | Game Switcher and Audio Routing docks (`src/gamepicker`, `src/audiorouting`), game capture quirks | `dock-check`, `capture-troubleshoot` | `docks.md` |
| Couch vtuber and discoball | `alexmj212/vtuber` and `alexmj212/discoball`, their deploys and OBS sources | `vtuber-audit`, deploy-and-swap | `vtuber.md` |

Not experts: vertical canvas and layout stay with Design system (Rotom). The
Defiant thread ("Connect to OBS on Defiant") is the hands on AJ's PC: it
runs recipes issue threads send (through the coordinator), reviewed by the
OBS expert when they change OBS. Vault notes: each expert keeps its own
current, written through the Defiant thread.

How an issue thread uses an expert:

1. Before changing something in a domain, send the expert the plan in one
   message. It replies with history, rules and the skill to use.
2. When stuck, ask again. The expert names the next step; the issue thread
   takes it.
3. When done, send the expert one line on what was learned. The expert
   updates its charter, memory or skill.

An expert never pushes to an issue thread's branch, opens a competing PR,
repeats an investigation, or answers AJ about the issue.
