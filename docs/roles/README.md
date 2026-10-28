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
