// Headless checks for the five bros added in round 6 (Fibonacci, McClintock, Kekule, Linnaeus, Leeuwenhoek): 51 bros,
// each new bro is wired into every per-bro table and switch, his art is shaded, has a signature item and differs from every
// other bro (the painted pixels are hashed), each weapon hurts a quack and does its own trick, each special works and is
// limited like the others, weapon and special cut terrain by material and never steel, nothing they fire kills the player,
// the aim works, they hurt every boss at a fair pace, a cage frees each of them, and they have their lines.
// Frame times are printed for information only (they swing with machine load).
// Usage: node science-bros/tests/bros_r6.js science-bros/index.html
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
const NEW = ['fibonacci', 'mcclintock', 'kekule', 'linnaeus', 'leeuwenhoek'];
const KINDS = { fibonacci: ['fib'], mcclintock: ['gene'], kekule: ['benzene'], linnaeus: ['tag'], leeuwenhoek: ['microbe'] }; // the shot kinds each weapon fires
const SPEC_KINDS = ['rabbit', 'cob', 'kernel', 'snake']; // the shots their specials make
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

// ---------------------------------------------------------------- 1. the roster, the tables and the switches
check('there are 51 bros', S.BROS.length === 51, S.BROS.length + ' bros');
check('the five new bros each exist exactly once', NEW.every((id) => S.BRO[id] && S.BROS.filter((b) => b.id === id).length === 1));
check('the new bros are ranged bros listed before the melee bros', NEW.every((id) => !S.BRO[id].melee) && Math.max(...NEW.map((id) => S.BROS.indexOf(S.BRO[id]))) < S.BROS.findIndex((b) => b.melee));
for (const id of NEW) {
  const b = S.BRO[id];
  check(id + ': name, weapon, special, formula, gun colour and palette are filled', ['name', 'weapon', 'wdesc', 'special', 'sdesc', 'formula', 'gun'].every((k) => typeof b[k] === 'string' && b[k].length > 2) && !!b.pal, b.name);
  check(id + ': head rows, a look (item and colour) and a known item', !!S.HEADS[id] && !!S.LOOKS[id] && !!S.BRO_ITEM[S.LOOKS[id][0]] && /^#[0-9a-f]{6}$/.test(S.LOOKS[id][1]), (S.LOOKS[id] || []).join(' '));
  check(id + ': sprites, white flash frames and rig are built', !!b.spr && !!b.white && !!b.rig && !!b.rig.white);
  check(id + ': a GUNFX entry with flash and colours', !!S.GUNFX[id] && !!S.GUNFX[id].flash && S.GUNFX[id].c.length === 2);
  check(id + ': a DESTRUCT entry for every shot kind its weapon fires', KINDS[id].every((k) => !!S.DESTRUCT[k]), KINDS[id].join(','));
  check(id + ': the weapon is aimed (not in NO_AIM)', KINDS[id].every((k) => !S.NO_AIM[k]));
  check(id + ': a BOSS_MUL entry only if it is a sane number', !(id in S.BOSS_MUL) || (S.BOSS_MUL[id] >= 1 && S.BOSS_MUL[id] <= 2.5), String(S.BOSS_MUL[id] || 1));
  const cases = (src.match(new RegExp("case '" + id + "':", 'g')) || []).length;
  check(id + ': has its own case in fireWeapon, useSpecial and the held-gun drawing', cases === 3, cases + ' cases');
  const L = S.BRO_LINES[id];
  check(id + ': a kill shout (at most 24 characters), a special line and a respawn line', !!L && L.k && L.k.length <= 24 && L.s && L.s.length > 8 && L.r && L.r.length > 8, L ? L.k : 'none');
}
check('the special shots have DESTRUCT entries too (rabbit, cob, kernel, snake)', SPEC_KINDS.every((k) => !!S.DESTRUCT[k]));
check('no new shot kind is in NO_AIM (none needs to skip the aim)', [...Object.values(KINDS).flat(), ...SPEC_KINDS].every((k) => !S.NO_AIM[k]));
check('every new name is a bro pun and ASCII, so the pixel font can draw it', NEW.every((id) => /bro$/.test(S.BRO[id].name) && /^[\x20-\x7e]+$/.test(S.BRO[id].name + S.BRO[id].weapon + S.BRO[id].special + S.BRO[id].formula + S.BRO[id].wdesc + S.BRO[id].sdesc)));
check('the five weapons and specials all have different names', new Set(S.BROS.map((b) => b.weapon)).size === 51 && new Set(S.BROS.map((b) => b.special)).size >= 50, new Set(S.BROS.map((b) => b.weapon)).size + ' weapon names');

// ---------------------------------------------------------------- 2. the art: shaded rows, a signature item, different from every other bro
{ const bad = []; for (const id of NEW) { const b = S.BRO[id], R = S.broRows(id), rows = R.head.concat(R.body); if (R.head.length !== 6 || R.body.length !== 6 || rows.some((r) => r.length !== 12) || [...rows.join('')].some((ch) => ch !== '.' && !b.rig.pal[ch])) bad.push(id); }
  check('each new bro is 6 head rows and 6 body rows, 12 wide, and every pixel has a colour in his palette', !bad.length, bad.join(',')); }
{ const bad = NEW.filter((id) => { const j = S.broRows(id).head.concat(S.broRows(id).body).join(''); return !/[CU]/.test(j) || !/[HJWV]/.test(j) || !/S/.test(j) || !/[xX]/.test(j) || !/[EY]/.test(S.broRows(id).head.join('')); });
  check('each new bro is shaded (coat rim, hair rim, skin shadow, brow) and wears his signature item', !bad.length, bad.join(',')); }
{ const ups = S.BROS.map((b) => hash(b.rig.up[0])), sprs = S.BROS.map((b) => hash(b.spr[0][0]));
  check('all 51 upper-body sprites are different (hash of the painted pixels)', new Set(ups).size === 51, new Set(ups).size + ' different');
  check('all 51 small sprites (HUD, roster, cages) are different', new Set(sprs).size === 51, new Set(sprs).size + ' different');
  const heads = S.BROS.map((b) => S.HEADS[b.id].join('/')); check('no new bro reuses another bro\'s head rows', NEW.every((id) => heads.filter((h) => h === S.HEADS[id].join('/')).length === 1));
  check('the hashes are real: each new sprite painted over 90 pixels', NEW.every((id) => S.BRO[id].rig.up[0].ops.length > 90 && S.BRO[id].spr[0][0].ops.length > 90)); }
{ const thin = NEW.filter((id) => colours(S.BRO[id].rig.up[0]).size < 9).map((id) => id + ' ' + colours(S.BRO[id].rig.up[0]).size);
  check('each new upper body uses at least 9 colours and has the dark outline', !thin.length && NEW.every((id) => colours(S.BRO[id].rig.up[0]).has('#0d0b18')), thin.join(', ')); }
check('the white hit flash is all white', NEW.every((id) => [...colours(S.BRO[id].rig.white.up[0])].every((c) => c === '#ffffff' || c === '#0d0b18')));
{ const errs = [], missing = []; drawLog = new Set();
  for (const id of NEW) for (const pose of ['stand', 'run', 'jump', 'climb', 'aim', 'firing', 'special']) {
    flat(id); drawLog.clear();
    if (pose === 'run') { S.P.vx = 100; S.P.rp = 2; } if (pose === 'jump') { S.P.onGround = false; S.P.vy = -100; } if (pose === 'climb') S.P.climb = true; if (pose === 'aim') S.P.aim = 0.7;
    if (pose === 'firing') { quack(36); for (let i = 0; i < 12; i++) step({ fire: true }); }
    if (pose === 'special') { quack(36); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 12; i++) step({ fire: true }); }
    S.P.inv = 0; try { S.render(0); } catch (e) { errs.push(id + ' ' + pose + ': ' + e.message); }
    if (!S.BRO[id].rig.up.some((c) => drawLog.has(c))) missing.push(id + ' ' + pose);
  }
  drawLog = null;
  check('every new bro draws in every pose, firing and during his special without an error', !errs.length, errs.slice(0, 3).join(' | '));
  check('and what is drawn is his own rig', !missing.length, missing.slice(0, 5).join(', ')); }

// ---------------------------------------------------------------- 3. each weapon hurts quacks, and does its trick
for (const id of NEW) {
  flat(id); const q = quack(44); let i = 0; for (; i < 300 && !q.dead; i++) { calm(q); step({ fire: true, right: S.P.x < q.x - 14 }); S.P.inv = 1e9; }
  check(id + ': the weapon kills a quack that walks toward it', q.dead, i + ' frames');
}
{ flat('fibonacci'); const n = []; for (let i = 0; i < 7; i++) { S.bullets.length = 0; S.P.cool = 0; step({ fire: true }); n.push(kinds('fib').length); }
  check('Fibonacci: the pulls fire 1, 1, 2, 3, 5 shots, then the sequence starts again', n.join(',') === '1,1,2,3,5,1,1', n.join(','));
  flat('fibonacci'); for (let i = 0; i < 4; i++) { S.P.cool = 0; step({ fire: true }); } S.bullets.length = 0; S.P.cool = 0; step({ fire: true }); const fv = kinds('fib');
  check('Fibonacci: the five shots of a pull fan out a little, one above the other', fv.length === 5 && new Set(fv.map((b) => Math.round(b.vy))).size === 5, fv.map((b) => b.vy.toFixed(0)).join(' ')); }
{ flat('mcclintock'); const a = quack(36, { hp: 60, max: 60 }), b2 = quack(41, { hp: 60, max: 60 }), c = quack(46, { hp: 60, max: 60 }), d = quack(60, { hp: 60, max: 60 }); calm(a, b2, c, d);
  b2.y -= 30; c.y -= 30; S.P.cool = 0; step({ fire: true }); S.P.cool = 9; // b2 and c hover above the line of fire, so only a jump reaches them
  for (let i = 0; i < 60; i++) { calm(a, b2, c, d); b2.vy = 0; c.vy = 0; b2.y = 16 * T - b2.h - 30; c.y = 16 * T - c.h - 30; step(); }
  check('McClintock: one gene hits a quack, then jumps to the next and the next, but not back and not across the screen', Math.abs(60 - a.hp - 1.7) < 0.01 && b2.hp < 60 && c.hp < 60 && d.hp === 60, 'damage ' + [a, b2, c, d].map((q) => (60 - q.hp).toFixed(1)).join(' / ')); }
{ flat('kekule'); const q = quack(39, { hp: 60, max: 60 }); calm(q); S.P.cool = 0; step({ fire: true }); S.P.cool = 99; const r = kinds('benzene')[0], x0 = r.x, v0 = Math.abs(r.vx); let hits = 0, last = 60;
  for (let i = 0; i < 80; i++) { calm(q); q.x = 39 * T; q.kx = 0; step(); if (q.hp < last - 0.01) hits++; last = q.hp; }
  check('Kekule: one ring rolls out about 8 tiles, stops there and grinds the same quack several times', hits >= 3 && r.vx === 0 && Math.abs(r.x - x0) > 110 && Math.abs(r.x - x0) < 160, hits + ' hits, speed ' + v0.toFixed(0) + ' -> ' + Math.abs(r.vx).toFixed(0) + ', rolled ' + Math.abs(r.x - x0).toFixed(0) + ' px'); }
{ flat('linnaeus'); S.cam.x = 30 * T - 150; const a = quack(36, { hp: 60, max: 60 }), b2 = quack(44, { hp: 60, max: 60 }), sc = quack(40, { hp: 60, max: 60 }, 'scout'); calm(a, b2, sc); b2.y -= 40; sc.y -= 40;
  S.P.cool = 0; step({ fire: true }); S.P.cool = 9; for (let i = 0; i < 30; i++) { calm(a, b2, sc); b2.vy = 0; sc.vy = 0; b2.y = 16 * T - b2.h - 40; sc.y = 16 * T - sc.h - 40; step(); }
  const named = S.fx.some((f) => f.kind === 'text' && /^QUACKUS /.test(f.txt));
  check('Linnaeus: a tagged grunt is hit, another grunt on screen takes half, a quack of another kind takes nothing', Math.abs(60 - a.hp - 1.5) < 0.01 && Math.abs(60 - b2.hp - 0.75) < 0.01 && sc.hp === 60 && named, 'damage ' + [a, b2, sc].map((q) => (60 - q.hp).toFixed(2)).join(' / ') + (named ? ', named' : '')); }
{ flat('leeuwenhoek'); S.P.cool = 0; step({ fire: true }); const two = kinds('microbe').length; S.P.cool = 9;
  const q = quack(36, { hp: 60, max: 60 }); calm(q); let daughters = 0; for (let i = 0; i < 30; i++) { calm(q); step(); daughters = Math.max(daughters, S.bullets.filter((b) => b.kind === 'microbe' && b.gen === 1).length); }
  check('Leeuwenhoek: two microbes a pull; one that hits splits into two daughters that spare the quack it hit', two === 2 && daughters >= 2 && Math.abs(60 - q.hp - 2.4) < 0.01, two + ' microbes, ' + daughters + ' daughters, damage ' + (60 - q.hp).toFixed(2)); }

// ---------------------------------------------------------------- 4. each special works, and is limited like the others
{ flat('fibonacci'); S.P.spec = 3; S.pressed.special = true; step(); const n = [kinds('rabbit').length]; let hop = false, under = false;
  for (const t of [1.2, 2.1, 3.0, 3.9, 4.8]) { while (S.lifeT < t + 0.05) { step(); for (const b of kinds('rabbit')) { if (b.vy < -100) hop = true; if (b.y > 16 * T) under = true; } } n.push(kinds('rabbit').length); }
  run(80); const gone = kinds('rabbit').length;
  check('Fibonacci: the rabbits breed by the sequence (2, 2, 4, 6, 10, 16), hop on the ground and are gone after 6 s', n.join(',') === '2,2,4,6,10,16' && hop && !under && gone === 0, n.join(',') + ', ' + gone + ' left' + (under ? ', one fell into the ground' : ''));
  flat('fibonacci'); const q = quack(36, { hp: 200, max: 200 }); calm(q); S.P.spec = 3; S.pressed.special = true; step(); let bites = 0, last = 200;
  for (let i = 0; i < 60 * 4; i++) { calm(q); q.x = 36 * T; q.kx = 0; step(); if (q.hp < last - 0.01) bites++; last = q.hp; }
  check('Fibonacci: the rabbits bite a quack again and again', bites >= 4, bites + ' bites, ' + (200 - q.hp).toFixed(1) + ' damage'); }
{ flat('mcclintock'); const a = quack(38, { hp: 4, max: 4 }), b2 = quack(40, { hp: 4, max: 4 }); calm(a, b2); S.P.spec = 3; S.pressed.special = true; step(); let ker = 0, bounced = false;
  for (let i = 0; i < 150; i++) { calm(a, b2); step(); ker = Math.max(ker, kinds('kernel').length); if (kinds('kernel').some((b) => b.bounce < 2)) bounced = true; }
  check('McClintock: the cob pops into 14 kernels that bounce, and weak quacks near it die', ker >= 14 && bounced && a.dead && b2.dead, ker + ' kernels' + (bounced ? ', bounced' : '')); }
{ flat('kekule'); const q = quack(31, { hp: 200, max: 200 }); calm(q); S.P.spec = 3; S.pressed.special = true; step(); const segs = kinds('snake').length; let bites = 0, last = 200, far = 0;
  for (let i = 0; i < 60 * 3; i++) { calm(q); q.x = 31 * T; q.kx = 0; step(); if (q.hp < last - 0.01) bites++; last = q.hp; for (const b of kinds('snake')) far = Math.max(far, Math.hypot(b.x - S.P.x - 5, b.y - S.P.y - 6)); }
  run(60 * 3.2); const left = kinds('snake').length;
  check('Kekule: a snake of 12 segments circles him close, bites a quack beside him again and again, and is gone after 6 s', segs === 12 && bites >= 4 && left === 0 && far < 25, segs + ' segments, ' + bites + ' bites, reach ' + far.toFixed(0));
  flat('kekule', 0); S.P.spec = 3; S.pressed.special = true; step(); const d0 = S.stats.deaths; let shots = 0, through = 0;
  for (let i = 0; i < 60 * 4; i++) { if (i % 20 === 0) { S.bullets.push({ x: S.P.x + 70, y: S.P.y + 4 + (i % 60) / 10, vx: -260, vy: 0, owner: 'e', dmg: 1, life: 1, kind: 'pill' }); shots++; } step(); S.P.vx = 0; through += S.bullets.filter((b) => b.owner === 'e' && !b.dead && b.x < S.P.x + 12).length; }
  check('Kekule: the snake swallows the shots fired at him; he is never hit', S.stats.deaths === d0 && S.P.alive && through === 0, shots + ' shots, ' + through + ' got inside the ring'); }
{ flat('linnaeus'); run(10); const cx = Math.floor((S.cam.x + 300) / T), g = [0, 2, 4].map((k) => quack(cx + k, { hp: 60, max: 60 })), sc = quack(cx + 7, { hp: 60, max: 60 }, 'scout'); calm(...g, sc);
  S.P.spec = 3; S.pressed.special = true; step(); const st = g.concat(sc).map((q) => q.stun || 0);
  check('Linnaeus: Systema Naturae stuns every quack on screen; three grunts take 7 each, a lone scout 3', st.every((v) => v >= 1.9) && g.every((q) => Math.abs(60 - q.hp - 7) < 0.01) && Math.abs(60 - sc.hp - 3) < 0.01, 'damage ' + g.concat(sc).map((q) => (60 - q.hp).toFixed(0)).join('/') + ', stun ' + st.map((v) => v.toFixed(1)).join('/')); }
{ flat('leeuwenhoek'); S.P.spec = 3; S.pressed.special = true; step(); const lens = S.P.lens; S.P.cool = 0; step({ fire: true }); const big = kinds('microbe');
  run(60 * 6.1); S.bullets.length = 0; S.P.cool = 0; step({ fire: true }); const small = kinds('microbe');
  check('Leeuwenhoek: Magnify lasts 6 s: his microbes are twice the size and hit twice as hard, then back to normal', lens > 5.9 && big.length === 2 && big.every((b) => b.big && Math.abs(b.dmg - 2.4) < 1e-9 && b.hitR === 6) && small.every((b) => !b.big && b.dmg === 1.2), big.map((b) => b.dmg).join(',') + ' -> ' + small.map((b) => b.dmg).join(','));
  flat('leeuwenhoek'); S.P.spec = 3; S.pressed.special = true; step(); S.P.alt = { kind: 'shotgun', ammo: 9 }; S.P.cool = 0; step({ fire: true }); const alt = S.bullets.filter((b) => b.owner === 'p' && b.kind !== 'microbe');
  check('Leeuwenhoek: Magnify works on a pickup gun too', alt.length > 0 && alt.every((b) => b.big), alt.length + ' pellets'); }
{ let ok = true; const info = [];
  for (const id of NEW) { flat(id); S.P.spec = 1; S.pressed.special = true; step(); const left = S.P.spec; S.pressed.special = true; step(); const stop = S.P.spec; info.push(id + ' ' + left + '/' + stop); ok = ok && left === 0 && stop === 0 && S.specMax(S.BRO[id]) === 3; }
  check('every new special costs one charge, cannot fire at zero, and the cap is 3 like the others', ok, info.join(', ')); }

// ---------------------------------------------------------------- 5. terrain: weapon and special cut it by material, steel never
const cuts = {}, mats = { earth: DIRT, brick: BRICK, crate: CRATE, ice: ICE };
for (const id of NEW) { cuts[id] = {}; for (const [n, m] of Object.entries(mats)) cuts[id][n] = cutBy(id, m, 150); }
for (const id of NEW) check(id + ': the weapon cuts earth and crates', cuts[id].earth > 0 && cuts[id].crate > 0, JSON.stringify(cuts[id]));
check('Kekule\'s ring eats earth faster than brick (it grinds like acid)', cuts.kekule.earth > cuts.kekule.brick * 2, JSON.stringify(cuts.kekule));
check('Leeuwenhoek\'s microbes eat earth, hardly brick', cuts.leeuwenhoek.earth > cuts.leeuwenhoek.brick, JSON.stringify(cuts.leeuwenhoek));
check('the five weapons leave five different patterns of damage', new Set(NEW.map((id) => Object.values(cuts[id]).map((v) => v.toFixed(1)).join(','))).size === 5);
for (const id of ['fibonacci', 'mcclintock']) { const sp = Object.values(mats).map((m) => cutBy(id, m, 220, true)); check(id + ': the special damages terrain too (rabbits dig, the cob pops)', sp.some((v) => v > 0), sp.map((v) => v.toFixed(1)).join('/')); }
{ const sp = Object.values(mats).map((m) => cutBy('kekule', m, 220, true)); check('kekule: the snake passes over blocks without cutting them (it circles at his feet)', sp.every((v) => v === 0), sp.join('/')); }
let steel = 0; for (const id of NEW) { steel += cutBy(id, STEEL, 120); steel += cutBy(id, STEEL, 120, true); } check('steel stands up to every weapon and special of the five', steel === 0, steel + ' damage');

// ---------------------------------------------------------------- 6. nothing they fire kills the player (blame)
const pb = (x, y, extra = {}) => S.bullets.push(Object.assign({ x, y, vx: 0, vy: 100, owner: 'p', dmg: 99, tdmg: 0, life: 1, kind: 'pill' }, extra));
const survives = (id, setup, frames = 240) => { flat(id, 0); const d0 = S.stats.deaths; setup(); for (let i = 0; i < frames && S.stats.deaths === d0; i++) { S.P.vx = 0; step({ fire: true }); S.P.face = 1; } return S.stats.deaths === d0 && S.P.alive; };
for (const id of NEW) {
  check(id + ': point blank at a wall, holding fire, no death', survives(id, () => wall(BRICK, 31, 32, 10, 15)));
  check(id + ': point blank at a steel wall, no death', survives(id, () => wall(STEEL, 31, 32, 10, 15)));
  check(id + ': its special at its own position, firing all the while, no death', (() => { flat(id, 0); const d0 = S.stats.deaths; wall(BRICK, 31, 32, 10, 15); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 420; i++) { S.P.vx = 0; step({ fire: true }); } return S.stats.deaths === d0 && S.P.alive; })());
}
check('McClintock: the cob going off at her feet', survives('mcclintock', () => pb(S.P.x + 5, S.P.y + 14, { kind: 'cob', explode: 22, tp: 1.5, dmg: 4 })));
check('McClintock: kernels raining on her', survives('mcclintock', () => { for (let k = 0; k < 14; k++) pb(S.P.x + 5 + k - 7, S.P.y - 10, { kind: 'kernel', vy: 200, dmg: 2, bounce: 2 }); }));
check('Fibonacci: rabbits hopping through him', survives('fibonacci', () => { for (let k = 0; k < 16; k++) pb(S.P.x + 5, S.P.y + 8, { kind: 'rabbit', vx: (k & 1 ? 1 : -1) * 100, vy: -150, dir: k & 1 ? 1 : -1, dmg: 1.5, life: 3, hitR: 4 }); }));
check('Kekule: a benzene ring grinding at his feet', survives('kekule', () => pb(S.P.x + 5, S.P.y + 12, { kind: 'benzene', vx: 1, vy: 0, dmg: 1.1, pierce: 99, hitR: 6, spin: 0, tick: 0 })));
check('Leeuwenhoek: magnified microbes splitting at his feet', survives('leeuwenhoek', () => { S.P.lens = 6; pb(S.P.x + 5, S.P.y + 14, { kind: 'microbe', gen: 0, ph: 0, big: 1, dmg: 2.4, hitR: 6 }); }));

// ---------------------------------------------------------------- 7. the aim system turns their shots
for (const id of NEW) {
  flat(id); S.P.cool = 0; step({ fire: true, aim: true, up: true }); const bs = S.bullets.filter((b) => b.owner === 'p' && KINDS[id].includes(b.kind));
  check(id + ': aimed up, the shots go upward', bs.length >= 1 && bs.every((b) => b.vy < -10 && b.aimed), bs.map((b) => b.vx.toFixed(0) + ',' + b.vy.toFixed(0)).join(' '));
  flat(id); const q = quack(31, { hp: 999, max: 999 }); let ok = false;
  for (let i = 0; i < 150 && !ok; i++) { S.P.x = 31 * T; S.P.inv = 1e9; q.x = 31 * T; q.y = S.P.y - 3 * T - q.h; q.vy = 0; calm(q); q.stun = 0; step({ fire: true, aim: true, up: true }); ok = q.hp < 999; }
  check(id + ': aimed up hurts a quack 3 tiles over its head', ok, (999 - q.hp).toFixed(1));
}

// ---------------------------------------------------------------- 8. every boss can be hurt at a fair pace (against the first five bros)
// The bot is the one in bros_art.js. Where it ends up standing is chaotic (a ledge just above King Citrus, say), so each
// fight runs from three seeds and the median damage per second counts, for the reference bros and the new ones alike.
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const solid = (v) => v !== 0 && v !== 5 && v !== 7;
const pick = {};
const LIST = []; for (let l = 0; l < S.nLevels; l++) LIST.push([l, true]); LIST.push([1, false]); LIST.push([S.MOON, true]);
for (const [l, fin] of LIST) { S.startLevel(l); const B = S.ents.find((e) => BOSSES.includes(e.type) && !!e.final === fin); if (B && !pick[B.type]) pick[B.type] = [l, fin]; }
const SEEDS = [7, 11, 13];
const fight3 = (id, type) => SEEDS.map((sd) => fight(id, type, 15, sd)).sort((a, b) => a.dps - b.dps)[1];
const fight = (id, type, secs = 15, sd = 7) => {
  const [lvl, fin] = pick[type];
  seed = sd; S.startLevel(lvl); S.endCeasefire(); S.finishObjectives(); step();
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
  const refDps = {}; for (const ty of BOSSES) refDps[ty] = med(ref.map((id) => fight3(id, ty).dps));
  for (const id of NEW) {
    const rows = BOSSES.map((ty) => fight3(id, ty)); if (process.env.R6BOSS) console.log(id + ': ' + BOSSES.map((ty, i) => ty + ' ' + (rows[i].dps / refDps[ty]).toFixed(2) + ' ttk ' + rows[i].ttk.toFixed(0)).join(', '));
    const slow = BOSSES.filter((ty, i) => rows[i].dps < refDps[ty] / 4 || rows[i].ttk > 180), rel = med(rows.map((r, i) => r.dps / (refDps[BOSSES[i]] || 1))), worst = Math.max(...rows.map((r) => r.ttk));
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
  real = false; check('the cage pool includes all five new bros', locked.size === 0, 'missed: ' + [...locked].join(',')); }
check('freeing every one of the 51 bros fills the roster (unlocked can reach 51)', (() => { S.unlocked.length = 0; S.BROS.forEach((b) => S.unlocked.push(b.id)); return S.unlocked.length === 51; })());

// ---------------------------------------------------------------- 10. their lines reach the radio
for (const id of NEW) { S.P.bro = S.BRO[id]; S.resetWit(); S.radioQ.length = 0; S.broQuip('s'); S.broQuip('s'); check(id + ': quips his special line on the radio', S.radioQ.some((m) => m.line === S.BRO_LINES[id].s)); }

// ---------------------------------------------------------------- 11. a busy fight: the shot count stays capped (frame times printed, not checked)
{
  const level = () => { S.setDifficulty(3, false); S.setDensity(6, false); S.reset(); S.startLevel(17); };
  const quacks = () => S.ents.filter((e) => S.THREAT[e.type] && !e.dead);
  const measure = (id) => {
    level(); S.P.bro = S.BRO[id]; S.endCeasefire(); S.P.alt = null;
    let best = 24, bn = 0; for (let c = 24; c < 330; c += 4) { const k = quacks().filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (k > bn) { bn = k; best = c; } }
    const near = quacks().find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60);
    for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); }
    const N = 300; let maxB = 0; const t0 = Date.now();
    for (let i = 0; i < N; i++) { S.P.inv = 1e9; if (i % 60 === 0) { S.P.spec = 3; S.pressed.special = true; } if (i % 20 === 0) S.explode(S.P.x + 60, S.P.y + 8, 30, 1, 'p', 0); step({ fire: true }, true); maxB = Math.max(maxB, S.bullets.length); }
    return [(Date.now() - t0) / N, maxB];
  };
  const [base] = measure('einstein');
  console.log('(for scale: Einstein ' + base.toFixed(2) + ' ms a frame with a special every second, INSANE / 300%; frame times swing with machine load and are not checked)');
  for (const id of NEW) { const [ms, mb] = measure(id); console.log('(' + id + ': ' + ms.toFixed(2) + ' ms a frame, at most ' + mb + ' shots in the air)'); check(id + ': never more than 200 shots in the air, firing with a special every second', mb <= 200, mb + ' shots'); }
}

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' round 6 bro checks passed');
process.exit(fails ? 1 : 0);
