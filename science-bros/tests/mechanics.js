// Headless checks for the level mechanics (belts, wind, steam vents, lifts, the flood, anti-gravity, cracked floors)
// and for the variety of the stronghold missions: their own pieces, arenas, themes and skylines.
// Usage: node science-bros/tests/mechanics.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T, ACID = 5;
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (i % 10 === 0) S.render(i / 60); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const N = S.nLevels, STRONG = []; for (let l = 5; l < N - 1; l++) STRONG.push(l); // every mission between Flat Earth Station and the Citadel
// a mission with every quack gone and an unkillable bro standing at column c, row r (feet on top of row r)
const lone = (l) => { S.startLevel(l); S.endCeasefire(); run(1); S.ents.forEach((e) => { if (e.type !== 'flag' && e.type !== 'icicle' && !e.final) e.dead = true; }); run(1); S.P.inv = 1e9; };
const stand = (c, r) => { S.P.x = c * T + 3; S.P.y = r * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.cam.x = Math.max(0, S.P.x - 240); };
const dev = (kind, test = () => true) => S.devs.find((d) => d.kind === kind && test(d));

// ---- every stronghold builds sound and has a mechanic of its own
const kinds = new Set();
for (const l of STRONG) {
  S.startLevel(l); const L = S.levelDef(l), tag = (l + 1) + ' ' + L.name;
  check(tag + ': builds with nothing loose and unsupported', S.checkCollapse() === 0);
  let cracks = 0; for (let c = 0; c < 236; c++) for (let r = 0; r < 22; r++) if (S.crumbly(c, r)) cracks++;
  const here = new Set(S.devs.map((d) => d.kind)); if (cracks) here.add('crumble');
  here.forEach((k) => kinds.add(k));
  check(tag + ': has at least one level mechanic', here.size > 0, [...here].join(','));
}
check('at least 6 different mechanics across the strongholds', kinds.size >= 6, [...kinds].join(','));

// ---- variety: no two strongholds are built from the same pieces, each has pieces of its own, arenas differ
const segs = STRONG.map((l) => S.levelDef(l).build.segs.map((s) => s[0]));
check('no two strongholds share the same sequence of pieces', new Set(segs.map((s) => s.join('>'))).size === segs.length);
const count = {}; segs.forEach((s) => new Set(s).forEach((k) => (count[k] = (count[k] || 0) + 1)));
segs.forEach((s, i) => { const own = new Set(s.filter((k) => count[k] === 1)); check((STRONG[i] + 1) + ' ' + S.levelDef(STRONG[i]).name + ': at least 3 pieces no other mission uses', own.size >= 3, [...own].join(',')); });
const arenas = STRONG.map((l) => S.levelDef(l).build.arena.kind);
check('the strongholds fight their bosses in at least 7 kinds of arena', new Set(arenas).size >= 7, arenas.join(','));
check('at least 2 new arena kinds', arenas.filter((a) => !['flat', 'towers', 'sand', 'stage'].includes(a)).length >= 2);
check('every theme has its own skyline', new Set(S.cityKinds()).size === S.cityKinds().length, S.cityKinds().join(','));

// ---- the three new missions sit before the Citadel, each with a theme of its own and a named boss
for (const l of [N - 4, N - 3, N - 2]) {
  const L = S.levelDef(l), others = []; for (let k = 0; k < N; k++) if (k !== l) others.push(S.levelDef(k).theme);
  S.startLevel(l); const B = S.ents.find((e) => e.final);
  check((l + 1) + ' ' + L.name + ': a theme no other mission uses', !others.includes(L.theme), L.theme);
  check((l + 1) + ' ' + L.name + ': its boss has a name of its own', !!B.bossName && B.max > 0, B.bossName);
}

// ---- conveyor belts carry a bro and a barrel
lone(9);
const belt = dev('belt', (d) => d.r === 16 && d.dir === 1);
stand(belt.c0 + 2, 16); let x0 = S.P.x; run(60);
check('a conveyor belt carries a bro standing on it', S.P.x - x0 > 30, ((S.P.x - x0) / T).toFixed(1) + ' tiles in 1 s');
const barrel = S.makeEnt({ type: 'barrel', c: belt.c0 + 6, from: 12 }); S.ents.push(barrel); x0 = barrel.x; stand(belt.c0 - 1, 16); run(60);
check('it carries a barrel too', barrel.x - x0 > 30, ((barrel.x - x0) / T).toFixed(1) + ' tiles');

// ---- wind: calm, then a gust that pushes the bro and bends the shots
lone(5);
const wind = dev('wind');
stand((wind.x0 / T) + 20, 16); wind.t = 0; wind.pow = 0; x0 = S.P.x; run(30);
check('in the calm the wind does not push', Math.abs(S.P.x - x0) < 2, (S.P.x - x0).toFixed(1));
wind.t = 4.6; wind.pow = 1; stand((wind.x0 / T) + 20, 16); x0 = S.P.x; run(30);
check('a gust pushes a standing bro', (S.P.x - x0) * wind.dir > 15, (S.P.x - x0).toFixed(1) + ' px');
wind.t = 4.6; wind.pow = 1; const shot = { x: S.P.x + 40, y: 10 * T, vx: 0, vy: 0, owner: 'e', dmg: 0, tdmg: 0, life: 1, kind: 'pill' }; S.bullets.push(shot); const sx = shot.x; run(10);
check('a gust bends the quacks\' shots', (shot.x - sx) * wind.dir > 5, (shot.x - sx).toFixed(1) + ' px');
check('the wind shows streaks before a gust', (wind.t = 3.5, run(1), wind.warn === true));

// ---- steam vents: a hiss, then a blast that throws the bro high
lone(12);
const vent = dev('vent', (d) => d.r === 16);
stand(vent.c, 16); S.P.x = vent.c * T + 3; vent.t = 1.9; run(2);
check('a vent warns before it blows', vent.st === 1, 'state ' + vent.st);
let y0 = S.P.y, top = y0; for (let i = 0; i < 90; i++) { run(1); top = Math.min(top, S.P.y); }
check('a vent throws the bro up several tiles', y0 - top > 5 * T, ((y0 - top) / T).toFixed(1) + ' tiles');

// ---- lifts: a freight lift carries a bro up, a mine cart carries one across
lone(5);
const lift = dev('lift', (d) => d.ax === d.bx);
S.P.x = lift.x + 4; S.P.y = lift.y - 15.01; S.P.vy = 0; S.cam.x = Math.max(0, S.P.x - 240); y0 = S.P.y; run(240);
check('a lift carries the bro up', y0 - S.P.y > 5 * T && Math.abs(S.P.y + S.P.h - lift.y) < 2, ((y0 - S.P.y) / T).toFixed(1) + ' tiles');
lone(6);
const cart = dev('lift', (d) => d.ay === d.by);
cart.s = 0; cart.dir = 1; cart.wait = 0; run(1); S.P.x = cart.x + 8; S.P.y = cart.y - 15.01; S.P.vy = 0; S.cam.x = Math.max(0, S.P.x - 240); x0 = S.P.x; run(150);
check('a mine cart carries the bro across', S.P.x - x0 > 4 * T && S.P.alive, ((S.P.x - x0) / T).toFixed(1) + ' tiles');
lone(5); const far = dev('lift', (d) => d.ax === d.bx); stand(3, 16); S.cam.x = 0; run(120);
check('a lift far off screen does no work', far.s === 0 && far.wait > 0);

// ---- the flood: acid rises to the red line once you are in, holds, then drains
lone(14);
const flood = dev('flood');
const acidIn = () => { let n = 0; for (let c = flood.c0; c <= flood.c1; c++) for (let r = flood.top; r < 21; r++) if (S.tileAt(c, r) === ACID) n++; return n; };
check('the cistern starts dry', acidIn() === 0 && flood.state === 'idle');
stand(flood.c1 - 3, flood.top); run(60);
check('stepping in starts the flood', flood.state === 'rise');
let most = 0; for (let i = 0; i < 60 * 16 && flood.state === 'rise'; i++) { run(1); most = Math.max(most, acidIn()); }
check('the acid rises up to the red line', flood.state === 'hold' && S.tileAt(flood.c0 + 1, flood.top) === ACID, flood.state + ', ' + most + ' acid tiles');
check('a bro above the red line stays dry', S.P.alive);
for (let i = 0; i < 60 * 14 && acidIn() > 0; i++) run(1);
check('then it drains away again', acidIn() === 0, acidIn() + ' acid tiles left');
lone(14); stand(flood.c0 + 10, 20); S.P.inv = 1e9; for (let i = 0; i < 60 * 8 && S.P.alive; i++) run(1);
check('a bro left on the cistern floor is caught by the acid', !S.P.alive);

// ---- anti-gravity: jumps float much higher inside the field
const jump = () => { const y = S.P.y; let hi = y; S.pressed.jump = true; for (let i = 0; i < 150; i++) { run(1, { jump: i < 25 }); hi = Math.min(hi, S.P.y); } return (y - hi) / T; };
lone(8); stand(10, 16); run(5); const outside = jump();
const grav = dev('grav', (d) => d.x1 - d.x0 > 20 * T), gc = Math.floor(grav.x0 / T) + 11; stand(gc, 16); S.P.x = gc * T + 3; run(5); // between the decks
const inField = S.P.x > grav.x0 && S.P.x < grav.x1, inside = jump();
check('a jump in an anti-gravity field floats far higher', inField && inside > outside * 1.6, outside.toFixed(1) + ' tiles outside, ' + inside.toFixed(1) + ' inside');

// ---- cracked floors give way a moment after you step on them; stalactites drop when you pass under
lone(6);
let cc = -1; for (let c = 20; c < 176 && cc < 0; c++) if (S.crumbly(c, 16) && S.tileAt(c, 16)) cc = c;
stand(cc, 16); S.P.x = cc * T + 3; run(10);
check('a cracked plank still holds for a moment', S.tileAt(cc, 16) !== 0);
run(60);
check('then it gives way', S.tileAt(cc, 16) === 0);
lone(6);
const rock = S.ents.find((e) => e.type === 'icicle' && e.rock);
check('the caverns have stalactites', !!rock);
stand(Math.floor((rock.x + 3) / T), Math.floor((rock.y + 60) / T) + 1); S.P.x = rock.x - 2; S.P.y = S.surf(Math.floor(rock.x / T), Math.floor(rock.y / T) + 1) * T - 15.01; run(20);
check('a stalactite shakes loose when you walk under it', rock.falling || rock.dead || rock.warn > 0);

console.log(fails ? fails + ' check(s) failed' : 'all mechanics checks passed');
process.exit(fails ? 1 : 0);
