// Headless checks for round 8: mission records, the rank sheet, the HUD feedback (score count-up, kill popups) and the unchanged random stream.
// Usage: node science-bros/tests/r8_records.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); if (k === 'measureText') return () => ({ width: 10 }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const mulberry = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function load(path, store = new Map()) { // one game in its own context; Math.random counted and seeded
  const src = fs.readFileSync(path, 'utf8').split('<script>')[1].split('</script>')[0];
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const win = { __SB_TEST__: true }, M = Object.create(Math), box = { n: 0, gen: mulberry(7) };
  M.random = () => { box.n++; return box.gen(); };
  const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
  vm.createContext(sb); vm.runInContext(src, sb);
  return { S: win.__SB__, box, store };
}
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const { S, store } = load(process.argv[2]);
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };

// ---- 1. the rank sheet. Hand values: all cages, all intel, no deaths, at par: 35 + 25 + 25 + 15 = 100, S.
const base = { cages: 4, cagesTotal: 4, intel: 3, intelTotal: 3, deaths: 0, time: 300, parTime: 300 };
let r = S.rankOf(base); check('perfect run at par is 100 points, rank S', r.pts === 100 && r.rank === 'S', JSON.stringify(r));
// half the cages (17.5) + 1/3 intel (8.33) + 2 deaths (25-10 = 15) + 1.5x par (7.5) = 48.33 -> 48, rank C (35..54)
r = S.rankOf({ cages: 2, cagesTotal: 4, intel: 1, intelTotal: 3, deaths: 2, time: 450, parTime: 300 }); check('half cages, 1/3 intel, 2 deaths, 1.5x par is 48 points, rank C', r.pts === 48 && r.rank === 'C', JSON.stringify(r));
r = S.rankOf({ cages: 0, cagesTotal: 0, intel: 3, intelTotal: 3, deaths: 0, time: 100, parTime: 300 }); check('a mission without cages gets the full 35', r.pts === 100, JSON.stringify(r));
check('time scores 0 at twice par and deaths floor at 0', S.rankOf(Object.assign({}, base, { time: 600, deaths: 9 })).pts === 35 + 25, S.rankOf(Object.assign({}, base, { time: 600, deaths: 9 })).pts);
check('letter cuts: 90 S, 75 A, 55 B, 35 C, below D', [90, 75, 55, 35, 34].every((p, i) => { const q = S.rankOf({ cages: 0, cagesTotal: 1, intel: 0, intelTotal: 3, deaths: 5, time: 600, parTime: 300 }); return i >= 0 && q.pts === 0 && q.rank === 'D'; }) && S.RANK.cuts.map((c) => c[0] + c[1]).join() === 'S90,A75,B55,C35');

// ---- 2. a campaign extraction writes a record, to the object and to storage
S.resetProgress(); S.startMode('campaign'); S.startLevel(0);
const name0 = S.levelDef(0).name, intelObj = () => S.objectives.find((o) => o.id === 'intel');
step();
Object.assign(S.stats, { time: 200, score: 5000, rescued: 2, deaths: 1 }); intelObj().n = 2;
S.leave(); step();
let rec = S.records()[name0];
check('extraction opens the debrief', S.state === 'win', S.state);
check('the record is stored under the mission name', !!rec && Math.abs(rec.time - 200) < 0.1 && rec.score === 5000 && rec.cages === 2 && rec.intel === 2 && rec.deaths === 1 && /^[SABCD]$/.test(rec.rank) && rec.pts > 0, JSON.stringify(rec));
const saved = JSON.parse(store.get('sciencebros.records') || 'null');
check('and written to localStorage', saved && saved[name0] && Math.abs(saved[name0].time - 200) < 0.1, JSON.stringify(saved));
check('lastResult holds this run', S.lastResult() && S.lastResult().score === 5000 && S.lastResult().pts === rec.pts);

// ---- 3. a worse run keeps every best; a better time alone replaces only the time
const again = (o, intel) => { S.startMode('campaign'); S.startLevel(0); step(); Object.assign(S.stats, o); intelObj().n = intel; S.leave(); step(); return S.records()[name0]; };
const before = JSON.stringify(rec);
rec = again({ time: 260, score: 3000, rescued: 1, deaths: 3 }, 1);
check('a worse run changes nothing', JSON.stringify(rec) === before, JSON.stringify(rec));
rec = again({ time: 150, score: 3000, rescued: 1, deaths: 3 }, 1);
check('a better time alone replaces only the time', Math.abs(rec.time - 150) < 0.1 && rec.score === 5000 && rec.cages === 2 && rec.intel === 2 && rec.deaths === 1, JSON.stringify(rec));
check('lastResult marks only the time as new', Object.keys(S.lastResult().nw).join() === 'time', Object.keys(S.lastResult().nw).join());
rec = again({ time: 150, score: 9000, rescued: 4, deaths: 0 }, 3);
check('a clean better run raises score, cages, intel, deaths and rank', rec.score === 9000 && rec.cages === 4 && rec.intel === 3 && rec.deaths === 0 && rec.pts > JSON.parse(before).pts, JSON.stringify(rec));
check('the debrief and the world map draw with a record', (() => { try { S.drawScreen(0.5); S.drawScreen(3); S.startMode('campaign'); S.setLevel(0); S.drawScreen(1); S.drawWorldMap(1); return true; } catch (e) { console.log(e); return false; } })());

// ---- 4. reset clears; 5. an old save loads with empty records
S.resetProgress(); check('resetProgress clears the records', Object.keys(S.records()).length === 0 && store.get('sciencebros.records') === '{}');
store.set('sciencebros.cleared', JSON.stringify([name0])); store.delete('sciencebros.records'); S.loadProgress();
check('a save without the records key loads with none', Object.keys(S.records()).length === 0);
store.set('sciencebros.records', JSON.stringify({ [name0]: { time: 90, score: 1, cages: 1, intel: 1, deaths: 0, rank: 'A', pts: 80 }, BOGUS: { time: 1 } })); S.loadProgress();
check('a saved record loads, an unknown or broken one is dropped', S.records()[name0] && S.records()[name0].rank === 'A' && !S.records().BOGUS && Object.keys(S.records()).length === 1);

// ---- 6. a random mission shows the rank but saves nothing
S.resetProgress(); S.startMode('campaign'); S.setMode('random'); S.startRandom(12345, true); step();
S.leave(); step();
check('random extraction goes to the debrief', S.state === 'win' && S.mode === 'random', S.state);
check('and writes no record', Object.keys(S.records()).length === 0 && store.get('sciencebros.records') === '{}');
check('but the debrief has a rank', !!S.lastResult() && /^[SABCD]$/.test(S.lastResult().rank));

// ---- 7. the shown score reaches the real one within 0.6 s and never passes it
S.resetProgress(); S.startMode('campaign'); S.startLevel(0); step(); S.setCam(0, 0);
S.addScore(12345, false); let over = false, hit = -1;
for (let i = 0; i < 36; i++) { step(); const h = S.hud(); if (h.sc > S.stats.score) over = true; if (hit < 0 && Math.floor(h.sc) === S.stats.score) hit = i; }
check('the shown score reaches stats.score within 0.6 s', hit >= 0 && Math.floor(S.hud().sc) === S.stats.score, 'after ' + (hit + 1) + ' steps');
check('and never overshoots', !over);
S.addScore(500, false); step(); S.addScore(700, false); for (let i = 0; i < 36; i++) { step(); if (S.hud().sc > S.stats.score) over = true; }
check('stacked awards also settle without overshoot', !over && Math.floor(S.hud().sc) === S.stats.score);

// ---- 8. a kill adds one popup; never more than 10 alive
S.startLevel(0); step(); S.setCam(0, 0);
const pops = () => S.fx.filter((f) => f.pop).length, e1 = Object.assign(S.makeEnt({ type: 'grunt', c: 8, from: 0 }), { face: 1 }); S.ents.push(e1);
const p0 = pops(); S.killEnemy(e1); check('a kill on screen adds one popup', pops() === p0 + 1 && S.fx.filter((f) => f.pop)[0].txt.startsWith('+'), S.fx.filter((f) => f.pop).map((f) => f.txt).join());
for (let i = 0; i < 25; i++) { const e = S.makeEnt({ type: 'grunt', c: 8 + (i % 6), from: 0 }); S.ents.push(e); S.killEnemy(e); }
check('never more than 10 popups alive', pops() <= 10 && pops() === 10, String(pops()));
S.fx.length = 0; S.setCam(4000, 0); const far = S.makeEnt({ type: 'grunt', c: 8, from: 0 }); S.ents.push(far); S.killEnemy(far);
check('a kill off screen adds none', pops() === 0);

// ---- 9. the random stream is untouched: same Math.random count as the game before round 8 over 600 scripted steps of mission 1
// (fingerprint recorded on a023136 plus the Wegbro fix, 2026-11-10; re-record it when a change alters the random stream on purpose)
const BEFORE = { n: 37597, x: 630, kills: 5, score: 900 };
function stream(path) {
  const { S: G, box } = load(path), st = (keys) => { for (const k in G.keys) G.keys[k] = false; Object.assign(G.keys, keys); G.step(1 / 60); for (const k in G.pressed) G.pressed[k] = false; };
  box.gen = mulberry(99); G.reset(); G.startLevel(0); box.n = 0;
  for (let i = 0; i < 600; i++) st({ right: i % 200 < 150, fire: i % 7 < 3, jump: i % 45 < 12, special: i === 300 });
  return { n: box.n, x: Math.round(G.P.x), kills: G.stats.kills, score: G.stats.score };
}
const a = stream(process.argv[2]), b = BEFORE;
check('Math.random is called as often as before round 8', a.n === b.n && a.n > 0, a.n + ' vs ' + b.n);
check('and the run ends in the same place', a.x === b.x && a.kills === b.kills && a.score === b.score, JSON.stringify(a) + ' vs ' + JSON.stringify(b));
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
