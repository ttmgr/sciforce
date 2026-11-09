// Headless checks that enemies do not hit the bro through walls: a blast kills only with a clear path (head, middle or feet,
// measured after the blast has carved the terrain), direct-fire shots and bursts stop when the line is blocked, lobbed shots
// still arc over, and boss fights keep the old rules.
// Usage: node science-bros/tests/walls.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, localStorage: { getItem: () => null, setItem: noop }, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const DIRT = 1, BRICK = 2, STEEL = 3;
const step = (n = 1) => { for (let i = 0; i < n; i++) { S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } };
// a flat floor at row 16, the bro at column 30, nothing else alive, mortal
const flat = () => {
  S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.bullets.length = 0;
  S.P.bro = S.BROS[0]; S.P.x = 30 * T + 3; S.P.y = 16 * T - S.P.h - 0.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = 0; S.P.alive = true; step(); S.P.inv = 0;
};
const wall = (v, c, r0 = 0, r1 = 15) => { for (let r = r0; r <= r1; r++) S.setTile(c, r, v); };
const blast = (x, tp = 0, y = 15 * T) => { S.P.inv = 0; S.explode(x, y, 80, 0, 'e', tp); return !S.P.alive; };
const px = 30 * T + 8;
// 1. blasts
flat(); check('a blast with no wall kills', blast(px + 56));
flat(); wall(STEEL, 32); check('the same blast behind a full-height steel wall does not kill', !blast(px + 56) && S.P.alive);
flat(); wall(STEEL, 32); check('a blast on the player\'s own side of the wall still kills', blast(px + 20));
flat(); wall(BRICK, 32); check('a blast that opens a brick wall kills (the wall is carved first)', blast(px + 56, 30));
flat(); wall(BRICK, 32); check('the same blast with too little force leaves the brick standing and does not kill', !blast(px + 56, 0));
flat(); wall(STEEL, 32); check('a steel wall that the blast cannot dent still protects when tp is set', !blast(px + 56, 3));
flat(); S.setTile(32, 15, STEEL); check('a one-tile low wall does not give false safety (head and middle are exposed)', blast(px + 56, 0, 14 * T + 8));
flat(); S.setTile(34, 15, STEEL); check('a blast centred inside a tile still counts as reaching the open side', blast(34 * T + 8, 0));
flat(); wall(STEEL, 32); S.P.inv = 0; S.explode(px + 56, 15 * T, 80, 0, 'p', 0); check('the player\'s own blast is unchanged (never kills)', S.P.alive);
// 2. direct fire stops at a wall, lobbed shots do not
const fired = (type, cFoe, frames, blocked) => {
  flat(); const e = S.makeEnt({ type, c: cFoe, from: 15 }); e.y = 16 * T - e.h - 0.01; e.face = -1; e.react = 0; e.provoked = true; S.ents.push(e);
  if (blocked) wall(STEEL, 34, 0, 15);
  const seen = new Set(); for (let i = 0; i < frames; i++) { S.P.inv = 1e9; step(); for (const b of S.bullets) if (b.owner === 'e' && !b.dead) seen.add(b); }
  return seen.size;
};
const t0 = fired('turret', 40, 300, false), t1 = fired('turret', 40, 300, true);
check('a turret fires bursts at a clear bro', t0 >= 3, t0 + ' shots');
check('the turret stops once a wall is between them', t1 === 0, t1 + ' shots');
const h0 = fired('heavy', 40, 400, false), h1 = fired('heavy', 40, 400, true);
check('a heavy hoses a clear bro', h0 >= 5, h0 + ' shots');
check('the heavy stops once a wall is between them', h1 === 0, h1 + ' shots');
{ flat(); const e = S.makeEnt({ type: 'turret', c: 40, from: 15 }); e.y = 16 * T - e.h - 0.01; S.ents.push(e); S.P.inv = 1e9;
  for (let i = 0; i < 400 && !S.bullets.some((b) => b.owner === 'e'); i++) step(); wall(STEEL, 36, 0, 15); S.bullets.length = 0; // a wall appears mid-burst
  let later = 0; for (let i = 0; i < 300; i++) { step(); later += S.bullets.filter((b) => b.owner === 'e' && !b.dead).length; }
  check('a wall that appears mid-burst stops the shooting', later === 0, later + ' shots'); }
{ flat(); wall(STEEL, 34, 0, 15); const e = S.makeEnt({ type: 'mortar', c: 40, from: 15 }); e.y = 16 * T - e.h - 0.01; S.ents.push(e);
  const g = { x: 40 * T, y: 10 * T, vx: -60, vy: 0, grav: 600, owner: 'e', dmg: 1, life: 3, kind: 'grenade' }; S.bullets.push(g);
  const before = S.bullets.length; step(); check('a lobbed (gravity) enemy shot is not culled by the wall rule', !g.dead && S.bullets.length >= before); }
// 3. boss fights keep the old rules
flat(); wall(STEEL, 32);
{ const b = S.makeEnt({ type: 'tank', c: 45, from: 15 }); b.active = true; S.ents.push(b);
  check('bossFight is on with an awake boss', S.bossFight());
  check('a boss-fight blast is unchanged: it kills through a wall by distance', blast(px + 56)); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
