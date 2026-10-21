# Handover

**Updated:** 2026-10-21 10:30

Four rounds of work are done on branch `feature/aim-melee-random-maps` and are open as PR #2 (https://github.com/ttmgr/sciforce/pull/2), not yet merged into main. Rounds 1-3: aiming, melee bros, random bros, destruction, random maps, more quacks, underground levels, fancier maps, gore, difficulty and density, satire story. Round 4 (2026-10-21) merged six workstreams plus a follow-up: campaign missions 560 columns wide with 2-3 forks and 2-3 underground detours each (random missions and bonus modes keep 376 / 140-column stretch, `playW` / `stretchW`); a one-time remake of all 18 missions (1-7 most), still fixed and the same every play; Trinity 1.5x (ring 120, crater 10 / 5.4 / 7.5); more destruction (steel above bedrock breaks to heavy weapons, back walls collapse, shootable decor, bigger chunks and dust); 4 new bros (Semmelweis, Torricelli, Volta, Gauss; 42 in all); 4 pickup guns (pogo, glue, fizz, duck) and 3 one-use specials (confetti, beach, spud). Lead fixes after merging: crater core bug (fractional rows), cloud cap kept on screen, BOSS_MUL for Mendel (1.15) and Pasteur (1.1), mission 3 sign, and several seeded tests made robust. Before touching anything: the game is `science-bros/index.html` opened as a file in the browser; old copies under `.claude/worktrees/` are stale agent checkouts, not the game.

Later on 2026-10-21, after playing: dogs are 15x11 (level shots hit them), ladder tops hold the bro (Down climbs down), a double tap of Jump leaves the mech, at most three falling blocks a frame hurt a boss, Semmelweis bubbles wobble both ways (no random drift), and the page around the game was redone (game first, fullscreen on F, live controls, clickable roster). The page also has a few hidden extras the user asked for and wants to find alone: never describe them to the user (see the page script and `tests/page_ui.js`).

## In flight / open tasks

- PR #2 waits for review and merge.
- Known flaky checks (fail sometimes, pass alone, also on older commits): `life.js` bird, `deaggro.js` "then quacks notice you again", the `levels.js` simple bot, the `events.js` airstrike, single `boss_fairness.js` checks, `controls_destruction.js` "blast holes the lab back wall" (about 1 in 20 on 79f7697 too), and absolute timing checks under load.
- Frame cost on a quiet machine (INSANE, 300%): 1.67-1.73 ms vs 1.47-1.55 ms on 78b2cd6. The nuke's blast frame costs 3.6-4.0 ms (old nuke 4.2-4.4 ms); frames after it average 1.6 ms, worst 2.8-3.2 ms.
- Things the user may want to revisit: soap bubbles now rise on a fixed path, so at 8 tiles they float over a standing quack (they hit up close); the random nuke event is also 1.5x; Boss Rush uses the short 140-column stretch (delete `mode !== 'rush'` in `buildLevel` to make it long); the full map's objectives panel covers its top-left corner (also on 78b2cd6).

## Next steps

1. Wait for the user's review of PR #2.

## Verification commands

```bash
# all test files; each prints PASS/FAIL lines and exits 1 on failure
for f in science-bros/tests/*.js; do node "$f" science-bros/index.html > /dev/null 2>&1 || echo "FAIL $f"; done
# one file
node science-bros/tests/longer_maps.js science-bros/index.html
```

## Files touched

- `science-bros/index.html` — the whole game.
- `science-bros/tests/*.js` — 42 headless test files (round 4 added bigger_nuke, more_destruction, new_bros, gimmick_weapons, longer_maps, mission_remake, dogs_ladders, page_ui).
- `README.md` — feature notes, controls and the test list.
- `CONTEXT.md`, `LEARNINGS.md`, `HANDOVER.md` — project memory.
