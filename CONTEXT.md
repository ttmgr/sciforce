# CONTEXT.md — domain model

## What this project is

Science Bros is a Broforce-style run-and-gun platformer in one self-contained
file, `science-bros/index.html` (plain JS in one script tag, canvas 480x270,
no build step, no dependencies). Scientist "bros" fight the Anti-Science
League's "quacks" through a 25-mission satire campaign, three bonus modes and
endless random missions. Headless Node tests in `science-bros/tests/` check the
logic with canvas and DOM stubbed.

## Vocabulary

- **bro** — a playable scientist (51 in all, 3 of them melee bros). A new run starts with `START_BROS` (10) random bros; the rest are unlocked by freeing them from cages. After a death the next bro is random, never the one who just died.
- **quack** — any enemy. Bosses are separate and have their own wake-up rule.
- **T** — tile size in pixels (16). The tile arrays are `LW` x `LH` (560 x 40). `playW` is the playable width of the current level: 236 + `stretchW`, so 356 to 516 for campaign missions by region (560 for the Detox Express), 376 for random missions and bonus modes; columns from `playW` on read as steel.
- **GH** — ground height row (22). Rows 0-21 are the classic surface level; rows 22-38 are earth and row 39 is steel bedrock, filled by `deepen()`.
- **stretch** — the extra columns inserted before each boss arena: since round 9 `stretchW` in a campaign mission follows its region (`STRETCH_OF`: 120, 160, 200, 240, 280; the Detox Express keeps the full 324, `STRETCH`), and it is 140 (`OLD_STRETCH`) elsewhere. `stretchK` is its share of 324 and `longScaled()` scales forks and detours with it. Levels are built 236 wide, then `slideArena()` moves the arena right from `cutAt` and `buildStretch()` fills the gap with about ten pieces, 2-3 forks and 2-3 underground detours per mission (`LONG_MAPS`). Hard-coded arena columns must go through `arenaCol()`.
- **fork** — a stretch piece (`stretchFork`) with a steel high road reached by ladders and a low road under it. Campaign only, never in random maps.
- **underground zone** — a mine, bunker, sewer, cavern or lab (`UG_KINDS`) below row 22, reached by shaft, ladder, lift or cracked floor.
- **random mission** — a map made from scratch by `genLevel(seed, diff)` from segment and arena tables (`SEG_META`, `ARENA_META`). Same seed gives the same tiles; `?seed=` replays one.
- **aim** — holding the aim key keeps the facing fixed so the bro can walk backwards and still shoot forwards; Up tilts the gun. `aimShots` applies it; weapons in `NO_AIM` keep their own path.
- **blame** — global that records who caused a hit, so the player's own weapons never kill the player.
- **DESTRUCT / wreck()** — per-weapon terrain damage by material (earth, brick, crate, ice, steel). Steel above the bedrock row has 10 hp and only weapons with a `DESTRUCT` `s` value dent it; bedrock and boss arenas never break.
- **pickup gun / one-use special** — `GUNS` (8 guns) drop from gun crates; `ONCE` specials (confetti, beach, spud) replace the bro's next special press once (`P.once`).
- **BOSS_MUL** — per-weapon damage multiplier against bosses, tuned so every bro can beat every boss.
- **seedN** — a fixed seed per mission or mode, so inserting missions (round 5 put two before the Citadel, round 6 five more spread through the campaign) does not change the others; never seed by level index.
- **difficulty / density** — two separate saved settings. `DIFFS` (EASY, NORMAL, HARD, INSANE) changes how hard fights are; `DENS` / `densMul` (25% to 300%) changes how many quacks spawn. Campaign missions spawn 1.5x the base (`CAMPAIGN_DENS`), capped at 3x the old base (`CAMPAIGN_DENS_MAX`), so 200% and 300% are the same in the campaign; random missions and bonus modes use the plain setting.
- **gore** — setting 0 (off), 1 (on) or 2 (extra). Robots and bosses leak their own colour (`LEAK`) instead of blood.
- **test hooks** — `window.__SB_TEST__` and `window.__SB__`, filled by `Object.assign` lines at the bottom of the script. Values that change must be exposed as functions, not copied values.

## Invariants

1. The game stays one HTML file with no build step and no external requests.
2. EASY, HARD and INSANE only change fights relative to NORMAL; the density setting only changes how many quacks spawn (round 5 raised the campaign base to 1.5x on purpose).
3. No quack fires in the first 10 seconds of a mission, and nothing spawns within 20 tiles of the start or inside a wall.
4. The player's own weapons never kill the player; enemy hazards still do.
5. Story text uses made-up names only. `tests/satire.js` blocks about 100 real brand, platform, company and living-person names.
6. Every test file takes the game path as its argument and exits 1 on any failure.

## Boundaries

- Out of scope: online play, accounts, servers, analytics, any external asset or library.
- Out of scope: real people or real brands in the satire.
- **region** — one of the 5 campaign groups of missions (`REGIONS`); free order inside an open region, cleared missions saved by name in `sciencebros.cleared`. `S.setReached(n)` in tests keeps its old meaning.
- **rescue counter** — lifetime count of freed cages (`sciencebros.rescues`); thresholds unlock bros in a fixed order, starting from Dr Reskbro (`reska`).
- **modifier** — a per-mission rule set by name in `MODS_OF` (DARK, FLOODED, RESTLESS, GALE); off in the boss arena; random maps roll it from a derived seed, so the main stream and layouts stay the same.
- **tanksuit** — the player's Think Tank; shares the walker's boarding code through `P.mech.kind`. Not the enemy boss of type `tank`.
- **record / rank** — the best time, score, cages, intel, deaths and rank of a campaign mission, keyed by mission name in `sciencebros.records`; `rankOf` scores a run on the 100-point `RANK` sheet (S, A, B, C, D). Random missions show a rank and save nothing.
- **music bus / song** — music has its own gain (`musicBus`) into the compressor, effects go through `sfxBus`; a song is an entry of `SONG_DEFS` (region, boss, finale, calm) and a stinger an entry of `STING`. `updateMusic` runs from `frame()`, never from `step()`.
- **weapon voice** — `wv`, a pitch, wave and tail per bro that colours the shared `shot` and `throw` sounds while `fireWeapon` runs.
- **firing tell / boss card / deathSlow** — round 8 presentation that only reads state: the muzzle glint before a grunt shot (`fireTell`), the boss name card (`bossIntroAt`), and 0.7 s of slow motion on a final boss's last hit (separate from Einstein's `slowT`).
- **fall damage** — round 9: a quack, dog or bomber that lands `FALL.from` (5) tiles or more below where it last stood takes `FALL.per` (2) hp per tile from the fifth on (`fallCheck`, `fallDmg`); the drop is scaled by `G / 900`. `e.fallY` is the height it last stood at, `e.air` whether it has been off the ground since. Not the player's rule: bros take no fall damage.
- **MECH** — per-suit numbers for the player's walker and Think Tank: speed, jump, `ram` (hp/s off soft blocks it moves into), `butt` (roof hit on a jump), `stomp` (landing).
- **saved run** — round 9: the campaign run stored as JSON under `sciencebros.run` (`saveRun`, `snapRun`, `loadRun`, `resumeRun`, `clearRun`). `markFresh()` at the end of `startLevel` numbers the entities built with the level (`e.sid`), keeps a copy of the tiles and a fingerprint (`freshSig`); the save lists dead `sid`s, damaged ones, raised flags and changed tiles. `titleItems()` is the title menu with CONTINUE in front while `runSaved` is set; `TITLE_MENU` stays the fixed list.
- **missionNo** — the number shown for a campaign mission: its place in `MAP_ORDER` plus one (1 to 26, region by region). The index in `LEVELS` is internal only and must not be shown.
- **DARK vs blackout** — the DARK modifier (`modDarkK`, a whole mission) is `DARK_AMB` (0.84) dark with the bro's `DARK_LAMP`; the blackout event (about 10 s) stays 0.95 dark with the bro's light cut to 30%. `gfxDark()` is true only for the blackout and the deep underground.
- **outline pass** — `gfxOutlinePass()` runs once a frame from the `drawBodies` wrapper, just before the entities are drawn, and `gfxRim()` after the bro; three screen-sized layers in `gfxBuf`. Never outline per character: canvas-to-canvas copies per entity cost about 0.5 ms each in Chrome.
- **frame loop** — `frame()` catches up at most three steps, redraws only when a step ran, and shows `frameStats` when the address has `?fps`.
