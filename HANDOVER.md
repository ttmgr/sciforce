# Handover

**Updated:** 2026-10-21 05:40

Three rounds of work are done on branch `feature/aim-melee-random-maps` and are open as PR #2 (https://github.com/ttmgr/sciforce/pull/2), not yet merged into main. Round 1 added aiming, walking backwards while shooting, 3 melee bros, longer maps and random bros. Round 2 added weapon-based destruction, the random map generator, more quacks, mech exit and boss damage fixes. Round 3 added underground levels (40 rows), fancier maps, more gore, 8 more quacks, difficulty and density settings and the satire story. Before touching anything: the game is `science-bros/index.html` opened as a file in the browser; old copies under `.claude/worktrees/` are stale agent checkouts, not the game.

## In flight / open tasks

- PR #2 waits for review and merge.
- Known flaky checks (they also fail sometimes on older commits, and pass when run alone): `life.js` bird check, `deaggro.js` "then quacks notice you again", the `levels.js` simple bot, the `events.js` airstrike, and timing checks under parallel load.
- Insane difficulty at 300% density costs about 2.1 ms a frame, close to the 3 ms budget.

## Next steps

1. Round 4, asked for on 2026-10-21 (the user pastes the full prompt after clearing context): longer campaign maps, a one-time remake of the campaign missions (most of all missions 1-7, which the user has replayed too often; still fixed, the same on every play), more gimmick weapons, a bigger nuke (Oppenheimer's special, `NUKE_R` / `NUKE_BOX` / `NUKE_HOLE`), more destruction, more bros. Confirm the scope before coding.
   Answers given on 2026-10-21: 4 new bros, 4 new pickup guns + 3 one-use special pickups, nuke 1.5x (ring 120 px, crater about 10 wide and 5 deep). WS1 and WS2 run in parallel split by area: WS1 owns stretch/underground code, WS2 owns the 236-column base of each mission; WS1 merges first. Waiting for the user's final OK on the scope (map length default about 560 columns, special pickups reading).
2. The hub files (`scripts/build_hub.py`, `docs/HUB.html`, `CONTEXT.md`, `HANDOVER.md`, `LEARNINGS.md`, `.gitignore`) are not committed yet. The user said on 2026-10-21 to commit all of them, `docs/HUB.html` included.

## Verification commands

```bash
# all test files; each prints PASS/FAIL lines and exits 1 on failure
for f in science-bros/tests/*.js; do node "$f" science-bros/index.html > /dev/null 2>&1 || echo "FAIL $f"; done
# one file
node science-bros/tests/underground.js science-bros/index.html
```

## Files touched

- `science-bros/index.html` — the whole game.
- `science-bros/tests/*.js` — 34 headless test files.
- `README.md` — feature notes, controls and the test list.
