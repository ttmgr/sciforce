// Headless checks for the bro added in round 8 (Dr Reskbro): 53 bros, wired into every table, the Squiggle signal (a hitscan chain drawn as a nanopore trace),
// Gene Sequencing (a scan sweep, every foe on screen falls into A C G T letters, capped hit on bosses, no harm to him).
// Usage: node science-bros/tests/bros_r8.js science-bros/index.html
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
// every canvas gets its own context; while the script loads, each fillRect is recorded with its colour, so a sprite's
// pixels can be hashed. drawLog collects what render() draws.
let rec = true, drawLog = null;
const grad = () => ({ addColorStop: noop });
const mkCtx = (ops) => {
  const t = {}, fillRect = (x, y, w, h) => { if (rec) ops.push(t.fillStyle + '@' + x + ',' + y + ',' + w + ',' + h); }, drawImage = (img) => { if (drawLog) drawLog.add(img); };
  return new Proxy(t, {
    get: (o, k) => (k in o ? o[k] : k === 'fillRect' ? fillRect : k === 'drawImage' ? drawImage : k === 'createLinearGradient' || k === 'createRadialGradient' ? grad : noop),
    set: (o, k, v) => { o[k] = v; return true; },
  });
};
const mkEl = () => { const el = { ops: [], addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} }; const c = mkCtx(el.ops); el.getContext = () => c; return el; };
const game = mkEl();
const doc = { getElementById: () => game, createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
let seed = 7; const M = Object.create(Math); let real = false; M.random = () => { if (real) return Math.random(); seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; // seeded, so the numbers repeat
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb); rec = false;
const S = win.__SB__, T = S.T;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0, passes = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (ok) passes++; else fails++; };
const DIRT = 1, BRICK = 2, STEEL = 3, CRATE = 4, ICE = 6;

const flat = (bro, inv = 1e9) => { // a flat floor at row 16, nothing else; the bro stands at column 30 facing right
  seed = 7; S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.bullets.length = 0; S.fx.length = 0;
  S.P.bro = S.BRO[bro]; S.P.x = 30 * T + 3; S.P.y = 16 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = inv; S.P.spec = 0; S.P.alt = null; S.P.shield = 0; S.P.lamp = 0; S.P.lens = 0; S.P.fib = 0; S.P.face = 1; S.P.volt = 0; step();
  S.P.inv = inv;
};
const quack = (c, extra = {}, type = 'grunt') => { const e = Object.assign(S.makeEnt({ type, c, from: 15 }), { face: -1, react: 99, cool: 99 }, extra); e.y = 16 * T - e.h - 0.01; S.ents.push(e); return e; };
const calm = (...qs) => qs.forEach((q) => { q.react = 99; q.cool = 99; });
const wall = (v, c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) S.setTile(c, r, v); };
const hpSum = (c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { let d = 0; for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) d += S.tileAt(c, r) ? S.hpAt(c, r) : 0; return d; };
const cutBy = (id, mat, n, special) => { // how much of a wall of this material a bro's weapon (or special) damaged in n frames
  flat(id); wall(mat); const h0 = hpSum(); if (special) { S.P.spec = 3; S.pressed.special = true; }
  for (let i = 0; i < n; i++) { S.P.x = 30 * T + 3; S.P.face = 1; step(special ? {} : { fire: true }); S.P.inv = 1e9; }
  return h0 - hpSum();
};
const hash = (c) => crypto.createHash('md5').update(c.ops.join(';')).digest('hex').slice(0, 10);
const colours = (c) => new Set(c.ops.map((o) => o.split('@')[0]));
const kinds = (k) => S.bullets.filter((b) => b.kind === k && !b.dead);
const settle = (n) => { for (let i = 0; i < n; i++) { S.P.vx = 0; step(); } };

const id = 'reska', B = () => S.BRO[id];
const sq = () => S.fx.filter((f) => f.kind === 'squig');

// ---------------------------------------------------------------- 1. the roster and the tables
check('there are 53 bros', S.BROS.length === 53, S.BROS.length + ' bros');
check('Dr Reskbro exists once, is ranged and listed before the melee bros', !!B() && S.BROS.filter((b) => b.id === id).length === 1 && !B().melee && S.BROS.indexOf(B()) < S.BROS.findIndex((b) => b.melee));
check('name, weapon, special, formula, gun colour and palette are filled and ASCII', ['name', 'weapon', 'wdesc', 'special', 'sdesc', 'formula', 'gun'].every((k) => /^[\x20-\x7e]{3,}$/.test(B()[k])) && !!B().pal && B().name === 'Dr Reskbro' && B().weapon === 'Squiggle signal' && B().special === 'Gene Sequencing');
check('his weapon and special are different from every other bro\'s', S.BROS.filter((b) => b.weapon === B().weapon).length === 1 && S.BROS.filter((b) => b.special === B().special).length === 1);
check('head rows, a look with a known item, sprites, rig and white frames', !!S.HEADS[id] && !!S.LOOKS[id] && !!S.BRO_ITEM[S.LOOKS[id][0]] && !!B().spr && !!B().rig && !!B().rig.white && !!B().white);
check('a GUNFX entry, a kill line, a special line and a respawn line', !!S.GUNFX[id] && !!S.BRO_LINES[id] && S.BRO_LINES[id].k.length <= 24 && S.BRO_LINES[id].s.length > 8 && S.BRO_LINES[id].r.length > 8);
{ const cases = (src.match(/case 'reska':/g) || []).length; check('his own case in the weapon switch, the special switch and the held-gun drawing', cases === 3, cases + ' cases'); }
check('3 specials per life', S.specMax(B()) === 3);
{ const t = JSON.stringify([B().name, B().wdesc, B().sdesc, B().formula, S.BRO_LINES[id]]); check('no employer or personal detail in his text', !/allianz|fortlane|askeras|tim\b|munich|phd/i.test(t)); }

// ---------------------------------------------------------------- 2. the art
{ const ups = S.BROS.map((b) => hash(b.rig.up[0])), sprs = S.BROS.map((b) => hash(b.spr[0][0]));
  check('all 53 upper-body sprites and small sprites are different', new Set(ups).size === 53 && new Set(sprs).size === 53);
  check('no other bro has his head rows', S.BROS.filter((b) => S.HEADS[b.id].join('/') === S.HEADS[id].join('/')).length === 1);
  check('the upper body uses at least 9 colours', colours(B().rig.up[0]).size >= 9); }
{ const errs = []; for (const pose of ['stand', 'run', 'jump', 'climb', 'aim', 'firing', 'special']) {
    flat(id); if (pose === 'run') { S.P.vx = 100; S.P.rp = 2; } if (pose === 'jump') { S.P.onGround = false; S.P.vy = -100; } if (pose === 'climb') S.P.climb = true; if (pose === 'aim') S.P.aim = 0.7;
    if (pose === 'firing') { quack(36); for (let i = 0; i < 12; i++) step({ fire: true }); } if (pose === 'special') { quack(36); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 12; i++) step({ fire: true }); }
    S.P.inv = 0; try { S.render(0); } catch (e) { errs.push(pose + ': ' + e.message); } }
  check('he draws in every pose, firing and during his special without an error', !errs.length, errs.join(' | ')); }

// ---------------------------------------------------------------- 3. the squiggle
{ flat(id); const q = quack(40); const hp0 = q.hp; S.P.cool = 0; step({ fire: true });
  check('one shot hurts the quack in front and draws a squiggle', q.hp < hp0 && sq().length === 1 && sq()[0].poly.length > 6, (hp0 - q.hp) + ' dmg'); }
{ flat(id); quack(40); S.P.cool = 0; step({ fire: true }); const p = sq()[0].poly, ys = p.map((a) => a[1]);
  const jumps = p.slice(1).filter((a, i) => Math.abs(a[1] - p[i][1]) > 4).length, flatSteps = p.slice(1).filter((a, i) => Math.abs(a[1] - p[i][1]) < 2.5).length;
  check('it reads as a squiggle plot: many sharp jumps joined by short flat dwells, not a smooth arc', jumps >= 4 && flatSteps >= 4 && Math.max(...ys) - Math.min(...ys) > 8, jumps + ' jumps, ' + flatSteps + ' dwells'); }
{ flat(id); const a = quack(38), b = quack(42), c = quack(46); S.P.cool = 0; step({ fire: true });
  check('it arcs from the first quack to the ones near it (chain)', a.hp < a.max && b.hp < b.max && c.hp < c.max, [a, b, c].map((q) => q.hp.toFixed(1)).join()); }
{ flat(id); const a = quack(38), b = quack(42); wall(STEEL, 40, 40, 10, 15); a.x = 38 * T; b.x = 42 * T; S.P.cool = 0; step({ fire: true });
  check('it only jumps along clear lines: a wall between two quacks stops the chain', a.hp < a.max && b.hp === b.max, a.hp + ' / ' + b.hp); }
{ const dps = (bid) => { flat(bid); const q = quack(40, { hp: 9999, max: 9999 }); q.x = 40 * T; for (let i = 0; i < 180; i++) { calm(q); q.x = 40 * T; q.kx = 0; q.stun = 0; step({ fire: true }); } return (9999 - q.hp) / 3; };
  const r = dps(id), e = dps('einstein'); check('modest in power: no more damage per second than Einstein\'s photon pistol', r > 2 && r <= e * 1.05, r.toFixed(1) + ' vs ' + e.toFixed(1)); }
{ flat(id, 0); wall(BRICK, 31, 32, 10, 15); const d0 = S.stats.deaths; for (let i = 0; i < 200; i++) { S.P.vx = 0; step({ fire: true }); } check('point blank at a wall, holding fire, no death', S.stats.deaths === d0 && S.P.alive); }
{ flat(id); S.render(0); S.P.alt = { kind: 'shotgun', ammo: 9 }; S.P.cool = 0; const q = quack(40); step({ fire: true }); check('a pickup gun replaces the squiggle as for every bro', sq().length === 0); }

// ---------------------------------------------------------------- 4. Gene Sequencing
const seqGo = () => { S.P.spec = 3; S.pressed.special = true; step(); };
const sweep = (n = 70) => { for (let i = 0; i < n; i++) { S.P.inv = 1e9; step(); } };
{ flat(id); seqGo(); check('the special starts a scan sweep and costs one of three', S.seqs().length === 1 && S.fx.some((f) => f.kind === 'seqscan') && S.P.spec === 2); }
{ flat(id); S.P.spec = 3; for (let k = 0; k < 4; k++) { S.pressed.special = true; step(); } check('three per life: the fourth press does nothing', S.P.spec === 0 && S.seqs().length === 3); }
{ flat(id); S.cam.x = S.P.x - 200; const qs = [34, 38, 42].map((c) => quack(c)), far = quack(110), trt = S.makeEnt({ type: 'turret', c: 44, from: 15 }); S.ents.push(trt);
  const crate = S.makeEnt({ type: 'guncrate', c: 36, from: 15 }); S.ents.push(crate); const tg = S.makeEnt({ type: 'target', c: 46, from: 15, skin: 'vat' }); S.ents.push(tg);
  const t0 = S.tileAt(40, 17), score0 = S.score ? S.score() : 0; seqGo(); S.cam.x = S.P.x - 200; const lettersSeen = []; for (let i = 0; i < 70; i++) { S.P.inv = 1e9; S.cam.x = S.P.x - 200; step(); lettersSeen.push(...S.parts().filter((p) => p.kind === 'base').map((p) => p.ch)); }
  check('every foe on screen dies, including a turret', qs.every((q) => q.dead) && trt.dead);
  check('a quack off screen, a crate and an objective target are unaffected', !far.dead && !crate.dead && !tg.dead);
  check('they fall apart into the letters A, C, G and T, each with its own colour, not gore', ['A', 'C', 'G', 'T'].every((ch) => lettersSeen.includes(ch)) && new Set(S.parts().filter((p) => p.kind === 'base').map((p) => p.col)).size >= 3 && !S.bodies.some((b) => b.kind === 'corpse' || b.kind === 'gib'));
  check('no blocks break and the player is unhurt', S.P.alive && S.tileAt(40, 17) === t0); }
{ flat(id, 0); const d0 = S.stats.deaths; S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); const ex = quack(31); ex.x = S.P.x + 8; seqGo(); sweep(80); S.P.inv = 0; check('he is not hurt by his own special, even with a foe beside him', S.P.alive && S.stats.deaths === d0); }
{ flat(id); S.cam.x = S.P.x - 200; const dr = S.makeEnt({ type: 'camdrone', c: 40, from: 15 }); S.ents.push(dr); dr.y = 10 * T; seqGo(); for (let i = 0; i < 70; i++) { S.P.inv = 1e9; S.cam.x = S.P.x - 200; step(); } check('a drone counts as a foe', dr.dead); }
{ const hit = () => { flat(id); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); const b = S.makeEnt({ type: 'boss', c: 36, from: 15 }); b.active = true; S.ents.push(b); const hp0 = b.hp; S.cam.x = S.P.x - 200; seqGo(); for (let i = 0; i < 120; i++) { S.P.inv = 1e9; S.cam.x = S.P.x - 200; step(); } return [hp0 - b.hp, b.dead, hp0]; };
  const [d, dead, hp0] = hit(); check('a boss takes a big capped hit spread over frames, not erasure in one press', d > 0.1 * hp0 && d <= 60.01 && !dead, d.toFixed(1) + ' of ' + hp0);
  flat(id); const b = S.makeEnt({ type: 'boss', c: 36, from: 15 }); b.active = true; S.ents.push(b); S.cam.x = S.P.x - 200; seqGo(); const h1 = b.hp; step(); check('and nothing happens to him on the first frame', b.hp >= h1 - 1e-6 && !b.dead); }

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' round 8 bro checks passed');
process.exit(fails ? 1 : 0);
