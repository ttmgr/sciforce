// Headless checks for the longer campaign maps: every mission is 560 columns wide with a 324-column stretch before
// its boss arena, the stretch has more sections, forks (a high road over a low road) and more underground detours
// than before, the boss arena sits where arenaCol() puts it and a bot reaches it, both roads of a fork can be walked,
// the start stays safe, nothing floats or sits in a wall, missions keep the same quacks every time, and a big fight
// at INSANE / 300% still costs under 3 ms a frame while every mission builds fast. Only the 18 campaign missions are long:
// random missions, the Moon Base, Lab Siege and Boss Rush keep the 140-column stretch and the 376-column map, and nobody
// (bro, camera, bullets) gets past column 376 there.
// Usage: node science-bros/tests/longer_maps.js science-bros/index.html
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
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const LW = S.LW, LH = S.LH, GH = S.GH, NL = S.nLevels, STEEL = 3, CRATE = 4, LADDER = 7;
const solid = (v) => v !== 0 && v !== 5 && v !== 7;
const quacks = () => S.ents.filter((e) => S.THREAT[e.type] && !e.dead);
const OLD_ZONES = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0]; // underground zones per mission at 376 columns (commit 78b2cd6)
const ownSeg = (l) => (S.levelDef(l).build.segs || []).filter((g) => g[0] !== 'camp' && g[1] <= 44);
const oldSections = (l) => { const segs = ownSeg(l), own = segs.length ? segs[l % segs.length] : null; return Math.max(1, Math.round((140 - (own ? own[1] : 0)) / 32)) + (own ? 1 : 0); }; // the 140-column stretch's piece count
const inWall = () => S.ents.filter((e) => !BOSSES.includes(e.type) && e.type !== 'icicle' && e.type !== 'drone' && e.type !== 'flag' && [1, 2, 3, 4, 6].includes(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))));
const floating = () => { // loose blocks (brick, crate, ice) with nothing holding them, the way the game checks it
  const N = LW * LH, at = (i) => S.tileAt(i % LW, Math.floor(i / LW)), loose = (v) => v === 2 || v === 4 || v === 6, seen = new Uint8Array(N), q = [];
  for (let i = 0; i < N; i++) if (solid(at(i)) && (!loose(at(i)) || i >= N - LW)) { seen[i] = 1; q.push(i); }
  while (q.length) { const i = q.pop(), c = i % LW, v = at(i), all = loose(v) || v === 3; for (const j of all ? [i - LW, i + LW, c > 0 ? i - 1 : -1, c < LW - 1 ? i + 1 : -1] : [i - LW]) if (j >= 0 && j < N && !seen[j] && loose(at(j))) { seen[j] = 1; q.push(j); } }
  const out = []; for (let i = 0; i < N; i++) if (loose(at(i)) && !seen[i]) out.push([i % LW, Math.floor(i / LW)]); return out;
};

// ---- 1. the size
check('a level is 560 columns wide (376 before, so about 50% longer)', LW === 560 && S.STRETCH === 324 && S.ARENA_AT + S.STRETCH + 60 === LW, 'LW ' + LW + ', stretch ' + S.STRETCH);
check('every mission has a settings row: [forks, detours]', S.LONG_MAPS.length === NL && S.LONG_MAPS.every((r) => r.length === 2 && r[0] >= 2 && r[1] >= 2));

// ---- 2. per mission: sections, forks, underground detours, the boss arena
const bad = { plan: [], more: [], fork: [], zones: [], arena: [], float: [], wall: [], start: [], slow: [] };
let maxMs = 0, totalSec = 0, oldSec = 0, totalZones = 0, totalForks = 0;
for (let l = 0; l < NL; l++) {
  let ms = 1e9; for (let k = 0; k < 3; k++) { const t0 = Date.now(); S.startLevel(l); ms = Math.min(ms, Date.now() - t0); } maxMs = Math.max(maxMs, ms); if (ms >= 60) bad.slow.push('L' + (l + 1) + ':' + ms);
  run(1);
  const tag = 'L' + (l + 1), cut = S.cutAt(), plan = S.stretchPlan(), [wantF, wantZ] = S.longOf(l);
  let c = cut; for (const [, c0, w] of plan) { if (c0 !== c) bad.plan.push(tag + ':gap at ' + c0); c = c0 + w; }
  if (c !== cut + S.STRETCH) bad.plan.push(tag + ':ends at ' + c);
  const forks = plan.filter((p) => p[0] === 'fork'), zones = S.ugZones().filter((z) => z.c0 >= cut - 10 && z.c1 <= cut + S.STRETCH + 2);
  totalSec += plan.length; oldSec += oldSections(l); totalZones += S.ugZones().length; totalForks += forks.length;
  if (plan.length < oldSections(l) + 4 || forks.length !== wantF || zones.length !== wantZ || S.ugZones().length <= OLD_ZONES[l]) bad.more.push(tag + ': ' + plan.length + ' sections (was ' + oldSections(l) + '), ' + forks.length + '/' + wantF + ' forks, ' + zones.length + '/' + wantZ + ' detours, ' + S.ugZones().length + ' zones (was ' + OLD_ZONES[l] + ')');
  for (const [, f0, w] of forks) { // a steel high road at row 10 with a ladder at each end, and the low road open under it
    const a = f0 + 6, b = f0 + w - 7, m = (a + b) >> 1; let ok = b - a >= 15;
    for (let k = a; k <= b; k++) { if (S.tileAt(k, 10) !== STEEL || solid(S.tileAt(k, 7)) || (k !== m && solid(S.tileAt(k, 9)))) ok = false; for (let r = 11; r <= 14; r++) if (solid(S.tileAt(k, r))) ok = false; if (!solid(S.tileAt(k, 16))) ok = false; }
    for (let r = 10; r <= 15; r++) if (S.tileAt(a - 1, r) !== LADDER || S.tileAt(b + 1, r) !== LADDER) ok = false;
    if (!ok) bad.fork.push(tag + '@' + f0);
  }
  const zs = S.ugZones().slice().sort((p, q) => p.c0 - q.c0); for (let i = 1; i < zs.length; i++) if (zs[i].c0 <= zs[i - 1].c1 + 6) bad.zones.push(tag + ':' + zs[i - 1].c1 + '/' + zs[i].c0); // zones apart
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  if (!B || B.ax0 < cut + S.STRETCH || B.trig < cut + S.STRETCH || B.ax1 >= LW || B.x < (cut + S.STRETCH) * T || S.padOf()[0] !== S.levelDef(l).pad[0] + S.STRETCH || S.arenaCol(S.levelDef(l).pad[0]) !== S.padOf()[0]) bad.arena.push(tag + (B ? ': ax0 ' + B.ax0 + ' ax1 ' + B.ax1 : ': no boss'));
  const fl = floating(); if (fl.length) bad.float.push(tag + ':' + fl.slice(0, 4).map((p) => p.join(',')).join('/'));
  const w = inWall(); if (w.length) bad.wall.push(tag + ':' + w.map((e) => e.type + '@' + Math.floor(e.x / T) + ',' + Math.floor(e.y / T)).join('/'));
  if (S.ceasefire < 9.9 || quacks().some((e) => e.x < 20 * T)) bad.start.push(tag);
}
check('every stretch is one run of pieces from the cut to the boss arena', !bad.plan.length, bad.plan.join(' '));
check('every mission: more sections, its forks, its underground detours, more zones than before', !bad.more.length, bad.more.join('; ') || totalSec + ' sections (was ' + oldSec + '), ' + totalForks + ' forks, ' + totalZones + ' zones (was ' + OLD_ZONES.reduce((s, v) => s + v) + ')');
check('the stretches have at least twice as many sections as before', totalSec >= oldSec * 2, totalSec + ' vs ' + oldSec);
check('every fork: a steel high road with a ladder at each end over an open low road', !bad.fork.length, bad.fork.join(' '));
check('underground zones never run into each other', !bad.zones.length, bad.zones.join(' '));
check('every boss arena sits after the stretch, where arenaCol() puts it, with its pad', !bad.arena.length, bad.arena.join(' '));
check('nothing floats at the start of any mission', !bad.float.length && S.checkCollapse() === 0, bad.float.join(' '));
check('nothing spawns inside a wall', !bad.wall.length, bad.wall.join(' '));
check('safe start: a 10 s ceasefire and no quack within 20 tiles of the start', !bad.start.length, bad.start.join(' '));
check('every mission builds in under 60 ms (best of 3)', !bad.slow.length, 'slowest ' + maxMs + ' ms' + (bad.slow.length ? ', ' + bad.slow.join(' ') : ''));

// ---- 3. both roads of a fork can be walked, and a bot gets through the whole stretch into the arena
const clear = () => { for (const e of S.ents) if (S.THREAT[e.type] || S.NEW_FOES.includes(e.type) || e.type === 'icicle' || ['minelayer', 'mine'].includes(e.type)) e.dead = true; };
const walk = (x, y, until, frames, keys) => { S.P.x = x; S.P.y = y; S.P.vx = 0; S.P.vy = 0; const ys = []; for (let i = 0; i < frames && !until(); i++) { if (i % 30 === 0) S.pressed.jump = true; S.P.inv = 1e9; S.P.alive = true; step(keys(i)); ys.push([S.P.x / T, S.P.y / T]); } return ys; };
let high = 0, low = 0, nf = 0; const roadInfo = [];
for (const l of [0, 5, 9, 17]) {
  S.startLevel(l); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99); clear();
  for (const [, f0, w] of S.stretchPlan().filter((p) => p[0] === 'fork')) {
    const a = f0 + 6, b = f0 + w - 7; nf++;
    let ys = walk(a * T + 2, 10 * T - 15.01, () => S.P.x / T > b + 3, 60 * 20, (i) => ({ right: true, fire: i % 6 < 3, jump: i % 30 < 10 })); // up high
    if (S.P.x / T > b + 3 && ys.filter(([x]) => x >= a + 1 && x <= b - 1).every(([, y]) => y < 10)) high++; else roadInfo.push('high L' + (l + 1) + '@' + f0 + ' at ' + (S.P.x / T).toFixed(0));
    clear(); ys = walk((f0 + 1) * T, 16 * T - 15.01, () => S.P.x / T > f0 + w + 1, 60 * 20, (i) => ({ right: true, fire: i % 6 < 3, jump: i % 30 < 10 })); // down low
    if (S.P.x / T > f0 + w + 1 && ys.filter(([x]) => x >= a && x <= b).every(([, y]) => y > 10.5)) low++; else roadInfo.push('low L' + (l + 1) + '@' + f0 + ' at ' + (S.P.x / T).toFixed(0));
  }
}
check('a bot walks the high road of every fork it tries, start to end, without dropping off', nf >= 8 && high === nf, high + ' of ' + nf + (roadInfo.length ? ', ' + roadInfo.join(' ') : ''));
check('and the low road under it, past the barricade', low === nf, low + ' of ' + nf);
let thru = 0; const thruInfo = [];
for (let l = 0; l < NL; l++) {
  S.startLevel(l); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99); clear();
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final), cut = S.cutAt(); let far = 0;
  walk((cut - 4) * T, 2 * T, () => far >= B.trig, 150 * 60, (i) => { far = Math.max(far, S.P.x / T); if (i % 25 === 0) S.pressed.jump = true; return { right: true, jump: i % 25 < 14, fire: i % 6 < 3 }; });
  if (far >= B.trig) thru++; else thruInfo.push('L' + (l + 1) + ':' + far.toFixed(0) + '/' + B.trig);
}
check('a bot crosses every 324-column stretch into the boss arena', thru === NL, thru + ' of ' + NL + (thruInfo.length ? ', stuck ' + thruInfo.join(' ') : ''));

// ---- 4. the same quacks every time, and the difficulty curve holds
const snap = () => S.ents.map((e) => e.type + Math.round(e.x) + ',' + Math.round(e.y)).join();
let same = 0; for (let l = 0; l < NL; l++) { S.reset(); S.startLevel(l); const a = snap(); S.reset(); S.startLevel(l); if (snap() === a) same++; }
check('every mission has the same quacks every time', same === NL, same + ' of ' + NL);
const per = []; for (let l = 0; l < NL; l++) { S.reset(); S.startLevel(l); per.push(quacks().reduce((s, e) => s + S.THREAT[e.type], 0)); }
check('the threat still climbs from the first mission to the last', per[0] === Math.min(...per) && per[NL - 1] >= Math.max(...per) - 6 && per.slice(9).reduce((a, b) => a + b) > 1.5 * per.slice(0, 9).reduce((a, b) => a + b), per.map((x) => x.toFixed(0)).join(' '));

// ---- 5. the full map fits the wider level, and a big fight stays cheap
S.startLevel(3); S.endCeasefire(); step();
check('the full map draws the 560-column level', (() => { try { S.keys.map = true; S.render(1); S.keys.map = false; return true; } catch (err) { console.log(err); return false; } })());
{
  const level = (n, d, k) => { S.setDifficulty(d, false); S.setDensity(k, false); S.reset(); S.startLevel(n); S.P.bro = S.BRO.einstein; };
  const fight = (d, k) => { // the last mission, its busiest 30 columns anywhere on the map, a minigun and explosions
    level(17, d, k); S.endCeasefire(); S.P.alt = { kind: 'minigun', ammo: 99999 };
    const n = quacks().length; let best = 24, bn = 0;
    for (let c = 24; c < LW - 30; c += 4) { const q = quacks().filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (q > bn) { bn = q; best = c; } }
    const near = quacks().find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60);
    for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); }
    const N = 300, t0 = Date.now();
    for (let i = 0; i < N; i++) { S.P.inv = 1e9; if (i % 20 === 0) S.explode(S.P.x + 60, S.P.y + 8, 30, 1, 'p', 0); step({ fire: true }, true); }
    return [(Date.now() - t0) / N, n, bn]; };
  let ms = 99, n = 0, bn = 0; for (let r = 0; r < 5; r++) { const f = fight(3, 6); if (f[0] < ms) [ms, n, bn] = f; } // the best of 5, so a busy machine does not fail it
  check('a fight at INSANE / 300% on the longer map (' + n + ' quacks in the level, ' + bn + ' in 30 columns) costs under 3 ms a frame', ms < 3, ms.toFixed(2) + ' ms');
  S.setDifficulty(1, false); S.setDensity(3, false);
}

// ---- 6. only the 18 campaign missions are long: random missions and the bonus modes keep the 140-column stretch and
// the 376-column map, with the arena and pad where they were before the longer maps (commit 4cc9ccc)
const OLD_W = 376, OLD_RANDOM = { 1: [318, 371], 2: [319, 369], 7: [318, 371], 42: [318, 371], 123: [318, 371], 999: [318, 371], 4242: [319, 369], 77777: [318, 371] }; // seed: [arena ax0, pad column] on 4cc9ccc
const edge = (tag, walk = true) => { // run right at the end of the map: the bro, the camera and the bullets stay inside the old width (walk false: solid steel there, only the view counts)
  S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99); clear();
  S.P.x = (OLD_W - 8) * T; S.P.y = 2 * T; S.P.vx = S.P.vy = 0; let px = 0, cx = 0, bx = 0;
  for (let i = 0; i < 240; i++) { S.P.inv = 1e9; S.P.alive = true; step({ right: true, fire: i % 6 < 3, jump: i % 30 < 10 }); px = Math.max(px, S.P.x + S.P.w); cx = Math.max(cx, S.cam.x + 480); for (const b of S.bullets) bx = Math.max(bx, b.x); }
  let wall = true; for (let r = 0; r < LH; r++) if (S.tileAt(OLD_W, r) !== STEEL || S.tileAt(LW - 1, r) !== STEEL) wall = false;
  let drew = true; try { S.render(1); S.keys.map = true; S.render(1); S.keys.map = false; } catch (err) { drew = false; console.log(err); }
  const ok = (!walk || px >= (OLD_W - 1) * T) && px <= OLD_W * T && cx <= OLD_W * T && bx <= OLD_W * T + 50 && wall && drew; // it does reach the end
  return [ok, tag + ': bro to ' + (px / T).toFixed(1) + ', view to ' + (cx / T).toFixed(1) + ', bullets to ' + (bx / T).toFixed(1) + (wall ? '' : ', no wall') + (drew ? '' : ', draw failed')];
};
{
  let camp = 0; for (let l = 0; l < NL; l++) { S.reset(); S.startLevel(l); if (S.stretchW() === S.STRETCH && S.playW() === LW) camp++; }
  check('the campaign keeps the 324-column stretch and the 560-column map', S.STRETCH === 324 && S.OLD_STRETCH === 140 && camp === NL, camp + ' of ' + NL);
  const bad6 = [], edges = []; let n6 = 0;
  for (const dk of Object.keys(S.GEN_DIFF)) for (const d of [0, 1, 2, 3]) for (const seed of Object.keys(OLD_RANDOM)) {
    S.setDifficulty(d, false); S.setGenDiff(dk); S.reset(); S.startRandom(+seed, true); n6++;
    const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final), [ax0, pc] = OLD_RANDOM[seed];
    if (S.stretchW() !== 140 || S.playW() !== OLD_W || !B || B.ax0 !== ax0 || B.ax1 >= OLD_W || S.padOf()[0] !== pc) bad6.push(dk + '/' + d + '/' + seed + ': width ' + S.playW() + ', ax0 ' + (B && B.ax0) + ', pad ' + S.padOf()[0]);
    if (d === 3 && seed % 2) edges.push(edge('random ' + dk + '/' + seed));
  }
  S.setDifficulty(1, false); S.setGenDiff('normal');
  check('random missions: 376 columns, the arena and pad where they were before (' + n6 + ' maps, every difficulty)', !bad6.length, bad6.slice(0, 6).join('; '));
  check('random missions: the bro, the camera and the bullets never get past column 376', edges.length >= 6 && edges.every((e) => e[0]), edges.filter((e) => !e[0] || e === edges[0]).map((e) => e[1]).join('; '));
  S.reset(); S.startMode('moon'); const M6 = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  check('Moon Base: 376 columns, the arena from column 318 and the pad at 370 as before', S.playW() === OLD_W && S.stretchW() === 140 && M6.ax0 === 318 && S.padOf()[0] === 370, 'width ' + S.playW() + ', ax0 ' + M6.ax0 + ', pad ' + S.padOf());
  const em = edge('moon'); check('Moon Base: nobody gets past column 376', em[0], em[1]);
  S.reset(); S.startMode('siege');
  check('Lab Siege: 376 columns and the pad at 30 as before', S.playW() === OLD_W && !S.isStretched() && S.padOf()[0] === 30, 'width ' + S.playW() + ', pad ' + S.padOf());
  const es = edge('siege', false); check('Lab Siege: the view stops at column 376 (all steel past column 60)', es[0], es[1]);
  S.reset(); S.startMode('rush');
  check('Boss Rush: 376 columns, the first boss fight starts at column 319 as before', S.playW() === OLD_W && Math.floor(S.P.x / T) === 319, 'width ' + S.playW() + ', bro at ' + Math.floor(S.P.x / T));
  S.reset(); S.startMode('campaign'); S.startLevel(0);
  check('back in the campaign the map is long again', S.playW() === LW && S.stretchW() === S.STRETCH);
}

console.log(fails ? fails + ' check(s) failed' : 'all longer maps checks passed');
process.exit(fails ? 1 : 0);
