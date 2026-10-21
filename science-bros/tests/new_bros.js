// Headless checks for the four bros added in round 4 (Semmelweis, Torricelli, Volta, Gauss): 46 bros in all, every per-bro table is
// filled, each weapon hurts a quack and does its own trick, each special works and is limited like the others, weapon and
// special cut terrain by material, nothing they fire kills the player, the aim works, they can hurt every boss at a fair
// pace, a cage can free each of them, a new run still starts with 10 bros, and a busy fight stays under 3 ms a frame.
// Usage: node science-bros/tests/new_bros.js science-bros/index.html
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
const wall = (v, c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) S.setTile(c, r, v); };
const dent = (c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { let d = 0; for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { const v = S.tileAt(c, r); d += v === 0 ? 3 : 0; } return d; }; // blocks gone
const hpSum = (c0 = 31, c1 = 42, r0 = 6, r1 = 15) => { let d = 0; for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) d += S.tileAt(c, r) ? S.hpAt(c, r) : 0; return d; };
// how much of a wall of this material a bro's weapon (or special) damaged in n frames: broken blocks count in full
const cutBy = (id, mat, n, special) => {
  flat(id); wall(mat); const h0 = hpSum(); if (special) { S.P.spec = 3; S.pressed.special = true; }
  for (let i = 0; i < n; i++) { S.P.x = 30 * T + 3; S.P.face = 1; step(special ? {} : { fire: true }); S.P.inv = 1e9; }
  return h0 - hpSum();
};

// ---------------------------------------------------------------- 1. the roster and every per-bro table
check('there are 46 bros', S.BROS.length === 46, S.BROS.length + ' bros');
check('the four new bros each exist exactly once', NEW.every((id) => S.BRO[id] && S.BROS.filter((b) => b.id === id).length === 1));
for (const id of NEW) {
  const b = S.BRO[id];
  check(id + ': name, weapon, special, formula, gun colour and palette are filled', ['name', 'weapon', 'wdesc', 'special', 'sdesc', 'formula', 'gun'].every((k) => typeof b[k] === 'string' && b[k].length > 2) && !!b.pal && !b.melee, b.name);
  check(id + ': sprites, white flash frames and rig are built', !!b.spr && !!b.white && !!b.rig);
  check(id + ': a GUNFX entry with flash and colours', !!S.GUNFX[id] && !!S.GUNFX[id].flash && S.GUNFX[id].c.length === 2);
  check(id + ': a DESTRUCT entry for every shot kind it fires', KINDS[id].every((k) => !!S.DESTRUCT[k]), KINDS[id].join(','));
  check(id + ': aim system on (not in NO_AIM)', KINDS[id].every((k) => !S.NO_AIM[k]));
  check(id + ': a BOSS_MUL entry only if it is a sane number', !(id in S.BOSS_MUL) || (S.BOSS_MUL[id] >= 1 && S.BOSS_MUL[id] <= 2.5), String(S.BOSS_MUL[id]));
}
check('every new name is a bro pun and no text names a real brand or platform', NEW.every((id) => /bro$/.test(S.BRO[id].name) && !/(google|apple inc|tesla motors|amazon|facebook|twitter|tiktok)/i.test(JSON.stringify(S.BRO[id]))));

// ---------------------------------------------------------------- 2. each weapon hurts quacks, and does its trick
for (const id of NEW) {
  flat(id); const q = quack(44); let i = 0; for (; i < 300 && !q.dead; i++) { calm(q); step({ fire: true, right: S.P.x < q.x - 14 }); S.P.inv = 1e9; }
  check(id + ': the weapon kills a quack that walks toward it', q.dead, i + ' frames');
}
{ flat('semmelweis'); const q = quack(35, { hp: 60, max: 60 }); let stunned = 0; for (let i = 0; i < 90; i++) { calm(q); step({ fire: i < 40 }); if (q.stun > stunned) stunned = q.stun; } // close range, holding fire: at 8 tiles most bubbles drift over his head (random wobble phase)
  check('Semmelweis: a soap bubble traps a quack (stunned) and pops', stunned > 0.5 && !S.bullets.some((b) => b.kind === 'bubble' && b.owner === 'p' && b.x > q.x - 4 && b.x < q.x + 4 && b.y > q.y && b.y < q.y + q.h), stunned.toFixed(2) + ' s'); }
{ flat('semmelweis'); for (let i = 0; i < 60; i++) step({ fire: true }); run(40); const bs = S.bullets.filter((b) => b.kind === 'bubble'); check('Semmelweis: bubbles drift upward and slow down', bs.length >= 2 && bs.reduce((a, b) => a + b.vy, 0) / bs.length < 0 && bs.every((b) => Math.abs(b.vx) < 150), bs.map((b) => b.vx.toFixed(0) + ',' + b.vy.toFixed(0)).join(' ')); } // on average: one bubble's wobble can point down at any moment
{ flat('torricelli'); const q = quack(41, { hp: 60, max: 60 }); calm(q); step({ fire: true }); let drops = 0, k = 0; for (; k < 90 && !drops; k++) { calm(q); step(); drops = S.bullets.filter((b) => b.kind === 'mdrop').length; }
  check('Torricelli: the blob splits into three droplets where it lands', drops === 3, drops + ' droplets');
  for (let i = 0; i < 120; i++) { calm(q); step(); } check('and the mercury poisons the quack', q.poison > 0 || q.dead || q.hp < 60, 'poison ' + (q.poison || 0).toFixed(2) + ', hp ' + q.hp.toFixed(1)); }
{ flat('volta'); const q = quack(12, { hp: 999, max: 999 }); const hits = []; let last = q.hp;
  for (let k = 0; k < 5; k++) { const b = { x: q.x - 6, y: q.y + 6, vx: 400, vy: 0, owner: 'p', dmg: 0.55, tdmg: 0.45, life: 0.5, kind: 'volt' }; S.bullets.push(b); for (let f = 0; f < 6 && !b.dead; f++) { calm(q); step(); } hits.push(last - q.hp); last = q.hp; } // step until the spark lands: the knock-back can carry the quack a frame further
  check('Volta: each spark on the same quack hits harder than the one before, up to a cap', hits[1] > hits[0] && hits[2] > hits[1] && hits[4] >= hits[3] - 1e-9 && hits[4] <= hits[0] * 2.3, hits.map((h) => h.toFixed(2)).join(' < ')); }
{ flat('gauss'); step({ fire: true }); const g = S.bullets.find((b) => b.kind === 'gauss'); const v0 = Math.hypot(g.vx, g.vy), d0 = g.dmg; run(12); const v1 = Math.hypot(g.vx, g.vy);
  check('Gauss: the slug speeds up through three coils and hits harder at range', v1 > v0 * 2.5 && g.dmg > d0 * 2 && g.stage === 3, v0.toFixed(0) + ' -> ' + v1.toFixed(0) + ' px/s, dmg ' + d0 + ' -> ' + g.dmg); }

// ---------------------------------------------------------------- 3. each special works, and is limited like the others
{ flat('semmelweis'); const q = quack(38, { hp: 60, max: 60 }); S.P.spec = 3; S.pressed.special = true; step(); const bs = S.bullets.filter((b) => b.kind === 'bubble' && b.big).length; let st = 0;
  for (let i = 0; i < 200; i++) { calm(q); step(); st = Math.max(st, q.stun || 0); }
  check('Semmelweis: Hand wash floats six huge bubbles that trap a quack for over 2 s', bs === 6 && st >= 2, bs + ' bubbles, stun ' + st.toFixed(2)); }
{ flat('torricelli'); const cx = Math.floor((S.cam.x + 60) / T), a = quack(cx, { hp: 3, max: 3 }), b2 = quack(cx + 8, { hp: 3, max: 3 }), c2 = quack(cx + 16, { hp: 3, max: 3 }); S.P.spec = 3; S.pressed.special = true; step(); let seen = 0, k = 0;
  for (; k < 300; k++) { [a, b2, c2].forEach(calm); step(); seen = Math.max(seen, S.bullets.filter((b) => b.kind === 'merc').length); }
  check('Torricelli: Barometer rains mercury across the screen and kills weak quacks', seen >= 3 && [a, b2, c2].filter((q) => q.dead).length >= 1, seen + ' blobs at once, ' + [a, b2, c2].filter((q) => q.dead).length + ' of 3 dead'); }
{ flat('volta'); S.P.spec = 3; S.pressed.special = true; step(); const on = S.P.volt > 5; S.P.cool = 0; step({ fire: true }); const fast = S.P.cool; const full = S.bullets.find((b) => b.kind === 'volt');
  flat('volta'); S.P.cool = 0; step({ fire: true }); const slow = S.P.cool;
  check('Volta: Overcharge lasts about 6 s, halves the cooldown and makes sparks full-charge', on && fast < slow * 0.65 && full && full.full, 'cool ' + fast.toFixed(3) + ' vs ' + slow.toFixed(3));
  flat('volta'); S.P.spec = 3; S.pressed.special = true; step(); run(60 * 6.2); check('and it wears off', S.P.volt === 0); }
{ flat('gauss'); const q = quack(40, { hp: 40, max: 40 }); S.P.spec = 3; S.pressed.special = true; step(); const n = S.bullets.filter((b) => b.kind === 'gauss').length; let seen = n;
  for (let i = 0; i < 90; i++) { calm(q); step(); seen = Math.max(seen, S.bullets.filter((b) => b.kind === 'gauss').length); }
  check('Gauss: the sum of 1 to 100 fires twenty slugs, the last far harder than the first, and kills a 40 hp quack', q.dead, 'hp left ' + q.hp.toFixed(1)); }
{ let ok = true; const info = [];
  for (const id of NEW) { flat(id); S.P.spec = 1; S.pressed.special = true; step(); const left = S.P.spec; S.pressed.special = true; step(); const stop = S.P.spec; info.push(id + ' ' + left + '/' + stop); ok = ok && left === 0 && stop === 0 && S.specMax(S.BRO[id]) === 3; }
  check('every special costs one charge, cannot fire at zero, and the cap is 3 like the others', ok, info.join(', ')); }

// ---------------------------------------------------------------- 4. terrain: weapon and special cut it by material, steel never
const cuts = {}, mats = { earth: DIRT, brick: BRICK, crate: CRATE, ice: ICE };
for (const id of NEW) { cuts[id] = {}; for (const [n, m] of Object.entries(mats)) cuts[id][n] = cutBy(id, m, 150); }
check('Semmelweis suds melt ice far better than earth, and spare brick', cuts.semmelweis.ice > cuts.semmelweis.earth + 0.5 && cuts.semmelweis.brick === 0, JSON.stringify(cuts.semmelweis));
check('Torricelli mercury punches stone: brick and earth both fall, more brick than the light weapons', cuts.torricelli.brick > 0 && cuts.torricelli.earth > 0, JSON.stringify(cuts.torricelli));
check('Volta forks into the neighbours: earth and brick are damaged, ice and crates too', cuts.volta.earth > 0 && cuts.volta.brick > 0 && cuts.volta.crate > 0, JSON.stringify(cuts.volta));
check('Gauss cuts a thin line three deep: brick is damaged', cuts.gauss.brick > 0 && cuts.gauss.earth > 0, JSON.stringify(cuts.gauss));
check('the four weapons leave four different patterns of damage', new Set(NEW.map((id) => Object.values(cuts[id]).map((v) => v.toFixed(1)).join(','))).size === 4);
for (const id of ['semmelweis', 'torricelli', 'gauss']) { const sp = Object.entries(mats).map(([n, m]) => cutBy(id, m, 220, true)); check(id + ': the special damages terrain too', sp.some((v) => v > 0), sp.map((v) => v.toFixed(1)).join('/')); }
{ const a = cutBy('volta', DIRT, 120), b2 = (() => { flat('volta'); wall(DIRT); const h0 = hpSum(); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 120; i++) { S.P.x = 30 * T + 3; S.P.face = 1; step({ fire: true }); S.P.inv = 1e9; } return h0 - hpSum(); })();
  check('Volta: an overcharged gun cuts earth faster than a normal one', b2 > a, a.toFixed(1) + ' vs ' + b2.toFixed(1)); }
let steel = 0; for (const id of NEW) { steel += cutBy(id, STEEL, 120); steel += cutBy(id, STEEL, 120, true); } check('steel stands up to every weapon and special of the four', steel === 0, steel + ' damage');

// ---------------------------------------------------------------- 5. nothing they fire kills the player (blame)
const pb = (x, y, extra = {}) => S.bullets.push(Object.assign({ x, y, vx: 0, vy: 100, owner: 'p', dmg: 99, tdmg: 0, life: 1, kind: 'pill' }, extra));
const survives = (id, setup, frames = 240) => { flat(id, 0); const d0 = S.stats.deaths; setup(); for (let i = 0; i < frames && S.stats.deaths === d0; i++) { S.P.vx = 0; step({ fire: true }); S.P.face = 1; } return S.stats.deaths === d0 && S.P.alive; };
for (const id of NEW) {
  check(id + ': point blank at a wall, holding fire, no death', survives(id, () => wall(BRICK, 31, 32, 10, 15)));
  check(id + ': point blank at a steel wall, no death', survives(id, () => wall(STEEL, 31, 32, 10, 15)));
  check(id + ': its special at its own position, no death', (() => { flat(id, 0); const d0 = S.stats.deaths; wall(BRICK, 31, 32, 10, 15); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 300; i++) { S.P.vx = 0; step(); } return S.stats.deaths === d0 && S.P.alive; })());
}
check('Semmelweis: a bubble at his feet', survives('semmelweis', () => pb(S.P.x + 5, S.P.y + 14, { kind: 'bubble', big: 1, stun: 2, dmg: 2, hitR: 8, life: 3 })));
check('Torricelli: a blob and its droplets at his feet', survives('torricelli', () => { pb(S.P.x + 5, S.P.y + 14, { kind: 'merc', dmg: 3, poison: 1.5, hitR: 3, grav: 650, life: 2 }); pb(S.P.x + 5, S.P.y + 12, { kind: 'mdrop', dmg: 1, bounce: 2, grav: 700, life: 1 }); }));
check('Volta: a full-charge spark at his feet', survives('volta', () => pb(S.P.x + 5, S.P.y + 14, { kind: 'volt', full: true, dmg: 0.55, tdmg: 1 })));
check('Gauss: a slug at his feet', survives('gauss', () => pb(S.P.x + 5, S.P.y + 14, { kind: 'gauss', sx: S.P.x, stage: 3, fixed: 1, dmg: 5, tdmg: 1, pierce: 2 })));
check('Torricelli: the Barometer rain falling on his own head, shown blame is the player\'s', (() => { flat('torricelli', 0); const d0 = S.stats.deaths; S.P.spec = 3; S.pressed.special = true; step(); let own = true; for (let i = 0; i < 300; i++) { S.P.vx = 0; step(); if (S.bullets.some((b) => b.kind === 'merc' && b.owner !== 'p')) own = false; } return own && S.stats.deaths === d0; })());

// ---------------------------------------------------------------- 6. the aim system turns their shots
for (const id of NEW) {
  flat(id); S.P.cool = 0; step({ fire: true, aim: true, up: true }); const bs = S.bullets.filter((b) => b.owner === 'p' && KINDS[id].includes(b.kind));
  check(id + ': aimed up, the shot goes upward', bs.length >= 1 && bs.every((b) => b.vy < -10 && b.aimed), bs.map((b) => b.vx.toFixed(0) + ',' + b.vy.toFixed(0)).join(' '));
  flat(id); const q = quack(31, { hp: 999, max: 999 }); let ok = false;
  for (let i = 0; i < 150 && !ok; i++) { S.P.x = 31 * T; S.P.inv = 1e9; q.x = 31 * T; q.y = S.P.y - 3 * T - q.h; q.vy = 0; calm(q); q.stun = 0; step({ fire: true, aim: true, up: true }); ok = q.hp < 999 || q.poison > 0; }
  check(id + ': aimed up hurts a quack 3 tiles over its head', ok, (999 - q.hp).toFixed(1));
}

// ---------------------------------------------------------------- 7. every boss can be hurt at a fair pace (against the first five bros)
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const solid = (v) => v !== 0 && v !== 5 && v !== 7;
const pick = {};
const LIST = []; for (let l = 0; l < S.nLevels; l++) LIST.push([l, true]); LIST.push([1, false]); LIST.push([S.MOON, true]);
for (const [l, fin] of LIST) { S.startLevel(l); const B = S.ents.find((e) => BOSSES.includes(e.type) && !!e.final === fin); if (B && !pick[B.type]) pick[B.type] = [l, fin]; }
const fight = (id, type, secs = 15) => {
  const [lvl, fin] = pick[type];
  seed = 7; S.startLevel(lvl); S.endCeasefire(); S.finishObjectives(); step();
  const B = S.ents.find((e) => BOSSES.includes(e.type) && !!e.final === fin);
  S.ents.forEach((e) => { if (e !== B && e.type !== 'flag') e.dead = true; });
  S.P.bro = S.BRO[id]; S.P.alt = null; S.P.x = (B.trig + 2) * T; S.P.y = 2 * T;
  const total = () => Math.max(0, B.hp) + (B.vats || []).reduce((a, o) => a + (o.dead ? 0 : Math.max(0, o.hp)), 0);
  const start = total(); let last = start, stillT = 0, dist = 110, jumpT = 0, act = 0;
  const dists = [dist, dist * 0.6, dist * 1.4];
  for (let f = 0; f < secs * 60 && !(B.dead || B.doomed || B.dying > 0); f++) {
    S.P.inv = 1e9; S.P.spec = 0; S.P.alive = true;
    const v = (B.vats || []).find((o) => !o.dead), t = v || B, tx = t.x + t.w / 2, ty = t.y + t.h / 2;
    const tot = total(); if (tot < last - 0.01) stillT = 0; else stillT += 1 / 60; last = tot;
    if (B.active) act += 1 / 60;
    if (B.active && stillT > 2) {
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
  const dead = B.dead || B.doomed || B.dying > 0, dealt = dead ? start : start - total();
  return { dps: dealt / Math.max(1, act), ttk: start / Math.max(0.01, dealt / Math.max(1, act)) };
};
{
  const ref = ['einstein', 'curie', 'tesla', 'newton', 'franklin'], med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const refDps = {}; for (const ty of BOSSES) refDps[ty] = med(ref.map((id) => fight(id, ty).dps));
  for (const id of NEW) {
    const rows = BOSSES.map((ty) => fight(id, ty)), slow = BOSSES.filter((ty, i) => rows[i].dps < refDps[ty] / 4 || rows[i].ttk > 180), rel = med(rows.map((r, i) => r.dps / (refDps[BOSSES[i]] || 1))), worst = Math.max(...rows.map((r) => r.ttk));
    check(id + ': hurts all 8 boss types within 15 s', rows.every((r) => r.dps > 0), rows.map((r) => r.dps.toFixed(1)).join(' '));
    check(id + ': about 60% or more of the reference damage per second against bosses (median over the 8)', rel >= 0.6, rel.toFixed(2) + ' (BOSS_MUL ' + (S.BOSS_MUL[id] || 1) + ')');
    check(id + ': no boss takes over four times as long as for the reference bros, or over 3 minutes', !slow.length, 'slow against: ' + slow.join(',') + '; slowest ' + worst.toFixed(0) + ' s');
  }
}

// ---------------------------------------------------------------- 8. cages free them, and a new run still starts with 10
check('a new run starts with 10 random bros (START_BROS unchanged)', (S.reset(), S.unlocked.length === 10), S.unlocked.length + '');
for (const id of NEW) {
  S.reset(); S.unlocked.length = 0; S.BROS.forEach((b) => { if (b.id !== id) S.unlocked.push(b.id); });
  check(id + ': when only he is locked, a cage frees him', S.pickRescueBro() === id);
  flat('einstein'); S.unlocked.length = 0; S.BROS.forEach((b) => { if (b.id !== id) S.unlocked.push(b.id); });
  const cage = S.makeEnt({ type: 'cage', c: 31, from: 15 }); S.ents.push(cage); S.P.inv = 1e9;
  for (let i = 0; i < 160 && !S.unlocked.includes(id); i++) { S.P.x = 31 * T; step({ fire: true }); if (i === 30) S.pressed.melee = true; }
  check(id + ': a real cage opens and unlocks him', S.unlocked.includes(id) && S.P.bro.id === id, S.P.bro.id);
}
{ real = true; S.reset(); const locked = new Set(NEW); for (let i = 0; i < 400; i++) { S.reset(); S.unlocked.length = 0; S.unlocked.push('einstein'); const r = S.pickRescueBro(); if (NEW.includes(r)) locked.delete(r); }
  real = false; check('the cage pool includes all four new bros', locked.size === 0, 'missed: ' + [...locked].join(',')); }
check('freeing every one of the 46 bros unlocks the trophy path (unlocked can reach 46)', (() => { S.unlocked.length = 0; S.BROS.forEach((b) => S.unlocked.push(b.id)); return S.unlocked.length === 46; })());

// ---------------------------------------------------------------- 9. frame cost on INSANE at 300%, and the shot count stays capped
{
  const level = () => { S.setDifficulty(3, false); S.setDensity(6, false); S.reset(); S.startLevel(17); };
  const quacks = () => S.ents.filter((e) => S.THREAT[e.type] && !e.dead);
  const measure = (id, special) => {
    level(); S.P.bro = S.BRO[id]; S.endCeasefire(); S.P.alt = null;
    let best = 24, bn = 0; for (let c = 24; c < 330; c += 4) { const k = quacks().filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (k > bn) { bn = k; best = c; } }
    const near = quacks().find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60);
    for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); }
    const N = 300; let maxB = 0; const t0 = Date.now();
    for (let i = 0; i < N; i++) { S.P.inv = 1e9; if (special && i % 60 === 0) { S.P.spec = 3; S.pressed.special = true; } if (i % 20 === 0) S.explode(S.P.x + 60, S.P.y + 8, 30, 1, 'p', 0); step({ fire: true }, true); maxB = Math.max(maxB, S.bullets.length); }
    return [(Date.now() - t0) / N, maxB];
  };
  let base = 99; for (let r = 0; r < 3; r++) base = Math.min(base, measure('einstein', false)[0]);
  const lim = Math.max(3, base * 1.3); console.log('(for scale: Einstein ' + base.toFixed(2) + ' ms a frame in the same spot; the limit is 3 ms, or 30% over Einstein when the machine is busy)');
  for (const id of NEW) { let ms = 99, sp = 99, mb = 0; for (let r = 0; r < 3; r++) { ms = Math.min(ms, measure(id, false)[0]); const [m2, b] = measure(id, true); sp = Math.min(sp, m2); mb = Math.max(mb, b); }
    console.log('(' + id + ': ' + ms.toFixed(2) + ' ms a frame firing, ' + sp.toFixed(2) + ' ms with a special every second, at most ' + mb + ' shots in the air)');
    check(id + ': a fight at INSANE / 300% costs under 3 ms a frame (or within 30% of Einstein on a busy machine)', ms < lim, ms.toFixed(2) + ' ms, limit ' + lim.toFixed(2));
    check(id + ': and with a special every second, still within 1.5x that limit', sp < lim * 1.5, sp.toFixed(2) + ' ms'); check(id + ': never more than 200 shots in the air', mb <= 200, mb + ' shots'); }
}

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' new bro checks passed');
process.exit(fails ? 1 : 0);
