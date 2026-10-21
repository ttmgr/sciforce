# LEARNINGS.md — corrections and gotchas

<!-- Append-only, one bullet per entry, newest at the bottom. The last 10
     entries surface in `build_hub.py --brief` so every future session sees
     them. Format: `- YYYY-MM-DD · area — what to do differently (and why)`. -->

- 2026-10-20 · tests — expose changing state on the test hooks as functions; `Object.assign` copies a getter's value once, so a plain property goes stale.
- 2026-10-20 · tests — a test that needs a specific bro must set `S.P.bro` itself (usually Einstein); a new run starts with 10 random bros.
- 2026-10-20 · maps — never hard-code a boss arena column; wrap it in `arenaCol()`, because `slideArena()` moves every arena by the stretch.
- 2026-10-20 · agents — worktree agents can start from old main; tell each agent to reset to the feature branch head before working.
- 2026-10-20 · comments — a `//` comment in the middle of a line cuts off the code after it; put comments at the end of the line.
- 2026-10-20 · tests — some checks are flaky under parallel load; rerun a failing file alone and compare with an older commit before calling it a regression.
- 2026-10-21 · playing — the user plays by opening `science-bros/index.html` as a file; if they "don't see the changes", reopen that exact path with a fresh `?v=` and warn about stale tabs from `.claude/worktrees/`.
- 2026-10-21 · tools — the `gh` on PATH is a broken Anaconda package; use `/opt/homebrew/bin/gh`.
