// Headless checks for maps that go underground: the level is 40 rows tall with earth and bedrock under the old 22,
// random maps and campaign stretches dig shafts down to tunnels and back up, nothing floats or sits in a wall, a bot
// gets down a shaft and back up, the camera follows to the bottom rows, the maps draw, and maps still build fast.
// Usage: node science-bros/tests/underground.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
// a seeded Math.random, so the bot runs play out the same way every time
const M = Object.create(Math); { let a = 777; M.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const FOE = S.RANDOM_FOES.map((f) => f[0]).concat(['para', 'turret']);
const LW = S.LW, LH = S.LH, GH = S.GH, NL = 18;
const solid = (v) => v !== 0 && v !== 5 && v !== 7;
const drew = (map) => { try { S.keys.map = !!map; S.render(1); S.keys.map = false; return true; } catch (err) { console.log(err); return false; } };
const inWall = () => S.ents.filter((e) => !BOSSES.includes(e.type) && e.type !== 'icicle' && e.type !== 'drone' && e.type !== 'flag' && [1, 2, 3, 4, 6].includes(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))));
const below = (e) => e.y + e.h > GH * T; // stands under the old bedrock row
// loose blocks (brick, crate, ice) with nothing holding them, the way the game checks it: earth under them, or steel or a held loose block beside
const floating = () => {
  const N = LW * LH, at = (i) => S.tileAt(i % LW, Math.floor(i / LW)), loose = (v) => v === 2 || v === 4 || v === 6, seen = new Uint8Array(N), q = [];
  for (let i = 0; i < N; i++) if (solid(at(i)) && (!loose(at(i)) || i >= N - LW)) { seen[i] = 1; q.push(i); }
  while (q.length) { const i = q.pop(), c = i % LW, v = at(i), all = loose(v) || v === 3; for (const j of all ? [i - LW, i + LW, c > 0 ? i - 1 : -1, c < LW - 1 ? i + 1 : -1] : [i - LW]) if (j >= 0 && j < N && !seen[j] && loose(at(j))) { seen[j] = 1; q.push(j); } }
  const out = []; for (let i = 0; i < N; i++) if (loose(at(i)) && !seen[i]) out.push([i % LW, Math.floor(i / LW)]); return out;
};
const inZone = (c) => S.ugZones().some((z) => c >= z.c0 - 1 && c <= z.c1 + 1);
// a whole level: earth and bedrock under every column solid at row 21; nothing floats; nothing in a wall
const sound = (tag, bad) => {
  let holes = 0; for (let c = 0; c < LW; c++) if (solid(S.tileAt(c, GH - 1)) && !S.deep(c) && (S.tileAt(c, LH - 1) !== 3 || S.tileAt(c, GH + 3) !== 1)) holes++;
  if (holes) bad.earth.push(tag + ':' + holes);
  const fl = floating().filter(([c, r]) => r >= GH || inZone(c)); if (fl.length) bad.float.push(tag + ':' + fl.map((p) => p.join(',')).join('/'));
  const F = S.fancy ? S.fancy() : null; // the fancy-map decoration: on solid ground with room over it underground, and nothing standing behind the playfield down there
  if (F) { const off = F.floor.filter((o) => o.r >= GH && (!solid(S.tileAt(o.c, o.r)) || solid(S.tileAt(o.c, o.r - 1)))).length + F.hang.filter((o) => o.r >= GH - 1 && (!solid(S.tileAt(o.c, o.r)) || solid(S.tileAt(o.c, o.r + 1)))).length + F.back.concat(F.land).filter((o) => o.r >= GH).length; if (off) bad.wall.push(tag + ':decor ' + off); }
  const w = inWall(); if (w.length) bad.wall.push(tag + ':' + w.map((e) => e.type + '@' + Math.floor(e.x / T) + ',' + Math.floor(e.y / T)).join('/'));
};

// ---- 1. the taller level
check('a level is 40 rows tall; missions are built in the top 22', LH === 40 && GH === 22);
const bad = { earth: [], float: [], wall: [] }, stretchZones = [], mainZones = [], kindsSeen = new Set();
for (let l = 0; l < NL; l++) {
  S.startLevel(l); run(1); sound('L' + (l + 1), bad);
  const z = S.ugZones().filter((o) => o.c0 >= S.cutAt() - 10 && o.c1 <= S.cutAt() + S.STRETCH + 2);
  if (z.length) { stretchZones.push(l + 1); z.forEach((o) => kindsSeen.add(o.kind)); }
  if (S.ugZones().some((o) => o.c1 < S.cutAt())) mainZones.push(l + 1);
}
for (const n of [S.SIEGE, S.MOON]) { S.startLevel(n); run(1); sound('mode' + n, bad); }
check('every mission and mode: earth down to a steel bedrock at row 39 under the old floor', !bad.earth.length, bad.earth.join(' '));
check('every mission and mode: nothing floats at the start', !bad.float.length && S.checkCollapse() === 0, bad.float.join(' '));
check('every mission and mode: nothing spawns inside a wall, no decoration floats or stands behind the underground', !bad.wall.length, bad.wall.join(' '));
check('several campaign stretches get an underground detour', stretchZones.length >= 8, stretchZones.length + ' missions: ' + stretchZones.join(','));
check('two missions also go underground in their main part, past the middle', mainZones.join(',') === '9,12' && [8, 11].every((l) => (S.startLevel(l), S.ugZones().every((o) => o.c0 > 90))), mainZones.join(','));

// ---- 2. what is down there, in the campaign stretches
let stretchFoes = 0, stretchLoot = 0, stretchCages = 0, shafts = 0;
for (const l of stretchZones) {
  S.startLevel(l - 1); run(1);
  const z = S.ugZones().find((o) => o.c0 >= S.cutAt() - 10);
  const inZ = (e) => e.x >= z.c0 * T && e.x <= (z.c1 + 1) * T && below(e);
  stretchFoes += S.ents.filter((e) => inZ(e) && FOE.concat(S.NEW_FOES).includes(e.type)).length;
  stretchLoot += S.ents.filter((e) => inZ(e) && ['ammo', 'guncrate', 'itemcrate'].includes(e.type)).length;
  stretchCages += S.ents.filter((e) => inZ(e) && e.type === 'cage').length;
  for (let c = z.c0; c <= z.c1; c++) if (!solid(S.tileAt(c, GH - 1)) && !solid(S.tileAt(c, GH))) shafts++;
}
check('the stretch detours hold quacks and loot', stretchFoes >= stretchZones.length * 2 && stretchLoot >= stretchZones.length, stretchFoes + ' quacks, ' + stretchLoot + ' crates');
check('later missions keep a scientist in a cage down there', stretchCages >= 4, stretchCages + ' cages');
check('each detour has a way down and a way back up through the old bedrock', shafts >= stretchZones.length * 2 * 2, shafts + ' shaft columns');

// ---- 3. random maps: underground branches, sometimes the main path, and they stay fast and sound
const rbad = { earth: [], float: [], wall: [] };
let withZone = 0, mainRoute = 0, slow = [], maxMs = 0, ugFoes = 0, ugCages = 0, ugIntel = 0, ugTargets = 0, ugLoot = 0; const SEEDS = 40, branchSeeds = [], descentSeeds = [];
S.startMode('random');
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = Date.now(); S.startRandom(seed, true); const ms = Date.now() - t0; maxMs = Math.max(maxMs, ms); if (ms >= 50) slow.push(seed + ':' + ms);
  const L = S.levelDef(S.RANDOM), plan = L.gen.plan.map((p) => p[0]);
  if (S.ugZones().length) withZone++;
  if (plan.includes('descent')) { mainRoute++; descentSeeds.push(seed); }
  if (plan.includes('under')) branchSeeds.push(seed);
  S.ugZones().forEach((o) => kindsSeen.add(o.kind));
  sound('seed' + seed, rbad);
  ugFoes += S.ents.filter((e) => below(e) && FOE.includes(e.type)).length;
  ugCages += S.ents.filter((e) => below(e) && e.type === 'cage').length;
  ugIntel += S.ents.filter((e) => below(e) && e.type === 'pickup' && e.item === 'intel').length;
  ugTargets += S.ents.filter((e) => below(e) && e.type === 'target').length;
  ugLoot += S.ents.filter((e) => below(e) && ['ammo', 'guncrate', 'itemcrate'].includes(e.type)).length;
}
check('most random maps go underground somewhere', withZone >= SEEDS * 0.7, withZone + ' of ' + SEEDS);
check('some random maps route the main path through the underground', mainRoute >= 4, mainRoute + ' of ' + SEEDS);
check('random maps: earth and bedrock under the level', !rbad.earth.length, rbad.earth.join(' '));
check('random maps: nothing floats in or under the underground parts', !rbad.float.length, rbad.float.join(' '));
check('random maps: nothing spawns inside a wall', !rbad.wall.length, rbad.wall.join(' '));
check('going down is worth it: quacks, cages, intel, loot and objectives underground', ugFoes >= withZone * 2 && ugCages >= 5 && ugIntel >= 3 && ugTargets >= 3 && ugLoot >= 5, ugFoes + ' quacks, ' + ugCages + ' cages, ' + ugIntel + ' intel, ' + ugTargets + ' targets, ' + ugLoot + ' crates');
check('mines, bunkers, sewers, caverns and labs all turn up', S.UG_KINDS.every((k) => kindsSeen.has(k)), [...kindsSeen].join(','));
check('every map still builds in under 50 ms', !slow.length, 'slowest ' + maxMs + ' ms' + (slow.length ? ', ' + slow.join(' ') : ''));

// ---- 4. a bot goes down a shaft and comes back up
const ladderAt = (c0, c1) => { for (let c = c0; c <= c1; c++) if (S.tileAt(c, 20) === 7 && S.tileAt(c, 24) === 7) return c; return -1; };
const botFrom = (x, y, until, frames, keys) => { // right, jump, fire; invulnerable
  S.P.x = x; S.P.y = y; S.P.vx = 0; S.P.vy = 0; let low = 0, i = 0;
  for (; i < frames && !until(); i++) { if (i % 25 === 0) S.pressed.jump = true; S.P.inv = 1e9; step(keys ? keys(i) : { right: true, jump: i % 25 < 14, fire: i % 6 < 3 }); if (S.P.alive) low = Math.max(low, S.P.y / T); }
  return { low, i };
};
let downUp = 0, tried = 0; const downInfo = [];
for (const seed of branchSeeds.slice(0, 6)) {
  S.startRandom(seed, true); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99);
  const piece = S.levelDef(S.RANDOM).gen.plan.find((p) => p[0] === 'under'), sh = ladderAt(piece[1], piece[1] + 14); if (sh < 0) continue;
  if (S.tileAt(sh + 1, 16) !== 0) S.setTile(sh + 1, 16, 0); // cracked ground over the shaft: we drop straight in
  for (const e of S.ents) if (FOE.includes(e.type) || S.NEW_FOES.includes(e.type)) e.dead = true; // only the path is under test
  tried++; const end = piece[1] + piece[2];
  // drop into the entry shaft (no keys: straight down), then right along the tunnel and up the far side
  S.P.x = (sh + 1) * T + 2; S.P.y = 14 * T; S.P.vx = 0; S.P.vy = 0; for (let i = 0; i < 120; i++) { S.P.inv = 1e9; step(); }
  const fell = S.P.y / T;
  const r = botFrom(S.P.x, S.P.y, () => S.P.x / T > end + 1 && S.P.y < 16 * T, 60 * 40); r.low = Math.max(r.low, fell);
  if (r.low > GH + 4 && S.P.x / T > end + 1 && S.P.y < 16 * T) downUp++; else downInfo.push(seed + ':low ' + r.low.toFixed(0) + ' at ' + (S.P.x / T).toFixed(0) + ',' + (S.P.y / T).toFixed(0));
}
check('an invulnerable bot drops down an entry shaft, runs the tunnel and climbs back out further on', tried >= 4 && downUp === tried, downUp + ' of ' + tried + (downInfo.length ? ', stuck ' + downInfo.join(' ') : ''));
// the campaign detours too (every stretch one and the two in a main part)
let campOk = 0, campN = 0; const campInfo = [];
for (const l of [...new Set(stretchZones.concat(mainZones)), S.MOON + 1]) for (let zi = 0; ; zi++) { // and the Moon Base, in low gravity
  S.startLevel(l - 1); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99);
  const z = S.ugZones()[zi]; if (!z) break;
  for (const e of S.ents) if (FOE.includes(e.type) || S.NEW_FOES.includes(e.type) || e.type === 'icicle') e.dead = true;
  const sh = (() => { for (let c = z.c0; c <= z.c1; c++) if (S.tileAt(c, GH) === 7) return c; return -1; })(); if (sh < 0) continue;
  let fl = 22; while (fl < LH && !solid(S.tileAt(sh + 1, fl))) fl++;
  campN++; const r = botFrom((sh + 1) * T + 3, fl * T - 15.01, () => S.P.x / T > z.c1 + 1 && S.P.y < 18 * T, 60 * 40);
  if (S.P.x / T > z.c1 + 1 && S.P.y < 18 * T) campOk++; else campInfo.push(l + ':' + (S.P.x / T).toFixed(0) + ',' + (S.P.y / T).toFixed(0));
}
check('a bot gets through every campaign detour (and the Moon Base one) and back up', campN >= 12 && campOk === campN, campOk + ' of ' + campN + (campInfo.length ? ', stuck ' + campInfo.join(' ') : ''));
// the main path under a ridge: from before the piece to past it
let thru = 0; const thruInfo = [];
for (const seed of descentSeeds.slice(0, 5)) {
  S.startRandom(seed, true); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99);
  for (const e of S.ents) if (FOE.includes(e.type) || S.NEW_FOES.includes(e.type)) e.dead = true;
  const piece = S.levelDef(S.RANDOM).gen.plan.find((p) => p[0] === 'descent'), c0 = piece[1], end = c0 + piece[2];
  const r = botFrom((c0 + 1) * T, (S.surf(c0 + 1, 0) - 1) * T, () => S.P.x / T > end + 1, 60 * 45);
  if (r.low > GH + 4 && S.P.x / T > end + 1) thru++; else thruInfo.push(seed + ':low ' + r.low.toFixed(0) + ' at ' + (S.P.x / T).toFixed(0) + ',' + (S.P.y / T).toFixed(0));
}
check('a bot takes the main path down under the ridge and back up', descentSeeds.length >= 2 && thru === Math.min(5, descentSeeds.length), thru + ' of ' + Math.min(5, descentSeeds.length) + (thruInfo.length ? ', stuck ' + thruInfo.join(' ') : ''));
// climbing the ladder out: up from the bottom of an exit shaft
{
  const seed = branchSeeds[0]; S.startRandom(seed, true); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein;
  for (const e of S.ents) if (FOE.includes(e.type) || S.NEW_FOES.includes(e.type)) e.dead = true;
  const piece = S.levelDef(S.RANDOM).gen.plan.find((p) => p[0] === 'under'), ex = ladderAt(piece[1] + piece[2] - 8, piece[1] + piece[2] - 1);
  let fl = 22; while (fl < LH && !solid(S.tileAt(ex, fl))) fl++;
  S.P.x = ex * T + 3; S.P.y = fl * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = 1e9; run(2);
  let top = S.P.y; for (let i = 0; i < 60 * 10 && S.P.y > 15 * T; i++) { S.P.inv = 1e9; step({ jump: true, up: true }); top = Math.min(top, S.P.y); }
  check('the ladder in a shaft climbs all the way back to the surface', top < 16 * T, 'from row ' + fl + ' up to row ' + (top / T).toFixed(1));
}

// ---- 5. the camera follows down to the bottom rows, the dark comes with it, the maps draw
{
  S.startRandom(branchSeeds[0], true); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein;
  const z = S.ugZones()[0], c = Math.floor((z.c0 + z.c1) / 2);
  for (let r = LH - 4; r < LH - 1; r++) for (let k = c - 2; k <= c + 2; k++) S.setTile(k, r, 0); // a pocket just over the bedrock
  S.P.x = c * T + 3; S.P.y = (LH - 1) * T - 15.01; S.P.vx = 0; S.P.vy = 0;
  for (let i = 0; i < 180; i++) { S.P.inv = 1e9; step(); }
  const cam = S.cam;
  check('inside a zone the camera follows you down to the bottom rows', cam.y + 270 >= (LH - 0.5) * T && S.P.alive, 'view ' + (cam.y / T).toFixed(1) + '-' + ((cam.y + 270) / T).toFixed(1) + ', player row ' + (S.P.y / T).toFixed(1));
  check('and it gets darker down there (lamps light it)', S.ugDark() > 0.3, S.ugDark().toFixed(2));
  check('the minimap and the full map draw underground', drew(false) && drew(true));
  check('the full map shows the underground rows on a map that has them', S.mapRows() === LH);
  // smoothly: the camera moves a little each frame, never jumps
  for (let r = 10; r < LH - 1; r++) S.setTile(c, r, 0); // a shaft from the surface to the bedrock
  S.P.x = c * T + 3; S.P.y = 9 * T; S.P.vy = 0; for (let i = 0; i < 2; i++) { S.P.inv = 1e9; step(); } S.cam.y = 0;
  let jump = 0, last = S.cam.y; for (let i = 0; i < 300; i++) { S.P.inv = 1e9; step(); jump = Math.max(jump, Math.abs(S.cam.y - last)); last = S.cam.y; }
  check('the camera glides down a long fall instead of jumping', jump < 12 && last > (GH + 4) * T - 270, 'largest step ' + jump.toFixed(1) + ' px, ends at row ' + (last / T).toFixed(1));
}
// outside a zone you still fall off the map under row 21; inside one you do not
{
  S.startLevel(0); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein;
  check('outside an underground zone the camera stays where it always was', S.camBottom() === GH * T - 270 && !S.deep(30));
  S.P.x = 30 * T; S.P.y = GH * T + 4; S.P.inv = 0; S.P.shield = 0; step();
  check('outside a zone, falling under row 21 is falling off the map', !S.P.alive);
  check('mission 1 keeps its map on the old 22 rows', S.mapRows() === 22 || S.ugZones().length > 0);
}

console.log(fails ? fails + ' check(s) failed' : 'all underground checks passed');
process.exit(fails ? 1 : 0);
