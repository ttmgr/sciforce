// Headless checks for round 10, the alien faction: the five types (hatchling, wall and ceiling crawler, acid spitter, egg pod, Brood Mother), the hive growth overlay,
// the two missions with a nest (Crop Circle Fields, Ancient Alien Temple) and the random infestation. Fingerprints marked "reference" were recorded once from the build before
// this round (random maps with seeds 1, 7, 42, 999, 4242 and 77777, the tiles and non-alien entities of the infested seeds and of both missions, and the Math.random draws of a build).
// Usage: node science-bros/tests/r10_aliens.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
let draws = 0, a = 99; const M = Object.create(Math); { M.random = () => { draws++; a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } // seeded and counted
const sb = { window: win, document: doc, localStorage: { getItem: () => null, setItem: noop }, navigator: { getGamepads: () => [] }, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T, A0 = a; // A0: the state of the random stream after the game booted
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const STEEL = 3, DIRT = 1, AL = S.ALIEN;
const solid = (c, r) => { const v = S.tileAt(c, r); return v !== 0 && v !== 5 && v !== 7; };
const run = (n, held = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, held); S.P.inv = 1e9; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } }; // the bro cannot be hurt
const raw = (n, held = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, held); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } }; // he can
const look = () => { S.cam.x = Math.max(0, S.P.x - 240); S.cam.y = Math.max(0, S.P.y - 157); };
// a flat steel floor at row 16 over columns 0-129, nothing else alive, the bro at column bro; calm = keep the safe start running
const flat = (bro = 4, calm = false) => {
  S.setMode('campaign'); S.setDifficulty(1, false); S.startLevel(0); if (!calm) S.endCeasefire(); run(1);
  for (let c = 0; c < 130; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? STEEL : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.bullets.length = 0; S.plants.length = 0; S.critters.length = 0; S.fx.length = 0;
  S.P.bro = S.BROS[0]; S.P.x = bro * T; S.P.y = 16 * T - S.P.h - 0.01; S.P.vx = 0; S.P.vy = 0; S.P.mech = null; S.P.inv = 0; S.P.alive = true; run(2); look();
};
const spawn = (type, c, extra = {}) => { const e = S.makeEnt(Object.assign({ type, c, from: 15 }, extra)); S.ents.push(e); return e; };
const died = (n, f) => { const d0 = S.stats.deaths; f(); return S.stats.deaths > d0; }; // did the bro die while f ran (he respawns after a moment)
const aliens = () => S.ents.filter((e) => AL[e.type] && !e.dead);

// ---- the reference numbers, recorded from the build before this round
const REF_RANDOM = { 1: 'mgozsa:87', 7: '1m9t8s6:90', 42: '126catb:86', 999: 'zkzo1:86', 4242: 'cm0a90:83', 77777: 's5h5gr:86' }; // hash of the entity list : its length
const REF_INFESTED = { 4: ['ah53zn', '1c42jh1'], 6: ['1nrtw5c', 'tny1ve'], 9: ['127ynor', '17a20cu'], 16: ['er4xbq', 'b9hei5'] }; // tiles, non-alien entities
const REF_MISSION = { 14: ['1ejxrm1', '1fab08i'], 16: ['1tlkk70', '173wl09'] }; // tiles, non-alien entities
const alienFree = (e) => !AL[e.type];
const entHash = (list) => fnv(list.map((e) => e.type + '@' + Math.round(e.x) + ',' + Math.round(e.y)).join('|'));
const tileHash = () => fnv(Array.from(S.tiles()).join(','));

// 1. the table: sizes, hp, not a quack, not a boss
{
  const want = { alhatch: [8, 7, 1], alcrawl: [12, 9, 3], alspit: [12, 14, 4], alpod: [10, 12, 3], alqueen: [40, 34, 90] };
  flat();
  for (const [t, d] of Object.entries(want)) { const e = spawn(t, 60, t === 'alcrawl' ? { hr: 10 } : {}); check(t + ' is ' + d[0] + 'x' + d[1] + ' with ' + d[2] + ' hp', e.max === d[2] && e.hp === d[2] && S.DIMS[t][0] === d[0] && S.DIMS[t][1] === d[1] && (t === 'alcrawl' || (e.w === d[0] && e.h === d[1])), e.w + 'x' + e.h + ' ' + e.hp); }
  check('no alien is a quack or a boss, all can be hit and leak their own goo', Object.keys(want).every((t) => !S.QUACK[t] && !S.BOSS[t] && S.HITTABLE[t] === 1 && S.LEAK[t]));
  check('the Brood Mother has 90 hp at NORMAL and follows the boss setting', (() => { S.setDifficulty(2, false); const h = spawn('alqueen', 80).max; S.setDifficulty(0, false); const l = spawn('alqueen', 90).max; S.setDifficulty(1, false); return h === 113 && l === 68; })());
  check('level 0 (no nest) holds no alien', (() => { S.setMode('campaign'); S.startLevel(0); return aliens().length === 0; })());
}

// 2. the hatchling: scuttles toward the bro, leaps from 3-5 tiles, dies to one hit, comes from pods in pairs
{
  flat(4); const h = spawn('alhatch', 9); h.hunt = 0; let leapDx = null, killed = false;
  for (let i = 0; i < 240 && leapDx === null; i++) { const vy0 = h.vy, g = h.onGround; run(1); if (g && h.vy < -150 && !h.dead) leapDx = Math.abs(h.x + 4 - S.P.x - 5); }
  check('a hatchling scuttles toward the bro and leaps at him from 3-5 tiles', leapDx !== null && leapDx >= 3 * T - 6 && leapDx <= 5 * T + 6, leapDx === null ? 'never' : (leapDx / T).toFixed(2) + ' tiles');
  flat(4); const h2 = spawn('alhatch', 8); S.P.face = 1; run(2); const k0 = S.stats.kills; run(40, { fire: true });
  check('one shot from the bro kills a hatchling', h2.dead && S.stats.kills === k0 + 1, 'hp ' + h2.hp);
  flat(4); const h3 = spawn('alhatch', 5); h3.hunt = 5; S.P.inv = 0;
  check('a hatchling that gets to the bro kills him', died(0, () => raw(120)));
  flat(4); const h4 = spawn('alhatch', 5); S.hitEnemy(h4, 1, 0, 'shot'); check('hitEnemy with 1 damage kills it', h4.dead);
}

// 3. the crawler: a ceiling, a wall and its corners, the drop, the fall
{
  const ceil = () => { for (let c = 50; c <= 90; c++) S.setTile(c, 10, STEEL); };
  flat(40); ceil(); const cr = spawn('alcrawl', 60, { hr: 10 }); cr.dirn = 1; cr.wt = 1e9; const x0 = cr.x; run(300);
  check('a crawler walks along a ceiling and stays on it', cr.ts === 2 && Math.abs(cr.x - x0) > 20 && Math.abs(cr.y - 11 * T) < 1 && !cr.dead, 'moved ' + Math.round(cr.x - x0) + ' px, side ' + cr.ts);
  flat(40); ceil(); const cd = spawn('alcrawl', 60, { hr: 10 }); cd.dirn = 1; run(2); S.P.x = cd.x + cd.w / 2 - 5; S.P.vx = 0; look();
  let dropped = false; for (let i = 0; i < 90 && !dropped; i++) { run(1); S.P.x = cd.x + cd.w / 2 - 5; dropped = cd.state === 'drop'; }
  check('it drops when the bro passes under it', dropped);
  let landed = false; for (let i = 0; i < 120 && !landed; i++) { run(1); landed = cd.state === 'stun' || cd.ts === 0; }
  for (let i = 0; i < 90; i++) run(1);
  check('a crawler that dropped on purpose takes no fall damage and clings to the floor again', !cd.dead && cd.hp === 3 && cd.ts === 0 && Math.abs(cd.y + cd.h - 16 * T) < 1, 'hp ' + cd.hp + ' side ' + cd.ts);
  flat(40); ceil(); const ck = spawn('alcrawl', 60, { hr: 10 }); ck.dirn = 1; run(1); S.P.x = ck.x + ck.w / 2 - 5; S.P.inv = 0; look();
  check('the drop onto a bro who stays put kills him', died(0, () => raw(120, {})));
  flat(40); for (let r = 11; r <= 15; r++) S.setTile(70, r, STEEL); const cw = spawn('alcrawl', 66); cw.dirn = 1; cw.wt = 1e9; const seen = []; for (let i = 0; i < 2400; i++) { run(1); if (!seen.length || seen[seen.length - 1] !== cw.ts) seen.push(cw.ts); }
  check('a crawler goes round corners: floor, up a wall, over its top, down the far side', /0,3,0,1,0/.test(seen.join(',')) && !cw.dead, seen.join(','));
  flat(40); ceil(); const cf = spawn('alcrawl', 60, { hr: 10 }); run(5); const tc = cf.tc; S.setTile(tc, 10, 0); run(10);
  check('if its tile is destroyed it falls', cf.state === 'fall' || cf.state === 'stun', cf.state); run(150);
  check('and recovers on the floor', !cf.dead && cf.hp === 3 && cf.state === 'cling' && cf.ts === 0, cf.state + ' side ' + cf.ts);
  flat(40); const cb = spawn('alcrawl', 60); cb.hunt = 3; S.P.x = cb.x + 14; S.P.inv = 0; look();
  check('a crawler beside the bro bites him', died(0, () => raw(100)));
  flat(40); ceil(); const cc = spawn('alcrawl', 60, { hr: 10 }); const hp = cc.hp; S.hitEnemy(cc, 1, 0, 'shot'); S.hitEnemy(cc, 1, 0, 'shot'); S.hitEnemy(cc, 1, 0, 'shot');
  check('three hits kill a crawler', hp === 3 && cc.dead);
}

// 4. the spitter: nothing in the safe start, a visible tell, then an arcing glob that can kill
{
  flat(54, true); const sp = spawn('alspit', 60); S.P.inv = 1e9; let globs = 0;
  for (let i = 0; i < 540; i++) { run(1); look(); globs += S.bullets.filter((b) => b.kind === 'glob' && b.owner === 'e').length; }
  check('a spitter in view fires nothing during the safe start (9 s)', globs === 0 && S.ceasefire > 0, 'globs ' + globs + ', ceasefire ' + S.ceasefire.toFixed(1));
  flat(54); const s2 = spawn('alspit', 60); let tell = 0, first = -1, n = 0, gaps = [], last = -1;
  for (let i = 0; i < 1200; i++) { const before = S.bullets.filter((b) => b.kind === 'glob').length; run(1); look(); if (s2.wind > 0) tell++; const now = S.bullets.filter((b) => b.kind === 'glob' && b.life > 3.95).length; if (now > 0) { n++; if (last >= 0) gaps.push((i - last) / 60); last = i; if (first < 0) first = i; } S.bullets.forEach((b) => { if (b.kind === 'glob' && b.life > 3.95) b.life = 3.9; }); }
  check('afterwards it lobs a glob with a wind-up tell of 0.75 s', first >= 0 && tell >= 40, 'first at ' + (first / 60).toFixed(1) + ' s, tell frames ' + tell);
  check('globs come every 2 to 3 seconds (the early-campaign ramp stretches it a little)', gaps.length >= 3 && gaps.every((g) => g >= 2 && g <= 3.7), gaps.map((g) => g.toFixed(2)).join(' ')); // 0.75 s wind-up plus the 2-3 s wait
  flat(54); const s3 = spawn('alspit', 60); S.P.inv = 0; raw(60); look(); let dead = false; for (let i = 0; i < 600 && !dead; i++) { const d0 = S.stats.deaths; raw(1); look(); dead = S.stats.deaths > d0; }
  check('its glob kills a bro who stands still', dead);
}

// 5. the egg pod
{
  flat(40); const p = spawn('alpod', 60); run(60); check('a pod does nothing while the bro is far', !p.dead && p.wob === 0 && aliens().length === 1);
  S.P.x = 57 * T; look(); let wob = -1, burst = -1; for (let i = 0; i < 90; i++) { run(1); if (p.wob > 0 && wob < 0) wob = i; if (p.dead && burst < 0) burst = i; }
  check('the bro within about 4 tiles makes it wobble for 0.6 s, then it bursts', wob >= 0 && burst - wob >= 34 && burst - wob <= 38, 'wobble ' + (burst - wob) + ' frames');
  check('a burst releases 2 hatchlings', aliens().filter((e) => e.type === 'alhatch').length === 2);
  flat(40); const q = spawn('alpod', 60); run(5); S.hitEnemy(q, 3, 0, 'shot'); run(60); S.P.x = 58 * T; run(60);
  check('a pod shot first is destroyed and nothing hatches', q.dead && aliens().length === 0);
  flat(40); const w = spawn('alpod', 60); S.P.x = 57 * T; look(); run(15); const wobbling = w.wob > 0; S.hitEnemy(w, 3, 0, 'shot'); run(60);
  check('a pod shot during its wobble hatches nothing', wobbling && w.dead && aliens().length === 0);
  flat(40, true); const z = spawn('alpod', 60); S.P.x = 58 * T; run(120); check('a pod does not hatch in the safe start', !z.dead && z.wob === 0);
  flat(40); S.setTile(60, 11, STEEL); const hp = spawn('alpod', 60, { hr: 11 }); run(5);
  check('a pod can hang from a ceiling', hp.hang && Math.abs(hp.y - 12 * T) < 1, 'y ' + hp.y); S.P.x = 58 * T; look(); run(70);
  check('a hanging pod hatches too, and the hatchlings fall to the floor', hp.dead && aliens().filter((e) => e.type === 'alhatch' && e.y > 12 * T).length === 2);
}

// 6. hive growth
{
  flat(50); const n = S.hiveNew(); const pod = spawn('alpod', 60, { nest: n.id }); run(30);
  const infested = () => { let k = 0; const hv = S.HIVE.hv; for (let c = 0; c < 130; c++) if (hv[16 * S.LW + c]) k++; return k; };
  const c0 = n.count; run(60 * 20);
  check('growth starts under the pod and spreads while the pod lives', c0 >= 1 && n.count > c0 + 2 && n.count === infested(), c0 + ' -> ' + n.count);
  check('it spreads at about one tile every 4 s per source', n.count <= 1 + 21 / 4 + 3, n.count + ' tiles after 20 s');
  check('it grows over solid tiles only, none of the tile ids change', (() => { let ok = true; for (let c = 0; c < 130; c++) for (let r = 0; r < 21; r++) { const v = S.tileAt(c, r); if (v !== (r >= 16 ? STEEL : 0)) ok = false; } return ok; })());
  const g = n.count; S.hitEnemy(pod, 99, 0, 'shot'); run(60 * 30);
  check('it stops when the nest\'s pods and Brood Mother are all dead', pod.dead && n.count === g, g + ' -> ' + n.count);
  flat(50); const big = S.hiveNew(); for (let k = 0; k < 6; k++) spawn('alpod', 58 + k * 2, { nest: big.id }); run(60 * 80);
  check('a nest caps at 60 infested tiles', big.count === 60 && big.cap === 60, String(big.count));
  { const six = S.hiveNew(); flat(50); const n6 = S.hiveNew(); for (let k = 0; k < 6; k++) spawn('alpod', 58 + k * 2, { nest: n6.id }); run(60 * 20); check('six sources grow faster than one (20 s)', n6.count >= 3 * Math.max(1, c0 + 5) && n6.count > 15, String(n6.count)); }
  flat(50); const fn = S.hiveNew(); const fp = spawn('alpod', 60, { nest: fn.id }); run(60 * 30); const cc = Math.floor((fp.x + 5) / T);
  S.P.x = cc * T + 3; S.P.y = 16 * T - S.P.h - 0.01; S.P.vx = 0; run(3);
  check('an infested floor slows the bro by 25%', S.hiveSlow() === 0.75 && S.oilSlow() === 0.75, String(S.hiveSlow()));
  { const clear = fn.tiles.length; S.P.x = 100 * T; S.P.y = 16 * T - S.P.h - 0.01; run(3); check('a clean floor does not', S.hiveSlow() === 1 && clear > 0); }
  { S.P.x = 100 * T; run(2); S.keys.right = true; for (let i = 0; i < 50; i++) { S.P.inv = 1e9; S.step(1 / 60); } const vClean = S.P.vx; S.keys.right = false;
    for (let c = 90; c < 125; c++) S.HIVE.hv[16 * S.LW + c] = fn.id + 1; S.P.x = 100 * T; S.P.vx = 0; run(2); S.keys.right = true; for (let i = 0; i < 50; i++) { S.P.inv = 1e9; S.step(1 / 60); } const vHive = S.P.vx; S.keys.right = false; run(5);
    check('and he really runs slower on it', vHive > 0 && Math.abs(vHive / vClean - 0.75) < 0.05, vHive.toFixed(0) + ' / ' + vClean.toFixed(0)); for (let c = 90; c < 125; c++) S.HIVE.hv[16 * S.LW + c] = 0; }
  flat(50); const bn = S.hiveNew(); const bp = spawn('alpod', 60, { nest: bn.id }); run(60 * 12); const tcol = bn.tiles.map((i) => i % S.LW).filter((c) => c !== Math.floor((bp.x + 5) / T))[0];
  S.setTile(tcol, 16, 0); run(40); check('growth vanishes when its tile breaks', S.HIVE.hv[16 * S.LW + tcol] === 0 && !bn.tiles.includes(16 * S.LW + tcol)); S.setTile(tcol, 16, STEEL);
  { const col = bn.tiles.map((i) => i % S.LW)[0]; S.fx.push({ kind: 'fire', x: col * T + 8, y: 16 * T, c: col, r: 16, t: 2, max: 3, by: 'p' }); bn.near = true; run(3);
    check('fire clears the growth around it', S.HIVE.hv[16 * S.LW + col] === 0); }
  { const col = bn.tiles.map((i) => i % S.LW)[0]; if (col !== undefined) { S.fx.push({ kind: 'acidpool', x: col * T + 8, y: 16 * T, c: col, r: 16, t: 2, max: 2.6, by: 'p' }); run(3); check('and so does acid the bro threw', S.HIVE.hv[16 * S.LW + col] === 0); } }
  flat(50); const bd = S.hiveNew(); const dp = spawn('alpod', 60, { nest: bd.id }); run(60 * 30); S.P.x = Math.floor((dp.x + 5) / T) * T + 3; run(3); S.P.x = Math.floor((dp.x + 5) / T) * T + 3; // a hatchling buds near the bro now and then, at most 2 per nest
  let budded = 0; for (let k = 0; k < 12; k++) { S.P.x = Math.floor((dp.x + 5) / T) * T + 3; S.P.y = 16 * T - S.P.h - 0.01; bd.bud = 0.1; bd.near = true; run(40); S.ents.filter((e) => e.type === 'alhatch' && !e.dead).forEach((e) => { e.hunt = 0; e.x = 120 * T; }); budded = Math.max(budded, bd.buds.filter((b) => !b.dead).length); }
  check('standing on growth now and then buds a hatchling (capped at 2 alive)', budded >= 1 && budded <= 2, 'alive buds ' + budded);
}

// 7. the Brood Mother
{
  flat(40); const q = spawn('alqueen', 60); run(5);
  check('the Brood Mother is not in BOSS and is no mission objective', !S.BOSS.alqueen && S.boss !== q && q.max === 90 && S.objectives.every((o) => o.id !== 'alqueen'));
  const n = S.HIVE.nests[q.nest]; let laid = 0; for (let i = 0; i < 12; i++) if (S.alLay(q)) laid++;
  check('she lays pods on the floor up to her cap of 6', laid === 6 && n.ents.filter((e) => e.type === 'alpod' && !e.dead).length === 6 && !S.alLay(q), 'laid ' + laid);
  check('every pod stands on the floor, none in a wall', n.ents.filter((e) => e.type === 'alpod').every((e) => !solid(Math.floor((e.x + 5) / T), Math.floor((e.y + 6) / T)) && Math.abs(e.y + e.h - 16 * T) < 1));
  flat(40); const q2 = spawn('alqueen', 60); look(); let seenBanner = false, globs = 0, pods0 = 0, screech = false; const n2 = S.HIVE.nests[q2.nest];
  S.ents.push(S.makeEnt({ type: 'alhatch', c: 56, from: 15 })); let rushed = 0;
  for (let i = 0; i < 60 * 70; i++) { run(1); S.P.x = 46 * T; look(); S.cam.x = S.P.x - 100; if (q2.seen) seenBanner = true; globs += S.bullets.filter((b) => b.kind === 'glob' && b.life > 3.9).length; if (S.ents.some((e) => e.type === 'alhatch' && !e.dead && e.rush)) rushed++; if (q2.act === 'screech') screech = true; S.bullets.forEach((b) => { if (b.kind === 'glob') b.dead = true; }); }
  check('she notices the bro on screen (name banner), spits fans of globs, screeches and lays pods', seenBanner && globs >= 6 && screech && rushed > 0 && n2.ents.filter((e) => e.type === 'alpod' && !e.dead).length >= 2, 'globs ' + globs + ' pods ' + n2.ents.filter((e) => e.type === 'alpod' && !e.dead).length);
  flat(40); const q3 = spawn('alqueen', 60); look(); run(3); for (let i = 0; i < 5; i++) S.alLay(q3); const n3 = S.HIVE.nests[q3.nest]; run(60 * 8); const s0 = S.stats.score, k0 = S.stats.kills, cnt0 = n3.count;
  check('before her death the nest has growth', cnt0 > 0, String(cnt0));
  S.hitEnemy(q3, 999, 0, 'shot');
  check('her death gives a large score bonus', q3.dead && S.stats.score - s0 >= 2500 && S.stats.kills === k0 + 1, '+' + (S.stats.score - s0));
  run(30); check('and every pod starts to wither', n3.ents.filter((e) => e.type === 'alpod').every((e) => e.dead || e.wilt > 0));
  run(60 * 3); check('within 3 s every pod is gone and all growth of the nest is gone', n3.count === 0 && n3.tiles.length === 0 && n3.ents.filter((e) => e.type === 'alpod' && !e.dead).length === 0 && !S.HIVE.hv.some((v) => v === n3.id + 1));
  check('no hatchlings came out of the withered pods', aliens().filter((e) => e.type === 'alhatch').length === 0);
}

// 8. the two missions with a nest
{
  const idx = (name) => Array.from({ length: S.nLevels }, (_, i) => S.levelDef(i).name).indexOf(name);
  const levels = { 14: 'CROP CIRCLE FIELDS', 16: 'ANCIENT ALIEN TEMPLE' };
  check('the level indices are what the test thinks', idx('CROP CIRCLE FIELDS') === 14 && idx('ANCIENT ALIEN TEMPLE') === 16);
  for (const lv of [14, 16]) {
    const name = levels[lv], measure = () => { a = A0; S.reset(); S.setMode('campaign'); S.setDifficulty(1, false); draws = 0; S.startLevel(lv); const d1 = draws; draws = 0; S.startLevel(lv); return [d1, draws]; }; // the same random stream every time
    const withAl = measure(), saved = Object.assign({}, S.AL_MISSIONS); for (const k in saved) delete S.AL_MISSIONS[k]; const without = measure(); Object.assign(S.AL_MISSIONS, saved); // the build with the nest switched off draws what the build did before
    S.setMode('campaign'); S.setDifficulty(1, false); S.startLevel(lv);
    check(name + ': a Brood Mother, 4-6 pods and a few crawlers and spitters in its nest, 2-3 more groups', (() => { const q = S.ents.filter((e) => e.type === 'alqueen'); if (q.length !== 1) return false; const nest = q[0].nest; const mine = S.HIVE.nests[nest]; const pods = mine.ents.filter((e) => e.type === 'alpod').length; return pods >= 4 && pods <= 6 && S.HIVE.nests.length >= 3 && S.HIVE.nests.length <= 4 && S.ents.filter((e) => e.type === 'alspit').length >= 1 && S.ents.filter((e) => e.type === 'alcrawl').length >= 2 && S.ents.filter((e) => e.type === 'alspit' || e.type === 'alcrawl').length >= 3; })(), 'nests ' + S.HIVE.nests.length + ', ' + aliens().length + ' aliens');
    const first = S.ents.filter((e) => AL[e.type]); const flags = S.ents.filter((e) => e.type === 'flag' || e.type === 'cage' || e.type === 'target');
    check(name + ': nothing alien within 20 tiles of the start', first.every((e) => e.x / T >= 30), 'nearest column ' + Math.min(...first.map((e) => Math.floor(e.x / T))));
    check(name + ': nothing alien inside a wall', first.every((e) => { for (const [x, y] of [[e.x + 0.6, e.y + 0.6], [e.x + e.w - 0.6, e.y + 0.6], [e.x + 0.6, e.y + e.h - 0.6], [e.x + e.w - 0.6, e.y + e.h - 0.6], [e.x + e.w / 2, e.y + e.h / 2]]) if (solid(Math.floor(x / T), Math.floor(y / T))) return false; return true; }));
    check(name + ': every alien is at least 6 columns from a flag, cage or target', first.every((e) => flags.every((f) => Math.abs((e.x + e.w / 2) / T - (f.x + f.w / 2) / T) >= 6)));
    const stretch0 = S.cutAt(), stretch1 = S.cutAt() + S.stretchW(), qn = S.ents.find((e) => e.type === 'alqueen');
    check(name + ': the Brood Mother stands in the stretch, on flat floor, no ladder near, not over a shaft', qn.x / T >= stretch0 && qn.x / T < stretch1 && !S.deep(Math.floor((qn.x + 20) / T)) && (() => { const c = Math.floor((qn.x + 20) / T), r = Math.round((qn.y + qn.h) / T); for (let k = -4; k <= 4; k++) { if (!solid(c + k, r) || !solid(c + k, r + 1) || !solid(c + k, r + 2)) return false; for (let j = 0; j < 8; j++) if (S.tileAt(c + k, r - j) === 7) return false; } return true; })());
    const lvKept = S.ents.filter((e) => e.final).length === 1 && S.objectives.some((o) => o.id === 'boss') && !S.objectives.some((o) => /brood|alien/i.test(o.id));
    check(name + ': its boss and objectives are as before', lvKept);
    check(name + ': a mission builds the same way twice', (() => { const a = JSON.stringify(S.ents.map((e) => [e.type, Math.round(e.x), Math.round(e.y), e.nest, e.hang ? 1 : 0, e.ts])); S.startLevel(lv); const b = JSON.stringify(S.ents.map((e) => [e.type, Math.round(e.x), Math.round(e.y), e.nest, e.hang ? 1 : 0, e.ts])); return a === b; })());
    const ref = REF_MISSION[lv];
    check(name + ': tiles and every non-alien entity are what they were (the nest adds entities only)', tileHash() === ref[0] && entHash(S.ents.filter(alienFree)) === ref[1]);
    check(name + ': building it with the nest draws exactly as many Math.random numbers as without (two builds)', withAl.join() === without.join(), withAl.join('/') + ' against ' + without.join('/'));
    check(name + ': the aliens are not trimmed by the quack budget and add no threat', first.length >= 12 && first.length === S.ents.filter((e) => AL[e.type]).length);
  }
  S.setMode('campaign'); S.startLevel(14); S.endCeasefire(); const g0 = S.stats.kills; run(200); check('a mission with aliens plays on without an error', true);
  check('saved run: aliens are in the entity list with stable numbers (markFresh)', S.ents.filter((e) => AL[e.type]).every((e) => e.sid !== undefined));
}

// 9. random missions
{
  S.reset(); const bad = []; for (const seed of Object.keys(REF_RANDOM)) { S.startRandom(+seed, true); const h = fnv(S.ents.map((e) => e.type + '@' + Math.round(e.x) + ',' + Math.round(e.y)).join('|')) + ':' + S.ents.length; if (h !== REF_RANDOM[seed] || S.ents.some((e) => AL[e.type])) bad.push(seed); }
  check('seeds 1, 7, 42, 999, 4242 and 77777 build exactly the entity lists of the reference build, with no alien', !bad.length, bad.join(', '));
  const inf = []; for (let s = 1; s <= 20; s++) { S.startRandom(s, true); if (S.ents.some((e) => AL[e.type])) inf.push(s); }
  check('about 1 random mission in 4 is infested (seeds 4, 6, 9 and 16 of the first 20)', inf.join(',') === '4,6,9,16', inf.join(','));
  let k = 0; for (let s = 1; s <= 1000; s++) if (S.genLevel(s).gen.alien) k++;
  check('1000 seeds: 20 to 30 percent infested', k >= 200 && k <= 300, k + ' of 1000');
  for (const s of [4, 6, 9, 16]) {
    S.startRandom(s, true); const al = S.ents.filter((e) => AL[e.type]), rf = REF_INFESTED[s];
    check('seed ' + s + ': one Brood Mother, nothing within 20 tiles of the start or in a wall', al.filter((e) => e.type === 'alqueen').length === 1 && al.every((e) => e.x / T >= 30 && !solid(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))));
    check('seed ' + s + ': only entities were added (tiles and the other entities as before)', tileHash() === rf[0] && entHash(S.ents.filter(alienFree)) === rf[1]);
  }
  check('with an infestation the nest is in the path section and clear of flags, cages and targets', (() => { S.startRandom(4, true); const al = S.ents.filter((e) => AL[e.type]), fl = S.ents.filter((e) => e.type === 'flag' || e.type === 'cage' || e.type === 'target'); return al.every((e) => fl.every((f) => Math.abs(e.x - f.x) >= 6 * T)); })());
}

// 10. the player's own shots never kill him through pods or acid
{
  flat(40); const p = spawn('alpod', 44); S.P.x = 41 * T; S.P.face = 1; S.P.inv = 0; look(); raw(40, { fire: true });
  check('shooting a pod next to the bro does not hurt him', p.dead && S.P.alive && aliens().length === 0);
  flat(40); S.P.inv = 0; S.P.x = 40 * T; look(); S.bullets.push({ x: S.P.x + 5, y: 16 * T - 30, vx: 0, vy: 100, grav: 600, owner: 'p', kind: 'glob', life: 4, dmg: 1 }); raw(150);
  const dd = S.stats.deaths; let pool = false; for (let i = 0; i < 150; i++) { raw(1); if (S.fx.some((f) => f.kind === 'acidpool' && f.by === 'p')) pool = true; }
  check('acid he threw leaves a pool that does not hurt him', pool && S.P.alive && S.stats.deaths === dd);
}


// 11. drawing, fall damage, the saved run, the outline pass
{
  flat(30); for (let c = 20; c <= 40; c++) S.setTile(c, 10, STEEL);
  const set = []; for (const [ty, c, ex] of [['alhatch', 33, {}], ['alcrawl', 34, {}], ['alcrawl', 35, { hr: 10 }], ['alspit', 36, {}], ['alpod', 37, {}], ['alpod', 38, { hr: 10 }], ['alqueen', 44, {}]]) set.push(spawn(ty, c, ex));
  const nq = S.HIVE.nests[set[6].nest]; for (let k = 0; k < 30; k++) S.hiveGrow(nq);
  let err = null; try { for (const flash of [0, 0.05]) for (const st of [{}, { wind: 0.5, wob: 0.3, tell: 0.2, bite: 0.2, act: 'spit', seen: true }, { act: 'screech', seen: true }, { act: 'lay', seen: true }, { wilt: 1, face: -1 }]) { set.forEach((e) => { Object.assign(e, st); e.flash = flash; }); S.render(1); } nq.wither = 1; S.render(2); } catch (e) { err = e; }
  check('every alien and the growth draw in every state without an error', !err, err && err.message);
  check('the small aliens get the graphics outline, the pods and the Brood Mother do not', set.slice(0, 4).every((e) => (e.dead = false, S.gfxOutlined(e) || e.x < S.cam.x - 32 || e.x > S.cam.x + 512)) && !S.gfxOutlined(set[4]) && !S.gfxOutlined(set[6]));
  const drop = (k) => { flat(50); S.setTile(60, 16 - k, DIRT); const e = spawn('alhatch', 60, { from: 16 - k - 1 }); e.walk = false; e.wt = 1e9; run(6); const on = Math.abs(e.y + e.h - (16 - k) * T) < 1; S.setTile(60, 16 - k, 0); for (let i = 0; i < 240 && !(e.dead || (e.onGround && i > 3)); i++) { e.walk = false; e.wt = 1e9; run(1); } return { dead: e.dead, on }; };
  { const a = drop(4), b = drop(6); check('a hatchling dropped 4 tiles lives and one dropped 6 tiles dies of the fall (round 9 rule, hatchlings only)', a.on && !a.dead && b.on && b.dead, 'drop 4 dead ' + a.dead + ', drop 6 dead ' + b.dead); }
}
{
  S.setMode('campaign'); S.setDifficulty(1, false); S.startLevel(14); S.endCeasefire(); S.P.bro = S.BROS[0]; run(5);
  const pods = S.ents.filter((e) => e.type === 'alpod'), q = S.ents.find((e) => e.type === 'alqueen'), sp = S.ents.find((e) => e.type === 'alspit'), sid = pods[0].sid, qsid = q.sid;
  pods[0].dead = true; sp.dead = true; q.hp = 40; const nAl = S.ents.filter((e) => AL[e.type] && !e.dead).length; const spSid = sp.sid;
  S.saveRun(); S.startLevel(0); const ok = S.resumeRun(); run(120);
  const q2 = S.ents.find((e) => e.type === 'alqueen'), alive = S.ents.filter((e) => AL[e.type] && !e.dead).length;
  check('a saved run in a mission with aliens resumes: the dead pod and spitter stay dead, the Brood Mother keeps her hp, nothing crashes', ok && q2 && q2.hp === 40 && !S.ents.some((e) => e.sid === sid && !e.dead) && !S.ents.some((e) => e.sid === spSid && !e.dead) && alive === nAl, 'alive ' + alive + ' of ' + nAl);
}

console.log(fails ? fails + ' check(s) failed' : 'all alien checks passed');
process.exit(fails ? 1 : 0);
