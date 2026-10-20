// Headless checks for the fancier maps: every level (campaign, Moon and random seeds) gets theme-fitting decorations that
// never sit inside blocks, are the same on a rebuild, leave the tiles and spawns alone, fall apart when their ground goes,
// draw without errors in every theme, and cost little per frame.
// Usage: node science-bros/tests/fancy_maps.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise, JSON };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const EMPTY = 0, BRICK = 2, STEEL = 3, CRATE = 4;
const solid = (c, r) => S.isSolidT(S.tileAt(c, r));
const tileHash = () => { const t = S.tilesNow(); let h = 0; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t[i]) | 0; return h; };
const spawnHash = () => JSON.stringify(S.ents.map((e) => [e.type, Math.round(e.x), Math.round(e.y)]));
const plain = () => JSON.stringify(S.fancy(), (k, v) => (k === 'img' ? undefined : v));
const bro = () => { S.P.bro = S.BRO.einstein; };
// every kind of decoration on a level must stand on something solid, in open air, not on a spawn
const audit = (label) => {
  const F = S.fancy(), bad = [], spawnCols = new Set(); S.spawnsNow().forEach((s) => { if (typeof s.c === 'number') spawnCols.add(s.c); });
  for (const it of F.floor) {
    const K = S.FK[it.k], rows = Math.ceil(K.H / T);
    for (let c = it.c; c < it.c + it.n; c++) { if (!solid(c, it.r) || S.tileAt(c, it.r) === CRATE) bad.push('floor ' + it.k + ' base ' + c + ',' + it.r); for (let r = it.r - rows; r < it.r; r++) if (S.tileAt(c, r) !== EMPTY) bad.push('floor ' + it.k + ' inside ' + c + ',' + r); if (spawnCols.has(c)) bad.push('floor ' + it.k + ' on a spawn at ' + c); }
  }
  for (const it of F.wall) { const K = S.WK[it.k]; for (let c = it.c; c < it.c + K.n; c++) { const v = S.tileAt(c, it.r); if (it.ty === 3 ? v !== BRICK && v !== STEEL : v !== EMPTY || !S.bgAt(c, it.r)) bad.push('wall ' + it.k + ' ' + c + ',' + it.r); } }
  for (const it of F.hang) { if (!solid(it.c, it.r)) bad.push('hang base'); for (let k = 1; k <= it.len; k++) if (S.tileAt(it.c, it.r + k) !== EMPTY) bad.push('hang ' + it.k + ' inside'); }
  for (const it of F.back) { if (it.k === 'bpipe') { for (let c = it.c; c < it.c + it.n; c++) if (S.tileAt(c, it.r) !== EMPTY) bad.push('pipe inside'); continue; } if (!solid(it.c, it.r) && !solid(it.c, it.r + 1)) bad.push('back ' + it.k + ' base'); for (let r = it.r - 2; r < it.r; r++) if (S.tileAt(it.c, r) !== EMPTY) bad.push('back ' + it.k + ' inside'); }
  for (const it of F.fore) if (!solid(it.c, it.r) || S.tileAt(it.c, it.r - 1) !== EMPTY) bad.push('tuft');
  for (const it of F.land) { const K = S.LK[it.k]; for (let c = it.c; c < it.c + K.n; c++) { if (!solid(c, it.r)) bad.push('landmark base'); for (let r = it.r - K.rows; r < it.r; r++) if (S.tileAt(c, r) !== EMPTY) bad.push('landmark ' + it.k + ' inside'); } }
  check(label + ': nothing sits inside a block, on a spawn, or in the air', bad.length === 0, bad.slice(0, 3).join('; '));
};
const drew = (n = 1) => { try { for (let i = 0; i < n; i++) S.render(1 + i * 0.3); return true; } catch (err) { console.log(err); return false; } };
const camTo = (x) => { S.cam.x = Math.max(0, x); S.cam.y = 0; };
const total = (F) => F.floor.length + F.wall.length + F.hang.length + F.back.length + F.fore.length;

// ---- block looks: 12 per kind, stable, mixed
const seen = new Set(), same = []; for (let r = 4; r < 14; r++) for (let c = 10; c < 50; c++) { seen.add(S.vIdx(c, r)); same.push(S.vIdx(c, r) === S.vIdx(c + 1, r)); }
check('block looks use all ' + S.FV + ' variants', S.FV === 12 && seen.size === 12 && [...seen].every((v) => v >= 0 && v < 12), [...seen].sort((a, b) => a - b).join(','));
check('the look of a block never changes', S.vIdx(33, 7) === S.vIdx(33, 7) && S.vIdx(5, 5) === S.vIdx(5, 5));
check('neighbouring blocks differ most of the time (no obvious tiling)', same.filter(Boolean).length < same.length * 0.5, same.filter(Boolean).length + '/' + same.length + ' equal');

// ---- every campaign level and the Moon
const themesSeen = new Set(); let minDeco = 1e9, lastLevel = -1;
const levels = []; for (let n = 0; n < S.nLevels; n++) levels.push(n); levels.push(S.MOON);
for (const n of levels) {
  S.startLevel(n); bro(); S.endCeasefire();
  const F = S.fancy(), th = S.levelDef(n).theme; themesSeen.add(th); const cnt = total(F); minDeco = Math.min(minDeco, cnt);
  const th0 = tileHash(), sp0 = spawnHash(), snap = plain();
  S.decorate(); check('level ' + n + ' (' + th + '): decorating again changes no tile and no spawn', tileHash() === th0 && spawnHash() === sp0);
  check('level ' + n + ': decorating again gives the same decoration', plain() === snap);
  S.startLevel(n); check('level ' + n + ': a rebuild gives the same decoration', plain() === snap, cnt + ' items');
  audit('level ' + n);
  check('level ' + n + ' has plenty of decoration', F.floor.length >= 15 && cnt >= 40, F.floor.length + ' floor, ' + F.wall.length + ' wall, ' + F.hang.length + ' hang, ' + F.back.length + ' back, ' + F.fore.length + ' fore');
  let ok = true; for (let x = 0; x < S.LW * T; x += 600) { camTo(x); S.step(1 / 60); if (!drew()) ok = false; }
  check('level ' + n + ' draws along its whole length', ok);
}

// ---- 20 random seeds (and enough more to meet every theme and landmark)
const lmSeen = new Set(), rndSnap = {}; let rndMin = 1e9, rndOk = true;
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946];
for (const seed of SEEDS) {
  S.startRandom(seed, true); bro(); const F = S.fancy(), th = S.levelDef(S.RANDOM).theme; themesSeen.add(th); rndSnap[seed] = plain(); rndMin = Math.min(rndMin, total(F)); F.land.forEach((o) => lmSeen.add(o.k));
  const th0 = tileHash(); S.decorate(); if (tileHash() !== th0) rndOk = false;
  S.startRandom(seed, true); if (plain() !== rndSnap[seed]) rndOk = false;
  audit('seed ' + seed + ' (' + th + ')'); if (!drew(3)) rndOk = false;
}
check('20 random seeds: all decorated, all deterministic, tiles untouched, all drawn', rndOk && rndMin >= 40, 'fewest items ' + rndMin);
// more seeds until every theme and every landmark kind has been built and drawn
for (let seed = 20000; seed < 20400 && (themesSeen.size < Object.keys(S.THEMES).length || lmSeen.size < Object.keys(S.LK).length); seed++) {
  const def = S.genLevel(seed); const want = !themesSeen.has(def.theme);
  if (!want && lmSeen.size >= Object.keys(S.LK).length) continue;
  S.startRandom(seed, true); bro(); const F = S.fancy(); themesSeen.add(def.theme); if (!want && !F.land.some((o) => !lmSeen.has(o.k))) continue;
  F.land.forEach((o) => lmSeen.add(o.k)); audit('seed ' + seed); for (const o of F.land) { camTo(o.x - 200); if (!drew(4)) rndOk = false; }
}
check('every theme was decorated and drawn (' + Object.keys(S.THEMES).length + ')', themesSeen.size === Object.keys(S.THEMES).length, [...themesSeen].join(' '));
check('the random generator places all four landmarks now and then', ['statue', 'billboard', 'ufo', 'crane'].every((k) => lmSeen.has(k)), [...lmSeen].join(' '));
check('campaign levels carry no landmarks (random maps only)', (S.startLevel(0), S.fancy().land.length === 0));

// ---- drawing every decoration kind in every theme
let allKinds = true;
for (const th of Object.keys(S.THEMES)) {
  const n = levels.find((k) => S.levelDef(k).theme === th); let got = false;
  if (n !== undefined) { S.startLevel(n); got = true; } else { for (let seed = 30000; seed < 30300 && !got; seed++) if (S.genLevel(seed).theme === th) { S.startRandom(seed, true); got = true; } }
  bro(); if (!got) { allKinds = false; continue; }
  const F = S.fancy(); const items = [];
  for (const k of Object.keys(S.FK)) items.push({ list: F.floor, o: { k, c: 20, r: 16, n: Math.ceil(S.FK[k].W / T), v: 1, x: 20 * T, y: 16 * T } });
  for (const k of Object.keys(S.WK)) for (const v of [0, 1, 2, 3]) items.push({ list: F.wall, o: { k, c: 20, r: 12, ty: 2, v, ox: 0, oy: 0 } });
  for (const k of Object.keys(S.HK)) items.push({ list: F.hang, o: { k, c: 20, r: 6, len: 3, v: 2, front: k.length % 2 === 0 } });
  for (const k of Object.keys(S.BK)) for (const [w, h] of S.BK[k].sizes) items.push({ list: F.back, o: { k, c: 20, r: 16, w, h, v: 1, x: 20 * T, n: 3 } });
  for (const k of Object.keys(S.LK)) items.push({ list: F.land, o: { k, c: 20, r: 16, n: S.LK[k].n, v: 3, x: 20 * T, y: 16 * T } });
  for (const it of items) it.list.push(it.o);
  for (const l of [F.floor, F.wall, F.hang, F.back, F.land]) l.sort((a, b) => a.c - b.c);
  camTo(20 * T - 200); S.cam.y = 0; if (!drew(3)) allKinds = false;
  // the same, with lighting off and the lights on
  S.settings.lighting = false; if (!drew(2)) allKinds = false; S.settings.lighting = true;
}
check('every decoration kind draws without errors in every theme, lighting on or off', allKinds);

// ---- decoration falls apart when its ground is blown away
S.startLevel(0); bro(); S.endCeasefire();
const fl = S.fancy().floor.find((o) => o.c > 20 && !o.gone); camTo(fl.x - 240); drew();
S.setTile(fl.c, fl.r, EMPTY); drew();
check('a decoration loses its ground and falls apart', fl.gone === true);

// ---- cost: the decoration passes over a screen full of decoration, and the frame with and without them
const cost = (label, seedOrLevel, random) => {
  if (random) S.startRandom(seedOrLevel, true); else S.startLevel(seedOrLevel); bro(); S.endCeasefire();
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; });
  const F = S.fancy(), full = {}; for (const k in F) full[k] = F[k].slice();
  const dense = F.floor.concat(F.wall).concat(F.back).sort((a, b) => a.c - b.c), mid = dense[dense.length >> 1];
  camTo(mid.c * T - 200); for (let i = 0; i < 60; i++) { S.P.inv = 1e9; S.render(1 + i * 0.016); }
  const N = 400, tm = (fn) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < N; i++) fn(i); return Number(process.hrtime.bigint() - t0) / 1e6 / N; };
  const deco = tm(() => { S.drawFancyBack(); S.drawFancyMid(); S.drawFancyFore(); S.fancyEdges(); });
  check(label + ': the decoration passes cost under 0.5 ms a frame', deco < 0.5, deco.toFixed(3) + ' ms (' + total(F) + ' items in the level)');
  const frame = () => { S.P.inv = 1e9; S.step(1 / 60); S.render(2); };
  const withDeco = tm(frame); for (const k in F) F[k].length = 0; const without = tm(frame); for (const k in F) F[k].push(...full[k]);
  check(label + ': a frame costs under 3 ms (step and draw)', withDeco < 3 || withDeco - without < 0.8, withDeco.toFixed(2) + ' ms vs ' + without.toFixed(2) + ' ms bare');
};
cost('city map', 15, false); cost('island map', 0, false); cost('random map', 1597, true); cost('random map', 987, true);
console.log(fails ? fails + ' check(s) failed' : 'all fancy map checks passed');
process.exit(fails ? 1 : 0);
