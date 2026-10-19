// Headless checks for the special events: each one can be forced, runs to the end and does what it says; the
// director never starts one during the quiet start, in a boss fight or in a bonus mode, and does start them later on.
// Usage: node science-bros/tests/events.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
let fails = 0, frame = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (++frame % 5 === 0) S.render(frame / 60); };
const calm = () => { for (const e of S.ents) if (e.type !== 'para') { e.react = 99; e.cool = 99; } };
// a flat field: earth from row 16 down, open sky above, no one about; the bro at column c
const flat = (c = 30) => {
  S.startLevel(2); S.endCeasefire(); step();
  for (let x = 0; x < 120; x++) for (let r = 0; r < 21; r++) S.setTile(x, r, r >= 16 ? 1 : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); step();
  S.P.x = c * T; S.P.y = 15 * T - 15.01; S.P.face = 1; S.P.bro = S.BRO.einstein;
  for (let i = 0; i < 60; i++) { S.P.inv = 1e9; S.P.x = c * T; step(); }
};
const quack = (c, extra = {}) => { const e = Object.assign(S.makeEnt({ type: 'grunt', c, from: 0 }), { face: -1, react: 99, cool: 99 }, extra); S.ents.push(e); return e; };
const runEvent = (max, each = noop) => { let i = 0; for (; i < max && S.ev(); i++) { each(i); step(); } return i; };

check('there are at least 5 events', S.EVENTS.length >= 5, S.EVENTS.join(' '));
let errs = [];
// ---- airstrike: a red strip, bombers, bombs land in it; the bro outside it lives
try {
  flat(); S.forceEvent('airstrike'); const E = S.ev(), q = quack(36);
  S.P.x = 10 * T; let bombs = 0, maxB = 0;
  const n = runEvent(900, () => { S.P.inv = 0; S.P.x = 10 * T; calm(); const b = S.bullets.filter((o) => o.raid).length; maxB = Math.max(maxB, b); bombs += b; });
  check('airstrike: a warning strip around the bro, a few seconds before the bombers', E.x0 < 30 * T && E.x1 > 30 * T && E.warn >= 2);
  check('airstrike: bombers fly over and carpet-bomb the strip', maxB >= 4 && q.dead, maxB + ' bombs in the air at once');
  check('airstrike: it ends, and the bro outside the strip is alive', !S.ev() && S.evLog().includes('airstrike') && S.P.alive, n + ' frames');
} catch (e) { errs.push('airstrike: ' + e.message); }
// ---- supply drop: crates come down on chutes and land; broken open they give pickups
try {
  flat(); S.forceEvent('supply'); const E = S.ev(), crates = E.crates.slice();
  const n = runEvent(900, () => { S.P.inv = 1e9; });
  check('supply: two or three crates drop on chutes', crates.length >= 2 && crates.some((e) => e.type === 'guncrate' && e.gun) && crates.some((e) => e.type === 'ammo'), crates.map((e) => e.type).join(' '));
  check('supply: they land', !S.ev() && crates.every((e) => !e.dead && e.onGround && !e.dropping), n + ' frames');
  const p0 = S.ents.filter((e) => e.type === 'pickup').length; crates.forEach((e) => S.hitEnemy(e, 9, 0)); step();
  check('supply: broken open they give pickups', S.ents.filter((e) => e.type === 'pickup').length >= p0 + crates.length);
} catch (e) { errs.push('supply: ' + e.message); }
// ---- ambush: paratroopers on both sides
try {
  flat(); S.forceEvent('ambush'); const paras = S.ev().paras.slice();
  for (let i = 0; i < 420; i++) { S.P.inv = 1e9; step(); }
  const px = S.P.x;
  check('ambush: a squad of paratroopers drops in', paras.length >= 4 && paras.every((p) => p.type === 'para'), paras.length + ' paras');
  check('ambush: on both sides of the bro', paras.some((p) => p.x < px) && paras.some((p) => p.x > px));
  check('ambush: they land and fight', paras.filter((p) => !p.dead && !p.chute && p.onGround).length >= 3 && paras.every((p) => p.aware));
  paras.forEach((p) => S.hitEnemy(p, 99, 0)); step();
  check('ambush: it ends when they are down', !S.ev() && S.evLog().includes('ambush'));
} catch (e) { errs.push('ambush: ' + e.message); }
// ---- golden quack: runs away; killed it gives a spare bro, left alone it escapes
try {
  flat(); const l0 = S.lives; S.forceEvent('golden'); const g = S.ev().g, x0 = g.x;
  for (let i = 0; i < 60; i++) { S.P.inv = 1e9; step(); }
  check('golden quack: it runs away from the bro', g.x > x0 + 40 && !g.dead, ((g.x - x0) / T).toFixed(1) + ' tiles in 1 s');
  S.hitEnemy(g, 99, 0, 'shot'); step(); step();
  check('golden quack: killing it gives an extra bro', S.lives === l0 + 1 && !S.ev(), S.lives - l0 + ' bros');
  flat(); const l1 = S.lives; S.forceEvent('golden'); const g2 = S.ev().g;
  runEvent(60 * 20, () => { S.P.inv = 1e9; S.P.x = 30 * T; });
  check('golden quack: left alone it gets away, no bro', g2.dead && g2.hp > 0 && S.lives === l1 && !S.ev());
} catch (e) { errs.push('golden: ' + e.message); }
// ---- Oppenbro drops in: plants a nuke at the quacks ahead; they die, the bro outside the ring lives, he leaves
try {
  flat(10); const qs = [quack(26), quack(28), quack(31)];
  S.forceEvent('oppenbro'); const E = S.ev(), o = E.o; let said = false, planted = null, ringOk = true, boomSeen = false;
  const n = runEvent(60 * 20, () => {
    S.P.inv = 0; S.P.x = 10 * T; calm(); if (o.say === 'NOW I AM BECOME BRO') said = true;
    const nk = S.nukes().find((k) => k.ev === E); if (nk) { planted = planted || nk; if (nk.boom) boomSeen = true; }
    if (planted && !planted.boom && Math.hypot(S.P.x + 5 - planted.x, S.P.y + 8 - planted.y + 6) < S.NUKE_R) ringOk = false;
  });
  check('Oppenbro event: he parachutes in and says his line', said && !o.chute);
  check('Oppenbro event: he plants a nuke ahead, near the quacks', !!planted && planted.x > 20 * T && boomSeen, planted && 'at column ' + (planted.x / T).toFixed(0));
  check('Oppenbro event: the blast clears the quacks', qs.every((q) => q.dead));
  check('Oppenbro event: the bro outside the ring is not hurt', ringOk && S.P.alive);
  check('Oppenbro event: he leaves afterwards and the event ends', o.dead && !S.ev() && S.evLog().includes('oppenbro'), n + ' frames');
} catch (e) { errs.push('oppenbro: ' + e.message); }
// ---- meteor shower and blackout
try {
  flat(); S.forceEvent('meteor'); let marks = 0;
  const n = runEvent(60 * 15, () => { S.P.inv = 1e9; marks = Math.max(marks, S.fx.filter((f) => f.kind === 'marker').length); });
  check('meteor shower: red marks, then rocks, then it ends', marks >= 1 && !S.ev() && S.evLog().includes('meteor'), n + ' frames');
  flat(); S.forceEvent('blackout'); for (let i = 0; i < 60; i++) { S.P.inv = 1e9; step(); }
  const dark = S.evDark(); runEvent(60 * 20, () => { S.P.inv = 1e9; });
  check('blackout: the lights go out, then come back', dark > 0.5 && S.evDark() === 0 && !S.ev());
} catch (e) { errs.push('meteor/blackout: ' + e.message); }
check('every event runs and draws without errors', errs.length === 0, errs.join(' | '));

// ---- the director
const quiet = (frames) => { for (let i = 0; i < frames; i++) { S.P.inv = 1e9; step(); if (S.ev()) return false; } return true; };
check('no events in the first two missions', [0, 1].every((n) => { S.startLevel(n); return !S.evPlan(); }));
let L = -1; for (let n = 2; n < S.nLevels && L < 0; n++) { S.startLevel(n); if (S.evPlan()) L = n; }
check('a later mission has an event planned', L >= 2, 'mission ' + (L + 1));
S.startLevel(L); S.skipEvClock(999); S.P.x = 120 * T;
check('no event during the quiet start', quiet(240) && S.ceasefire > 0 && !!S.evPlan());
S.startLevel(L); S.endCeasefire(); step(); S.boss.active = true; S.skipEvClock(999); S.P.x = 120 * T;
check('no event in a boss fight', quiet(120));
let bonus = true;
for (const m of ['siege', 'rush', 'moon']) { S.startMode(m); S.endCeasefire(); S.skipEvClock(999); if (S.evPlan() || !quiet(300)) bonus = false; }
check('no events in the bonus modes', bonus);
S.startMode('campaign'); S.reset();
// a long run through every mission: events come up, only from the third mission, more often later
const got = [];
for (let n = 0; n < S.nLevels; n++) {
  S.startLevel(n); S.endCeasefire(); for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step(); }
  S.skipEvClock(200); let name = null;
  for (let i = 0; i < 120 && !name; i++) { S.P.inv = 1e9; step(); if (S.ev()) name = S.ev().name; }
  got.push(name);
}
const early = got.slice(2, 2 + Math.floor((S.nLevels - 2) / 2)).filter(Boolean).length, late = got.slice(2 + Math.floor((S.nLevels - 2) / 2)).filter(Boolean).length;
check('over a whole campaign the director starts events in later missions', !got[0] && !got[1] && got.filter(Boolean).length >= 6, got.map((g, i) => (i + 1) + ':' + (g || '-')).join(' '));
check('later missions get more events than earlier ones', late >= early, early + ' early, ' + late + ' late');
check('the events vary', new Set(got.filter(Boolean)).size >= 3);
check('one event at a time', (() => { S.startLevel(L); S.endCeasefire(); step(); S.forceEvent('blackout'); S.skipEvClock(999); for (let i = 0; i < 120; i++) { S.P.inv = 1e9; step(); if (S.ev() && S.ev().name !== 'blackout') return false; } return true; })());
console.log(fails ? fails + ' check(s) failed' : 'all event checks passed');
process.exit(fails ? 1 : 0);
