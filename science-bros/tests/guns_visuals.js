// Headless checks for gun feel and combat visuals: every bro's gun flashes in its own shape and kicks back,
// rendering every bro firing throws no errors, shots leave impact effects on blocks and quacks, explosions
// are layered, pickup guns animate, and a busy fight stays cheap to step and draw.
// Usage: node science-bros/tests/guns_visuals.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (draw) S.render(1); };
// a flat test yard: earth from row 16 down, nothing else on it
const yard = () => {
  S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0;
  S.P.x = 30 * T; S.P.y = 16 * T - 15.01; for (let i = 0; i < 60; i++) { S.P.inv = 1e9; S.P.x = 30 * T; step(); }
};
const quack = (c, extra = {}) => { const e = Object.assign(S.makeEnt({ type: 'grunt', c, from: 0 }), { face: -1, react: 99, cool: 99 }, extra); S.ents.push(e); return e; };
// fire one shot (Jemison's charger needs the trigger held, then let go); returns the muzzle flash it made
const fireOnce = () => {
  S.P.cool = 0; let m = null;
  for (let i = 0; i < 45 && !m; i++) { S.P.inv = 1e9; step({ fire: S.P.bro.id !== 'jemison' || i < 40 }); m = S.fx.find((f) => f.kind === 'muzzle'); if (m) break; }
  return m;
};

// ---- every bro: a muzzle flash in its own shape and colours, a kick, heat on guns that heat up
let noFlash = [], wrongShape = [], noKick = [], noHeat = [];
for (const b of S.BROS.filter((o) => !o.melee)) { // melee bros swing instead (see aim_melee_maps.js)
  yard(); S.P.bro = S.BRO[b.id]; S.P.face = 1; S.P.spec = 0; S.P.heat = 0;
  const g = S.GUNFX[b.id], m = fireOnce();
  if (!m) { noFlash.push(b.id); continue; }
  if (!g || m.shape !== g.flash || m.c1 !== g.c[1]) wrongShape.push(b.id);
  if (!(S.P.recoil > 0)) noKick.push(b.id);
  if (g && g.heat && !(S.P.heat > 0)) noHeat.push(b.id);
}
check('every bro has a gun style', S.BROS.filter((o) => !o.melee).every((b) => S.GUNFX[b.id] && S.GUNFX[b.id].flash && S.GUNFX[b.id].c.length === 2));
check('every bro fires and makes a muzzle flash', noFlash.length === 0, noFlash.join(' '));
check('each flash has its gun\'s own shape and colour', wrongShape.length === 0, wrongShape.join(' '));
check('every shot kicks the gun back', noKick.length === 0, noKick.join(' '));
check('guns that heat up get hot', noHeat.length === 0, noHeat.join(' '));
const shapes = new Set(S.BROS.map((b) => S.GUNFX[b.id].flash));
check('there are many flash shapes, not one for all', shapes.size >= 6, [...shapes].join(' '));
// ---- casings and vents
yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; let n0 = S.bodies.filter((o) => o.kind === 'shell').length; fireOnce(); step();
check('a bullet gun ejects a casing', S.bodies.filter((o) => o.kind === 'shell').length > n0);
yard(); S.P.bro = S.BRO.tesla; S.P.face = 1; n0 = S.bodies.filter((o) => o.kind === 'shell').length; fireOnce();
check('an energy gun vents sparks instead of a casing', S.bodies.filter((o) => o.kind === 'shell').length === n0 && S.parts().some((p) => p.kind === 'spark'));
// ---- slow guns show a glow as they get ready; hot barrels smoke
yard(); S.P.bro = S.BRO.newton; S.P.face = 1; fireOnce();
check('a slow gun remembers its reload time for the ready glow', S.P.coolMax > 0.3 && S.P.cool > 0, S.P.coolMax.toFixed(2));
yard(); S.P.bro = S.BRO.meitner; S.P.face = 1; for (let i = 0; i < 120; i++) { S.P.inv = 1e9; step({ fire: true }); }
let smoke = 0; for (let i = 0; i < 40; i++) { S.P.inv = 1e9; step(); smoke += S.parts().filter((p) => p.kind === 'smoke').length; }
check('a gun fired hard gets hot and smokes after', S.P.heat > 0.2 && smoke > 0, 'heat ' + S.P.heat.toFixed(2));
// ---- every bro firing for a while, drawn every frame, with quacks and blocks of every kind ahead
let errs = [];
for (const b of S.BROS) {
  yard(); S.P.bro = S.BRO[b.id]; S.P.face = 1; S.P.spec = 3;
  S.setTile(40, 15, 3); S.setTile(41, 14, 2); S.setTile(42, 13, 4); S.setTile(43, 15, 6); quack(34); quack(37, { hp: 30, max: 30 });
  try {
    for (let i = 0; i < 40; i++) { S.P.inv = 1e9; S.P.x = 30 * T; step({ fire: true }, true); }
    S.pressed.special = true; for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: i > 10 }, true); }
    for (let i = 0; i < 20; i++) { S.P.inv = 1e9; step({}, true); } // idle animations
  } catch (e) { errs.push(b.id + ': ' + e.message); }
}
check('rendering every bro firing and using a special throws no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
// ---- pickup guns: flash, spin-up, pump, back-blast, kick
const altFlash = [];
for (const g of Object.keys(S.GUNS)) {
  yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; S.P.alt = { kind: g, ammo: 99 };
  const m = fireOnce(); if (!m || m.shape !== S.GUNFX['alt_' + g].flash) altFlash.push(g);
  try { for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); } } catch (e) { altFlash.push(g + ' ' + e.message); }
}
check('every pickup gun flashes in its own shape and draws', altFlash.length === 0, altFlash.join(' '));
yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; S.P.alt = { kind: 'minigun', ammo: 999 };
const countMg = (frames) => { const s0 = S.P.shots || 0; for (let i = 0; i < frames; i++) { S.P.inv = 1e9; step({ fire: true }); } return (S.P.shots || 0) - s0; };
const early = countMg(20); countMg(60); const late = countMg(20);
check('the minigun spins up: slow at first, then a stream', late > early * 1.6, early + ' then ' + late + ' rounds in 20 frames');
yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; S.P.alt = { kind: 'shotgun', ammo: 9 }; fireOnce(); for (let i = 0; i < 20; i++) step();
check('the shotgun pumps out a red hull', S.bodies.some((o) => o.kind === 'shell' && o.col === '#d9534f'));
yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; S.P.alt = { kind: 'railgun', ammo: 9 }; fireOnce();
check('a heavy shot kicks the camera', S.kick() < 0, 'kick ' + S.kick().toFixed(1));
// ---- impacts: what a shot leaves on steel, earth and a quack
const impactOn = (tile) => {
  yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; S.setTile(36, 15, tile);
  let pops = 0, sparks = 0, smoke2 = 0, holes = 0; // marks are counted as they appear: a broken block takes its marks with it
  for (let i = 0; i < 40; i++) { S.P.inv = 1e9; S.P.x = 30 * T; step({ fire: i < 20 }); pops += S.fx.filter((f) => f.kind === 'pop').length; sparks += S.parts().filter((p) => p.kind === 'spark').length; smoke2 += S.parts().filter((p) => p.kind === 'smoke').length; holes = Math.max(holes, (S.decals.get(15 * S.LW + 36) || []).length); }
  return { pops, sparks, smoke: smoke2, holes };
};
const st = impactOn(3), di = impactOn(1);
check('shots spark off steel', st.pops > 0 && st.sparks > 0 && st.holes > 0, st.pops + ' pops, ' + st.sparks + ' sparks, ' + st.holes + ' marks');
check('shots kick up dust from earth and leave holes', di.smoke > 0 && di.holes > 0, di.smoke + ' smoke, ' + di.holes + ' marks');
yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; const hq = quack(36, { hp: 50, max: 50 }); let flashed = false, pop = false;
for (let i = 0; i < 30; i++) { S.P.inv = 1e9; S.P.x = 30 * T; hq.react = 99; hq.cool = 99; step({ fire: true }); if (hq.flash > 0) flashed = true; if (S.fx.some((f) => f.kind === 'pop')) pop = true; }
check('a hit quack flashes white and the shot pops where it lands', flashed && pop);
// ---- explosions: flash, fireball, shockwave, sparks, smoke, embers, debris and a burnt strip on the ground
yard(); let sc0 = 0; for (const [, a] of S.decals) sc0 += a.length;
S.explode(40 * T, 16 * T - 6, 34, 4, 'p', 0);
const kinds = new Set(S.fx.map((f) => f.kind)), pk = new Set(S.parts().map((p) => p.kind)); let sc1 = 0; for (const [, a] of S.decals) sc1 += a.length;
check('an explosion has a fireball, a ring and a shockwave', kinds.has('flash') && kinds.has('ring') && kinds.has('shock'), [...kinds].join(' '));
check('and sparks, smoke and embers', pk.has('spark') && pk.has('smoke') && pk.has('fire'), [...pk].join(' '));
check('and scorches the ground under it', sc1 - sc0 >= 8, (sc1 - sc0) + ' marks');
yard(); const b1 = S.bodies.length; S.explode(40 * T, 16 * T - 6, 34, 4, 'p', 3);
check('a blast that breaks ground throws debris', S.bodies.filter((o) => o.kind === 'chunk').length >= 3, S.bodies.length - b1 + ' bodies');
// ---- a big kill freezes for a moment with a white burst
yard(); const hv = Object.assign(S.makeEnt({ type: 'heavy', c: 36, from: 0 }), { face: -1, react: 99, cool: 99 }); S.ents.push(hv); S.hitEnemy(hv, 99, 100, 'shot');
check('killing a heavy makes a white burst', S.fx.some((f) => f.kind === 'kill'));
// ---- frame cost: a busy fight (12 quacks, minigun fire, blasts) stepped and drawn every frame
yard(); S.P.bro = S.BRO.einstein; S.P.face = 1; S.P.alt = { kind: 'minigun', ammo: 9999 };
for (let c = 34; c < 58; c += 2) quack(c, { hp: 1e6, max: 1e6 });
for (let i = 0; i < 60; i++) { S.P.inv = 1e9; S.P.x = 30 * T; step({ fire: true }, true); } // warm up
const N = 300, t0 = Date.now();
for (let i = 0; i < N; i++) {
  S.P.inv = 1e9; S.P.x = 30 * T;
  if (i % 20 === 0) S.explode(36 * T + (i % 7) * 20, 16 * T - 6, 30, 1, 'p', 0);
  for (const e of S.ents) { e.react = 99; e.cool = 99; }
  step({ fire: true }, true);
}
const ms = (Date.now() - t0) / N;
check('a busy fight costs under 3 ms a frame to step and draw', ms < 3, ms.toFixed(2) + ' ms, ' + S.parts().length + ' particles, ' + S.bullets.length + ' bullets, ' + S.fx.length + ' effects');
console.log(fails ? fails + ' check(s) failed' : 'all gun and visual checks passed');
process.exit(fails ? 1 : 0);
