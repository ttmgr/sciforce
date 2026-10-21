// Headless checks for the 4 gimmick pickup guns (pogo, glue, fizz, duck) and the 3 one-use specials (confetti, beach,
// spud): each can be picked up, fires, hurts quacks, damages a boss within its BOSS_MUL range, cuts terrain by
// material, never kills the player (point blank at a wall, at his own feet), follows the aim system (or is in NO_AIM),
// a one-use special is used up after one press and the bro's own special comes back, and the frame budget holds.
// Usage: node science-bros/tests/gimmick_weapons.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
let seed = 7; const M = Object.create(Math); M.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; // seeded, so the numbers repeat
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(1); for (const k in S.pressed) S.pressed[k] = false; };
let fails = 0, passes = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (ok) passes++; else fails++; };
const DIRT = 1, BRICK = 2, STEEL = 3, CRATE = 4, ICE = 6;
const GUNS = ['pogo', 'glue', 'fizz', 'duck'], ONCES = ['confetti', 'beach', 'spud'], ALL = GUNS.concat(ONCES);
// a flat floor at row 16, the bro stands at column 30 facing right, nothing else about
const flat = (bro = 'einstein', inv = 1e9) => {
  seed = 7; S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.bullets.length = 0; S.fx.length = 0;
  S.P.bro = S.BRO[bro]; S.P.x = 30 * T + 3; S.P.y = 16 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = inv; S.P.spec = 0; S.P.alt = null; S.P.once = null; S.P.shield = 0; S.P.face = 1; S.P.aim = 0; step();
  S.P.inv = inv;
};
const wall = (v, c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) S.setTile(c, r, v); };
const broken = (c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { let n = 0; for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (!S.tileAt(c, r)) n++; return n; };
const grunt = (c, extra = {}) => { const e = Object.assign(S.makeEnt({ type: 'grunt', c, from: 0 }), { face: -1, react: 99, cool: 99, hp: 40, max: 40 }, extra); e.y = 16 * T - e.h - 0.01; S.ents.push(e); return e; };
const arm = (id) => { if (S.GUNS[id]) S.P.alt = { kind: id, ammo: 99 }; else S.P.once = id; };
// one frame of using a gun (hold fire, trigger ready) or a special (press it)
const use = (id, keys = {}) => { S.P.x = 30 * T + 3; S.P.face = 1; S.P.cool = 0; if (S.P.alt) S.P.alt.ammo = 99; if (ONCES.includes(id)) { S.pressed.special = true; step(keys); } else step(Object.assign({ fire: true }, keys)); };

// ---- 1. the tables
check('4 new pickup guns, each with a name, ammo, colour, muzzle style and a boss multiplier', GUNS.every((g) => S.GUNS[g] && S.GUNS[g].name && S.GUNS[g].ammo > 0 && S.GUNS[g].col && S.GUNFX['alt_' + g] && S.BOSS_MUL['g_' + g] > 0) && Object.keys(S.GUNS).length === 8);
check('3 one-use specials, each with a name and a boss multiplier', ONCES.every((k) => S.ONCE[k] && S.ONCE[k].name && S.BOSS_MUL['s_' + k] > 0) && Object.keys(S.ONCE).length === 3);
check('every new gun and special has a terrain entry', ALL.every((k) => S.DESTRUCT[k]));
check('every new gun and special follows the aim system, except spud (in NO_AIM: it falls from the sky)', ALL.every((k) => (k === 'spud') === !!S.NO_AIM[k]));

// ---- 2. pickup
for (const g of GUNS) {
  flat(); const pk = S.spawnPickup(S.P.x + 2, S.P.y); pk.item = 'gun'; pk.gun = g; for (let i = 0; i < 30; i++) step();
  check('pickup: the ' + g + ' gun is picked up with full ammo', S.P.alt && S.P.alt.kind === g && S.P.alt.ammo === S.GUNS[g].ammo, S.P.alt ? S.P.alt.ammo + ' shots' : 'nothing');
}
for (const k of ONCES) {
  flat(); const spec0 = S.P.spec; const pk = S.spawnPickup(S.P.x + 2, S.P.y); pk.item = 'once'; pk.once = k; for (let i = 0; i < 30; i++) step();
  check('pickup: the ' + k + ' special is picked up and held, his own special count untouched', S.P.once === k && S.P.spec === spec0);
}
{ const guns = new Set(), onces = new Set();
  for (let i = 0; i < 400; i++) { flat(); seed = 1000 + i * 7919; const e = S.makeEnt({ type: i % 2 ? 'itemcrate' : 'guncrate', c: 40 }); e.x = 40 * T; e.y = 15 * T; S.ents.push(e); S.hitEnemy(e, 99, 0); const pk = S.ents.find((o) => o.type === 'pickup' && !o.dead); if (pk && pk.item === 'gun') guns.add(pk.gun); if (pk && pk.item === 'once') onces.add(pk.once); }
  check('gun crates and item crates drop the new guns and the one-use specials', GUNS.every((g) => guns.has(g)) && ONCES.every((k) => onces.has(k)), [...guns].join(',') + ' / ' + [...onces].join(',')); }

// ---- 3. fires, shows ammo, hurts quacks
for (const id of ALL) {
  flat(); arm(id); const q = grunt(36, { hp: 30, max: 30 }); if (id === 'spud') q.x = 33 * T;
  for (let i = 0; i < 30; i++) { use(id); if (GUNS.includes(id) && S.P.alt) S.P.alt.ammo--; }
  let hurt = q.dead || q.hp < 30; for (let i = 0; i < 150 && !hurt; i++) { S.P.inv = 1e9; step(); hurt = q.dead || q.hp < 30; }
  check(id + ': fires and hurts a quack', hurt, 'hp ' + Math.max(0, q.hp).toFixed(1) + '/30');
}
check('the HUD draws the held gun and the held special', (() => { flat(); arm('pogo'); S.P.once = 'beach'; try { step({}, true); return true; } catch (e) { console.log(e); return false; } })());
for (const g of GUNS) { flat(); arm(g); S.P.alt.ammo = 5; S.P.cool = 0; step({ fire: true }); check(g + ': a shot uses one round of ammo', S.P.alt && S.P.alt.ammo === 4, S.P.alt ? '' + S.P.alt.ammo : 'gone'); }

// ---- 4. terrain by material: the material table decides; steel never breaks
const cut = (id, mat) => { flat(); wall(mat, 31, 42, 13, 15); arm(id); for (let i = 0; i < (ONCES.includes(id) ? 1 : 90); i++) use(id); for (let i = 0; i < 150; i++) { S.P.inv = 1e9; step(); } return broken(31, 42, 13, 15); };
for (const id of ALL) {
  const r = [DIRT, BRICK, CRATE, ICE].map((m) => cut(id, m)), st = cut(id, STEEL);
  check(id + ': cuts terrain by material (broken blocks: earth ' + r[0] + ', brick ' + r[1] + ', crate ' + r[2] + ', ice ' + r[3] + '), never steel', Math.max(...r) > 0 && st === 0, 'steel ' + st);
}
{ const g = [cut('glue', DIRT), cut('glue', BRICK)], f = [cut('fizz', ICE), cut('fizz', DIRT)], s = [cut('spud', DIRT), cut('spud', BRICK)], d = [cut('duck', BRICK), cut('duck', CRATE)];
  check('glue (acid) eats earth faster than brick; fizz (glass) takes ice; spuds (soft) take earth over brick; ducks scuff crates, not brick', g[0] > g[1] && f[0] > f[1] && s[0] > s[1] && d[1] > d[0], 'glue ' + g + ' fizz ' + f + ' spud ' + s + ' duck ' + d); }

// ---- 5. never kills the player: point blank at a wall, and at his own feet
const lives = (id, setup, feet) => {
  flat(); arm(id); setup(); const d0 = S.stats.deaths;
  for (let i = 0; i < 300 && S.stats.deaths === d0; i++) {
    S.P.vx = 0; S.P.shield = 0; S.P.inv = 0;
    if (i < 3) { use(id); if (feet && i === 0) for (const b of S.bullets) if (b.owner === 'p') { b.x = S.P.x + 5; b.y = S.P.y + 14; b.vx = 0; b.vy = 100; } } else step();
  }
  return S.stats.deaths === d0;
};
for (const id of ALL) {
  check('no self-kill: ' + id + ' point blank into a brick wall', lives(id, () => wall(BRICK, 31, 32, 8, 15), false));
  check('no self-kill: ' + id + ' point blank into a steel wall', lives(id, () => wall(STEEL, 31, 32, 8, 15), false));
  check('no self-kill: ' + id + ' going off at his own feet', lives(id, () => { }, true));
}
check('still deadly: an enemy bullet', (() => { flat(); const d0 = S.stats.deaths; S.P.inv = 0; S.bullets.push({ x: S.P.x + 40, y: S.P.y + 8, vx: -300, vy: 0, owner: 'e', dmg: 1, tdmg: 0.4, life: 2, kind: 'pill' }); for (let i = 0; i < 60; i++) step(); return S.stats.deaths > d0; })());

// ---- 6. aim: holding aim keeps the facing, Up tilts the shot
for (const id of ALL) {
  flat(); arm(id); use(id, { aim: true, up: true, right: true }); const b = S.bullets.filter((o) => o.owner === 'p');
  if (id === 'spud') check(id + ': is in NO_AIM and falls straight down whatever the aim', b.length === 8 && b.every((o) => o.vx === 0 && !o.aimed), b.length + ' spuds');
  else check(id + ': Up tilts the shot upward', b.length > 0 && b.every((o) => o.aimed && o.vy < -40 && o.vx > 0), b[0] ? 'vx ' + b[0].vx.toFixed(0) + ' vy ' + b[0].vy.toFixed(0) : 'no shot');
}
for (const id of GUNS) {
  flat(); arm(id); let ok = true, fired = 0;
  for (let i = 0; i < 40; i++) { S.P.cool = 0; S.P.alt.ammo = 99; step({ fire: true, aim: true, left: true }); if (S.P.face !== 1) ok = false; }
  for (const b of S.bullets) if (b.owner === 'p' && b.vx > 0) fired++;
  check(id + ': hold aim, walk backwards, still facing and shooting forwards', ok && fired > 0 && S.P.x < 30 * T, 'face ' + S.P.face + ', moved ' + (S.P.x - 30 * T).toFixed(0) + ' px');
}

// ---- 7. a boss: damage within the BOSS_MUL range, never a one-shot, never useless
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'], pick = {};
for (let l = 0; l < S.nLevels; l++) { S.startLevel(l); for (const B of S.ents.filter((e) => BOSSES.includes(e.type))) if (!pick[B.type]) pick[B.type] = [l, !!B.final]; }
const hpOf = (e) => Math.max(0, e.hp) + (e.vats || []).reduce((a, o) => a + (o.dead ? 0 : Math.max(0, o.hp)), 0);
const bossFight = (id, type, secs) => {
  const [lvl, fin] = pick[type]; seed = 7; S.startLevel(lvl); S.endCeasefire(); S.finishObjectives(); step();
  const B = S.ents.find((e) => BOSSES.includes(e.type) && !!e.final === fin); S.ents.forEach((e) => { if (e !== B && e.type !== 'flag') e.dead = true; });
  S.P.bro = S.BRO.einstein; S.P.alt = null; S.P.once = null; S.P.x = (B.trig + 2) * T; S.P.y = 2 * T; step();
  let best = null, bs = 1e9; const tx = B.x + B.w / 2, ty = B.y + B.h / 2;
  for (let c = B.ax0 || 0; c <= (B.ax1 || 60); c++) for (let r = 2; r < 21; r++) { if (!S.isSolidT(S.tileAt(c, r)) || S.isSolidT(S.tileAt(c, r - 1)) || S.isSolidT(S.tileAt(c, r - 2))) continue; const sc = Math.abs(r * T - 8 - ty) + Math.abs(Math.abs(c * T + 8 - tx) - 90) * 0.6; if (sc < bs) { bs = sc; best = [c, r]; } }
  const x0 = best[0] * T + 3, y0 = best[1] * T - 15.01, face = tx > x0 ? 1 : -1; arm(id);
  const h0 = hpOf(B); let spike = 0, last = h0, t = secs;
  for (let f = 0; f < secs * 60 && !(B.dead || B.doomed || B.dying > 0); f++) {
    S.P.inv = 1e9; S.P.alive = true; S.P.spec = 0; S.P.x = x0; S.P.y = y0; S.P.vx = 0; S.P.vy = 0; S.P.face = B.x + B.w / 2 > x0 + 5 ? 1 : -1; if (f === 0) S.P.cool = 0; // keep facing the boss: the tank can drive past
    if (S.GUNS[id]) { if (S.P.alt) S.P.alt.ammo = Math.max(S.P.alt.ammo, 2); step({ fire: true }); } else { if (f === 0) S.pressed.special = true; step(); }
    const h = hpOf(B); spike = Math.max(spike, last - h); last = h; t = f / 60;
  }
  return { dmg: h0 - hpOf(B), hp: h0, dead: B.dead || B.doomed || B.dying > 0, spike, t };
};
const rows = {}, REF = ['shotgun', 'rocket', 'minigun', 'railgun'], med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
for (const id of ALL.concat(REF)) { rows[id] = {}; for (const ty of ['boss', 'tank']) rows[id][ty] = bossFight(id, ty, S.GUNS[id] ? 20 : 6); }
const dps = (id, ty) => rows[id][ty].dmg / Math.max(1, rows[id][ty].t);
for (const id of GUNS) {
  const out = ['boss', 'tank'].map((ty) => ty + ' ' + dps(id, ty).toFixed(1) + '/s vs ' + med(REF.map((r) => dps(r, ty))).toFixed(1) + '/s').join(', ');
  check(id + ': boss damage per second is in line with the other pickup guns, 0.5x to 1.5x of their median, and not a one-shot (' + out + ')', ['boss', 'tank'].every((ty) => { const m = med(REF.map((r) => dps(r, ty))), q = dps(id, ty); return q >= 0.5 * m && q <= 1.5 * m && rows[id][ty].t >= 3 && rows[id][ty].spike < 0.3 * rows[id][ty].hp; }));
}
for (const id of ONCES) {
  const out = Object.entries(rows[id]).map(([ty, r]) => ty + ' ' + r.dmg.toFixed(1) + '/' + r.hp.toFixed(0)).join(', ');
  check(id + ': one use takes 8% to 30% of a boss (' + out + ' hp)', Object.values(rows[id]).every((r) => r.dmg >= 0.08 * r.hp && r.dmg <= 0.3 * r.hp && !r.dead));
}

// ---- 8. a one-use special is used up after one press, and the bro's own special comes back
for (const k of ONCES) {
  flat('curie'); S.P.spec = 2; arm(k); S.pressed.special = true; step(); const used = S.P.once === null && S.P.spec === 2 && S.bullets.some((o) => o.owner === 'p' && o.kind === k);
  S.bullets.length = 0; S.pressed.special = true; step(); const own = S.P.spec === 1 && S.bullets.some((o) => o.kind === 'bigvial');
  check(k + ': the first press uses it up (specials stay 2), the next is Curie\'s own', used && own, 'once ' + S.P.once + ', specials ' + S.P.spec);
  flat('curie'); S.P.spec = 0; arm(k); S.pressed.special = true; step(); const works = S.P.once === null && S.bullets.some((o) => o.owner === 'p');
  S.bullets.length = 0; S.pressed.special = true; step(); check(k + ': works with no special left; the next press does nothing', works && S.P.spec === 0 && S.bullets.length === 0);
}

// ---- 9. every new gun and special draws, with quacks and blocks about, and the pickups draw
{ const errs = [];
  for (const id of ALL) { try { flat(); wall(BRICK, 36, 38, 10, 15); grunt(34); for (let i = 0; i < 90; i++) { S.P.inv = 1e9; arm(id); S.P.cool = 0; if (ONCES.includes(id) && i % 30 === 0) S.pressed.special = true; step({ fire: true }, true); } } catch (e) { errs.push(id + ': ' + e.message); } }
  flat(); for (const g of GUNS) { const pk = S.spawnPickup(33 * T, 10 * T); pk.item = 'gun'; pk.gun = g; pk.keep = true; } for (const k of ONCES) { const pk = S.spawnPickup(34 * T, 10 * T); pk.item = 'once'; pk.once = k; pk.keep = true; }
  try { step({}, true); } catch (e) { errs.push('pickups: ' + e.message); }
  check('rendering every new gun, special and pickup throws no errors', errs.length === 0, errs.slice(0, 3).join(' | ')); }

// ---- 10. frame cost: INSANE at 300%, the last mission's busiest stretch, firing each new gun and special
{
  const quacks = () => S.ents.filter((e) => S.THREAT[e.type] && !e.dead);
  const frame = (id) => {
    seed = 7; S.setDifficulty(3, false); S.setDensity(6, false); S.reset(); S.startLevel(S.nLevels - 1); S.P.bro = S.BRO.einstein; S.endCeasefire();
    let best = 24, bn = 0; for (let c = 24; c < 330; c += 4) { const k = quacks().filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (k > bn) { bn = k; best = c; } }
    const near = quacks().find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60); arm(id);
    for (let i = 0; i < 30; i++) { S.P.inv = 1e9; arm(id); step({ fire: true }, true); }
    const N = 300, t0 = Date.now();
    for (let i = 0; i < N; i++) { S.P.inv = 1e9; if (S.P.alt) S.P.alt.ammo = 99; if (ONCES.includes(id) && i % 100 === 0) { S.P.once = id; S.pressed.special = true; } step({ fire: true }, true); }
    return (Date.now() - t0) / N;
  };
  let worst = 0, who = '', base = 0; for (const id of ['minigun'].concat(ALL)) { let ms = 99; for (let r = 0; r < 5; r++) ms = Math.min(ms, frame(id)); console.log('  ' + id + ': ' + ms.toFixed(2) + ' ms'); if (id === 'minigun') base = ms; else if (ms > worst) { worst = ms; who = id; } }
  S.setDifficulty(1, false); S.setDensity(3, false);
  check('INSANE at 300%: every new gun and special keeps a frame under 3 ms (worst: ' + who + '; a busy machine is allowed 20% over the minigun run in the same test)', worst < 3 || worst < base * 1.2, worst.toFixed(2) + ' ms, minigun ' + base.toFixed(2) + ' ms');
  check('a special held once makes a capped number of shots however often the key is pressed', (() => { flat(); S.P.once = 'spud'; for (let i = 0; i < 100; i++) { S.pressed.special = true; step(); } return S.bullets.length <= 8; })(), S.bullets.length + ' bullets');
}
console.log(fails ? fails + ' check(s) failed' : 'all ' + passes + ' gimmick weapon checks passed');
process.exit(fails ? 1 : 0);
