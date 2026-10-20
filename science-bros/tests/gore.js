// Headless checks for the gore: off makes no blood, on makes more blood than before (bursts, stains on walls and floor, meat and a bone), extra makes limbs, sticking chunks, drips and a screen-edge splat, caps hold after 100 kills, robots and bosses spark and leak instead of bleeding.
// Usage: node science-bros/tests/gore.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const EMPTY = 0, DIRT = 1;
// a flat empty yard on mission 1 (floor from row 16), the player out of the way at column 30
const arena = () => {
  S.startLevel(0); S.endCeasefire(); step();
  for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : EMPTY);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; step();
  S.P.bro = S.BRO.einstein; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.inv = 1e9; S.P.face = 1; S.P.vx = 0; S.P.vy = 0;
};
const fill = (c0, r0, c1, r1, v) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) S.setTile(c, r, v); };
const add = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), { react: 99, cool: 99 }, extra); S.ents.push(e); return e; };
const REDS = ['#9b2335', '#6e1423', '#7a1a2a'];
const stains = (cols = REDS) => { let n = 0; for (const [, a] of S.decals) for (const d of a) if (cols.includes(d[2])) n++; return n; };
const maxTile = () => { let m = 0; for (const [, a] of S.decals) m = Math.max(m, a.length); return m; };
const keepP = () => { S.P.x = 30 * T; S.P.inv = 1e9; };

// OLD numbers (measured on commit 8485ace, 3 runs each, same scenes): a quack shot dead in front of a wall
// (3 small hits, then a big one) left 71 to 77 stains on gore 1 and 123 to 129 on gore 2; a quack shot dead
// in the open left 43 to 49 stains on gore 1 and 70 to 74 on gore 2; none on gore 0.
const OLD = { wall1: 77, open1: 49, wall2: 129, open2: 74 };
const wallKill = (g) => { arena(); S.settings.gore = g; fill(40, 10, 40, 15, DIRT); const q = add('grunt', 38); for (let k = 0; k < 3; k++) S.hitEnemy(q, 0.4, 160, 'shot'); S.hitEnemy(q, 9, 160, 'shot'); run(300); return stains(); };
const openKill = (g) => { arena(); S.settings.gore = g; const q = add('grunt', 50); S.hitEnemy(q, 9, 160, 'shot'); run(300); return stains(); };

// ---- gore off
const w0 = wallKill(0), o0 = openKill(0);
check('gore off: no blood stains', w0 === 0 && o0 === 0, w0 + ' and ' + o0);
arena(); S.settings.gore = 0; const q0 = add('heavy', 36); S.hitEnemy(q0, 999, 200, 'shot'); run(30);
check('gore off: no blood drops, no limbs, no screen splat', !S.parts().some((p) => p.kind === 'blood') && !S.bodies.some((b) => b.kind === 'gib' || b.meat) && !S.fx.some((f) => f.kind === 'edge'));
arena(); S.settings.gore = 0; const g0 = add('grunt', 34); S.P.x = g0.x - 20; S.explode(g0.x + 5, g0.y + 8, 30, 9, 'p', 0); run(60);
check('gore off: an explosion leaves no meat, bone, drip or splat', !S.bodies.some((b) => b.meat || b.col === '#e6e2da') && !S.fx.some((f) => f.kind === 'edge' || f.kind === 'drip') && stains() === 0);

// ---- gore on: more than before
const w1 = wallKill(1), o1 = openKill(1);
check('gore on: more stains around a kill by a wall than the old ' + OLD.wall1, w1 > OLD.wall1 * 1.2, w1 + ' stains');
check('gore on: more stains around a kill in the open than the old ' + OLD.open1, o1 > OLD.open1 * 1.2, o1 + ' stains');
arena(); S.settings.gore = 1; fill(40, 10, 40, 15, DIRT);
{ const q = add('grunt', 38); S.hitEnemy(q, 9, 160, 'shot'); run(300); let wall = 0; for (const [i, a] of S.decals) { const c = i % S.LW, r = Math.floor(i / S.LW); if (c === 40 && r >= 10 && r <= 15) wall += a.length; } check('gore on: the wall behind the target is stained', wall >= 8, wall + ' stains on the wall'); }
arena(); S.settings.gore = 1; const gx = add('grunt', 50); S.P.x = gx.x - 30; S.explode(gx.x + 5, gx.y + 8, 30, 9, 'p', 0); run(2);
const meatN = S.bodies.filter((b) => b.meat).length, boneN = S.bodies.filter((b) => b.col === '#e6e2da').length;
check('gore on: an explosive kill throws a few meat chunks and a bone', meatN >= 3 && boneN >= 1, meatN + ' meat, ' + boneN + ' bone');
check('gore on: no flying limbs and no screen splat on default', !S.fx.some((f) => f.kind === 'edge') && !S.bodies.some((b) => b.kind === 'gib' && b.sw === 4));
arena(); S.settings.gore = 1; const gy = add('grunt', 50); S.hitEnemy(gy, 999, 100, 'shot'); run(240);
{ let lo = 1e9, hi = -1e9; for (const [, a] of S.decals) for (const d of a) if (REDS.includes(d[2]) && d[1] >= 16 * T - 2 && d[1] <= 16 * T + 2) { lo = Math.min(lo, d[0]); hi = Math.max(hi, d[0]); }
  check('gore on: a thrown body leaves a trail and pool along the floor', hi - lo >= 24, (hi - lo) + ' px wide'); }
arena(); S.settings.gore = 1; const gp = add('grunt', 50); S.hitEnemy(gp, 999, 0, 'shot'); run(300); const pc = S.bodies.find((b) => b.kind === 'corpse');
check('gore on: the pool under a corpse keeps spreading', !!pc && pc.pool >= 5, 'pool ' + (pc && pc.pool));

// ---- gore extra: limbs, sticking gibs, drips, screen splat
const w2 = wallKill(2), o2 = openKill(2);
check('gore extra: more stains than the old ' + OLD.wall2 + ' by a wall and ' + OLD.open2 + ' in the open, and more than on', w2 > OLD.wall2 * 1.3 && o2 > OLD.open2 * 1.3 && w2 > w1 * 1.3, w2 + ' and ' + o2 + ' (on: ' + w1 + ', ' + o1 + ')');
arena(); S.settings.gore = 2; const hv = add('grunt', 50); S.P.x = hv.x - 20; S.hitEnemy(hv, 99, 200, 'shot'); run(2);
const limbs = S.bodies.filter((b) => b.kind === 'gib'), corpse2 = S.bodies.find((b) => b.kind === 'corpse');
check('gore extra: a big hit takes the head and an arm off', limbs.length >= 2 && !!corpse2 && corpse2.sy > 0, limbs.length + ' limbs');
check('gore extra: a very close big kill splatters the screen edge', S.fx.some((f) => f.kind === 'edge'));
arena(); S.settings.gore = 2; const sm = add('grunt', 50); S.P.x = sm.x - 150; S.hitEnemy(sm, 1, 100, 'shot'); const sg = add('grunt', 52); S.hitEnemy(sg, 99, 100, 'shot');
check('gore extra: a big kill far away makes no screen splat', !S.fx.some((f) => f.kind === 'edge'));
arena(); S.settings.gore = 2; fill(30, 11, 56, 11, DIRT); fill(30, 11, 30, 15, DIRT); fill(56, 11, 56, 15, DIRT); // a closed room
{ const e = add('grunt', 44, { y: 14 * T }); S.P.x = 34 * T; S.explode(e.x + 5, e.y + 8, 30, 9, 'p', 0); run(90);
  const stuck = S.bodies.filter((b) => b.stuck), drips = S.fx.filter((f) => f.kind === 'drip');
  check('gore extra: chunks stick to walls and ceilings', stuck.length >= 1, stuck.length + ' stuck');
  check('gore extra: blood drips from the ceiling after the blast', drips.length >= 1, drips.length + ' drips'); }
arena(); S.settings.gore = 1; fill(30, 11, 56, 11, DIRT);
{ const e = add('grunt', 44, { y: 14 * T }); S.explode(e.x + 5, e.y + 8, 30, 9, 'p', 0); run(90); check('gore on: chunks bounce instead of sticking, no drips', !S.bodies.some((b) => b.stuck) && !S.fx.some((f) => f.kind === 'drip')); }

// ---- caps hold after 100 kills
for (const g of [1, 2]) {
  arena(); S.settings.gore = g; fill(60, 8, 60, 15, DIRT); fill(30, 11, 56, 11, DIRT); let maxB = 0, maxP = 0;
  for (let k = 0; k < 100; k++) { const e = add('grunt', 44 + (k % 8)); keepP(); if (k % 3 === 0) S.explode(e.x + 5, e.y + 8, 30, 9, 'p', 0); else S.hitEnemy(e, 99, k % 2 ? 200 : -200, 'shot'); run(6); maxB = Math.max(maxB, S.bodies.length); maxP = Math.max(maxP, S.parts().length); }
  run(30); maxB = Math.max(maxB, S.bodies.length); maxP = Math.max(maxP, S.parts().length);
  check('gore ' + g + ': after 100 kills bodies stay capped (281)', maxB <= 281, maxB + ' bodies');
  check('gore ' + g + ': after 100 kills particles stay capped (901)', maxP <= 901, maxP + ' particles');
  check('gore ' + g + ': after 100 kills each tile keeps its stain cap (' + (g === 2 ? 52 : 26) + ')', maxTile() <= (g === 2 ? 52 : 26), maxTile() + ' on the fullest tile');
}

// ---- robots spark and leak oil; bosses leak their own colour
arena(); S.settings.gore = 1; const dr = add('camdrone', 44); S.hitEnemy(dr, 1, 100, 'shot');
const ps = S.parts();
check('a hit camdrone sparks and leaks oil', ps.some((p) => p.kind === 'spark') && ps.some((p) => p.col === S.LEAK.camdrone[0]), ps.length + ' particles');
check('a hit camdrone does not bleed red', !ps.some((p) => REDS.includes(p.col)));
dr.hp = 0.1; S.hitEnemy(dr, 5, 100, 'shot'); run(200);
check('a killed camdrone leaves oil, no red stains', stains() === 0 && stains([S.LEAK.camdrone[0]]) >= 1, stains([S.LEAK.camdrone[0]]) + ' oil stains');
arena(); S.settings.gore = 1; const tu = add('turret', 44); S.hitEnemy(tu, 1, 100, 'shot'); run(100);
check('a hit turret sparks, it does not bleed', stains() === 0);
arena(); S.settings.gore = 0; const dr0 = add('camdrone', 44); S.hitEnemy(dr0, 1, 100, 'shot');
check('gore off: robots still spark but leak no oil', S.parts().some((p) => p.kind === 'spark') && !S.parts().some((p) => p.kind === 'blood'));
arena(); S.settings.gore = 1; const kc = add('citrus', 44); kc.active = true; S.hitEnemy(kc, 1, 100, 'shot');
check('King Citrus leaks orange juice, not blood', S.parts().some((p) => p.col === '#ff9a2a') && !S.parts().some((p) => REDS.includes(p.col)));
for (const t of ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'director']) check('boss ' + t + ' has its own leak colour', !!S.LEAK[t] && !REDS.includes(S.LEAK[t][0]));

console.log(fails ? fails + ' check(s) failed' : 'all gore checks passed');
process.exit(fails ? 1 : 0);
