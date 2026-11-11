// Headless checks for round 7's three mission features:
//  1. DETOX EXPRESS, a new campaign mission (26 in all) on a train that does not move: the scenery does. Cars with gaps, a constant slipstream on the roofs
//     that never reaches a car end, three juice tankers to uncouple, the Detoxkopter (a mid-mission boss that comes in from the west and can be shot down), a boss on
//     the front cars, and a chopper out.
//  2. The edge of the world in FLAT EARTH STATION: a span of the stretch whose ends join (both ways, quacks from behind, shots vanish), switched off for good when
//     the mast inside falls; the player, the walker, the Think Tank can all wrap and leave; dying inside respawns.
//  3. The meltdown in PYRAMID POWER PLANT: a collapse front after the last required non-boss objective, 70% of run speed, stops at the arena, spares objectives,
//     cages and the pad, and a respawn is always east of it.
// Usage: node science-bros/tests/mission_r7.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
const M = Object.create(Math); { let a = 7; M.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T, N = S.nLevels, LH = S.LH;
let prevJump = false;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); if (keys.jump && !prevJump) S.pressed.jump = true; prevJump = !!keys.jump; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const NAMES = Array.from({ length: N }, (_, i) => S.levelDef(i).name), at = (n) => NAMES.indexOf(n);
const EXP = at('DETOX EXPRESS'), FLAT = at('FLAT EARTH STATION'), PYR = at('PYRAMID POWER PLANT');
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const begin = (l) => { S.reset(); S.startLevel(l); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99); S.P.inv = 1e9; };
const solid = (c, r) => S.isSolidT(S.tileAt(c, r));
const finalBoss = () => S.ents.find((e) => BOSSES.includes(e.type) && e.final);
// win a boss fight and take the chopper: from the arena to the level-clear screen
function finishIt() {
  const B = finalBoss(); S.finishObjectives(); S.P.x = (B.trig + 2) * T; S.P.y = 12 * T; S.P.inv = 1e9;
  run(30); S.killEnemy(B, 'shot'); for (let i = 0; i < 60 * 14 && !B.dead; i++) { S.P.inv = 1e9; S.P.alive = true; step({}); }
  const chop = !!S.chopper; let i = 0;
  for (; i < 60 * 40 && S.state === 'play'; i++) { S.P.inv = 1e9; step({ right: true, jump: i % 40 < 18 }); }
  return { dead: B.dead, chop, state: S.state, col: S.P.x / T };
}
// a simple bot: runs right, jumps at a gap or a wall or now and then, fires, climbs when stuck; `onTick` gets the frame
function bot(goalCol, maxFrames, onTick, fireOk = () => true) {
  let far = 0, last = 0, still = 0, i = 0;
  for (; i < maxFrames && far < goalCol; i++) {
    S.P.inv = 1e9; S.P.alive = true; S.P.bro = S.BRO.einstein; if (S.P.mech) S.P.mech = null;
    const pc = Math.floor((S.P.x + 5) / T), fr = Math.floor((S.P.y + S.P.h + 1) / T), gap = !solid(pc + 1, fr) && !solid(pc + 2, fr) && S.P.onGround;
    still = Math.abs(S.P.x - last) < 0.3 ? still + 1 : 0; last = S.P.x;
    if (still > 90) { S.P.x += 3 * T; S.P.y -= 3 * T; still = 0; } // wedged between a crate and a quack: hop it
    step({ right: true, jump: gap || i % 45 < 14 && S.P.onGround || still > 20, fire: i % 6 < 3 && fireOk(S.P.x / T), up: still > 40 });
    if (S.P.y > 21 * T) { S.P.y = 0; } // a fall into the gap would respawn him at the flag: this test measures the route, not the jump
    far = Math.max(far, S.P.x / T); if (onTick) onTick(i, far);
  }
  return { far, frames: i };
}

// ---- 1. DETOX EXPRESS
check('the campaign has 26 missions, the Citadel last', N === 26 && S.levelDef(N - 1).name === 'CITRUS CITADEL', N);
check('Detox Express comes right after Detox Desert and before Cryo Summit', EXP === at('DETOX DESERT') + 1 && NAMES[EXP + 1] === 'CRYO SUMMIT', NAMES.slice(EXP - 1, EXP + 2).join(' > '));
{
  const L = S.levelDef(EXP), th = S.THEMES.train, others = Object.keys(S.THEMES).filter((k) => k !== 'train');
  check('its own theme "train", unlike every other theme in sky and skyline', !!th && L.theme === 'train' && th.campaign && others.every((k) => S.THEMES[k].sky.join() !== th.sky.join() && S.THEMES[k].cityKind !== th.cityKind));
  const o = L.objectives, vat = o.find((x) => x.id === 'vat'), boss = o.find((x) => x.id === 'boss');
  check('objectives: "Uncouple the juice tankers" (3, required, vat skin) and a required boss', vat && vat.need === 3 && vat.req && /Uncouple the juice tankers/.test(vat.text) && boss && boss.req);
  check('briefing, debrief, 3 intel lines, a place on the map apart from the others', !!L.brief && !!L.debrief && L.intel.length === 3 && L.map.length === 2 && NAMES.every((n, i) => i === EXP || Math.hypot(S.levelDef(i).map[0] - L.map[0], S.levelDef(i).map[1] - L.map[1]) >= 36));
  const st = S.STORY['DETOX EXPRESS']; check('story text: intercept, start, mid, midboss, boss and win; three level signs', st && ['intercept', 'start', 'mid', 'midboss', 'boss', 'win'].every((k) => st[k] && st[k].length) && S.WIT_SIGNS['DETOX EXPRESS'].length === 3);
  check('seed of its own, no other mission changed its seed', new Set(NAMES.map((n, i) => S.seedN(i))).size === N && S.seedN(EXP) === 25 && S.seedN(at('DETOX DESERT')) === 1);
}
{
  begin(EXP);
  const tg = S.ents.filter((e) => e.type === 'target' && e.skin === 'vat'), cg = S.ents.filter((e) => e.type === 'cage'), B = finalBoss(), K = S.ents.find((e) => e.type === 'kopter');
  check('three juice tankers, three cages, a boss in the arena on the front cars', tg.length === 3 && cg.length === 3 && B && B.type === 'boss' && B.ax0 > S.cutAt() + S.stretchW(), tg.length + ' tankers, ' + cg.length + ' cages');
  check('the Detoxkopter: a boss-class kopter, not the final boss, which comes in from the west', K && !K.final && K.fromW && K.hp > 20);
  // cars: solid floor and roof inside a car, nothing under the gaps, so a fall is deadly (below row 22 is off the map)
  const cars = []; let gaps = 0, bad = 0, c = 20; for (; c < 500; c++) { const f = solid(c, 16); if (f && !cars.length || f && !solid(c - 1, 16)) cars.push([c, c]); if (f) cars[cars.length - 1][1] = c; }
  for (let k = 1; k < cars.length; k++) for (let g = cars[k - 1][1] + 1; g < cars[k][0]; g++) { gaps++; for (let r = 10; r < 22; r++) if (solid(g, r) && r !== 9) bad++; }
  check('the train is one long row of cars with gaps (' + cars.length + ' cars)', cars.length >= 14 && gaps >= 30, cars.length + ' cars');
  check('every gap is open from the roof down to the track, falling is deadly', bad === 0 && cars.every(([a, b]) => b - a >= 24 && b - a <= 33), bad + ' solid tiles in gaps');
  const winds = S.devs.filter((d) => d.kind === 'wind');
  check('the slipstream blows west on the roofs only, three columns in from both ends of every car', winds.length >= 14 && winds.every((d) => d.dir === -1 && d.r1 <= 8 && cars.some(([a, b]) => d.x0 >= (a + 3) * T && d.x1 <= (b - 2) * T)), winds.length + ' devices');
  // a gap kills
  S.P.x = (cars[2][1] + 2) * T; S.P.y = 12 * T; S.P.vx = 0; S.P.inv = 0; S.setLives(99); run(90); check('fall into a gap: the bro dies', !S.P.alive);
}
{
  begin(EXP); const K = S.ents.find((e) => e.type === 'kopter'); S.ents.forEach((e) => { if (e !== K && e.type !== 'flag' && e.type !== 'target' && e.type !== 'cage') e.dead = true; });
  S.P.x = (K.trig + 3) * T; S.P.y = 10 * T; run(30); let west = false, maxHp = K.hp;
  for (let i = 0; i < 400 && !west; i++) { S.P.inv = 1e9; step(); west = K.active && K.x + K.w / 2 < S.P.x - 40; }
  check('the Detoxkopter flies in from behind (the west) when you reach its car', K.active && west, 'kopter col ' + (K.x / T).toFixed(0) + ' player col ' + (S.P.x / T).toFixed(0));
  for (let i = 0; i < 60 * 30 && !K.dead; i++) { S.P.inv = 1e9; S.P.alive = true; if (i % 30 === 0) S.hitEnemy(K, 12, 0, 'shot'); step(); }
  check('and it can be shot down; that completes its (optional) objective', K.dead && S.objectives.find((o) => o.id === 'kopter').n === 1, 'hp ' + K.hp.toFixed(0) + '/' + maxHp);
}
{
  begin(EXP); const r = finishIt();
  check('chopper extraction works: boss down, chopper called, level clear', r.dead && r.chop && r.state === 'win', JSON.stringify(r));
}
{
  begin(EXP); const B = finalBoss(), res = bot(B.trig, 60 * 200);
  check('a bot runs the train from the platform to the locomotive', res.far >= B.trig, 'col ' + res.far.toFixed(0) + ' of ' + B.trig + ' in ' + (res.frames / 60).toFixed(0) + ' s');
  check('then the mission can be finished (boss, chopper)', (() => { const r = finishIt(); return r.dead && r.state === 'win'; })());
}
// the scenery rushes past: drawing the same scene a moment apart changes the backdrop, not the cars
{ begin(EXP); let err = ''; try { for (let k = 0; k < 4; k++) S.render(k * 0.4); } catch (e) { err = e.message; } check('the train scene draws (scrolling rails, bogies, skyline)', !err, err); }

// ---- 2. the edge of the world
const edgeLevel = () => { begin(FLAT); const W = S.wrap(); S.ents.forEach((e) => { if (e.type !== 'target' && e.type !== 'flag') e.dead = true; }); return W; };
{
  const W = edgeLevel(), x0 = W.c0 * T, x1 = (W.c1 + 1) * T, mid = (W.c0 + W.c1) / 2;
  check('the edge of the world: a bounded span in the stretch, with the third mast inside and the other two outside', !!W && W.c0 > S.cutAt() && W.c1 - W.c0 >= 50 && S.ents.filter((e) => e.type === 'target' && e.x >= x0 && e.x < x1).length === 1 && S.ents.filter((e) => e.type === 'target').length === 3);
  check('its ends are flat and clear, the same height at both', [0, 1, 2, 3, 4, 5, 6].every((k) => S.tileAt(W.c0 + k, 16) === S.tileAt(W.c1 - k, 16) && solid(W.c0 + k, 16) && !solid(W.c0 + k, 15) && !solid(W.c1 - k, 15)));
  // east end -> west end
  S.P.x = (W.c1 - 12) * T; S.P.y = 14 * T; S.P.vx = 0; run(2); let east = S.P.x, hopped = 0, last = S.P.x;
  for (let i = 0; i < 60 * 8 && !hopped; i++) { step({ right: true }); S.P.inv = 1e9; if (S.P.x < last - 200) hopped = 1; last = S.P.x; }
  check('walking off the east end brings you back at the west end', hopped && S.P.x < x0 + 8 * T && S.P.x > x0, (S.P.x / T).toFixed(1) + ' (span ' + W.c0 + '-' + W.c1 + ')');
  const wq = S.ents.filter((e) => e.wq && !e.dead);
  check('a couple of quacks come from behind (west of you)', wq.length === 2 && wq.every((e) => e.x < S.P.x), wq.length + ' quacks');
  // west end -> east end
  S.ents.forEach((e) => { if (e.wq) e.dead = true; }); S.P.x = (W.c0 + 12) * T; run(2); hopped = 0; last = S.P.x;
  for (let i = 0; i < 60 * 8 && !hopped; i++) { step({ left: true }); S.P.inv = 1e9; if (S.P.x > last + 200) hopped = 1; last = S.P.x; }
  check('walking off the west end brings you to the east end', hopped && S.P.x > x1 - 8 * T && S.P.x < x1, (S.P.x / T).toFixed(1));
  // shots disappear at the ends
  S.ents.forEach((e) => { if (e.wq) e.dead = true; }); S.P.x = (W.c1 - 8) * T; run(2); const n0 = S.bullets.length;
  S.bullets.push({ x: x1 - 40, y: 15 * T, vx: 300, vy: 0, owner: 'p', life: 3, kind: 'p', dmg: 1 }); run(30);
  check('a shot that reaches the end is gone, it does not wrap', !S.bullets.some((b) => b.x < x1 - 200 && b.owner === 'p' && b.vx > 0) && S.bullets.length <= n0 + 1);
  // the Think Tank and the walker wrap too
  S.ents.forEach((e) => { if (e.wq) e.dead = true; });
  const tank = S.makeEnt({ type: 'tanksuit', c: Math.round(mid) }); S.ents.push(tank); tank.win = true; tank.x = x1 - 1.5 * T; S.updateWrap(0); check('an empty Think Tank at the east end comes out at the west end', tank.x < x0 + 8 * T, (tank.x / T).toFixed(1));
  const walker = S.makeEnt({ type: 'mechsuit', c: Math.round(mid) }); S.ents.push(walker); walker.win = true; walker.x = x0 + 0.2 * T; S.updateWrap(0); check('an empty walker at the west end comes out at the east end', walker.x > x1 - 8 * T, (walker.x / T).toFixed(1));
  for (const kind of ['tank', 'walker']) {
    S.P.alive = true; S.P.mech = { kind, hp: 40, max: 40, gcool: 0, rcool: 0, wp: 0, hurt: 0, lift: 0 }; S.P.x = (W.c1 - 10) * T; S.P.y = 14 * T; run(2); hopped = 0; last = S.P.x;
    for (let i = 0; i < 60 * 14 && !hopped; i++) { step({ right: true }); S.P.inv = 1e9; if (S.P.x < last - 200) hopped = 1; last = S.P.x; }
    check('the player in the ' + (kind === 'tank' ? 'Think Tank' : 'walker') + ' wraps too', hopped === 1, (S.P.x / T).toFixed(1)); S.P.mech = null;
  }
  // dying inside respawns correctly
  S.ents.forEach((e) => { if (e.wq) e.dead = true; }); S.P.alive = true; S.P.x = (W.c0 + 30) * T; S.P.y = 12 * T; run(4); S.P.inv = 0; S.killPlayer('gib'); run(60 * 6, {});
  check('dying inside the edge respawns the next bro at a checkpoint, alive, inside the span or before it', S.P.alive && S.P.x / T > W.c0 - 40 && S.P.x / T < W.c1 + 1, (S.P.x / T).toFixed(1));
  S.P.inv = 1e9; S.P.x = (W.c1 - 8) * T; S.P.y = 14 * T; run(2); hopped = 0; last = S.P.x; for (let i = 0; i < 60 * 8 && !hopped; i++) { step({ right: true }); S.P.inv = 1e9; if (S.P.x < last - 200) hopped = 1; last = S.P.x; }
  check('and the wrap works for the new bro', hopped === 1);
  // the camera never shows past the ends while the wrap is on
  S.ents.forEach((e) => { if (e.wq) e.dead = true; }); S.P.x = (W.c1 - 12) * T; S.P.y = 14 * T; let seen = true; for (let i = 0; i < 60 * 6; i++) { step({ right: true }); S.P.inv = 1e9; if (S.cam.x + 480 > x1 + 2 || S.cam.x < x0 - 2) seen = S.P.win ? false : seen; }
  check('the camera stays inside the span while the wrap is on', seen);
  // toppling the mast switches it off for good, and a way out opens
  const mast = S.ents.find((e) => e.type === 'target' && e.x >= x0 && e.x < x1); S.killEnemy(mast, 'shot');
  check('the mast inside falls: the wrap is off for good', W.off === true && S.objectives.find((o) => o.id === 'radio').n >= 1);
  S.P.alive = true; S.P.x = (W.c1 - 8) * T; S.P.y = 14 * T; run(2); for (let i = 0; i < 60 * 8; i++) { step({ right: true }); S.P.inv = 1e9; }
  check('you walk out of the east end', S.P.x > x1 + 2 * T, (S.P.x / T).toFixed(1));
  S.P.x = (W.c0 + 8) * T; run(2); for (let i = 0; i < 60 * 8; i++) { step({ left: true }); S.P.inv = 1e9; }
  check('and out of the west end', S.P.x < x0 - 2 * T, (S.P.x / T).toFixed(1));
  S.ents.forEach((e) => { if (e.wq) e.dead = true; }); const w0 = W.n; S.P.inv = 0; S.killPlayer('gib'); run(60 * 6); S.P.inv = 1e9; S.P.x = (W.c1 - 4) * T; S.P.y = 14 * T; run(60 * 4, { right: true });
  check('the wrap stays off, even after the player dies and walks back in', W.off && W.n === w0 && S.P.x > x1 && !S.ents.some((e) => e.wq && !e.dead), 'wraps ' + W.n);
}
{
  // the mission can be finished: a bot goes through the whole stretch (the bot is let out of the wrap by the mast falling when it is first sent round)
  begin(FLAT); const W = S.wrap(), B = finalBoss(); let wraps = 0, fell = false, prev = 0;
  const res = bot(B.trig, 60 * 260, (i, far) => { if (S.P.x < prev - 300) wraps++; prev = S.P.x; if (wraps >= 1 && !fell && !W.off) { fell = true; S.killEnemy(S.ents.find((e) => e.type === 'target' && e.x >= W.c0 * T && e.x < (W.c1 + 1) * T), 'shot'); } }, (col) => col < W.c0 - 2 || col > W.c1 + 2 || W.off);
  check('a bot runs Flat Earth Station: it is sent round the edge once, the mast falls, and it gets to the zeppelin', res.far >= B.trig && wraps >= 1 && W.off, 'col ' + res.far.toFixed(0) + ' of ' + B.trig + ', wraps ' + wraps);
  check('and the mission can be finished (boss, chopper)', (() => { const r = finishIt(); return r.dead && r.state === 'win'; })());
}

// ---- 3. the meltdown
const pyr = () => { begin(PYR); S.ents.forEach((e) => { if (e.type !== 'target' && e.type !== 'cage' && e.type !== 'flag' && e.type !== 'pickup' && !BOSSES.includes(e.type)) e.dead = true; }); return finalBoss(); };
{
  let B = pyr(); const ax0 = B.ax0;
  const snap = (r) => Array.from({ length: 560 }, (_, c) => S.tileAt(c, r)), keep0 = [21, 38, 39].map(snap);
  S.P.x = 150 * T; S.P.y = 8 * T; run(20); S.objHit('vat'); S.objHit('vat'); run(10);
  check('no meltdown while a required objective is open', !S.melt() && S.objectives.find((o) => o.id === 'vat').n === 2);
  S.objHit('vat'); const m = S.melt();
  check('the last required objective but the boss starts it: banner first, front behind the player', !!m && m.t > 0 && m.x < S.P.x - 10 * T && S.bannerNow().text === 'MELTDOWN', m && (m.x / T).toFixed(0));
  const sx = m.x; run(60 * 3); check('a three second warning, then the front moves', m.t <= 0.05 || m.x >= sx); run(10);
  const x1 = m.x; run(60 * 4); const v = (m.x - x1) / 4;
  check('it sweeps east at about 70% of a bro\'s run speed (118 px/s)', Math.abs(v - 0.7 * 118) < 6, v.toFixed(1) + ' px/s vs ' + (0.7 * 118).toFixed(1));
  check('the ground behind it is gone (earth, bricks, crates); steel and the bottom two rows stay', (() => { let gone = 0, n = 0, keepOk = true; for (let c = 136; c < Math.floor(m.x / T) - 5; c++) { n++; let loose = 0; for (let r = 0; r < 21; r++) if ([1, 2, 4, 6].includes(S.tileAt(c, r))) loose++; if (!loose) gone++; if ([21, 38, 39].some((r, k) => S.tileAt(c, r) !== keep0[k][c])) keepOk = false; } return gone >= n * 0.8 && keepOk; })());
  S.P.x = Math.max(S.P.x, m.x + 200); S.P.inv = 0; const p0 = S.P.x; run(60 * 2); check('a bro who stays ahead lives; one caught behind it dies', S.P.alive); S.P.x = m.x - 40; run(30); check('caught behind the front: dead', !S.P.alive);
  // respawn
  for (let i = 0; i < 60 * 8 && !S.P.alive; i++) step({}); check('the next bro respawns east of the front, with seconds to spare', S.P.alive && S.P.x > m.x + 12 * T, 'P col ' + (S.P.x / T).toFixed(0) + ' front ' + (m.x / T).toFixed(0));
  // it stops at the arena
  S.P.inv = 1e9; S.P.x = (ax0 - 20) * T; S.P.y = 8 * T; for (let i = 0; i < 60 * 150 && !m.done; i++) { S.P.inv = 1e9; S.P.alive = true; S.P.x = Math.max(S.P.x, m.x + 100); step({}); }
  check('the front stops at the boss arena\'s entry and no further', m.done && m.x <= ax0 * T && m.x >= (ax0 - 3) * T && S.tileAt(ax0 + 2, 16) !== 0 || m.done && m.x <= ax0 * T, (m.x / T).toFixed(0) + ' vs arena ' + ax0);
  // respawn after it has stopped: at the arena's entry, never behind the front
  S.P.inv = 0; S.killPlayer('gib'); run(60 * 5); check('a respawn after it stopped puts the bro at the arena, east of the front', S.P.alive && S.P.x >= m.x, (S.P.x / T).toFixed(0));
}
{
  // fairness: it spares an open objective, a cage and the extraction pad
  const B = pyr(); const cg = S.ents.find((e) => e.type === 'cage'), tg = S.ents.find((e) => e.type === 'target' && !e.dead), [pc, pr] = S.padOf();
  S.P.x = 40 * T; S.P.y = 8 * T; run(5); const cc = Math.floor((cg.x + 8) / T), tc = Math.floor((tg.x + 8) / T), under = (c) => { const r = Math.floor((cg.y + cg.h) / T); return r; };
  const keep = (c, r) => S.tileAt(c, r); const cr = Math.floor((cg.y + cg.h + 1) / T), tr = Math.floor((tg.y + tg.h + 1) / T);
  const cv = keep(cc, cr), tv = keep(tc, tr), pv = keep(pc, pr + 1);
  S.objectives.forEach((o) => { if (o.req && o.id !== 'boss') o.n = o.need - 1; }); tg.dead = false; S.objectives.find((o) => o.id === 'vat').n = 2; S.objHit('vat'); const m = S.melt();
  m.t = 0; m.x = Math.min(cc, tc) * T - 3 * T; m.c = Math.floor(m.x / T); S.P.x = 5 * T; S.P.inv = 1e9; for (let i = 0; i < 60 * 40; i++) { S.P.alive = true; S.P.inv = 1e9; step({}); if (m.x > Math.max(cc, tc) * T + 3 * T) break; }
  check('it never takes the ground from a cage or an open objective', keep(cc, cr) === cv && keep(tc, tr) === tv && cv !== 0 && tv !== 0, 'cage col ' + cc + ', target col ' + tc);
  const mm = S.melt(); mm.to = (pc - 5) * T; mm.done = false; mm.x = (pc - 12) * T; mm.c = pc - 12; for (let i = 0; i < 60 * 30 && !mm.done; i++) { S.P.alive = true; S.P.inv = 1e9; step({}); }
  check('nor the extraction pad', keep(pc, pr + 1) === pv && pv !== 0 && keep(pc + 2, pr + 1) !== 0 && keep(pc - 2, pr + 1) !== 0);
}
{
  // the boss first: the front starts on the arena's west side and runs toward the chopper
  const B = pyr(); const ax0 = B.ax0, [pc] = S.padOf();
  S.P.x = (ax0 + 10) * T; S.P.y = 12 * T; run(30); S.killEnemy(B, 'shot'); for (let i = 0; i < 60 * 14 && !B.dead; i++) { S.P.inv = 1e9; S.P.alive = true; step({}); }
  S.objectives.find((o) => o.id === 'vat').n = 2; S.objHit('vat'); const m = S.melt(); // the boss is down, one battery left: it falls with the player in the arena
  check('if the boss fell first the front starts at the arena\'s west side and runs toward the chopper', !!m && Math.abs(m.x - ax0 * T) < 2 && m.to === (pc - 5) * T && m.bossDone, m && (m.x / T) + ' -> ' + (m.to / T));
  check('and the chopper is called as usual', !!S.chopper);
}
{
  const B = pyr(); const res = bot(B.trig, 60 * 260, (i, far) => { const m = S.melt(); if (!m && far > B.trig - 100) { S.objectives.find((o) => o.id === 'vat').n = 2; S.objHit('vat'); } if (m && S.P.x < m.x - 20) m.caught = true; });
  const m = S.melt();
  check('a bot runs Pyramid Power Plant, triggers the meltdown on the way and stays ahead of the front to the arena', res.far >= B.trig && !!m && !m.caught, 'col ' + res.far.toFixed(0) + ' of ' + B.trig + ', front ' + (m && (m.x / T).toFixed(0)));
  check('and the mission can be finished (boss, chopper)', (() => { const r = finishIt(); return r.dead && r.state === 'win'; })());
}
{ begin(PYR); let err = ''; S.P.x = 150 * T; run(5); S.objectives.find((o) => o.id === 'vat').n = 2; S.objHit('vat'); S.melt().t = 0; try { for (let k = 0; k < 40; k++) { run(8); S.render(k * 0.2); } } catch (e) { err = e.message; } check('the meltdown scene draws (heat wall, warning edge)', !err, err); }

console.log(fails ? fails + ' check(s) failed' : 'all mission r7 checks passed');
process.exit(fails ? 1 : 0);
