// Headless checks for the physics layer: collapse, ragdolls, gibs, punch, propane.
// Usage: node science-bros/tests/physics.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
S.setRamp(false); // these checks need each level exactly as built, without the campaign difficulty curve
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (i % 10 === 0) S.render(i / 60); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const solid = (c, r) => { const v = S.tileAt(c, r); return v !== 0 && v !== 5; };
const fresh = () => { S.reset(); run(1); S.P.inv = 1e9; };
const grunts = () => S.ents.filter((e) => e.type === 'grunt' && !e.dead);
const breakAll = (cells) => cells.forEach(([c, r]) => S.damageTile(c, r, 999));

// 1. the level as built has nothing floating
fresh();
check('no floating tiles at start', S.checkCollapse() === 0);

// 2. watchtower: cut both wooden legs and it comes down onto the cliff top
fresh();
const top = S.ents.find((e) => e.type === 'grunt' && Math.abs(e.x / T - 126) < 1 && e.y < 5 * T);
S.P.x = 100 * T;
breakAll([[124, 7], [128, 7]]);
run(150);
check('watchtower platform left row 4', !solid(124, 4) && !solid(126, 4) && !solid(128, 4));
check('watchtower bricks landed on the cliff', solid(125, 7) && solid(127, 7));
check('quack on the tower fell or died', !top || top.dead || top.y > 5 * T, top ? 'y row ' + (top.y / T).toFixed(1) : 'none');

// 3. shooting a quack leaves a ragdoll that comes to rest on the floor
fresh();
let g = (() => { const q = S.makeEnt({ type: 'grunt', c: 17, from: 0 }); S.ents.push(q); return q; })();
S.P.x = 9 * T;
S.hitEnemy(g, 99, 160, 'shot');
const corpse = S.bodies.find((b) => b.kind === 'corpse');
check('corpse spawned', !!corpse);
check('corpse flies in the shot direction', corpse && corpse.vx > 100, corpse && 'vx ' + corpse.vx.toFixed(0));
run(240);
check('corpse came to rest', corpse.rest === true);
check('corpse rests on top of the ground', !solid(Math.floor(corpse.x / T), Math.floor(corpse.y / T)) && corpse.y < 16 * T, 'y ' + corpse.y.toFixed(1));
check('blood left on tiles', S.decals.size > 0, S.decals.size + ' tiles stained');

// 4. explosions tear quacks into gibs
fresh();
g = grunts().find((e) => Math.abs(e.x / T - 24) < 1);
S.P.x = 4 * T;
S.explode(g.x + 5, g.y + 8, 30, 6, 'p', 0);
check('explosion gibs a quack', S.bodies.filter((b) => b.kind === 'gib').length >= 4);

// 5. bunker: cut the left roof off from the girder and the door, and it drops
fresh();
S.P.x = 30 * T;
breakAll([[50, 9], [50, 10], [44, 13], [44, 14], [44, 15]]);
run(180);
check('left bunker roof collapsed', !solid(47, 9) && !solid(47, 10));
check('roof right of the girder still up', solid(60, 9) && solid(60, 10));

// 6. acid bridge: cut the crates under the tower and it drops, half onto a steel pile, half into the acid
fresh();
S.P.x = 70 * T;
const turret = S.ents.find((e) => e.type === 'turret' && Math.abs(e.x / T - 88) < 1);
const ty0 = turret.y;
breakAll([[88, 16], [89, 16]]);
run(240);
check('tower fell out of rows 12-15', !solid(88, 12) && !solid(89, 12));
check('turret on the tower came down', turret.dead || turret.y > ty0 + 8, 'dropped ' + (turret.y - ty0).toFixed(0) + ' px');
check('steel piles still stand in the acid', solid(80, 17) && solid(96, 17));

// 7. punch sends a quack flying
fresh();
g = (() => { const q = S.makeEnt({ type: 'grunt', c: 17, from: 0 }); S.ents.push(q); return q; })();
S.P.x = g.x - 11; S.P.y = g.y; S.P.face = 1; S.P.mcool = 0;
S.pressed.melee = true; run(1);
const flung = S.bodies.find((b) => b.kind === 'corpse');
check('punch kills and launches', g.dead && flung && flung.vx > 250, flung && 'vx ' + flung.vx.toFixed(0));

// 8. shot propane tank rockets upward, then blows
fresh();
const tank = S.ents.find((e) => e.type === 'propane');
S.ents.forEach((e) => { if (e !== tank && Math.abs(e.x - tank.x) < 8 * T) e.dead = true; }); // nothing in its flight path
const y0 = tank.y;
S.P.x = 4 * T;
S.hitEnemy(tank, 1, 90);
let minY = y0, steps = 0;
while (!tank.dead && steps < 200) { run(1); minY = Math.min(minY, tank.y); steps++; }
check('propane flew up', y0 - minY > 16, 'rose ' + (y0 - minY).toFixed(0) + ' px');
check('propane exploded', tank.dead, steps + ' frames');

console.log(fails ? fails + ' check(s) failed' : 'all physics checks passed');
process.exit(fails ? 1 : 0);
