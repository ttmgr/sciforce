// Headless checks for round 9 fall damage: the damage table, quacks dropped from a pillar (4 tiles free, 5 tiles 2 hp, then 2 hp a tile),
// a heavy that survives, a dog and a bomber, a jump that lands at the same height, a parachute, the first landing after a spawn, the Moon's
// low gravity, the kill counted for the player, and a quack that walks off a ledge by itself.
// Usage: node science-bros/tests/r9_fall.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, localStorage: { getItem: () => null, setItem: noop }, navigator: { getGamepads: () => [] }, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const DIRT = 1, STEEL = 3;
const run = (n, held = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, held); S.P.inv = 1e9; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } };
// a flat steel floor at row 16 over columns 0-119, nothing else alive, the bro parked at column 4
const flat = (lv = 0) => {
  S.startLevel(lv); S.endCeasefire(); run(1);
  for (let c = 0; c < 130; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? STEEL : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.bullets.length = 0; S.plants.length = 0; S.critters.length = 0;
  S.P.bro = S.BROS[0]; S.P.x = 4 * T; S.P.y = 16 * T - S.P.h - 0.01; S.P.vx = 0; S.P.vy = 0; S.P.mech = null; run(2);
};
const calm = (e) => { e.walking = false; e.walkT = 1e9; e.cool = 1e9; e.react = 1e9; e.face = 1; };
// a quack on a one-block pillar k tiles above the floor at column c; pulling the block out drops it exactly k tiles
const dropFrom = (type, k, c = 60) => {
  S.setTile(c, 16 - k, DIRT);
  const e = S.makeEnt({ type, c, from: 0 }); calm(e); S.ents.push(e); run(4); calm(e);
  const hp0 = e.hp; S.setTile(c, 16 - k, 0);
  for (let i = 0; i < 240 && !(e.dead || (e.onGround && i > 3)); i++) { calm(e); run(1); } run(2);
  return { e, lost: hp0 - Math.max(0, e.hp), dead: e.dead };
};

// 1. the table
check('under 5 tiles is free; 5 tiles cost 2 hp, then 2 hp a tile', S.fallDmg(4.9) === 0 && S.fallDmg(5) === 2 && S.fallDmg(6) === 4 && S.fallDmg(7.5) === 6 && S.fallDmg(10) === 12 && S.FALL.from === 5 && S.FALL.per === 2);

// 2. dropped quacks
{ flat(); const a = dropFrom('grunt', 4); check('a grunt dropped 4 tiles is not hurt', !a.dead && a.lost === 0, 'lost ' + a.lost); }
{ flat(); const a = dropFrom('grunt', 5); check('a grunt (2 hp) dropped 5 tiles dies', a.dead); }
{ flat(); const a = dropFrom('heavy', 6); check('a heavy (20 hp) dropped 6 tiles loses 4 hp and lives', !a.dead && Math.abs(a.lost - 4) < 1e-6, 'lost ' + a.lost); }
{ flat(); const a = dropFrom('heavy', 10); check('dropped 10 tiles it loses 12 hp', !a.dead && Math.abs(a.lost - 12) < 1e-6, 'lost ' + a.lost); }
{ flat(); const a = dropFrom('guru', 5); check('a guru (4 hp) dropped 5 tiles loses 2 hp and lives', !a.dead && Math.abs(a.lost - 2) < 1e-6, 'lost ' + a.lost); }
{ flat(); const a = dropFrom('dog', 6); check('a dog dropped 6 tiles dies', a.dead); }
{ flat(); const a = dropFrom('bomber', 6); check('a bomber dropped 6 tiles goes off', a.dead); }
{ flat(); const k0 = S.stats.kills; dropFrom('grunt', 7); check('the fall kill counts for the player', S.stats.kills === k0 + 1, 'kills ' + S.stats.kills); }

// 3. what costs nothing
{ flat(); const e = S.makeEnt({ type: 'grunt', c: 60, from: 0 }); calm(e); S.ents.push(e); run(4); e.vy = -500; let top = e.y; const y0 = e.y;
  for (let i = 0; i < 200 && !(e.onGround && i > 5); i++) { calm(e); run(1); top = Math.min(top, e.y); } run(2);
  check('a quack thrown 8 tiles up that lands where it stood is not hurt', !e.dead && e.hp === e.max && (y0 - top) / T > 7, 'rose ' + ((y0 - top) / T).toFixed(1) + ' tiles'); }
{ flat(); const e = S.makeEnt({ type: 'grunt', c: 0, y: 2 * T }); e.x = 60 * T; calm(e); S.ents.push(e);
  for (let i = 0; i < 200 && !(e.onGround && i > 5); i++) { calm(e); run(1); } run(2);
  check('the first landing after a spawn in the air is free (13 tiles)', !e.dead && e.hp === e.max); }
{ flat(); const e = S.makeEnt({ type: 'para', c: 0, y: 2 * T }); e.x = 60 * T; S.ents.push(e);
  for (let i = 0; i < 900 && e.chute; i++) run(1); run(3);
  check('a paratrooper under its canopy lands unhurt', !e.dead && e.hp === e.max && !e.chute); }
{ flat(); S.setTile(60, 8, DIRT); const e = S.makeEnt({ type: 'para', c: 0, y: 1 * T }); e.x = 60 * T + 3; S.ents.push(e);
  for (let i = 0; i < 900 && e.chute; i++) run(1); calm(e); run(3); const onPillar = e.y < 9 * T; S.setTile(60, 8, 0);
  for (let i = 0; i < 240 && !(e.dead || (e.onGround && i > 3)); i++) { calm(e); run(1); } run(2);
  check('once it has landed, a paratrooper falls like anyone else (8 tiles)', onPillar && e.dead, 'on the pillar ' + onPillar); }

// 4. low gravity: the Moon Base (G 380) scales an 8-tile drop to 3.4 tiles
{ flat(S.MOON); const a = dropFrom('grunt', 8); check('on the Moon an 8-tile drop does not hurt', S.G < 900 && !a.dead && a.lost === 0, "G " + S.G + ", lost " + a.lost); }

// 5. a quack that walks off a ledge by itself
{ flat(); for (let c = 50; c <= 60; c++) S.setTile(c, 9, DIRT); const e = S.makeEnt({ type: 'grunt', c: 58, from: 0 }); calm(e); S.ents.push(e); run(4);
  for (let i = 0; i < 400 && !e.dead; i++) { calm(e); e.kx = 60; run(1); }
  check('a quack pushed off a 7-tile ledge dies on landing', e.dead); }

console.log(fails ? fails + ' check(s) failed' : 'all fall damage checks passed');
process.exit(fails ? 1 : 0);
