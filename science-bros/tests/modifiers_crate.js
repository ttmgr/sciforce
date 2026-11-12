// Headless checks for the mission modifiers (DARK, FLOODED, RESTLESS, GALE) and the grant crate with its auditor: each modifier starts and is off in the boss arena,
// the fixed assignment, FLOODED never covers an objective, cage or flag, the crate's loot and the auditor (12 hp, no shooting, blocked by walls, gone after 45 s),
// and random maps get their modifiers and crate from a derived roll that leaves tiles and the main random stream alone.
// Usage: node science-bros/tests/modifiers_crate.js science-bros/index.html
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

const names = Array.from({ length: S.nLevels }, (_, i) => S.levelDef(i).name), at = (n) => names.indexOf(n);
const live = (l) => { S.reset(); S.startLevel(l); S.endCeasefire(); S.P.inv = 1e9; step(); };
const frames = (n, f) => { for (let i = 0; i < n; i++) { S.P.inv = 1e9; if (f) f(i); step(); } };
const withMod = (k) => names.map((n, i) => i).filter((i) => (S.levelDef(i).mods || []).includes(k));

// ---------------------------------------------------------------- 1. the fixed assignment
{ const mod = names.map((n, i) => [i, S.levelDef(i).mods || []]).filter(([, m]) => m.length);
  check('about ten campaign missions carry a modifier, about three of them two', mod.length >= 9 && mod.length <= 13 && mod.filter(([, m]) => m.length === 2).length >= 2 && mod.filter(([, m]) => m.length === 2).length <= 4, mod.length + ' missions, ' + mod.filter(([, m]) => m.length === 2).length + ' with two');
  check('no mission carries more than two, and only known ones, never twice', mod.every(([, m]) => m.length <= 2 && new Set(m).size === m.length && m.every((k) => ['dark', 'flooded', 'restless', 'gale'].includes(k))));
  check('none in missions 1 to 3, Detox Express, Flat Earth Station or Pyramid Power Plant', [0, 1, 2].every((i) => !(S.levelDef(i).mods || []).length) && ['DETOX EXPRESS', 'FLAT EARTH STATION', 'PYRAMID POWER PLANT'].every((n) => !(S.levelDef(at(n)).mods || []).length));
  check('all four modifiers are used', ['dark', 'flooded', 'restless', 'gale'].every((k) => withMod(k).length >= 2), ['dark', 'flooded', 'restless', 'gale'].map((k) => k + ':' + withMod(k).length).join(' '));
  const a = JSON.stringify(mod); S.reset(); S.startLevel(0); check('the assignment is the same every play (level data, no dice)', a === JSON.stringify(names.map((n, i) => [i, S.levelDef(i).mods || []]).filter(([, m]) => m.length))); }

// ---------------------------------------------------------------- 2. each modifier starts, and is off in the boss arena
const arenaOf = () => S.ents.find((e) => e.final && e.ax0 !== undefined);
const inArena = () => { const b = arenaOf(); S.P.x = (b.ax0 + 3) * T; S.P.y = 8 * T; S.P.vy = 0; };
{ const l = withMod('dark')[0]; live(l); frames(120); const on = S.modState(); inArena(); frames(120); const off = S.modState();
  check('DARK: the blackout darkness is on for the mission (' + names[l] + ') and fades out in the boss arena', on.live && on.dark > 0.95 && !off.live && off.dark < 0.05, on.dark.toFixed(2) + ' -> ' + off.dark.toFixed(2)); }
{ const l = withMod('flooded')[0]; live(l); const fl = S.devs.filter((d) => d.kind === 'flood' && d.cyc);
  check('FLOODED: basins on the way carry cyclic flood devices (' + names[l] + ', ' + fl.length + ')', fl.length >= 1 && fl.every((d) => d.top < d.bot && d.bot - d.top <= 3));
  const d = fl[0]; const seen = []; S.P.x = d.x0 - 60; frames(60 * 40, () => { S.P.x = d.x0 - 60; S.P.y = 10 * T; if (seen[seen.length - 1] !== d.state) seen.push(d.state); });
  check('FLOODED: a warning comes before it rises, then it holds, drains and rests', seen.indexOf('warn') >= 0 && seen.indexOf('warn') < seen.indexOf('rise') && seen.includes('hold') && seen.includes('drain'), seen.join('>'));
  live(l); const d2 = S.devs.filter((x) => x.kind === 'flood' && x.cyc)[0]; inArena(); frames(60 * 20, () => inArena()); check('FLOODED: nothing starts in the boss arena', d2.state === 'idle' && !S.modState().live, d2.state); }
{ const l = withMod('gale')[0]; live(l); const w = S.devs.filter((d) => d.kind === 'wind' && d.mod);
  check('GALE: a wind device spans the stretch up to the arena (' + names[l] + ')', w.length === 1 && w[0].x1 < arenaOf().ax0 * T && w[0].x1 - w[0].x0 > 150 * T);
  let warn = false, gust = false; S.P.x = 40 * T; frames(60 * 9, () => { S.P.x = 40 * T; if (w[0].warn) warn = true; if (w[0].pow > 0.9) gust = true; });
  check('GALE: the existing warning streaks come first, then a gust', warn && gust);
  const x0 = w[0].x1; check('GALE: the gusts end before the boss arena, so it is calm there', w[0].x1 <= (arenaOf().ax0 - 20) * T, x0 / T + ' vs ' + arenaOf().ax0); }
{ const l = withMod('restless')[0]; live(l); S.ents.forEach((e) => { if (e.type !== 'flag' && !e.final) e.dead = true; }); S.P.x = 30 * T; S.P.y = 10 * T;
  S.bodies.length = 0; const qs = []; for (let i = 0; i < 60; i++) { const q = S.makeEnt({ type: 'grunt', c: 20 + (i % 20), from: 6 }); q.cool = 99; q.react = 99; S.ents.push(q); qs.push(q); }
  for (const q of qs) S.killEnemy(q, 'shot'); frames(60 * 6);
  const up = S.ents.filter((e) => e.revived && !e.dead);
  check('RESTLESS: some killed quacks get back up (' + up.length + ' of 60)', up.length >= 3 && up.length <= 40);
  up.forEach((q) => S.killEnemy(q, 'shot')); const n = S.ents.filter((e) => e.revived && !e.dead).length; frames(60 * 6);
  check('RESTLESS: only once; a revived quack stays dead', S.ents.filter((e) => e.revived && !e.dead).length === 0 && n === 0);
  inArena(); frames(5); const q2 = S.makeEnt({ type: 'grunt', c: 30, from: 6 }); S.ents.push(q2); const before = S.ents.filter((e) => e.revived).length; for (let i = 0; i < 30; i++) { const q = S.makeEnt({ type: 'grunt', c: 20, from: 6 }); S.ents.push(q); S.killEnemy(q, 'shot'); } frames(60 * 5);
  check('RESTLESS: nobody gets up in the boss arena', S.ents.filter((e) => e.revived).length === before); }
{ live(0); frames(30); check('no modifier on mission 1 (nothing is live)', !S.modState().live && S.modState().dark === 0); }
{ const l = withMod('dark')[0]; live(l); const b = S.bannerNow ? S.bannerNow() : null; frames(60 * 4); const bn = S.bannerNow ? S.bannerNow() : null;
  check('a short banner names the modifiers at the mission start', bn && /DARK/.test(bn.text), JSON.stringify(bn && bn.text)); }

// ---------------------------------------------------------------- 3. FLOODED never drowns what a mission needs
{ const bad = [], seeds = [1, 7, 42, 999, 4242, 77777, 5, 11, 23, 31, 50, 61];
  const check1 = (tag) => { const sp = S.spawnsNow(); for (const d of S.devs) if (d.kind === 'flood' && d.cyc) for (const o of sp) if (['target', 'cage', 'flag', 'grantcrate', 'itemcrate', 'guncrate'].includes(o.type) || o.final) { if (o.c >= d.c0 - 3 && o.c <= d.c1 + 3) bad.push(tag + ' ' + o.type + o.c); }
    const pad = S.padOf(); for (const d of S.devs) if (d.kind === 'flood' && d.cyc && pad[0] >= d.c0 - 3 && pad[0] <= d.c1 + 3) bad.push(tag + ' pad');
    for (const d of S.devs) if (d.kind === 'flood' && d.cyc && d.c0 <= 8) bad.push(tag + ' start'); };
  let basins = 0;
  for (const l of withMod('flooded')) { S.reset(); S.startLevel(l); check1(names[l]); basins += S.devs.filter((d) => d.kind === 'flood' && d.cyc).length; }
  check('FLOODED basins keep clear of every target, cage, flag, crate, the boss and the pad in all four flooded missions (' + basins + ' basins)', !bad.length && basins >= 4, bad.slice(0, 4).join(', '));
  const bad2 = []; let rb = 0; for (const s of seeds) { S.reset(); S.startRandom(s, true); if ((S.levelDef(S.RANDOM).mods || []).includes('flooded')) { check1('seed ' + s); rb++; } }
  S.reset(); let forced = 0; for (let s = 1; s < 400 && forced < 6; s++) { S.reset(); const g = S.genLevel(s * 37); if ((g.mods || []).includes('flooded')) { S.startRandom(s * 37, true); check1('seed ' + s * 37); forced++; } }
  check('and in random maps with FLOODED (' + forced + ' tried)', !bad.length && forced >= 3, bad.slice(0, 4).join(', '));
  live(withMod('flooded')[0]); check('every basin is shallow (2 to 3 rows) with a solid floor', S.devs.filter((d) => d.kind === 'flood' && d.cyc).every((d) => { for (let c = d.c0; c <= d.c1; c++) if (!S.tileAt(c, d.bot)) return false; return d.bot - d.top >= 2 && d.bot - d.top <= 3; })); }

// ---------------------------------------------------------------- 4. the grant crate and the auditor
{ const gl = names.map((n, i) => i).filter((i) => S.levelDef(i).grant);
  check('about half the campaign missions from mission 3 on carry a grant crate', gl.length >= 10 && gl.length <= 14 && gl.every((i) => i >= 3), gl.length + ' missions');
  const pos = (l) => { S.reset(); S.startLevel(l); return S.ents.filter((e) => e.type === 'grantcrate').map((e) => Math.round(e.x) + ',' + Math.round(e.y)).join(';'); };
  const ps = gl.map(pos); check('each has exactly one crate, in a fixed place (the same on a second build)', ps.every((p) => p && !p.includes(';')) && JSON.stringify(ps) === JSON.stringify(gl.map(pos)), ps.filter((p) => !p).length + ' missing');
  S.reset(); S.startLevel(gl[0]); const c = S.ents.find((e) => e.type === 'grantcrate'); check('it stands on the main-route ground and is not a gun crate or an item crate', c.type !== 'guncrate' && Math.abs(c.y + c.h - 16 * T) < 1.5, c.y);
  check('missions without it have none, and neither do Detox Express, Flat Earth, Pyramid', names.every((n, i) => gl.includes(i) || (S.reset(), S.startLevel(i), !S.ents.some((e) => e.type === 'grantcrate')))); }
const crate = (extra = {}) => { flat('einstein'); const e = Object.assign(S.makeEnt({ type: 'grantcrate', c: 40, from: 8 }), extra); S.ents.push(e); return e; };
{ const e = crate(); const sc0 = S.stats.score, bn0 = S.bannerNow().text; S.hitEnemy(e, 5, 100, 'shot'); step();
  const pk = S.ents.find((x) => x.type === 'pickup' && x.item === 'gun');
  check('smashing it drops a strong gun and a score bonus', e.dead && !!pk && S.GRANT_GUNS.includes(pk.gun) && S.stats.score - sc0 >= 1000, pk && pk.gun + ' +' + (S.stats.score - sc0));
  const a = S.ents.filter((x) => x.type === 'auditor' && !x.dead);
  check('and releases one auditor with 12 hp, and one banner', a.length === 1 && a[0].hp === 12 && /AUDITOR/.test(S.bannerNow().text), a.length + ' auditor, ' + S.bannerNow().text);
  check('the crate is smashed by a normal shot too, and seqs/sequencing leave it alone', (() => { flat('reska'); const k = S.makeEnt({ type: 'grantcrate', c: 36, from: 8 }); S.ents.push(k); S.cam.x = S.P.x - 200; S.P.spec = 3; S.pressed.special = true; step(); frames(60); return !k.dead; })()); }
const auditor = (c = 44) => { flat('einstein'); const a = S.makeEnt({ type: 'auditor', c, from: 8 }); S.ents.push(a); S.cam.x = S.P.x - 200; return a; };
{ const a = auditor(); const hp0 = a.hp; S.P.inv = 1e9; let hurts = 0; frames(60 * 6, () => { a.t = Math.min(a.t, 5); });
  check('he walks after the player', Math.abs(a.x - S.P.x) < 40, Math.round(a.x - S.P.x) + ' px'); }
{ const a = auditor(); let shots = 0; frames(60 * 8, () => { shots = Math.max(shots, S.bullets.filter((b) => b.owner === 'e').length); }); check('he never shoots', shots === 0); }
{ const a = auditor(46); S.P.inv = 0; let died = false; for (let i = 0; i < 60 * 8 && S.P.alive; i++) { a.t = 1; step(); } check('touching him hurts like other melee quacks (it kills)', !S.P.alive); }
{ const a = auditor(46); wall(STEEL, 38, 41, 2, 15); a.x = 44 * T; frames(60 * 10, () => { a.t = 1; }); check('a tall wall blocks him: he never passes through it', a.x > 41.5 * T && !S.ents.includes(null)); }
{ const a = auditor(50); wall(STEEL, 40, 41, 13, 15); a.x = 46 * T; frames(60 * 6, () => { a.t = 1; }); check('he jumps over a low wall (collision, not teleport)', a.x < 40 * T, Math.round(a.x / T) + ''); }
{ const a = auditor(46); S.P.x = 30 * T; frames(60 * 44, () => { S.P.x = 30 * T + 3; S.P.y = 16 * T - 15.01; }); const at44 = a.dead; frames(60 * 2, () => { S.P.x = 30 * T + 3; }); check('he leaves after 45 s if not killed (here after about 45 s)', !at44 && a.dead, at44 + '/' + a.dead); }
{ const a = auditor(46); S.P.x = 30 * T; for (let i = 0; i < 40; i++) S.hitEnemy(a, 0.4, 0, 'shot'); step(); check('he can be killed: 12 hp', a.dead && a.hp <= 0); }

// ---------------------------------------------------------------- 5. random maps
{ const seeds = Array.from({ length: 300 }, (_, i) => 3 + i * 17);
  const gens = seeds.map((s) => { const g = S.genLevel(s); return [s, g.mods || [], !!g.grant, g.hseed]; });
  check('some random maps get a modifier, some two, some a crate; most get none', gens.filter((g) => g[1].length).length >= 40 && gens.filter((g) => g[1].length === 2).length >= 2 && gens.filter((g) => g[2]).length >= 60 && gens.filter((g) => g[1].length).length < 150, gens.filter((g) => g[1].length).length + ' with mods, ' + gens.filter((g) => g[2]).length + ' with a crate');
  check('the roll is derived from the seed: the same seed gives the same result', JSON.stringify(gens.slice(0, 40)) === JSON.stringify(seeds.slice(0, 40).map((s) => { const g = S.genLevel(s); return [s, g.mods || [], !!g.grant, g.hseed]; })));
  let calls = 0; const mr = Math.random; const same = [];
  for (const s of [1, 7, 42, 999]) { S.reset(); S.startRandom(s, true); const L = S.levelDef(S.RANDOM); const withTiles = Array.from(S.tilesNow()).join(''), sp = S.spawnsNow().filter((o) => o.type !== 'grantcrate').map((o) => o.type + o.c).join(';'); const had = (L.mods || []).length + (L.grant ? 1 : 0);
    const m = L.mods, g = L.grant; L.mods = undefined; L.grant = false; S.startLevel(S.RANDOM); const t2 = Array.from(S.tilesNow()).join(''), sp2 = S.spawnsNow().map((o) => o.type + o.c).join(';'); L.mods = m; L.grant = g;
    same.push(withTiles === t2 && sp === sp2); }
  check('modifiers and the crate change no tile and no other spawn of a random map', same.every(Boolean), same.join()); }
{ let found = 0; for (let s = 1; s < 500 && found < 3; s++) { const g = S.genLevel(s * 29); if ((g.mods || []).length && g.grant) { S.reset(); S.startRandom(s * 29, true); S.endCeasefire(); frames(60); if (S.ents.some((e) => e.type === 'grantcrate')) found++; } }
  check('random maps with both start fine and show the crate', found >= 3, found + ''); }
{ S.reset(); S.startRandom(7, true); const L = S.levelDef(S.RANDOM); L.mods = ['dark', 'gale']; S.startLevel(S.RANDOM); S.endCeasefire(); frames(120); check('a random map with two modifiers runs both', S.modState().live && S.modState().dark > 0.9 && S.devs.some((d) => d.kind === 'wind' && d.mod)); }

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' modifier and grant crate checks passed');
process.exit(fails ? 1 : 0);
