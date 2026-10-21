// Headless checks for the two missions added before the Citadel: Aura Megamall (a crystal shopping mall) and Pox Party
// Volcano (an anti-vax lair). The campaign has 20 missions and the Citadel is still last; the older 18 missions, random
// maps and bonus modes build exactly as on commit 7fd836a; the two new themes exist, differ from every other theme and
// never come up on a random map; each new mission builds the same twice, starts safe, has nothing floating or in a
// wall, keeps every cage, intel file, target and the boss arena within reach, has an underground part and a stretch
// with its forks and detours, and a bot crosses it; the threat climbs from the Juice Pipeline through both to the
// Citadel; the story, world map and acts take them in; every bro can hurt the two new bosses; and a big fight at
// INSANE / 300% on each costs under 3 ms a frame, about what the Citadel costs.
// Usage: node science-bros/tests/new_maps.js science-bros/index.html
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
// a seeded Math.random, so the bot runs play out the same way every time (seed 99: the fingerprints below were taken with it)
const M = Object.create(Math); { let a = 99; M.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const LW = S.LW, LH = S.LH, GH = S.GH, N = S.nLevels, STEEL = 3, LADDER = 7;
const NEW = ['AURA MEGAMALL', 'POX PARTY VOLCANO'], NEW_TH = ['mall', 'volcano'];
const idx = NEW.map((name) => Array.from({ length: N }, (_, i) => S.levelDef(i).name).indexOf(name));

// ---- 1. the older missions, random maps and bonus modes are what they were on commit 7fd836a
// (a hash of the tiles, quacks, decoration, devices, scenery and the event plan, ramp on, NORMAL at 100%)
const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const snap = () => fnv(Array.from(S.tilesNow()).join('')) + '.' + fnv(S.ents.map((e) => e.type + Math.round(e.x) + ',' + Math.round(e.y) + ',' + Math.round(e.hp || 0)).join(';')) + '.' + fnv(S.decor().map((d) => d.kind + d.c + ',' + d.r).join(';')) + '.' + fnv(S.devs.map((d) => d.kind + d.x0 + ',' + d.x1).join(';')) + '.' + fnv(JSON.stringify(Object.values(S.fancy()).map((l) => l.map((o) => o.k + o.c + ',' + o.r + ',' + o.v)))) + '.' + (S.evPlan() ? S.evPlan().name + Math.round(S.evPlan().col) : '-');
const BASE = { missions: { 'PLACEBO ISLAND': 'tehlcx.11qo6xl.bukp0k.5v08oe.1qb45kv.-', 'DETOX DESERT': 'xjccmv.1qgs0a9.5rpcg4.ig2pho.6om4ca.-', 'CRYO SUMMIT': 'az9a3p.5fpaic.ce098m.1iwvvnu.z5uymb.airstrike278', 'DILUTION PLANT': 'q1ra6b.1hf2ly8.ue8055.3t9ljz.12w5kof.ambush469', 'FLAT EARTH STATION': '1oz5x2a.1gntjyw.j7muo6.f8hwaa.isrvbr.blackout50', 'CHEMTRAIL AIRFIELD': '1vcclqu.wzao8l.1f8xray.qb3g59.1a9lekr.-', 'QUARTZ CAVERNS': '10vld3p.f6c0dg.nzz8c.1kzrtz.14gclwr.-', 'MIASMA MARSH': 'mwh5zx.ftfy4m.1vk29x.xr4fhf.1pg9qbv.-', 'ZODIAC OBSERVATORY': '1xqhfsq.1ooa584.xzu6k0.o3ac7y.1rm6hkk.-', 'PERPETUAL MOTION WORKS': '1jsxb1h.bdexhb.hd8wcm.1iaxobi.b8tjyf.-', 'CROP CIRCLE FIELDS': '1dt95ph.14jlee6.1vlv0lc.ltj4fx.c7p6gw.oppenbro358', 'PYRAMID POWER PLANT': 'prxnes.1ej7e4l.1jgms4q.1p5uwav.1eylix9.golden246', 'HOMEOPATHIC HOT SPRINGS': '1g8ini9.b57p1y.x394rp.ldts36.107rjzi.blackout200', 'LEY LINE LIGHTHOUSE': 'glr6ok.smmeid.1tf5ow3.7rakhq.t08kzo.airstrike191', 'STRUCTURED WATER WORKS': 'mkv1f4.19ajfp1.piu7r2.1c0kww3.ii1ekq.airstrike281', 'NEON WELLNESS DISTRICT': '1ob9szv.owheng.2hb5hk.mozpxh.1pvess.-', 'JUICE PIPELINE': '144938x.cvv7zo.cn75wd.olwt5o.196fvan.airstrike390', 'CITRUS CITADEL': 'zy6al1.1hgzxy8.1o4j2f5.3ubg1v.oemhxm.supply273' },
  random: { 1: 'moon.LIVE-STREAMED CRATER.p762ui.bev3x5.xjglwb.mr3gy2.mzrh2w.-', 7: 'island.DILUTED ISLAND.z4z5es.cxx7mk.1nyhct0.1e51c3x.1d75cwp.-', 42: 'moon.BLOCKCHAIN CRATER.6lr60s.1oegjsm.1a313cr.v0rfgh.119kzul.-', 999: 'grove.MAGNET GROVES.lkiefg.xcti00.1l2tbdj.189y3rr.oxi78r.-', 4242: 'rust.CHEMTRAIL YARD.13c019w.1biqrj1.1kv3kz2.9x3p04.1p8tm5q.-', 77777: 'citrus.DETOX CITADEL.1rdub0h.1ctwqhm.qpbnq6.fx5g2g.1tp7ruk.-' },
  modes: { 'moon': 'h6ri5y.g3p1pa.1j6sbgt.31d53p.18ot0cr.-', 'siege': 'h7v8f6.11dh7u8.w9h7fo.ztntfp.hmmzzg.-', 'rush': 'k7dsdq.17a5lx9.209rs4.76ecrz.1qeahli.-' } }; // taken on 90c4d7d (round 5 wit and tuning merged), the head before the two missions
{
  const changed = [];
  for (let l = 0; l < N; l++) { const name = S.levelDef(l).name; if (NEW.includes(name)) continue; S.reset(); S.startLevel(l); if (snap() !== BASE.missions[name]) changed.push(name); }
  check('the 18 older missions build exactly as on 90c4d7d, before the new missions (Citadel included)', !changed.length && Object.keys(BASE.missions).every((n) => Array.from({ length: N }, (_, i) => S.levelDef(i).name).includes(n)), changed.join(', '));
  const rnd = []; for (const seed of Object.keys(BASE.random)) { S.reset(); S.startRandom(+seed, true); if (S.levelDef(S.RANDOM).theme + '.' + S.levelDef(S.RANDOM).name + '.' + snap() !== BASE.random[seed]) rnd.push(seed); }
  check('random missions are unchanged (6 seeds: theme, name, tiles, quacks, decoration)', !rnd.length, rnd.join(', '));
  const md = []; for (const m of ['moon', 'siege', 'rush']) { S.reset(); S.startMode(m); if (snap() !== BASE.modes[m]) md.push(m); }
  check('Moon Base, Lab Siege and Boss Rush are unchanged', !md.length, md.join(', '));
  S.reset(); S.startMode('campaign');
  let seen = 0; for (let s = 1; s <= 400; s++) if (NEW_TH.includes(S.genLevel(s * 131).theme)) seen++;
  check('the two new themes never come up on a random map (400 seeds)', seen === 0, seen + ' maps');
}

// ---- 2. the campaign: 20 missions, the two new ones right before the Citadel, which stays last
check('the campaign has 20 missions', N === 20, N);
check('the Citadel is still the last mission', S.levelDef(N - 1).name === 'CITRUS CITADEL');
check('the mall and the volcano are missions 18 and 19, right before the Citadel', idx[0] === N - 3 && idx[1] === N - 2, idx.map((i) => i + 1).join(', '));
check('Lab Siege and the Moon Base still follow the campaign', S.levelDef(S.SIEGE).name === 'LAB SIEGE' && S.levelDef(S.MOON).name === 'MOON BASE');
check('Boss Rush still ends with King Citrus in the Citadel', S.RUSH[S.RUSH.length - 1][0] === N - 1 && S.RUSH[S.RUSH.length - 1][2] === 'citrus');

// ---- 3. the two new themes: everything a theme has, and none of it shared with another theme
{
  const TH = S.THEMES, others = Object.keys(TH).filter((k) => !NEW_TH.includes(k)), key = (k, f) => JSON.stringify(TH[k][f]);
  for (const k of NEW_TH) {
    const t = TH[k], has = ['sky', 'orb', 'hill', 'city', 'cityKind', 'hills', 'win', 'beam', 'dirt', 'top', 'dust', 'acid', 'brick'].every((f) => t[f] !== undefined);
    check(k + ': a full theme (sky, orb, skyline, hills, palette, liquid, brick look) used by its mission', has && S.levelDef(idx[NEW_TH.indexOf(k)]).theme === k);
    const same = ['sky', 'orb', 'cityKind', 'hills', 'dirt', 'top', 'acid', 'win'].filter((f) => others.some((o) => key(o, f) === key(k, f)));
    check(k + ': its sky, orb, skyline, hills, earth, ground top, liquid and lights differ from all ' + others.length + ' older themes', !same.length, same.join(', '));
    check(k + ': weather and floating motes of its own', (t.glitter || t.ashfall) && !others.some((o) => TH[o].glitter || TH[o].ashfall) && !!t.look.motes && !others.some((o) => TH[o].look.motes === t.look.motes), (t.glitter ? 'glitter' : 'ashfall') + ', ' + t.look.motes);
  }
  check('the two new themes differ from each other', ['sky', 'orb', 'cityKind', 'hills', 'dirt', 'acid', 'brick'].every((f) => key('mall', f) !== key('volcano', f)));
  check('every theme still has its own skyline', new Set(S.cityKinds()).size === S.cityKinds().length);
  check('floor decoration of their own (a potted palm, a fumarole)', S.FK.planter && S.FK.planter.th === 'mall' && S.FK.fumarole && S.FK.fumarole.th === 'volcano');
}

// ---- reach and soundness helpers (as in tests/mission_remake.js)
const solidT = (v) => v === 1 || v === 2 || v === 3 || v === 4 || v === 6;
const LOOSE = (v) => v === 2 || v === 4 || v === 6;
const floating = () => {
  const n = LW * LH, at = (i) => S.tileAt(i % LW, Math.floor(i / LW)), seen = new Uint8Array(n), q = [];
  for (let i = 0; i < n; i++) if (solidT(at(i)) && (!LOOSE(at(i)) || i >= n - LW)) { seen[i] = 1; q.push(i); }
  while (q.length) { const i = q.pop(), c = i % LW, v = at(i), all = LOOSE(v) || v === 3; for (const j of all ? [i - LW, i + LW, c > 0 ? i - 1 : -1, c < LW - 1 ? i + 1 : -1] : [i - LW]) if (j >= 0 && j < n && !seen[j] && LOOSE(at(j))) { seen[j] = 1; q.push(j); } }
  const out = []; for (let i = 0; i < n; i++) if (LOOSE(at(i)) && !seen[i]) out.push((i % LW) + ',' + Math.floor(i / LW)); return out;
};
const reach = () => { // on foot from the start: walk, fall, jump 3 up and 3 across, climb ladders and walls, ride lifts and vents; crate doors and boss gates count as open, acid never as ground
  const open = new Uint8Array(LW * LH), at = (c, r) => S.tileAt(c, r);
  for (let r = 0; r < LH; r++) for (let c = 0; c < LW; c++) { const v = at(c, r); open[r * LW + c] = v === 0 || v === 7 || v === 4 ? 1 : 0; }
  for (const e of S.ents) if (e.gate) { const [g0, g1, r0, r1] = e.gate; for (let r = r0; r <= r1; r++) for (let c = g0; c <= g1; c++) open[r * LW + c] = 1; }
  const isOpen = (c, r) => c >= 0 && c < LW && r >= 0 && r < LH && open[r * LW + c] === 1;
  const hard = (c, r) => c >= 0 && c < LW && r >= 0 && r < LH && (solidT(at(c, r)) || at(c, r) === 5);
  const support = new Uint8Array(LW * LH), lift = new Map();
  for (const d of S.devs) {
    if (d.kind === 'lift') { const c0 = Math.floor(Math.min(d.ax, d.bx) / T), c1 = Math.floor((Math.max(d.ax, d.bx) + d.w - 1) / T), r0 = Math.floor(Math.min(d.ay, d.by) / T) - 1, r1 = Math.floor(Math.max(d.ay, d.by) / T) - 1; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r >= 0) support[r * LW + c] = 1; }
    if (d.kind === 'vent') lift.set(d.c + ',' + (d.r - 1), d.h);
  }
  const seen = new Uint8Array(LW * LH), q = [];
  const add = (c, r) => { if (isOpen(c, r) && !seen[r * LW + c] && at(c, r) !== 5) { seen[r * LW + c] = 1; q.push(c, r); } };
  add(Math.floor((S.P.x + S.P.w / 2) / T), Math.floor((S.P.y + S.P.h - 1) / T));
  while (q.length) {
    const r = q.pop(), c = q.pop(), lad = at(c, r) === 7, onFoot = hard(c, r + 1) && at(c, r + 1) !== 5 || at(c, r + 1) === 7 || lad || support[r * LW + c], wall = hard(c - 1, r) || hard(c + 1, r);
    if (at(c, r + 1) === 5) continue;
    if (!onFoot && !wall) { add(c, r + 1); add(c - 1, r + 1); add(c + 1, r + 1); continue; }
    add(c - 1, r); add(c + 1, r); add(c, r + 1); add(c - 1, r + 1); add(c + 1, r + 1);
    if (lad || at(c, r - 1) === 7 || wall || support[r * LW + c]) { add(c, r - 1); add(c - 1, r - 1); add(c + 1, r - 1); }
    if (onFoot) for (let dy = 1; dy <= 3 && isOpen(c, r - dy); dy++) for (const s of [-1, 1]) for (let dx = 0; dx <= 3 && isOpen(c + s * dx, r - dy); dx++) add(c + s * dx, r - dy);
    const h = lift.get(c + ',' + r); if (h) for (let k = 1; k <= h && isOpen(c, r - k); k++) add(c, r - k);
  }
  return (e) => { const c = Math.floor((e.x + e.w / 2) / T), r = Math.floor((e.y + e.h - 1) / T); return [[c, r], [c - 1, r], [c + 1, r], [c, r - 1]].some(([x, y]) => x >= 0 && y >= 0 && seen[y * LW + x]); };
};
const FLY = ['jetpack', 'camdrone', 'drone', 'icicle', 'flag', 'dronecaller', ...BOSSES];
const fullSnap = () => Array.from(S.tilesNow()).join('') + '|' + S.spawnsNow().map((o) => o.type + o.c + ',' + (o.from || 0)).join(';') + '|' + S.decor().map((d) => d.kind + d.c + ',' + d.r).join(';') + '|' + S.devs.map((d) => d.kind + d.x0 + ',' + d.x1).join(';') + '|' + S.ents.map((e) => e.type + Math.round(e.x) + ',' + Math.round(e.y)).join(';');
const clear = () => { for (const e of S.ents) if (S.THREAT[e.type] || S.NEW_FOES.includes(e.type) || e.type === 'icicle' || ['minelayer', 'mine'].includes(e.type)) e.dead = true; };

// ---- 4. each new mission: fixed, safe, sound, everything within reach, its own underground and its stretch
for (const l of idx) {
  const L = S.levelDef(l), tag = (l + 1) + ' ' + L.name;
  S.reset(); S.startLevel(l); const a = fullSnap(); S.reset(); S.startLevel(l);
  check(tag + ': builds the same twice (tiles, spawns, decoration, devices, quacks)', fullSnap() === a);
  check(tag + ': briefing, debrief, 3 intel lines, a subtitle and objectives', !!L.brief && !!L.debrief && L.intel.length === 3 && !!L.sub && L.objectives.some((o) => o.id === 'boss' && o.req) && L.objectives.some((o) => ['vat', 'radio', 'server'].includes(o.id) && o.req));
  S.P.bro = S.BRO.einstein;
  const near = S.ents.filter((e) => (S.THREAT[e.type] || e.type === 'turret') && e.x < 20 * T);
  check(tag + ': safe start (no quack within 20 tiles, 10 s ceasefire)', near.length === 0 && Math.abs(S.ceasefire - 10) < 0.01, near.map((e) => e.type).join(','));
  const fl = floating(); check(tag + ': no loose block floats', fl.length === 0 && S.checkCollapse() === 0, fl.slice(0, 6).join(' '));
  const walled = S.ents.filter((e) => !FLY.includes(e.type) && solidT(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))));
  check(tag + ': nothing spawns inside a wall', walled.length === 0, walled.map((e) => e.type + '@' + Math.floor(e.x / T)).join(','));
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final), ok = reach();
  const cages = S.ents.filter((e) => e.type === 'cage'), intel = S.ents.filter((e) => e.type === 'pickup' && e.item === 'intel'), tk = L.objectives.find((o) => ['vat', 'radio', 'server'].includes(o.id)), targets = S.ents.filter((e) => e.type === 'target');
  const trig = [{ x: B.trig * T, y: (S.surf(B.trig, S.openRow(B.trig)) - 1) * T, w: T, h: T, type: 'boss arena' }], lost = [...cages, ...intel, ...targets, ...trig].filter((e) => !ok(e));
  check(tag + ': ' + cages.length + ' cages (' + L.cages + ' listed), 3 intel files, ' + targets.length + ' targets (' + tk.need + ' needed), all within reach with the boss arena', lost.length === 0 && intel.length === 3 && cages.length >= L.cages && targets.filter((e) => e.skin === tk.id).length >= tk.need, 'unreachable: ' + lost.map((e) => e.type + '@' + Math.floor(e.x / T) + ',' + Math.floor(e.y / T)).join(' '));
  check(tag + ': one final boss, a reused type under a name of its own, its arena after the stretch', S.ents.filter((e) => BOSSES.includes(e.type) && e.final).length === 1 && !!B.bossName && !!B.bossSub && B.ax0 >= S.cutAt() + S.STRETCH && S.padOf()[0] === L.pad[0] + S.STRETCH, B.type + ' ' + B.bossName);
  const base = S.ugZones().filter((z) => z.c1 < S.cutAt()), [wantF, wantZ] = S.longOf(l), plan = S.stretchPlan();
  const forks = plan.filter((p) => p[0] === 'fork').length, detours = S.ugZones().filter((z) => z.c0 >= S.cutAt() - 10 && z.c1 <= S.cutAt() + S.STRETCH + 2).length;
  check(tag + ': an underground part in its own base, and a stretch with ' + wantF + ' forks and ' + wantZ + ' underground detours', base.length >= 1 && forks === wantF && detours === wantZ && plan.length >= 8 && wantF >= 3 && wantZ >= 3, base.length + ' base zones, ' + plan.length + ' sections, ' + forks + ' forks, ' + detours + ' detours');
  S.endCeasefire(); S.P.inv = 1e9; S.P.x = 3 * T; run(30);
  const air = S.ents.filter((e) => !e.dead && !FLY.includes(e.type) && e.type !== 'para' && !solidT(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h + 1) / T))) && S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h + 1) / T)) !== LADDER && !S.devs.some((d) => d.kind === 'lift' && Math.abs(d.y - (e.y + e.h)) < 3 && e.x + e.w > d.x && e.x < d.x + d.w));
  check(tag + ': nothing floats in mid-air once it settles', air.length === 0, air.map((e) => e.type + '@' + Math.floor(e.x / T) + ',' + Math.floor(e.y / T)).join(' '));
}

// ---- 5. a bot gets through: the hand-made base (runs right, jumps, fires, presses up when stuck), then the stretch into the arena
for (const l of idx) {
  const tag = (l + 1) + ' ' + S.levelDef(l).name;
  S.reset(); S.startLevel(l); S.endCeasefire(); S.P.bro = S.BRO.einstein; const goal = S.cutAt() - 4; let far = 0, i = 0;
  for (; i < 60 * 90 && far < goal; i++) {
    const stuck = i % 120 < 30;
    if (i % 25 === 0) S.pressed.jump = true;
    S.P.inv = 1e9;
    const pc = Math.floor((S.P.x + 5) / T), overAcid = [1, 2, 3, 4].some((k) => [1, 2, 3, 4, 5, 6].some((d) => S.tileAt(pc + k, Math.floor(S.P.y / T) + d) === 5));
    step({ right: true, jump: i % 25 < 14, fire: i % 6 < 3 && !overAcid, up: stuck && i % 240 < 30 });
    far = Math.max(far, S.P.x / T);
  }
  check(tag + ': a simple bot gets through the hand-made base to the stretch in 90 s', far >= goal, 'reached col ' + far.toFixed(0) + ' of ' + goal + ' in ' + (i / 60).toFixed(0) + ' s');
  S.reset(); S.startLevel(l); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99); clear();
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final); let reached = 0;
  S.P.x = (S.cutAt() - 4) * T; S.P.y = 2 * T; S.P.vx = S.P.vy = 0;
  for (let k = 0; k < 150 * 60 && reached < B.trig; k++) { if (k % 25 === 0) S.pressed.jump = true; S.P.inv = 1e9; S.P.alive = true; step({ right: true, jump: k % 25 < 14, fire: k % 6 < 3 }); reached = Math.max(reached, S.P.x / T); }
  check(tag + ': a bot crosses the 324-column stretch into the boss arena', reached >= B.trig, 'reached col ' + reached.toFixed(0) + ' of ' + B.trig);
}

// ---- 6. the difficulty curve: the threat climbs from the Juice Pipeline through the mall and the volcano to the Citadel
{
  const threat = []; for (let l = 0; l < N; l++) { S.reset(); S.startLevel(l); threat.push(S.ents.filter((e) => S.THREAT[e.type] && !e.dead).reduce((a, e) => a + S.THREAT[e.type], 0)); }
  const [m, v] = idx, prev = threat[m - 1], fin = threat[N - 1];
  check('threat climbs: Juice Pipeline, then the mall, then the volcano, then the Citadel (no drop of more than 6)', threat[m] >= prev - 6 && threat[v] >= threat[m] - 6 && fin >= threat[v] - 6, [prev, threat[m], threat[v], fin].map((x) => x.toFixed(0)).join(' -> '));
  check('both new missions sit in the hardest part of the campaign, and the Citadel is still among the hardest', threat[m] > threat.slice(0, 10).reduce((a, b) => a + b) / 10 * 1.3 && threat[v] > threat.slice(0, 10).reduce((a, b) => a + b) / 10 * 1.3 && fin >= Math.max(...threat) - 6, threat.map((x) => x.toFixed(0)).join(' '));
  check('their place on the ramp lies between the Juice Pipeline and the Citadel', S.levelDef(m).ramp > 16 / 17 && S.levelDef(v).ramp > S.levelDef(m).ramp && S.levelDef(v).ramp < 1, S.levelDef(m).ramp + ', ' + S.levelDef(v).ramp);
}

// ---- 7. the story: scripts by known speakers that fit their boxes, the money trail from the pipeline to the Citadel, the satire rules
{
  const wrapN = (str, n) => { const out = []; let ln = ''; for (const w of str.split(' ')) { if ((ln + ' ' + w).trim().length > n) { out.push(ln.trim()); ln = w; } else ln += ' ' + w; } if (ln.trim()) out.push(ln.trim()); return out; };
  const fits = (str, n, lines) => wrapN(str, n).length <= lines && wrapN(str, n).every((x) => x.length <= n);
  const texts = [];
  for (const l of idx) {
    const L = S.levelDef(l), st = S.STORY[L.name], tag = (l + 1) + ' ' + L.name;
    const ok = st && st.intercept && ['start', 'mid', 'boss', 'win'].every((k) => (st[k] || []).length && st[k].every(([who, line]) => S.CAST[who] && line));
    check(tag + ': a full script (intercept, start, checkpoint, boss and win lines) by known speakers', !!ok);
    if (!ok) continue;
    const radio = ['start', 'mid', 'boss', 'win'].flatMap((k) => st[k].map((x) => x[1]));
    const bad = radio.filter((x) => !fits(x, 43, 3)).concat(fits(st.intercept[1], 34, 3) ? [] : [st.intercept[1]]);
    S.startLevel(l); const B = S.ents.find((e) => e.final), signs = S.decor().filter((d) => d.kind === 'sign' || d.kind === 'plaque').map((d) => d.text), neons = S.decor().filter((d) => d.kind === 'neon').map((d) => d.text);
    check(tag + ': every line fits its box; briefing, debrief, intel, subtitle, boss line, signs and neon fit theirs', !bad.length && fits(L.brief, 62, 7) && fits(L.debrief, 70, 3) && L.intel.every((x) => x.length <= 76) && L.sub.length <= 58 && B.bossSub.length <= 60 && signs.every((x) => x.length <= 19) && neons.every((x) => x.length <= 16), bad.join(' | '));
    check(tag + ': the running gags turn up (sponsored radio, DYOR Dale live)', radio.some((x) => /sponsored|brought to you|use code/i.test(x)) && st.mid.some(([w, x]) => w === 'live' && /chat/i.test(x)));
    texts.push(L.name, L.sub, L.brief, L.debrief, ...L.intel, st.intercept[1], ...radio, B.bossName, B.bossSub, ...signs, ...neons, ...L.objectives.map((o) => o.text));
  }
  const block = fs.readFileSync(path.join(__dirname, 'satire.js'), 'utf8').match(/const BLOCK = \[([\s\S]*?)\];/)[1];
  const BLOCK = vm.runInNewContext('[' + block + ']');
  const hits = BLOCK.filter((b) => texts.some((x) => new RegExp('(^|[^A-Za-z])' + b.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '([^A-Za-z]|$)', 'i').test(x)));
  check('the new text names no real brand, platform, company or living person (' + BLOCK.length + ' names from tests/satire.js)', BLOCK.length > 50 && !hits.length, hits.join(', '));
  const [m, v] = idx;
  check('the money trail: the Juice Pipeline points at the mall, the mall at the volcano, the volcano at the Citadel', /mall/i.test(S.levelDef(m - 1).debrief) && /volcano/i.test(S.levelDef(m).debrief) && /Citrus Citadel/.test(S.levelDef(v).debrief));
  check('both are in Act III; the Citadel is still the finale', S.actOf(m).num === 'ACT III' && S.actOf(v).num === 'ACT III' && S.actOf(N - 1).num === 'FINALE' && S.actOf(N - 1).first);
}

// ---- 8. the world map: two new stops with landmarks of their own, well apart, drawn without errors
{
  const spots = Array.from({ length: N }, (_, i) => S.levelDef(i).map); let close = 99;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) close = Math.min(close, Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]));
  check('the new stops are on the map, every stop at least 36 px from the next', idx.every((l) => spots[l][0] > 10 && spots[l][0] < 470 && spots[l][1] > 80 && spots[l][1] < 200) && close >= 36, 'closest ' + close.toFixed(1) + ' px; ' + idx.map((l) => spots[l].join(',')).join(' '));
  check('their landmarks: a glass-roofed mall and a smoking volcano; the Citadel stays the big fortress', S.wmKind(S.levelDef(idx[0])) === 'mall' && S.wmKind(S.levelDef(idx[1])) === 'volcano' && S.wmKind(S.levelDef(N - 1)) === 'citadel');
  let err = ''; S.startMode('campaign'); S.setReached(N - 1);
  try { for (const l of [...idx, N - 1]) { S.setLevel(l); for (let k = 0; k < 6; k++) S.drawWorldMap(k * 1.7); } } catch (e) { err = e.message; }
  check('the world map draws with every mission reached and the new ones selected', !err, err);
  S.reset(); S.startMode('campaign');
}

// ---- 9. the new bosses are fair: every bro can hurt them within 25 s and they never lose 40 hp in one frame (as tests/boss_fairness.js)
{
  const solid = (v) => v !== 0 && v !== 5 && v !== 7; let fights = 0, hurt = 0; const weak = [], spikes = [];
  for (const l of idx) for (const b of S.BROS) {
    S.startLevel(l); S.endCeasefire(); S.finishObjectives(); step({});
    const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
    S.ents.forEach((e) => { if (e !== B && e.type !== 'flag') e.dead = true; });
    S.P.bro = S.BRO[b.id]; S.P.x = (B.trig + 2) * T; S.P.y = 2 * T;
    const total = () => Math.max(0, B.hp) + (B.vats || []).reduce((a, o) => a + (o.dead ? 0 : o.hp), 0);
    const start = total(); let last = start, stillT = 0, dist = 90, jumpT = 0, spike = 0;
    for (let f = 0; f < 25 * 60 && !(B.dead || B.doomed || B.dying > 0); f++) {
      S.P.inv = 1e9; S.P.spec = 0;
      const v = (B.vats || []).find((o) => !o.dead), t = v || B, tx = t.x + t.w / 2, ty = t.y + t.h / 2;
      const tot = total(); if (last - tot > 40) spike = last - tot; if (tot < last - 0.01) stillT = 0; else stillT += 1 / 60; last = tot;
      if (start - tot > 0.5 && f > 8 * 60) break; // it has been hurt, and 8 s showed no spike
      if (B.active && stillT > 3) {
        stillT = 0; dist = [90, 50, 24, 140][([90, 50, 24, 140].indexOf(dist) + 1) % 4];
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
    fights++; if (start - total() > 0.5 || B.dead || B.doomed || B.dying > 0) hurt++; else weak.push(b.id + ' vs ' + B.bossName);
    if (spike) spikes.push(B.bossName + ' ' + spike.toFixed(0) + ' hp (' + b.id + ')');
  }
  check('every bro hurts the Grand Diffuser and the Immunity Forge within 25 s', hurt === fights, hurt + ' of ' + fights + (weak.length ? '; ' + weak.join(', ') : ''));
  check('neither loses 40 hp in one frame', !spikes.length, spikes.join(', '));
  // each goes down, its gate opens and the chopper comes
  for (const l of idx) {
    S.startLevel(l); S.endCeasefire(); run(1);
    for (const e of S.ents) if (!BOSSES.includes(e.type) && e.type !== 'flag') e.dead = true;
    const B = S.ents.find((e) => e.final); S.P.inv = 1e9; S.P.x = B.trig * T + 8; S.P.y = 2 * T; run(120);
    const woke = B.active; S.finishObjectives();
    for (let k = 0; k < 400 && !B.dead && !B.doomed; k++) { for (const v of B.vats || []) v.dead = true; S.hitEnemy(B, 5, 90, 'shot'); run(2); }
    run(60 * 8); const [g0, , gr0, gr1] = B.gate;
    check((l + 1) + ' ' + S.levelDef(l).name + ': ' + B.bossName + ' wakes, goes down, its gate opens and the chopper comes', woke && B.dead && S.tileAt(g0, gr1) === 0 && S.tileAt(g0, gr0) === 0 && !!S.chopper);
  }
}

// ---- 10. drawing: every part of each new map draws (lighting on and off, the full map), and a big fight stays cheap
{
  let err = '';
  for (const l of idx) {
    S.reset(); S.startLevel(l); S.endCeasefire(); step(); S.P.inv = 1e9;
    try { for (let x = 0; x < S.playW() * T; x += 400) { S.cam.x = x; S.cam.y = 0; S.render(x / 300); } S.cam.y = 24 * T; S.render(3); S.settings.lighting = false; S.render(4); S.settings.lighting = true; S.keys.map = true; S.render(5); S.keys.map = false; } catch (e) { err = (l + 1) + ': ' + e.message; }
  }
  check('both new maps draw end to end, underground, with lighting off and as the full map', !err, err);
  const level = (n, d, k) => { S.setDifficulty(d, false); S.setDensity(k, false); S.reset(); S.startLevel(n); S.P.bro = S.BRO.einstein; };
  const quacks = () => S.ents.filter((e) => S.THREAT[e.type] && !e.dead);
  const fight = (l) => { // the mission's busiest 30 columns, a minigun and explosions, drawn every frame, at INSANE / 300%
    level(l, 3, 6); S.endCeasefire(); S.P.alt = { kind: 'minigun', ammo: 99999 };
    let best = 24, bn = 0;
    for (let c = 24; c < LW - 30; c += 4) { const q = quacks().filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (q > bn) { bn = q; best = c; } }
    const near = quacks().find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60);
    for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); }
    const F = 300, t0 = Date.now();
    for (let i = 0; i < F; i++) { S.P.inv = 1e9; if (i % 20 === 0) S.explode(S.P.x + 60, S.P.y + 8, 30, 1, 'p', 0); step({ fire: true }, true); }
    return (Date.now() - t0) / F;
  };
  const best = (l) => { let ms = 99; for (let r = 0; r < 5; r++) ms = Math.min(ms, fight(l)); return ms; }; // the best of 5, so a busy machine does not fail it
  const cit = best(N - 1);
  for (const l of idx) { const ms = best(l); check((l + 1) + ' ' + S.levelDef(l).name + ': a fight at INSANE / 300% costs under 3 ms a frame, about what the Citadel costs', ms < 3 && ms < cit * 1.5 + 0.3, ms.toFixed(2) + ' ms vs Citadel ' + cit.toFixed(2) + ' ms'); }
  S.setDifficulty(1, false); S.setDensity(3, false);
}

console.log(fails ? fails + ' check(s) failed' : 'all new map checks passed');
process.exit(fails ? 1 : 0);
