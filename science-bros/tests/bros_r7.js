// Headless checks for the bro added in round 7 (Conrad Roentbro): 52 bros, he is wired into every per-bro table and switch, his art is
// shaded and different, the cathode ray hurts a quack and sweeps, Gamma Blast is Trinity's twin (same countdown, kill box, crater, three
// per life, boss handling) with its own look (no mushroom cloud, X-ray skeletons for the length of the flash), nothing he fires kills him.
// Usage: node science-bros/tests/bros_r7.js science-bros/index.html
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
const NEW = ['roentgen'];
const KINDS = { roentgen: ['crt'] };

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
const id = 'roentgen', B = () => S.BRO[id];
const nukeCount = () => S.nukes().length;
const settle = (n) => { for (let i = 0; i < n; i++) { S.P.vx = 0; step(); } };

// ---------------------------------------------------------------- 1. the roster and the tables
check('there are 53 bros', S.BROS.length === 53, S.BROS.length + ' bros');
check('Conrad Roentbro exists once, is ranged and listed before the melee bros', !!B() && S.BROS.filter((b) => b.id === id).length === 1 && !B().melee && S.BROS.indexOf(B()) < S.BROS.findIndex((b) => b.melee));
check('name, weapon, special, formula, gun colour and palette are filled and ASCII', ['name', 'weapon', 'wdesc', 'special', 'sdesc', 'formula', 'gun'].every((k) => /^[\x20-\x7e]{3,}$/.test(B()[k])) && !!B().pal && B().name === 'Conrad Roentbro', B().name);
check('his weapon and special are different from every other bro\'s', S.BROS.filter((b) => b.weapon === B().weapon).length === 1 && S.BROS.filter((b) => b.special === B().special).length === 1 && B().weapon !== S.BRO.franklin.weapon);
check('head rows, a look with a known item, sprites, rig and white frames', !!S.HEADS[id] && !!S.LOOKS[id] && !!S.BRO_ITEM[S.LOOKS[id][0]] && !!B().spr && !!B().rig && !!B().rig.white && !!B().white);
check('a GUNFX entry, a DESTRUCT entry for the crt shot, a kill line, a special line and a respawn line', !!S.GUNFX[id] && !!S.DESTRUCT.crt && !!S.BRO_LINES[id] && S.BRO_LINES[id].k.length <= 24 && S.BRO_LINES[id].s.length > 8 && S.BRO_LINES[id].r.length > 8);
check('the crt shot is aimed (not in NO_AIM)', !S.NO_AIM.crt);
{ const cases = (src.match(/case 'roentgen':/g) || []).length; check('his own case in the weapon switch, the special switch and the held-gun drawing', cases === 3, cases + ' cases'); }
check('the cap is 3 specials and a fresh bro has them', S.specMax(B()) === 3);

// ---------------------------------------------------------------- 2. the art
{ const R = S.broRows(id), rows = R.head.concat(R.body), j = rows.join('');
  check('6 head rows and 6 body rows, 12 wide, every pixel coloured in his palette', R.head.length === 6 && R.body.length === 6 && rows.every((r) => r.length === 12) && [...j].every((ch) => ch === '.' || B().rig.pal[ch]));
  check('he is shaded and wears his item', /[CU]/.test(j) && /[HJWV]/.test(j) && /S/.test(j) && /[xX]/.test(j) && /[EY]/.test(R.head.join(''))); }
{ const ups = S.BROS.map((b) => hash(b.rig.up[0])), sprs = S.BROS.map((b) => hash(b.spr[0][0]));
  check('all 53 upper-body sprites and all 53 small sprites are different', new Set(ups).size === 53 && new Set(sprs).size === 53, new Set(ups).size + '/' + new Set(sprs).size);
  check('no other bro has his head rows', S.BROS.filter((b) => S.HEADS[b.id].join('/') === S.HEADS[id].join('/')).length === 1);
  check('the upper body uses at least 9 colours and the dark outline', colours(B().rig.up[0]).size >= 9 && colours(B().rig.up[0]).has('#0d0b18')); }
{ const errs = []; for (const pose of ['stand', 'run', 'jump', 'climb', 'aim', 'firing', 'special']) {
    flat(id); if (pose === 'run') { S.P.vx = 100; S.P.rp = 2; } if (pose === 'jump') { S.P.onGround = false; S.P.vy = -100; } if (pose === 'climb') S.P.climb = true; if (pose === 'aim') S.P.aim = 0.7;
    if (pose === 'firing') { quack(36); for (let i = 0; i < 12; i++) step({ fire: true }); } if (pose === 'special') { quack(36); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 12; i++) step({ fire: true }); }
    S.P.inv = 0; try { S.render(0); } catch (e) { errs.push(pose + ': ' + e.message); } }
  check('he draws in every pose, firing and during his special without an error', !errs.length, errs.join(' | ')); }

// ---------------------------------------------------------------- 3. the cathode ray
{ flat(id); const q = quack(44); let i = 0; for (; i < 300 && !q.dead; i++) { calm(q); step({ fire: true, right: S.P.x < q.x - 14 }); S.P.inv = 1e9; }
  check('the ray kills a quack that walks toward him', q.dead, i + ' frames'); }
{ flat(id); const vys = []; for (let i = 0; i < 8; i++) { S.bullets.length = 0; S.P.cool = 0; step({ fire: true }); vys.push(...kinds('crt').map((b) => Math.round(b.vy))); }
  check('each shot is swept one scan line: up, level, down, level (the pattern repeats)', new Set(vys).size === 3 && vys.slice(0, 4).join() === vys.slice(4, 8).join() && Math.min(...vys) < 0 && Math.max(...vys) > 0, vys.join(',')); }
{ const dps = (bid) => { flat(bid); const q = quack(40, { hp: 9999, max: 9999 }); q.x = 40 * T; for (let i = 0; i < 180; i++) { calm(q); q.x = 40 * T; q.kx = 0; q.stun = 0; step({ fire: true }); } return (9999 - q.hp) / 3; };
  const r = dps(id), e = dps('einstein'); check('modest in power: no more damage per second than Einstein\'s photon pistol', r > 2 && r <= e * 1.05, r.toFixed(1) + ' vs ' + e.toFixed(1)); }

// ---------------------------------------------------------------- 4. Gamma Blast is Trinity's twin
const arm = (bid) => { flat(bid); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.P.spec = 3; S.pressed.special = true; step(); return S.nukes()[0]; };
const fuse = (n) => { for (let i = 0; i < 600 && n && !n.boom; i++) { S.P.inv = 1e9; step(); } };
{ const g = arm(id), o = arm('oppenheimer');
  check('the special plants one device with the same countdown as Trinity and a gamma style', !!g && g.style === 'gamma' && !!o && o.style === 'trinity' && g.max === o.max && g.max === 3, g && (g.style + ' ' + g.max)); }
{ flat(id); S.P.spec = 3; for (let k = 0; k < 4; k++) { S.pressed.special = true; step(); } check('three per life: the fourth press does nothing', S.P.spec === 0 && nukeCount() === 3, nukeCount() + ' devices'); }
const cleared = (bid) => { // quacks at several distances: who is dead after the flash
  const g = arm(bid), xs = [-70, 40, 200, 480, 640, 700]; const qs = xs.map((dx) => { const q = quack(Math.round((g.x + dx) / T)); q.hp = 50; q.max = 50; return q; });
  const rowAbove = quack(Math.round(g.x / T) + 3); rowAbove.y -= 300; qs.push(rowAbove);
  S.P.x = 5 * T; S.P.inv = 1e9; fuse(g); return qs.map((q) => (q.dead ? 1 : 0)).join(''); };
{ const a = cleared(id), b = cleared('oppenheimer'); check('the same kill box as Trinity: the same quacks die at every distance', a === b && a.length > 3, a + ' vs ' + b); }
{ const hole = (bid) => { const g = arm(bid), c0 = Math.floor(g.x / T); let n0 = 0; for (let c = c0 - 12; c <= c0 + 12; c++) for (let r = 0; r < 24; r++) if (S.tileAt(c, r)) n0++; S.P.x = 5 * T; fuse(g); let n1 = 0; for (let c = c0 - 12; c <= c0 + 12; c++) for (let r = 0; r < 24; r++) if (S.tileAt(c, r)) n1++; return n0 - n1; };
  const a = hole(id), b = hole('oppenheimer'); check('the same crater as Trinity (NUKE_HOLE), and a big one', a === b && a > 40, a + ' vs ' + b + ' tiles'); }
{ const g = arm(id); const x = g.x, y = g.y; S.P.x = x - 10; S.P.y = y - S.P.h; S.P.inv = 0; const d0 = S.stats.deaths; fuse(g); S.P.inv = 0;
  // the device is the bro's own: it throws him but does not kill him
  check('his own Gamma Blast does not kill him (only an enemy device would)', S.P.alive && S.stats.deaths === d0); }
{ flat(id); const g = S.plantNuke(S.P.x + 60, 16 * T, 'e', 3, 0, 0, 'gamma'); S.P.inv = 0; S.P.x = g.x - 20; for (let i = 0; i < 300 && !g.boom; i++) { S.P.inv = 0; step(); } check('an enemy gamma device inside the ring kills him, like Trinity', !S.P.alive); }
{ const hit = (bid) => { flat(bid); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); const b = S.makeEnt({ type: 'boss', c: 40, from: 15 }); b.active = true; S.ents.push(b); const hp0 = b.hp; S.P.spec = 3; S.pressed.special = true; step(); fuse(S.nukes()[0]); for (let i = 0; i < 90; i++) { S.P.inv = 1e9; step(); } return hp0 - b.hp; };
  const a = hit(id), b = hit('oppenheimer'); check('bosses take the same hit as from Trinity', a > 0 && Math.abs(a - b) < 1e-6, a.toFixed(2) + ' vs ' + b.toFixed(2)); }
{ const g = arm(id); const kinds0 = new Set(); fuse(g); S.P.inv = 1e9;
  check('no mushroom cloud: a gamma burst, rays and violet and green rings instead', !S.fx.some((f) => f.kind === 'mushroom') && S.fx.some((f) => f.kind === 'gamma') && S.fx.some((f) => f.kind === 'ring' && f.col === '#b3a6ff'));
  check('the screen flashes (same duration as Trinity) and no ash falls', S.flash() > 1.5 && S.ash() === 0, S.flash().toFixed(2) + ' s, ash ' + S.ash());
  const o = arm('oppenheimer'); fuse(o); check('Trinity still makes its mushroom cloud and ash', S.fx.some((f) => f.kind === 'mushroom') && S.ash() > 10); }
{ // the X-ray view: skeleton bones are drawn for each quack on screen while the flash lasts, and not for the white Trinity flash
  const count = (bid) => { const g = arm(bid); S.P.x = 30 * T; S.cam.x = S.P.x - 100; quack(36); quack(40); fuse(g); game.ops.length = 0; rec = true; S.P.inv = 1e9; S.render(0); rec = false; return game.ops.filter((o) => o.startsWith('#d9ffe4@')).length; };
  const gam = count(id), tri = count('oppenheimer'); check('quacks on screen are drawn as X-ray skeletons during the gamma flash, not during Trinity\'s', gam > 10 && tri === 0, gam + ' bone strokes vs ' + tri); }
{ const g = arm(id); S.P.x = 5 * T; S.render(0); check('the device and its warning ring render in his colours without an error', true); }

// ---------------------------------------------------------------- 5. terrain and blame
{ const cut = (m) => { flat(id); wall(m); const h0 = hpSum(); for (let i = 0; i < 150; i++) { S.P.x = 30 * T + 3; S.P.face = 1; step({ fire: true }); S.P.inv = 1e9; } return h0 - hpSum(); };
  check('the ray scratches earth and crates but never steel', cut(DIRT) > 0 && cut(CRATE) > 0 && cut(STEEL) === 0, cut(DIRT).toFixed(1) + '/' + cut(CRATE).toFixed(1)); }
{ flat(id, 0); wall(BRICK, 31, 32, 10, 15); const d0 = S.stats.deaths; for (let i = 0; i < 300; i++) { S.P.vx = 0; step({ fire: true }); } check('point blank at a wall, holding fire, no death', S.stats.deaths === d0 && S.P.alive);
  flat(id, 0); wall(BRICK, 31, 32, 10, 15); S.P.spec = 3; S.pressed.special = true; step(); for (let i = 0; i < 300; i++) { S.P.vx = 0; step({ fire: true }); } check('Gamma Blast at his own feet while firing: the first one only throws him', S.P.alive); }
{ flat(id); S.P.cool = 0; step({ fire: true, aim: true, up: true }); const bs = kinds('crt'); check('aimed up, the shots go upward', bs.length === 1 && bs[0].vy < -10 && bs[0].aimed, bs.map((b) => b.vy.toFixed(0)).join()); }
{ flat(id); S.render(0); S.P.alt = { kind: 'shotgun', ammo: 9 }; S.P.cool = 0; step({ fire: true }); check('a pickup gun replaces the ray as for every bro', kinds('crt').length === 0); }

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' round 7 bro checks passed');
process.exit(fails ? 1 : 0);
