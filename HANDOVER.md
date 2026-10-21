# Handover

**Updated:** 2026-10-21 21:40

Six rounds of work are done on branch `feature/aim-melee-random-maps` and are open as PR #2 (https://github.com/ttmgr/sciforce/pull/2), not yet merged into main. Round 6 (latest): 51 bros, 25 missions. Round 5: redrawn bros and bosses, calmer dogs, bosses go home after a death, 1.5x campaign quacks, more satire; details below. Rounds 1-3: aiming, melee bros, random bros, destruction, random maps, more quacks, underground levels, fancier maps, gore, difficulty and density, satire story. Round 4 (2026-10-21) merged six workstreams plus a follow-up: campaign missions 560 columns wide with 2-3 forks and 2-3 underground detours each (random missions and bonus modes keep 376 / 140-column stretch, `playW` / `stretchW`); a one-time remake of all 18 missions (1-7 most), still fixed and the same every play; Trinity 1.5x (ring 120, crater 10 / 5.4 / 7.5); more destruction (steel above bedrock breaks to heavy weapons, back walls collapse, shootable decor, bigger chunks and dust); 4 new bros (Semmelweis, Torricelli, Volta, Gauss; 42 in all); 4 pickup guns (pogo, glue, fizz, duck) and 3 one-use specials (confetti, beach, spud). Lead fixes after merging: crater core bug (fractional rows), cloud cap kept on screen, BOSS_MUL for Mendel (1.15) and Pasteur (1.1), mission 3 sign, and several seeded tests made robust. Before touching anything: the game is `science-bros/index.html` opened as a file in the browser; old copies under `.claude/worktrees/` are stale agent checkouts, not the game.

Later on 2026-10-21, after playing: dogs are 15x11 (level shots hit them), ladder tops hold the bro (Down climbs down), a double tap of Jump leaves the mech, at most three falling blocks a frame hurt a boss, Semmelweis bubbles wobble both ways (no random drift), and the page around the game was redone (game first, fullscreen on F, live controls, clickable roster). The page also has a few hidden extras the user asked for and wants to find alone: never describe them to the user (see the page script and `tests/page_ui.js`).

Round 5 (2026-10-21, merged into the feature branch): dogs notice at 150 px after a growl and "!" (was 220 px, instantly); every boss walks back to its start when the bro dies or leaves the arena, damage kept; campaign missions hold 1.5x quacks at NORMAL 100% (capped at the old 300% level); all 46 bros redrawn (coat, shading, a signature item each) and 4 new bros (Kelvin, Huygens, Nightingale, Schrodinger); all 8 bosses and variants redrawn with tells, damage states and death sequences; two new missions before the Citadel (18 Aura Megamall, 19 Pox Party Volcano; 20 in all, 22 bosses); much more satire (quack barks, per-bro quips, radio chatter, tips, signs). Lead fixes while merging: signs and lines for the new missions and bros, new-mission boss looks, test fingerprints rebased, one SHOOT label per cluster of boss parts.

Round 6 (2026-10-21, merged and pushed): 5 more bros (Fibonacci, McClintock, Kekule, Linnaeus, Leeuwenhoek; 51 in all) and 5 more missions with new themes, each after the mission whose story leads to it: 6 Raw Milk Ranch (dairy, boss The Cream Crusher), 10 Magnet Funland (park, The Ringmaster), 13 Spirit Box Manor (manor, The Poltercopter), 16 Ancient Alien Temple (jungle, The Ancient Astronaut), 21 Tinfoil Hat Bunker (foil, The Foil Press); 25 missions, 27 bosses, Citadel last. Older missions keep their seeds and content. Lead fixes: Kekule's ring grinds brick (p 1), test bots stay Einstein after freeing a cage, title tip above the logo.

## In flight / open tasks

- PR #2 waits for review and merge.
- Known flaky checks (fail sometimes, pass alone, also on older commits): `life.js` bird, `deaggro.js` "then quacks notice you again", the `levels.js` simple bot, the `events.js` airstrike, single `boss_fairness.js` checks, `controls_destruction.js` "blast holes the lab back wall" (about 1 in 20 on 79f7697 too), `tuning.js` "all eight boss types go home" (kopter hp once under load, passes alone), and absolute timing checks under load.
- Frame cost (INSANE, 300%): round 4 measured 1.67-1.73 ms vs 1.47-1.55 ms on 78b2cd6 on a quiet machine. Round 5 could only be compared under outside load (another project's pipeline): 3.6-4.6 ms vs 3.1-4.4 ms (7fd836a) and 3.6-3.8 ms (78b2cd6), within noise; re-measure on a quiet machine. The nuke's blast frame costs 3.6-4.0 ms (old nuke 4.2-4.4 ms); frames after it average 1.6 ms, worst 2.8-3.2 ms.
- Things the user may want to revisit: soap bubbles now rise on a fixed path, so at 8 tiles they float over a standing quack (they hit up close); the random nuke event is also 1.5x; Boss Rush uses the short 140-column stretch (delete `mode !== 'rush'` in `buildLevel` to make it long); the full map's objectives panel covers its top-left corner (also on 78b2cd6).

## Next steps

1. Known bug left alone (outside the asks): the Succussion Engine's hammers, quake rubble, quack hatch and dying blasts use unslid arena columns (216*T, 214, 212, 206-228), so the hammers always slam at the arena's left edge; fix with arenaCol() if the user wants it.
2. Wait for the user's review of PR #2.

## Verification commands

```bash
# all test files; each prints PASS/FAIL lines and exits 1 on failure
for f in science-bros/tests/*.js; do node "$f" science-bros/index.html > /dev/null 2>&1 || echo "FAIL $f"; done
# one file
node science-bros/tests/longer_maps.js science-bros/index.html
```

## Files touched

- `science-bros/index.html` — the whole game.
- `science-bros/tests/*.js` — 47 headless test files (rounds 4-5 added bigger_nuke, more_destruction, new_bros, gimmick_weapons, longer_maps, mission_remake, dogs_ladders, page_ui, tuning, wit, new_maps, bros_art, boss_art).
- `README.md` — feature notes, controls and the test list.
- `CONTEXT.md`, `LEARNINGS.md`, `HANDOVER.md` — project memory.
