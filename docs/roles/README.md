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

| Expert | Consulted on | Skills for issue threads (in `.claude/skills/` unless marked) | Charter |
|---|---|---|---|
| Audio | Everything viewers and AJ hear: mic chain, music, game and alert sound levels, routing, no clipping and no limiters (`docs/AUDIO.md`, `npm run audio`) | `mic-diagnose` (planned), `audio-change-proof` (planned) | `audio.md` |
| OBS and stream setup | How the broadcast is put together: scenes, sources, filters, automations, capture, the OBS docks, MIU and Stream Deck wiring, backups and safe-change rules | Recipes the Defiant thread runs; `obs-ops` (on Defiant, `~/.claude/skills/`), `obs-restart` (source `tools/obs/obs-restart-skill.md`, deployed to the vault's `.claude/skills/`) | `obs.md` |
| Alerts and integrations | How the stream reacts to viewers: alert and gag pages, MIU commands, Twitch events, the BRB clip reel (`alexmj212/twitch-clip-reel-overlay`) | `alert-test-safe` (planned; never posts to chat), `miu-command-edit` (planned) | `alerts.md` |
| Performance | CPU and GPU cost of every scene and of OBS, the project's top goal (`docs/PERFORMANCE.md`, `npm run bench`, `npm run gpu:summary`) | `gpu-check` (`.claude/skills/gpu-check/`), `bench-compare` (planned) | `performance.md` |
| Avatars | AJ's on-stream characters and their control apps: `alexmj212/vtuber` and `alexmj212/discoball`, their deploys and OBS sources | `vtuber-audit` (planned), deploy-and-swap (planned) | `avatars.md` |

Each expert keeps its own row current: the PR that ships a skill drops its
"(planned)" mark, and a planned skill that stops earning its keep comes off
the list (2026-10-31, after the column went stale when `gpu-check` shipped in
#152).

### When a thread becomes permanent

AJ (2026-10-31): "do not create permanent thread for short term fixes or bug
hunting expeditions, the criteria for permanent threads should be agnostic of
past investigations or faulty setups from before."

- A permanent thread covers a **lasting part of the stream** that will keep
  getting asks however today's setup looks: what viewers see or hear, how
  the broadcast is assembled, how it reacts to viewers, what it costs, the
  avatars. Or a process every PR goes through (the roles above).
- Never for a fix, a bug hunt, an investigation or a feature build. Those
  are issue threads, even when they run for days.
- A charter describes the domain as it should work, from the docs and the
  current setup. It doesn't inherit an investigation thread's history or a
  past faulty setup; open bugs stay with their issue threads, and what they
  learn reaches the expert as Learnings when they finish.

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

Every role and expert thread improves itself unprompted (AJ, 2026-10-31):
see `docs/IMPROVING.md`, "Permanent threads improve unprompted".
