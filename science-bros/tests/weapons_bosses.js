// Headless checks for weapon destruction (each weapon breaks blocks its own way), no self-kills (nothing the player
// set off kills him; enemy hazards still do) and boss damage (every bro's main weapon against every boss type: a bot
// at a good range fires for 15 s; every bro must reach about 60% of the median boss damage per second).
// Usage: node science-bros/tests/weapons_bosses.js science-bros/index.html [seconds per boss fight]
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const SECS = +(process.argv[3] || 15);
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
let seed = 7; const M = Object.create(Math); M.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; // seeded, so the numbers repeat
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const DIRT = 1, BRICK = 2, STEEL = 3, CRATE = 4, ICE = 6;
// a flat floor at row 16, nothing else; the bro stands at column 30 facing right
const flat = (bro = 'einstein', inv = 1e9) => {
  seed = 7; S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.bullets.length = 0; S.fx.length = 0;
  S.P.bro = S.BRO[bro]; S.P.x = 30 * T + 3; S.P.y = 16 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = inv; S.P.spec = 0; S.P.alt = null; S.P.shield = 0; S.P.face = 1; step();
  S.P.inv = inv;
};
const wall = (v, c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) S.setTile(c, r, v); };
const broken = (c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { const out = []; for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (!S.tileAt(c, r)) out.push([c, r]); return out; };
const fire = (n, keys = {}) => { for (let i = 0; i < n; i++) { S.P.x = 30 * T + 3; S.P.face = 1; S.P.spec = 0; step(Object.assign({ fire: true }, keys)); } };
const shoot = (bro, mat, frames, alt) => { flat(bro); wall(mat); if (alt) S.P.alt = { kind: alt, ammo: 99 }; fire(frames); return broken(); };

// ---------------------------------------------------------------- 1. every weapon breaks blocks its own way
check('every bro and pickup gun has a destruction entry', S.BROS.every((b) => b.melee || ['einstein', 'curie', 'tesla', 'newton', 'franklin', 'ada', 'darwin', 'galileo', 'turing', 'johnson', 'meitner', 'archimedes', 'mendel', 'pasteur', 'faraday', 'hypatia', 'feynman', 'fleming', 'sagan', 'wegener', 'hubble', 'mendeleev', 'hawking', 'hopper', 'wu', 'hodgkin', 'davinci', 'rutherford', 'nobel', 'bohr', 'lamarr', 'lavoisier', 'goodall', 'jemison', 'oppenheimer', 'semmelweis', 'torricelli', 'volta', 'gauss', 'kelvin', 'huygens', 'nightingale', 'schrodinger'].includes(b.id))
  && ['photon', 'vial', 'zap', 'apple', 'xray', 'card', 'finch', 'sunbeam', 'enigma', 'calc', 'fission', 'drill', 'pea', 'dart', 'weld', 'disc', 'qwave', 'spores', 'dot', 'pwave', 'red', 'hawk', 'bit', 'parity', 'xtal', 'bolt2', 'alpha', 'elemNa', 'tnt', 'leap', 'torp', 'flame', 'hoot', 'plasma', 'neutron', 'hammer', 'scalpel', 'glove', 'pellet', 'rocket', 'mg', 'railgun', 'bubble', 'merc', 'mdrop', 'volt', 'gauss', 'frost', 'wavelet', 'wlet', 'pend', 'petal', 'psi', 'catbox'].every((k) => S.DESTRUCT[k]));
const sigs = new Map(); // a weapon's mark: the holes it leaves in 1.5 s in an earth, a brick, a crate and an ice wall
const mark = (id, alt) => [DIRT, BRICK, CRATE, ICE].map((m) => shoot(id, m, 90, alt).map(([c, r]) => (c - 31) + ':' + r).sort().join(' ')).join(' | ');
for (const b of S.BROS) { const sg = mark(b.id); if (!sigs.has(sg)) sigs.set(sg, []); sigs.get(sg).push(b.id); }
for (const g of ['shotgun', 'rocket', 'minigun', 'railgun']) { const sg = mark('einstein', g); if (!sigs.has(sg)) sigs.set(sg, []); sigs.get(sg).push(g); }
if (process.env.SIGS) for (const [k, v] of sigs) console.log(v.join(',') + ': ' + k);
check('the 46 bros and 4 pickup guns leave many different holes in earth, brick, crate and ice walls', sigs.size >= 22, sigs.size + ' different holes');
let fire0 = shoot('lavoisier', BRICK, 180).length, fire1 = shoot('lavoisier', DIRT, 180).length, fire2 = shoot('lavoisier', CRATE, 180).length;
check('fire does not burn stone or earth, but burns crates', !fire0 && !fire1 && fire2 >= 1, 'brick ' + fire0 + ', earth ' + fire1 + ', crates ' + fire2 + ' broken');
let sun0 = shoot('galileo', DIRT, 120).length, sun1 = shoot('galileo', ICE, 120).length;
check('the sun lens melts ice but only scorches earth', !sun0 && sun1 >= 1, 'earth ' + sun0 + ', ice ' + sun1);
let ac0 = shoot('curie', DIRT, 120).length, ac1 = shoot('curie', BRICK, 120).length;
check('acid vials eat earth far faster than brick', ac0 >= 2 * Math.max(1, ac1), 'earth ' + ac0 + ', brick ' + ac1);
flat('einstein'); wall(BRICK); S.P.alt = { kind: 'railgun', ammo: 9 }; fire(1); let rl = broken();
check('one railgun shot cuts a thin line through a brick wall', rl.length >= 10 && new Set(rl.map(([, r]) => r)).size === 1, rl.length + ' bricks in ' + new Set(rl.map(([, r]) => r)).size + ' row(s)');
let dr = shoot('archimedes', DIRT, 60);
check('the drill bores a tunnel a bro fits through (2 rows tall, 2 deep)', new Set(dr.map(([, r]) => r)).size >= 2 && new Set(dr.map(([c]) => c)).size >= 2, dr.length + ' blocks');
let hm = shoot('anning', BRICK, 60);
check('the fossil hammer tunnels into brick', hm.length >= 3, hm.length + ' bricks');
let tn = shoot('nobel', BRICK, 120);
check('dynamite carves a round crater in brick', new Set(tn.map(([, r]) => r)).size >= 2 && new Set(tn.map(([c]) => c)).size >= 2, tn.length + ' bricks');
let pe = shoot('mendel', BRICK, 60).length, ps = shoot('pasteur', BRICK, 60).length, sc = shoot('vesalius', BRICK, 60).length;
check('light weapons only chip brick (peas, darts, scalpels: none broken in 1 s)', !pe && !ps && !sc, pe + ' ' + ps + ' ' + sc);
let xr = shoot('franklin', DIRT, 6);
check('the x-ray beam cuts two blocks deep along its line', xr.length >= 1 && xr.length <= 3 && new Set(xr.map(([, r]) => r)).size === 1, xr.map((t) => t.join(',')).join(' '));
shoot('davinci', BRICK, 30); const db = 6 - S.hpAt(32, 15); shoot('einstein', BRICK, 30); const ei = 6 - S.hpAt(32, 15);
check('crossbow bolts punch through: the brick behind takes damage too, unlike with a light gun', db > 0 && ei === 0, 'behind: bolt ' + db.toFixed(1) + ', photon ' + ei.toFixed(1));
let sg0 = shoot('sagan', DIRT, 90).length, bo = shoot('bohr', DIRT, 90).length;
check('orbs and quantum shots pass through blocks without breaking them', !sg0 && !bo, sg0 + ' ' + bo);
let sp0 = shoot('fleming', DIRT, 120).length, sp1 = shoot('fleming', CRATE, 120).length;
check('spores rot crates, not earth', !sp0 && sp1 >= 1, 'earth ' + sp0 + ', crates ' + sp1);
let st = 0;
for (const b of S.BROS) st += shoot(b.id, STEEL, 60).length;
for (const g of ['shotgun', 'rocket', 'minigun', 'railgun']) st += shoot('einstein', STEEL, 60, g).length;
check('steel stands up to every weapon', st === 0, st + ' steel blocks broken');

// ---------------------------------------------------------------- 2. nothing the player set off kills him
const pb = (x, y, extra = {}) => S.bullets.push(Object.assign({ x, y, vx: 300, vy: 0, owner: 'p', dmg: 99, tdmg: 0, life: 1, kind: 'pill' }, extra));
const thing = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 15 }), extra); e.y = 16 * T - e.h - 0.01; S.ents.push(e); return e; }; // standing on the floor
const lives = (o, setup, frames = 180) => { flat(o.bro || 'einstein', 0); const d0 = S.stats.deaths; setup(); for (let i = 0; i < frames && S.stats.deaths === d0; i++) { S.P.vx = 0; if (o.fire) S.P.face = 1; step(o.fire ? { fire: true } : {}); } return S.stats.deaths === d0; }; // a death respawns the next bro, so count deaths
const self = [
  ['his own Trinity nuke inside the red ring', { bro: 'oppenheimer' }, () => S.plantNuke(S.P.x + 35, S.P.y + 15, 'p', 0.3)],
  ['a barrel he shoots next to him', {}, () => { const b = thing('barrel', 31); pb(b.x - 6, b.y + 4); }],
  ['a chain of barrels and a fuel tank he set off', {}, () => { thing('barrel', 31); thing('barrel', 29); thing('fueltank', 32); const b = thing('barrel', 33); pb(b.x - 6, b.y + 4); }],
  ['a propane tank he shoots, against a wall', {}, () => { wall(STEEL, 32, 33, 10, 15); const b = thing('propane', 31); pb(b.x - 6, b.y + 4); }],
  ['a mine he shoots', {}, () => { const b = thing('mine', 31); pb(b.x - 6, b.y + 2); }],
  ['a fire he lit under a propane tank', {}, () => { wall(STEEL, 32, 33, 10, 15); wall(STEEL, 28, 33, 13, 13); const t = thing('propane', 31); S.fx.push({ kind: 'fire', x: t.x + 2, y: 16 * T, c: Math.floor((t.x + 2) / T), r: 16, t: 3, max: 3.4, by: 'p' }); }], // as ignite() marks a fire his blast or flame lit
  ['his own blast on a bomber next to him', {}, () => { thing('bomber', 31); S.explode(S.P.x + 28, S.P.y + 8, 12, 99, 'p', 0); }],
  ['Curie\'s vial and its radiation puddle at his feet', { bro: 'curie' }, () => pb(S.P.x + 5, S.P.y + 14, { kind: 'vial', vx: 0, vy: 100, dmg: 4, explode: 30, tp: 3, rad: 22 })],
  ['Nobel\'s dynamite at his feet', { bro: 'nobel' }, () => pb(S.P.x + 5, S.P.y + 14, { kind: 'tnt', vx: 0, vy: 100, dmg: 5, explode: 22, tp: 2.5, fuse: 0.55 })],
  ['Mary Anbro\'s meteor on his head', { bro: 'anning' }, () => pb(S.P.x + 5, S.P.y - 40, { kind: 'bomb', vx: 0, vy: 260, grav: 500, dmg: 20, explode: 60, tp: 5, life: 4 })],
  ['a mech rocket into the wall in front of him', {}, () => { wall(BRICK, 31, 32, 10, 15); pb(S.P.x + 10, S.P.y + 4, { kind: 'rocket', vx: 110, dmg: 8, explode: 30, tp: 4, life: 3 }); }],
  ['Hawking\'s black hole going off on top of him', { bro: 'hawking' }, () => S.fx.push({ kind: 'hole', x: S.P.x + 5, y: S.P.y + 8, t: 0.3, max: 3, eat: 0 })],
  ['Turing\'s ricochets in a box', { bro: 'turing' }, () => { wall(BRICK, 31, 31, 10, 15); wall(BRICK, 28, 28, 10, 15); for (let i = 0; i < 10; i++) pb(S.P.x + 10, S.P.y + 8, { kind: 'enigma', vx: 430, vy: (i - 5) * 30, dmg: 1, life: 1.2, bounces: 3 }); }],
  ['Rutherford\'s alpha particles bouncing back', { bro: 'rutherford' }, () => { wall(BRICK, 31, 31, 10, 15); for (let i = 0; i < 10; i++) pb(S.P.x + 10, S.P.y + 8, { kind: 'alpha', vx: 360, vy: (i - 5) * 20, dmg: 2, life: 1.2, bounce: 2 }); }],
  ['Hypatia\'s disc coming back', { bro: 'hypatia' }, () => pb(S.P.x + 12, S.P.y + 8, { kind: 'disc', vx: 470, dmg: 1.5, life: 2.2, pierce: 99, dir: 1, spin: 0 })],
  ['a grenade he batted back', { bro: 'hooke', fire: true }, () => { S.bullets.push({ x: S.P.x + 16, y: S.P.y + 8, vx: -40, vy: 0, grav: 600, owner: 'e', dmg: 4, life: 9, fuse: 0.5, kind: 'grenade' }); S.P.cool = 0; }],
  ['bricks he cut loose falling on him', {}, () => { wall(BRICK, 30, 34, 5, 5); wall(BRICK, 34, 34, 6, 15); wall(BRICK, 30, 30, 6, 11); pb(33 * T + 2, 15 * T + 8, { tdmg: 99, dmg: 1 }); }],
  ['an icicle he shot down', {}, () => { S.setTile(30, 10, DIRT); const ic = Object.assign(S.makeEnt({ type: 'icicle', c: 30, hang: 10 }), {}); S.ents.push(ic); S.bullets.push({ x: ic.x - 4, y: ic.y + 6, vx: 300, vy: 0, owner: 'p', dmg: 1, tdmg: 0, life: 0.1, kind: 'pill' }); }],
];
for (const [name, o, setup] of self) { const ok = lives(o, setup); check('no self-kill: ' + name, ok, ok ? '' : 'died: ' + S.deathLog.slice(-1)[0]); }
check('a grenade batted back is the player\'s', (() => { flat('hooke', 0); const g = { x: S.P.x + 16, y: S.P.y + 8, vx: -40, vy: 0, grav: 600, owner: 'e', dmg: 4, life: 9, fuse: 2, kind: 'grenade' }; S.bullets.push(g); S.P.cool = 0; step({ fire: true }); return g.owner === 'p'; })());
// enemy hazards still kill
const enemy = [
  ['an enemy blast', () => S.explode(S.P.x + 10, S.P.y + 8, 30, 5, 'env', 2)],
  ['a barrel an enemy blast set off', () => { thing('barrel', 31); S.explode(S.P.x + 60, S.P.y + 8, 40, 5, 'env', 0); }],
  ['a bomber that runs into him', () => { const b = thing('bomber', 33); b.run = true; b.fuse = 0.3; }],
  ['bricks an enemy shot cut loose', () => { wall(BRICK, 30, 34, 5, 5); wall(BRICK, 34, 34, 6, 15); wall(BRICK, 30, 30, 6, 11); S.bullets.push({ x: 33 * T + 2, y: 15 * T + 8, vx: 300, vy: 0, owner: 'e', dmg: 1, tdmg: 99, life: 1, kind: 'pill' }); }],
  ['an icicle that falls by itself', () => { S.setTile(30, 10, DIRT); const ic = S.makeEnt({ type: 'icicle', c: 30, hang: 10 }); ic.falling = true; S.ents.push(ic); }],
  ['a nuke he did not throw, inside its ring', () => S.plantNuke(S.P.x + 35, S.P.y + 15, 'npc', 0.3)],
  ['acid', () => { S.setTile(30, 16, 5); S.setTile(31, 16, 5); S.P.y += 6; }],
  ['falling off the map', () => { S.P.y = 22 * T + 4; }],
  ['an enemy bullet', () => S.bullets.push({ x: S.P.x + 40, y: S.P.y + 8, vx: -300, vy: 0, owner: 'e', dmg: 1, tdmg: 0.4, life: 2, kind: 'pill' })],
];
for (const [name, setup] of enemy) check('still deadly: ' + name, !lives({}, setup));

// ---------------------------------------------------------------- 3. boss damage per second, per bro and boss type
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const solid = (v) => v !== 0 && v !== 5 && v !== 7;
const RANGE = { anning: 22, vesalius: 18, hooke: 34, archimedes: 20, faraday: 60, fleming: 55, hypatia: 90, galileo: 110, tesla: 120, meitner: 100, wegener: 90, goodall: 90, lavoisier: 60 }; // a good range for short weapons; 110 px for the rest
const pick = {};
const LIST = []; for (let l = 0; l < S.nLevels; l++) LIST.push([l, true]); LIST.push([1, false]); LIST.push([S.MOON, true]);
for (const [l, fin] of LIST) { S.startLevel(l); const B = S.ents.find((e) => BOSSES.includes(e.type) && !!e.final === fin); if (B && !pick[B.type]) pick[B.type] = [l, fin]; }
const fight = (id, type) => {
  const [lvl, fin] = pick[type];
  seed = 7; S.startLevel(lvl); S.endCeasefire(); S.finishObjectives(); step();
  const B = S.ents.find((e) => BOSSES.includes(e.type) && !!e.final === fin);
  S.ents.forEach((e) => { if (e !== B && e.type !== 'flag') e.dead = true; });
  S.P.bro = S.BRO[id]; S.P.alt = null; S.P.x = (B.trig + 2) * T; S.P.y = 2 * T;
  const total = () => Math.max(0, B.hp) + (B.vats || []).reduce((a, o) => a + (o.dead ? 0 : Math.max(0, o.hp)), 0);
  const start = total(); let last = start, stillT = 0, pref = RANGE[id] || 110, dist = pref, jumpT = 0, spike = 0, act = 0;
  const dists = [pref, pref * 0.6, pref * 1.4];
  for (let f = 0; f < SECS * 60 && !(B.dead || B.doomed || B.dying > 0); f++) {
    S.P.inv = 1e9; S.P.spec = 0; S.P.alive = true;
    const v = (B.vats || []).find((o) => !o.dead), t = v || B, tx = t.x + t.w / 2, ty = t.y + t.h / 2;
    const tot = total(); if (last - tot > spike) spike = last - tot; if (tot < last - 0.01) stillT = 0; else stillT += 1 / 60; last = tot;
    if (B.active) act += 1 / 60;
    if (B.active && stillT > 2) { // no damage for 2 s: stand where a player would, at the target's height, at another range
      stillT = 0; dist = dists[(dists.indexOf(dist) + 1) % 3];
      let best = null, bs = 1e9;
      for (let c = B.ax0 || 0; c <= (B.ax1 || 60); c++) for (let r = 2; r < 21; r++) {
        if (!solid(S.tileAt(c, r)) || solid(S.tileAt(c, r - 1)) || solid(S.tileAt(c, r - 2))) continue;
        const sc = Math.abs(r * T - 8 - ty) + Math.abs(Math.abs(c * T + 8 - tx) - dist) * 0.6; if (sc < bs) { bs = sc; best = [c, r]; }
      }
      if (best) { S.P.x = best[0] * T + 3; S.P.y = best[1] * T - 15.01; S.P.vx = 0; S.P.vy = 0; }
    }
    const px = S.P.x + 5, py = S.P.y + 8, dx = tx - px, want = tx - Math.sign(dx || 1) * dist, keys = { fire: true };
    if (Math.abs(want - px) > 12) { if (want > px) keys.right = true; else keys.left = true; }
    jumpT -= 1 / 60;
    if (jumpT <= 0 && (ty < py - 20 || S.P.wall)) { S.pressed.jump = true; keys.jump = true; jumpT = 0.7; } else if (jumpT > 0.4) keys.jump = true;
    if (ty < py - 20) keys.up = true;
    step(keys);
    if (Math.abs(want - px) <= 12) S.P.face = dx >= 0 ? 1 : -1;
  }
  const dead = B.dead || B.doomed || B.dying > 0;
  return { dps: (dead ? start : start - total()) / Math.max(1, act), spike };
};
const rows = {}; let maxSpike = 0;
for (const b of S.BROS) { rows[b.id] = {}; for (const ty of BOSSES) { const r = fight(b.id, ty); rows[b.id][ty] = r.dps; maxSpike = Math.max(maxSpike, r.spike); } }
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const medBoss = {}; for (const ty of BOSSES) medBoss[ty] = med(S.BROS.map((b) => rows[b.id][ty]));
const rel = {}; for (const b of S.BROS) rel[b.id] = med(BOSSES.map((t) => rows[b.id][t] / (medBoss[t] || 1))); // a bro's damage per second relative to the median bro, the median over the boss types
console.log('boss damage per second (' + SECS + ' s per fight; rel = against the median bro)');
console.log('bro'.padEnd(12) + BOSSES.map((t) => t.slice(0, 7).padStart(8)).join('') + '   rel  x');
for (const b of S.BROS) console.log(b.id.padEnd(12) + BOSSES.map((t) => rows[b.id][t].toFixed(2).padStart(8)).join('') + rel[b.id].toFixed(2).padStart(6) + ('' + (S.BOSS_MUL[b.id] || 1)).padStart(5));
console.log('median'.padEnd(12) + BOSSES.map((t) => medBoss[t].toFixed(2).padStart(8)).join(''));
const order = Object.entries(rel).sort((a, b) => a[1] - b[1]);
console.log('weakest five: ' + order.slice(0, 5).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ') + '; strongest: ' + order.slice(-3).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', '));
check('every bro deals at least about 60% of the median boss damage per second', order[0][1] >= 0.6, order[0][0] + ' ' + order[0][1].toFixed(2));
check('no boss loses 40 hp in one frame', maxSpike <= 40, maxSpike.toFixed(1) + ' hp at most');
check('the strongest weapon stays under 3.5x the median, so bosses are no walkover', order[order.length - 1][1] < 3.5, order[order.length - 1][0] + ' ' + order[order.length - 1][1].toFixed(2));

console.log(fails ? fails + ' check(s) failed' : 'all weapon, self-kill and boss damage checks passed');
process.exit(fails ? 1 : 0);
