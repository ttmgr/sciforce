// Headless checks for the bro art (round 5) and the four bros added in round 5 (Kelvin, Huygens, Nightingale, Schrodinger): 51 bros,
// every bro is built from shaded rows with a signature item and draws without error, each sprite differs from every other
// one (the painted pixels are hashed), the rig still fits the hit box; the four new bros are wired into every per-bro
// table, each weapon hurts a quack and does its own trick, each special works and is limited like the others, weapon and
// special cut terrain by material, nothing they fire kills the player, the aim works, they hurt every boss at a fair pace,
// a cage frees each of them, and a busy fight stays under 3 ms a frame.
// Usage: node science-bros/tests/bros_art.js science-bros/index.html
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
const NEW = ['kelvin', 'huygens', 'nightingale', 'schrodinger'];
const KINDS = { kelvin: ['frost'], huygens: ['wavelet', 'wlet'], nightingale: ['petal'], schrodinger: ['psi'] }; // the shot kinds each bro's weapon fires
const flat = (bro, inv = 1e9) => { // a flat floor at row 16, nothing else; the bro stands at column 30 facing right
  seed = 7; S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.bullets.length = 0; S.fx.length = 0;
  S.P.bro = S.BRO[bro]; S.P.x = 30 * T + 3; S.P.y = 16 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = inv; S.P.spec = 0; S.P.alt = null; S.P.shield = 0; S.P.lamp = 0; S.P.face = 1; S.P.volt = 0; step();
  S.P.inv = inv;
};
const quack = (c, extra = {}) => { const e = Object.assign(S.makeEnt({ type: 'grunt', c, from: 15 }), { face: -1, react: 99, cool: 99 }, extra); e.y = 16 * T - e.h - 0.01; S.ents.push(e); return e; };
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

// ---------------------------------------------------------------- 1. the art: every bro from shaded rows, each one different
check('there are 51 bros (five more in round 6, see bros_r6.js)', S.BROS.length === 51, S.BROS.length + ' bros');
check('every bro has a head, a look (item and colour) and a known item', S.BROS.every((b) => S.HEADS[b.id] && S.LOOKS[b.id] && S.BRO_ITEM[S.LOOKS[b.id][0]] && /^#[0-9a-f]{6}$/.test(S.LOOKS[b.id][1])), S.BROS.filter((b) => !S.LOOKS[b.id]).map((b) => b.id).join(','));
{ const bad = []; for (const b of S.BROS) { const R = S.broRows(b.id), rows = R.head.concat(R.body); if (R.head.length !== 6 || R.body.length !== 6 || rows.some((r) => r.length !== 12) || [...rows.join('')].some((ch) => ch !== '.' && !b.rig.pal[ch])) bad.push(b.id); }
  check('every bro is 6 head rows and 6 body rows, 12 wide, and every pixel has a colour in his palette', !bad.length, bad.join(',')); }
{ const bad = S.BROS.filter((b) => { const j = S.broRows(b.id).head.concat(S.broRows(b.id).body).join(''); return !/[CU]/.test(j) || !/[HJWV]/.test(j) || !/S/.test(j) || !/[xX]/.test(j); }).map((b) => b.id);
  check('every bro is shaded (coat rim, hair rim, skin shadow) and wears his signature item', !bad.length, bad.join(',')); }
{ const bad = S.BROS.filter((b) => { const h = S.broRows(b.id).head.join(''); return /e/.test(h) && !/[EY]/.test(h); }).map((b) => b.id); check('every visible eye has a brow or a white (glasses cover the rest)', !bad.length, bad.join(',')); }
{ const ups = S.BROS.map((b) => hash(b.rig.up[0])), sprs = S.BROS.map((b) => hash(b.spr[0][0]));
  check('the ' + S.BROS.length + ' upper-body sprites are all different (hash of the painted pixels)', new Set(ups).size === S.BROS.length, new Set(ups).size + ' different');
  check('the ' + S.BROS.length + ' small sprites (HUD, roster, cages) are all different', new Set(sprs).size === S.BROS.length, new Set(sprs).size + ' different');
  check('the hashes are real: each sprite painted over 90 pixels', S.BROS.every((b) => b.rig.up[0].ops.length > 90 && b.spr[0][0].ops.length > 90), 'fewest ' + Math.min(...S.BROS.map((b) => Math.min(b.rig.up[0].ops.length, b.spr[0][0].ops.length)))); }
{ const thin = S.BROS.filter((b) => colours(b.rig.up[0]).size < 9).map((b) => b.id + ' ' + colours(b.rig.up[0]).size);
  check('each upper body uses at least 9 colours (outline, shades and highlights, item)', !thin.length, thin.join(', '));
  check('each sprite has the dark outline', S.BROS.every((b) => colours(b.rig.up[0]).has('#0d0b18'))); }
check('the white hit flash is all white', S.BROS.every((b) => [...colours(b.rig.white.up[0])].every((c) => c === '#ffffff' || c === '#0d0b18')));
check('shoes catch the light on the bros only (quack legs unchanged)', S.BRO_LEGS.stand.join('').includes('B') && !S.LEG_FRAMES.stand.join('').includes('B'));
check('the rig still fits: 12 wide, 6-row head, 12-row upper body over 4-row legs (16 px on a 10 x 15 hit box)', S.BROS.every((b) => b.rig.w === 12 && b.rig.hh === 6 && b.rig.uh === 12) && S.P.w === 10 && S.P.h === 15);
check('every rig has every leg pose: stand, 6 run frames, jump, fall, 2 climb frames, kneel', S.BROS.every((b) => b.rig.legs.stand && b.rig.legs.run.length === 6 && b.rig.legs.jump && b.rig.legs.fall && b.rig.legs.climb.length === 2 && b.rig.legs.kneel));
{ const errs = [], missing = []; drawLog = new Set();
  for (const b of S.BROS) for (const pose of ['stand', 'run', 'jump', 'climb', 'aim']) {
    flat(b.id); drawLog.clear();
    if (pose === 'run') { S.P.vx = 100; S.P.rp = 2; } if (pose === 'jump') { S.P.onGround = false; S.P.vy = -100; } if (pose === 'climb') S.P.climb = true; if (pose === 'aim') S.P.aim = 0.7;
    try { S.render(0); } catch (e) { errs.push(b.id + ' ' + pose + ': ' + e.message); }
    if (!drawLog.has(b.rig.up[0])) missing.push(b.id + ' ' + pose);
  }
  drawLog = null;
  check('every bro draws in every pose (stand, run, jump, climb, aim) without an error', !errs.length, errs.slice(0, 3).join(' | '));
  check('and what is drawn is his own rig', !missing.length, missing.slice(0, 5).join(', ')); }

// ---------------------------------------------------------------- 2. the four new bros in every per-bro table
check('the four new bros each exist exactly once', NEW.every((id) => S.BRO[id] && S.BROS.filter((b) => b.id === id).length === 1));
for (const id of NEW) {
  const b = S.BRO[id];
  check(id + ': name, weapon, special, formula, gun colour and palette are filled', ['name', 'weapon', 'wdesc', 'special', 'sdesc', 'formula', 'gun'].every((k) => typeof b[k] === 'string' && b[k].length > 2) && !!b.pal && !b.melee, b.name);
  check(id + ': sprites, white flash frames and rig are built', !!b.spr && !!b.white && !!b.rig && !!b.rig.white);
  check(id + ': a GUNFX entry with flash and colours', !!S.GUNFX[id] && !!S.GUNFX[id].flash && S.GUNFX[id].c.length === 2);
  check(id + ': a DESTRUCT entry for every shot kind it fires', KINDS[id].every((k) => !!S.DESTRUCT[k]), KINDS[id].join(','));
  check(id + ': the weapon is aimed (not in NO_AIM)', KINDS[id].every((k) => !S.NO_AIM[k]));
  check(id + ': a BOSS_MUL entry only if it is a sane number', !(id in S.BOSS_MUL) || (S.BOSS_MUL[id] >= 1 && S.BOSS_MUL[id] <= 2.5), String(S.BOSS_MUL[id]));
}
check('the special shots have DESTRUCT entries too (pendulum, cat box)', !!S.DESTRUCT.pend && !!S.DESTRUCT.catbox);
check('only the pendulum skips the aim (it swings from its own pivot)', !!S.NO_AIM.pend);
check('every new name is a bro pun and no text names a real brand or platform', NEW.every((id) => /bro$/.test(S.BRO[id].name) && !/(google|apple inc|tesla motors|amazon|facebook|twitter|tiktok)/i.test(JSON.stringify(S.BRO[id]))));
check('the names are ASCII, so the pixel font can draw them', S.BROS.every((b) => /^[\x20-\x7e]+$/.test(b.name + b.weapon + b.special + b.formula)));

// ---------------------------------------------------------------- 3. each weapon hurts quacks, and does its trick
for (const id of NEW) {
  flat(id); const q = quack(44); let i = 0; for (; i < 300 && !q.dead; i++) { calm(q); step({ fire: true, right: S.P.x < q.x - 14 }); S.P.inv = 1e9; }
  check(id + ': the weapon kills a quack that walks toward it', q.dead, i + ' frames');
}
{ flat('kelvin'); const q = quack(36, { hp: 60, max: 60 }); let st = 0; for (let i = 0; i < 40; i++) { calm(q); step({ fire: i < 20 }); st = Math.max(st, q.stun || 0); }
  check('Kelvin: the frost chills a quack stiff (stunned) and hurts it', st > 0.2 && q.hp < 60, 'stun ' + st.toFixed(2) + ', hp ' + q.hp.toFixed(1)); }
{ flat('kelvin'); step({ fire: true }); const fl = S.bullets.filter((b) => b.kind === 'frost'); check('Kelvin: two flakes a pull, slightly spread', fl.length === 2, fl.map((b) => b.vy.toFixed(0)).join(' ')); }
{ flat('huygens'); wall(BRICK, 36, 37, 10, 15); step({ fire: true }); let n = 0; for (let i = 0; i < 40 && !n; i++) { step(); n = S.bullets.filter((b) => b.kind === 'wlet').length; }
  const ws = S.bullets.filter((b) => b.kind === 'wlet');
  check('Huygens: the wave bursts into six wavelets where it hits a wall, outside the wall', n === 6 && ws.every((b) => !S.tileAt(Math.floor(b.x / T), Math.floor(b.y / T))), n + ' wavelets'); }
{ flat('huygens'); const q = quack(36, { hp: 60, max: 60 }), q2 = quack(36, { hp: 60, max: 60 }); q2.x = q.x + 18; calm(q, q2); S.P.cool = 0; step({ fire: true }); S.P.cool = 9;
  for (let i = 0; i < 40; i++) { calm(q, q2); q2.x = q.x + 18; step(); }
  check('Huygens: the wavelets from a hit quack spare that quack and spread to its neighbour', Math.abs(60 - q.hp - 1.6) < 0.01 && q2.hp < 60, 'hit quack lost ' + (60 - q.hp).toFixed(2) + ', neighbour ' + (60 - q2.hp).toFixed(2)); }
{ flat('nightingale'); step({ fire: true }); const ps = S.bullets.filter((b) => b.kind === 'petal'); check('Nightingale: five petals fanned out (half a rose), some well up and some well down', ps.length === 5 && new Set(ps.map((b) => Math.round(b.vy))).size === 5 && Math.min(...ps.map((b) => b.vy)) < -150 && Math.max(...ps.map((b) => b.vy)) > 150, ps.map((b) => b.vy.toFixed(0)).join(' ')); }
{ flat('nightingale'); const near = quack(33, { hp: 60, max: 60 }), far = quack(50, { hp: 60, max: 60 }); calm(near, far); S.P.cool = 0; step({ fire: true }); for (let i = 0; i < 30; i++) { calm(near, far); step(); }
  check('Nightingale: the petals are short range: a close quack is hit, one 20 tiles off is not', near.hp < 60 && far.hp === 60, 'near ' + near.hp.toFixed(1) + ', far ' + far.hp.toFixed(1)); }
{ flat('schrodinger'); step({ fire: true }); const g = S.bullets.filter((b) => b.kind === 'psi'); check('Schrodinger: two ghost shots a pull, linked', g.length === 2 && g[0].link === g[1].link, g.length + ' shots'); }
{ flat('schrodinger'); const q = quack(36, { hp: 60, max: 60 }); calm(q); S.P.cool = 0; step({ fire: true }); S.P.cool = 9; for (let i = 0; i < 40; i++) { calm(q); step(); }
  check('Schrodinger: only one ghost is real: one pull at a quack does one shot of damage, and no ghost is left', Math.abs(60 - q.hp - 2.4) < 0.01 && !S.bullets.some((b) => b.kind === 'psi'), 'damage ' + (60 - q.hp).toFixed(2)); }

// ---------------------------------------------------------------- 4. each special works, and is limited like the others
{ flat('kelvin'); run(20); const cx = Math.floor((S.cam.x + 300) / T), a = quack(cx, { hp: 60, max: 60 }), b2 = quack(cx + 6, { hp: 60, max: 60 }); calm(a, b2); S.P.spec = 3; S.pressed.special = true; step();
  const st = [a, b2].map((q) => q.stun), ice = S.fx.filter((f) => f.kind === 'ice').length; run(60 * 4.3);
  check('Kelvin: Absolute zero freezes every quack on screen for about 4 s, hurts them, and the ice melts again', st.every((v) => v > 3.5) && a.hp <= 58 && ice >= 2 && !S.fx.some((f) => f.kind === 'ice'), 'stun ' + st.map((v) => v.toFixed(1)).join('/') + ', ' + ice + ' ice blocks'); }
{ flat('huygens'); const q = quack(33, { hp: 200, max: 200 }); let hits = 0, last = 200, xs = []; S.P.spec = 3; S.pressed.special = true; step();
  const pd = S.bullets.find((b) => b.kind === 'pend');
  for (let i = 0; i < 60 * 6.2; i++) { calm(q); q.x = 33 * T; q.stun = 0; step(); if (q.hp < last - 0.01) hits++; last = q.hp; if (pd && !pd.dead) xs.push(pd.x - pd.px); }
  check('Huygens: the pendulum swings both ways, hits the same quack again on later swings, and is gone after 6 s', !!pd && Math.min(...xs) < -30 && Math.max(...xs) > 30 && hits >= 3 && !S.bullets.some((b) => b.kind === 'pend'), hits + ' hits, swing ' + Math.min(...xs).toFixed(0) + '..' + Math.max(...xs).toFixed(0)); }
{ flat('nightingale', 0); const near = quack(34, { hp: 60, max: 60 }), far = quack(60, { hp: 60, max: 60 }); calm(near, far); S.P.spec = 3; S.pressed.special = true; step();
  const sh = S.P.shield, st = [near.stun || 0, far.stun || 0]; const d0 = S.stats.deaths;
  S.bullets.push({ x: S.P.x + 5, y: S.P.y + 8, vx: -10, vy: 0, owner: 'e', dmg: 1, life: 0.2, kind: 'pill' }); run(5);
  check('Nightingale: the lamp shields her for 6 s, dazzles a close quack and not a far one, and the shield takes a hit for her', sh > 5.9 && S.P.lamp > 5 && st[0] >= 1.5 && st[1] < 0.05 && S.stats.deaths === d0 && S.P.alive, 'shield ' + sh.toFixed(1) + ', stun ' + st.map((v) => v.toFixed(1)).join('/')); }
{ flat('schrodinger'); const a = quack(39, { hp: 4, max: 4 }), b2 = quack(41, { hp: 4, max: 4 }); calm(a, b2); S.P.spec = 3; S.pressed.special = true; step(); let cloud = false, meow = false;
  for (let i = 0; i < 150; i++) { calm(a, b2); step(); cloud = cloud || S.fx.some((f) => f.kind === 'rad' && f.col === '#b3a6ff'); meow = meow || S.fx.some((f) => f.kind === 'text' && f.txt === 'MEOW'); }
  check('Schrodinger: the cat box bursts, leaves a purple poison cloud and kills weak quacks; the cat is fine', cloud && meow && a.dead && b2.dead); }
{ let ok = true; const info = [];
  for (const id of NEW) { flat(id); S.P.spec = 1; S.pressed.special = true; step(); const left = S.P.spec; S.pressed.special = true; step(); const stop = S.P.spec; info.push(id + ' ' + left + '/' + stop); ok = ok && left === 0 && stop === 0 && S.specMax(S.BRO[id]) === 3; }
  check('every special costs one charge, cannot fire at zero, and the cap is 3 like the others', ok, info.join(', ')); }

// ---------------------------------------------------------------- 5. terrain: weapon and special cut it by material, steel never
const cuts = {}, mats = { earth: DIRT, brick: BRICK, crate: CRATE, ice: ICE };
for (const id of NEW) { cuts[id] = {}; for (const [n, m] of Object.entries(mats)) cuts[id][n] = cutBy(id, m, 150); }
check('Kelvin frost makes ice and crates brittle: more ice and crate than earth', cuts.kelvin.ice > cuts.kelvin.earth && cuts.kelvin.crate > cuts.kelvin.earth, JSON.stringify(cuts.kelvin));
check('Huygens wavelets chip every material', Object.values(cuts.huygens).every((v) => v > 0), JSON.stringify(cuts.huygens));
check('Nightingale petals scuff earth and crates, hardly brick', cuts.nightingale.earth > cuts.nightingale.brick && cuts.nightingale.crate > 0, JSON.stringify(cuts.nightingale));
check('Schrodinger shots punch brick and earth', cuts.schrodinger.brick > 0 && cuts.schrodinger.earth > 0, JSON.stringify(cuts.schrodinger));
check('the four weapons leave four different patterns of damage', new Set(NEW.map((id) => Object.values(cuts[id]).map((v) => v.toFixed(1)).join(','))).size === 4);
for (const id of ['huygens', 'schrodinger']) { const sp = Object.values(mats).map((m) => cutBy(id, m, 220, true)); check(id + ': the special damages terrain too', sp.some((v) => v > 0), sp.map((v) => v.toFixed(1)).join('/')); }
let steel = 0; for (const id of NEW) { steel += cutBy(id, STEEL, 120); steel += cutBy(id, STEEL, 120, true); } check('steel stands up to every weapon and special of the four', steel === 0, steel + ' damage');

// ---------------------------------------------------------------- 6. nothing they fire kills the player (blame)
const pb = (x, y, extra = {}) => S.bullets.push(Object.assign({ x, y, vx: 0, vy: 100, owner: 'p', dmg: 99, tdmg: 0, life: 1, kind: 'pill' }, extra));
const survives = (id, setup, frames = 240) => { flat(id, 0); const d0 = S.stats.deaths; setup(); for (let i = 0; i < frames && S.stats.deaths === d0; i++) { S.P.vx = 0; step({ fire: true }); S.P.face = 1; } return S.stats.deaths === d0 && S.P.alive; };
for (const id of NEW) {
  check(id + ': point blank at a wall, holding fire, no death', survives(id, () => wall(BRICK, 31, 32, 10, 15)));
  check(id + ': point blank at a steel wall, no death', survives(id, () => wall(STEEL, 31, 32, 10, 15)));
  check(id + ': its special at its own position, no death', (() => { flat(id, 0); const d0 = S.stats.deaths; wall(BRICK, 31, 32, 10, 15); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 400; i++) { S.P.vx = 0; step(); } return S.stats.deaths === d0 && S.P.alive; })());
}
check('Huygens: wavelets bursting at his feet', survives('huygens', () => { for (let k = 0; k < 6; k++) pb(S.P.x + 5, S.P.y + 10, { kind: 'wlet', vx: Math.cos(k) * 170, vy: Math.sin(k) * 170, dmg: 0.45, life: 0.2 }); }));
check('Huygens: the pendulum swinging through him', survives('huygens', () => S.bullets.push({ x: S.P.x + 5, y: S.P.y, vx: 0, vy: 0, owner: 'p', dmg: 3, tdmg: 1, life: 4, kind: 'pend', pierce: 99, knock: 320, hitR: 7, t: 0, f: -1, swing: 1 })));
check('Schrodinger: the cat box going off at his feet', survives('schrodinger', () => pb(S.P.x + 5, S.P.y + 14, { kind: 'catbox', explode: 46, tp: 2.5, dmg: 9, rad: 40, radCol: '#b3a6ff' })));
check('Kelvin: frost at his feet', survives('kelvin', () => pb(S.P.x + 5, S.P.y + 14, { kind: 'frost', dmg: 0.45, stun: 0.3 })));

// ---------------------------------------------------------------- 7. the aim system turns their shots
for (const id of NEW) {
  flat(id); S.P.cool = 0; step({ fire: true, aim: true, up: true }); const bs = S.bullets.filter((b) => b.owner === 'p' && KINDS[id].includes(b.kind));
  check(id + ': aimed up, the shots go upward', bs.length >= 1 && bs.every((b) => b.vy < -10 && b.aimed), bs.map((b) => b.vx.toFixed(0) + ',' + b.vy.toFixed(0)).join(' '));
  flat(id); const q = quack(31, { hp: 999, max: 999 }); let ok = false;
  for (let i = 0; i < 150 && !ok; i++) { S.P.x = 31 * T; S.P.inv = 1e9; q.x = 31 * T; q.y = S.P.y - 3 * T - q.h; q.vy = 0; calm(q); q.stun = 0; step({ fire: true, aim: true, up: true }); ok = q.hp < 999; }
  check(id + ': aimed up hurts a quack 3 tiles over its head', ok, (999 - q.hp).toFixed(1));
}

// ---------------------------------------------------------------- 8. every boss can be hurt at a fair pace (against the first five bros)
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

// ---------------------------------------------------------------- 9. cages free them, and a new run still starts with 10
check('a new run starts with 10 random bros (START_BROS unchanged)', (S.reset(), S.unlocked.length === 10), S.unlocked.length + '');
for (const id of NEW) {
  S.reset(); S.unlocked.length = 0; S.BROS.forEach((b) => { if (b.id !== id) S.unlocked.push(b.id); });
  check(id + ': when only he or she is locked, a cage frees them', S.pickRescueBro() === id);
  flat('einstein'); S.unlocked.length = 0; S.BROS.forEach((b) => { if (b.id !== id) S.unlocked.push(b.id); });
  const cage = S.makeEnt({ type: 'cage', c: 31, from: 15 }); S.ents.push(cage); S.P.inv = 1e9;
  for (let i = 0; i < 160 && !S.unlocked.includes(id); i++) { S.P.x = 31 * T; step({ fire: true }); if (i === 30) S.pressed.melee = true; }
  check(id + ': a real cage opens and unlocks them', S.unlocked.includes(id) && S.P.bro.id === id, S.P.bro.id);
}
{ real = true; S.reset(); const locked = new Set(NEW); for (let i = 0; i < 400; i++) { S.reset(); S.unlocked.length = 0; S.unlocked.push('einstein'); const r = S.pickRescueBro(); if (NEW.includes(r)) locked.delete(r); }
  real = false; check('the cage pool includes all four new bros', locked.size === 0, 'missed: ' + [...locked].join(',')); }

// ---------------------------------------------------------------- 10. frame cost on INSANE at 300%, and the shot count stays capped
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

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' bro art checks passed');
process.exit(fails ? 1 : 0);
