// Headless checks for the map randomizer: the same seed makes the same map, every map is complete and fair
// (one boss, enough targets, cages, intel, flags, a clear start, nobody in a wall), it builds fast, a simple bot gets
// to the boss on almost every seed, and the title menu, the pause menu reroll, ?seed= and the next map all work.
// Usage: node science-bros/tests/random_maps.js science-bros/index.html [seeds]
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
// a seeded Math.random, so the game plays out the same way on every run of this test (the bot check is not left to luck)
const M = Object.create(Math); { let a = 20261020; M.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const FOE = S.RANDOM_FOES.map((f) => f[0]).concat(['para', 'turret']);
const SEEDS = +process.argv[3] || 60;
const snap = () => { const a = []; for (let r = 0; r < 22; r++) for (let c = 0; c < S.LW; c++) a.push(S.tileAt(c, r)); return a.join(''); };
const drew = () => { try { S.render(1); return true; } catch (err) { console.log(err); return false; } };

// ---- the title menu entry: a briefing for a fresh map, 10 random bros, then deploy
S.reset(); S.state; step();
const iR = S.TITLE_MENU.findIndex((m) => m[1] === 'random');
check('the title menu has a RANDOM MISSION entry', iR >= 0 && S.TITLE_MENU[iR][0] === 'RANDOM MISSION');
S.reset(); run(1); S.pressed.pause = true; run(1); for (let k = 0; k < 9; k++) { S.pressed.down = true; run(1); } S.pressed.fire = true; run(1); // quit to the title
check('back on the title', S.state === 'title', S.state);
S.titleSel = iR; S.pressed.right = true; run(1);
check('left/right on the entry picks the difficulty', S.genDiffKey() === 'hard', S.genDiffKey()); S.pressed.left = true; run(1);
check('and back to normal', S.genDiffKey() === 'normal'); check('the title draws the entry', drew());
S.pressed.start = true; run(1);
const seed1 = S.genSeed();
check('the entry opens the briefing of a random map', S.state === 'brief' && S.mode === 'random' && S.level === S.RANDOM, S.state + ' ' + S.mode);
check('a random mission starts with 10 random bros, like a new campaign', S.unlocked.length === 10);
check('the briefing names the map and shows the seed', S.levelDef(S.RANDOM).sub.includes('SEED ' + seed1) && drew(), S.levelDef(S.RANDOM).name + ' / ' + seed1);
S.pressed.start = true; run(1);
check('enter deploys into the map', S.state === 'play' && S.level === S.RANDOM && S.P.alive);
const map1 = snap();
// ---- the pause menu: seed shown, NEW RANDOM MAP rerolls
S.pressed.pause = true; run(1);
const items = S.pauseItems().map((m) => m[0]), iNew = items.indexOf('NEW RANDOM MAP');
check('the pause menu offers NEW RANDOM MAP on a random map', iNew >= 0 && items[items.length - 1] === 'QUIT TO TITLE', items.slice(-3).join(', '));
check('the pause menu draws with the seed', drew());
for (let k = 0; k < iNew; k++) { S.pressed.down = true; run(1); }
S.pressed.fire = true; run(1);
check('NEW RANDOM MAP deploys a new seed straight away', !S.paused && S.state === 'play' && S.genSeed() !== seed1 && S.level === S.RANDOM, seed1 + ' -> ' + S.genSeed());
check('and the new map is different', snap() !== map1);
S.startMode('campaign'); S.startLevel(0);
check('the campaign pause menu has no reroll', !S.pauseItems().some((m) => m[0] === 'NEW RANDOM MAP') && S.pauseItems().length === 10);
// ---- ?seed= in the URL replays a map
S.setUrlSeed(4242); S.startMode('random');
check('?seed=4242 deploys seed 4242', S.genSeed() === 4242);
S.startMode('random'); check('the next one is a fresh seed again', S.genSeed() !== 4242);

// ---- after extraction the debrief offers the next random map
let bs = 1; while (!['boss', 'tank'].includes(S.genLevel(bs).gen.boss)) bs++;
S.startRandom(bs, true); S.endCeasefire(); step();
{
  const B = S.boss; S.P.x = (B.trig + 2) * T; S.P.y = (S.surf(B.trig + 2, 0) - 1) * T; S.P.vy = 0; run(5);
  S.finishObjectives(); let k = 0; for (; k < 900 && !B.dead; k++) { S.P.inv = 1e9; if (B.active) S.hitEnemy(B, 50, 0); step(); }
  check('seed ' + bs + ': the boss can be killed and the chopper comes', B.dead && !!S.chopper, k + ' frames');
  for (let i = 0; i < 60 * 30 && S.state === 'play'; i++) { S.P.inv = 1e9; if (i % 30 === 0) S.pressed.jump = true; step({ right: true, jump: (i % 30) < 15 }); }
  check('extraction ends in the debrief', S.state === 'win' && drew(), S.state);
  const before = S.genSeed(); S.pressed.start = true; run(1);
  check('enter on the debrief briefs a new random map', S.state === 'brief' && S.genSeed() !== before && S.mode === 'random');
}

// ---- many seeds: complete, fair and fast
S.startMode('random');
const bossKinds = new Set(), arenaKinds = new Set(), themes = new Set(), pieces = new Set(), slow = [];
let bad = { same: [], boss: [], targets: [], cages: [], intel: [], wall: [], start: [], flags: [], arena: [], pad: [] }, maxMs = 0, foesEasy = 0, foesHard = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = Date.now(); S.startRandom(seed, true); const ms = Date.now() - t0; maxMs = Math.max(maxMs, ms); if (ms >= 50) slow.push(seed + ':' + ms);
  const L = S.levelDef(S.RANDOM), a = snap(); S.startRandom(seed, true);
  if (snap() !== a) bad.same.push(seed);
  const bosses = S.ents.filter((e) => BOSSES.includes(e.type) && e.final), B = bosses[0];
  if (bosses.length !== 1) bad.boss.push(seed); else { bossKinds.add(B.type); if (B.ax0 < 316 || B.trig < 316) bad.arena.push(seed); if (S.padOf()[0] <= B.gate[1]) bad.pad.push(seed); }
  L.gen.plan.forEach((p) => pieces.add(p[0])); themes.add(L.theme);
  for (const o of L.objectives) if (['vat', 'radio', 'server'].includes(o.id) && S.ents.filter((e) => e.type === 'target' && e.skin === o.id).length < o.need) bad.targets.push(seed + ':' + o.id);
  if (S.ents.filter((e) => e.type === 'cage').length < L.cages) bad.cages.push(seed);
  if (S.ents.filter((e) => e.type === 'pickup' && e.item === 'intel').length !== 3) bad.intel.push(seed);
  const stuck = S.ents.filter((e) => !BOSSES.includes(e.type) && e.type !== 'icicle' && e.type !== 'drone' && e.type !== 'flag' && [1, 2, 3, 4, 6].includes(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))));
  if (stuck.length) bad.wall.push(seed + ':' + stuck.map((e) => e.type + '@' + Math.floor(e.x / T)).join('/'));
  if (S.ents.some((e) => FOE.includes(e.type) && e.x < 20 * T)) bad.start.push(seed);
  const flags = S.ents.filter((e) => e.type === 'flag').map((e) => e.x / T).sort((x, y) => x - y), gaps = flags.map((f, i) => f - (i ? flags[i - 1] : 0));
  if (flags.length < 6 || Math.max(...gaps) > 56) bad.flags.push(seed + ':' + flags.length + '/' + Math.max(...gaps).toFixed(0));
  if (seed <= 10) { // the difficulty only changes the quacks, never the map
    const threat = () => S.ents.filter((e) => FOE.includes(e.type)).length;
    S.setGenDiff('easy'); S.startRandom(seed, true); const ae = snap(); foesEasy += threat();
    S.setGenDiff('hard'); S.startRandom(seed, true); const ah = snap(); foesHard += threat();
    S.setGenDiff('normal'); if (ae !== a || ah !== a) bad.same.push(seed + ':diff');
  }
}
check(SEEDS + ' seeds: the same seed always makes the same map (and the same map on every difficulty)', !bad.same.length, bad.same.join(' '));
check('one final boss on every map, in its arena at the far end', !bad.boss.length && !bad.arena.length, bad.boss.concat(bad.arena).join(' '));
check('the extraction pad is behind the gate', !bad.pad.length, bad.pad.join(' '));
check('enough targets for the objective', !bad.targets.length, bad.targets.join(' '));
check('a cage for every scientist in the objectives', !bad.cages.length, bad.cages.join(' '));
check('3 intel files', !bad.intel.length, bad.intel.join(' '));
check('nothing spawns inside a wall', !bad.wall.length, bad.wall.join(' '));
check('no enemy in the first 20 columns', !bad.start.length, bad.start.join(' '));
check('a checkpoint flag about every 40 columns', !bad.flags.length, bad.flags.join(' '));
check('every map is made in under 50 ms', !slow.length, 'slowest ' + maxMs + ' ms' + (slow.length ? ', ' + slow.join(' ') : ''));
check('hard maps hold more quacks than easy ones', foesHard > foesEasy * 1.5, foesEasy + ' easy, ' + foesHard + ' hard over 10 seeds');
check('variety: many pieces, bosses, arenas and themes', pieces.size >= 30 && bossKinds.size >= 6 && themes.size >= 10, pieces.size + ' pieces, ' + bossKinds.size + ' bosses, ' + themes.size + ' themes');
check('the randomizer uses its own pieces too', ['hills', 'gap', 'cave', 'towers', 'bunker', 'floaters', 'barricade'].every((k) => pieces.has(k)));
// a boss that does not suit the arena never turns up
const misfit = []; for (let seed = 1; seed <= 500; seed++) { const g = S.genLevel(seed).gen; if (!(S.ARENA_META[g.arena] || S.ARENA_DEFAULT).bosses.includes(g.boss)) misfit.push(seed + ':' + g.boss + '@' + g.arena); }
check('over 500 seeds every boss suits its arena (ARENA_META)', !misfit.length && Object.keys(S.ARENA_META).every((k) => S.ARENA[k] || S.GEN_ARENA[k]), misfit.join(' '));
// a new level piece or arena that nobody described yet still works
S.SEG.testyard = (H, c, w) => { H.ground(c, c + w - 1, 16); H.fill(c + 2, 14, c + 3, 15, 2); };
S.ARENA.testarena = (H, o) => { H.ground(176, 235, 16); H.fill(226, 0, 227, 15, 3); H.sp(o.boss, 205, 0, Object.assign({ ax0: 178, ax1: 224, trig: 180, final: true, gate: [226, 227, 0, 15] }, o.extra)); };
let usedPiece = false, usedArena = false;
for (let seed = 1; seed <= 400 && !(usedPiece && usedArena); seed++) {
  S.startRandom(seed, true); const L = S.levelDef(S.RANDOM);
  if (L.gen.plan.some((p) => p[0] === 'testyard')) usedPiece = true;
  if (L.gen.arena === 'testarena' && S.boss && S.boss.final && S.boss.ax0 === S.arenaCol(178) && S.tileAt(S.arenaCol(226), 5) === 3) usedArena = true;
}
delete S.SEG.testyard; delete S.ARENA.testarena;
check('an undescribed new piece and arena get picked with default settings', usedPiece && usedArena);

// ---- the bot: right, jump, fire as Einstein, invulnerable; it must reach the boss within 90 s on 95% of the seeds
let ok = 0; const missed = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  S.startRandom(seed, true); S.endCeasefire(); step();
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  S.P.bro = S.BRO.einstein; S.setLives(99); let far = 0;
  for (let i = 0; i < 60 * 90 && far < B.trig; i++) {
    if (i % 25 === 0) S.pressed.jump = true;
    S.P.inv = 1e9; // the respawned bro too
    step({ right: true, jump: i % 25 < 14, fire: i % 6 < 3, up: i % 240 < 30 });
    if (S.P.alive) far = Math.max(far, S.P.x / T);
  }
  if (far >= B.trig) ok++; else missed.push(seed + '@' + far.toFixed(0));
}
check('a simple bot reaches the boss within 90 s on at least 95% of ' + SEEDS + ' seeds', ok >= SEEDS * 0.95, ok + ' of ' + SEEDS + (missed.length ? ', missed ' + missed.join(' ') : ''));

console.log(fails ? fails + ' check(s) failed' : 'all random map checks passed');
process.exit(fails ? 1 : 0);
