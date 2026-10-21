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
- 2026-10-21 · screenshots — with `window.__SB_TEST__` set there is no game loop, so a headless Chrome page stays black; call `__SB__.startLevel(n)`, step and `render(1)` yourself, then copy the `#game` canvas with `toDataURL`.
- 2026-10-21 · nuke — `crater()` loops rows from `NUKE_HOLE` sizes; a fractional size (7.5) made every row index fractional, typed-array writes were ignored and the core stayed solid. Round loop bounds to whole rows; `bros.js` "it blows a crater" catches it.
- 2026-10-21 · merges — a merge that adds `Math.random()` calls (chunks, dust) shifts the seeded random stream in every test, so balance checks near their limit flip (Mendel 0.72 -> 0.58 of the median, Semmelweis bubble, fizz vs tank). Before blaming the merge, check the same test on each branch alone; fix fragile bots (face the boss, fire at fair range), and use `BOSS_MUL` only for a real weak bro.
- 2026-10-21 · maps — `LW` (560) is only the array size; "end of the map" is `playW` and "how far the arena slides" is `stretchW`. Changing a global width also resizes random maps and bonus modes, which the user did not want.
- 2026-10-21 · tests — a new bro must be added to the hard-coded id and `DESTRUCT` key lists in `weapons_bosses.js` and the count in `bros.js`; many tests also use mission 1 spots (flat start at row 16, lab, tide pools) as fixtures.
- 2026-10-21 · agents — parallel agents share one scratchpad folder; give every scratch file a per-workstream prefix, or one agent overwrites another's scripts.
- 2026-10-21 · timing — with several agents running, load reaches 25-35 and absolute frame-time checks fail on old commits too; measure new vs base back to back on a quiet machine.
- 2026-10-21 · page — the game's window keydown handler calls preventDefault on Tab, Enter, Space and Esc, which breaks page buttons and details/summary; page controls must stop those keys before they reach the window handler (`pageKeys()`).
- 2026-10-21 · ladders — ladder tops now hold the bro (`moveBody`), which moves boss-test bots onto new spots; seeded boss checks can flip. Look at where the bot stands before tuning balance.
- 2026-10-21 · missions — never seed a mission by its level index or hard-code the Citadel's index; inserting two missions shifted both (use `seedN`, `S.nLevels - 1`). Tests that list bosses per level must find the Citadel as the last mission.
- 2026-10-21 · merges — branches that each add content to shared pools (bro lines, signs per mission, fingerprints) collide after merging: a new bro needs its `BRO_LINES`, a new mission its `WIT_SIGNS` and a boss skin; take test fingerprints on the head just before the merge, not on the old base.
- 2026-10-21 · agents — five agents running test batches at once drove the load to 115 and made git time out; tell agents to run tests one at a time and leave the full suite to the lead.
