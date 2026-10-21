// Headless checks for bigger dogs and ladder tops: a dog is 15x11 (was 12x8) so a level shot from a standing bro hits it,
// and the top of a ladder holds the bro like a floor: he lands on it, stays there, climbs down with Down, and stands on it
// after climbing up.
// Usage: node science-bros/tests/dogs_ladders.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
let seed = 7; const M = Object.create(Math); let real = false; M.random = () => { if (real) return Math.random(); seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; // seeded, so the numbers repeat
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0, passes = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (ok) passes++; else fails++; };
const DIRT = 1, BRICK = 2, STEEL = 3, CRATE = 4, ICE = 6;
const NEW = ['semmelweis', 'torricelli', 'volta', 'gauss'];
const KINDS = { semmelweis: ['bubble'], torricelli: ['merc', 'mdrop'], volta: ['volt'], gauss: ['gauss'] }; // the shot kinds each bro fires
// a flat floor at row 16, nothing else; the bro stands at column 30 facing right
const flat = (bro, inv = 1e9) => {
  seed = 7; S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.bullets.length = 0; S.fx.length = 0;
  S.P.bro = S.BRO[bro]; S.P.x = 30 * T + 3; S.P.y = 16 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = inv; S.P.spec = 0; S.P.alt = null; S.P.shield = 0; S.P.face = 1; S.P.volt = 0; step();
  S.P.inv = inv;
};
const quack = (c, extra = {}) => { const e = Object.assign(S.makeEnt({ type: 'grunt', c, from: 15 }), { face: -1, react: 99, cool: 99 }, extra); e.y = 16 * T - e.h - 0.01; S.ents.push(e); return e; };
const calm = (...qs) => qs.forEach((q) => { q.react = 99; q.cool = 99; });

// ---------------------------------------------------------------- 1. dogs are big enough to hit with a level shot
const dog = (c) => { const e = Object.assign(S.makeEnt({ type: 'dog', c, from: 15 }), { face: -1, react: 99, cool: 99 }); e.y = 16 * T - e.h - 0.01; S.ents.push(e); return e; };
{ flat('einstein'); const d = dog(38); check('a dog is 15 wide and 11 tall', d.w === 15 && d.h === 11, d.w + 'x' + d.h); }
// how far above the dog's floor a bro can be and still hit it with a straight shot (held there, firing level)
const reach = (id) => { let best = -1;
  for (let k = 0; k <= 10; k++) { flat(id); const d = dog(38), hp0 = d.hp; let hit = false;
    for (let i = 0; i < 90 && !hit; i++) { d.vx = 0; d.x = 38 * T; d.react = 99; d.cool = 99; S.P.y = 16 * T - 15.01 - k; S.P.vy = 0; step({ fire: true }); hit = d.dead || d.hp < hp0; }
    if (!hit) break; best = k; }
  return best; };
const straight = (id) => { flat(id); step({ fire: true }); const b = S.bullets.find((q) => q.owner === 'p'); return !!b && !b.grav && Math.abs(b.vy) < 1 && Math.abs(b.vx) > 100; };
const SHOOT = S.BROS.filter((b) => !b.melee && straight(b.id)).map((b) => b.id), R = SHOOT.map((id) => [id, reach(id)]).sort((a, b) => a[1] - b[1]);
console.log('(straight-shooting bros: ' + SHOOT.length + '; px above the floor that still hits: ' + R.map(([id, k]) => id + ' ' + k).join(', ') + ')');
check('a level shot still hits a dog when the bro is 5 px higher than it (median of the straight-shooting bros; 3 px with the old 12x8 dog)', R.length >= 10 && R[R.length >> 1][1] >= 5, 'lowest ' + R[0][0] + ' ' + R[0][1] + ' px, median ' + R[R.length >> 1][1] + ' px');

// ---------------------------------------------------------------- 2. the top of a ladder holds the bro
const LADDER = 7, feet = () => S.P.y + S.P.h, TOP = 10 * T;
const ladder = () => { flat('einstein'); for (let r = 10; r <= 15; r++) S.setTile(40, r, LADDER); };
{ ladder(); S.P.x = 40 * T + 3; S.P.y = 4 * T; S.P.vy = 0; run(60);
  check('a bro who drops onto the top of a ladder lands on it', S.P.onGround && Math.abs(feet() - TOP) < 1, 'feet at ' + (feet() / T).toFixed(2) + ' rows, top at 10');
  run(120); check('and stays there', S.P.onGround && Math.abs(feet() - TOP) < 1, 'feet at ' + (feet() / T).toFixed(2));
  run(30, { down: true }); check('holding Down climbs down the ladder', S.P.ladder && feet() > TOP + 8, 'feet at ' + (feet() / T).toFixed(2) + ', on ladder ' + !!S.P.ladder); }
{ ladder(); S.P.x = 40 * T + 3; S.P.y = 16 * T - 15.01; S.P.vy = 0; run(5);
  run(150, { jump: true }); run(60);
  check('climbing up a ladder ends standing on its top', S.P.onGround && Math.abs(feet() - TOP) < 1, 'feet at ' + (feet() / T).toFixed(2) + ' rows'); }
{ ladder(); S.P.x = 40 * T + 3; S.P.y = 4 * T; S.P.vy = 0; run(60); run(40, { right: true });
  check('walking off the top of a ladder drops back to the floor', S.P.onGround && Math.abs(feet() - 16 * T) < 1 && S.P.x > 41 * T, 'feet at ' + (feet() / T).toFixed(2)); }

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' dog and ladder checks passed');
process.exit(fails ? 1 : 0);
