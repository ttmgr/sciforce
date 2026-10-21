// Headless checks for the round 5 tuning: dogs notice you later and from nearer, a boss that calms down walks home with its damage kept,
// and campaign missions hold about 1.5x the quacks at NORMAL / 100% (the "before" numbers are from commit 7fd836a).
// Usage: node science-bros/tests/tuning.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const store = {}; // a pretend browser storage, so a saved setting can be loaded by a fresh game
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const boot = () => {
  const win = { __SB_TEST__: true };
  const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
  vm.createContext(sb); vm.runInContext(src, sb); return win.__SB__;
};
store['sciencebros.settings'] = JSON.stringify({ difficulty: 1, density: 3 }); // a player who saved NORMAL / 100% before this change
let S = boot();
const T = S.T;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0, passes = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (ok) passes++; else fails++; };
const W = { grunt: 1, para: 1, dog: 1, scout: 1, shield: 1.5, medic: 1.5, bomber: 1.5, grenadier: 2, flamer: 2, guru: 2, preacher: 2, camdrone: 2, jetpack: 2.5, rocketeer: 2.5, turret: 2.5, heavy: 3, brute: 3, sniper: 3, mortar: 3, minelayer: 2, jumper: 2, pilldoc: 2.5, flagbearer: 2, sapper: 2, knight: 3, diffuser: 2, miner: 2, detox: 2.5, streamer: 2.5, yogi: 2.5, pinboard: 2.5, alpha: 3, dronecaller: 3 };
const quacks = () => S.ents.filter((e) => W[e.type] && !e.dead);
const flat = () => { S.startLevel(0); S.endCeasefire(); step(); for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.P.bro = S.BRO.einstein; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.alt = null; S.P.inv = 1e9; run(90); }; // (90 frames so the camera has caught up and the player counts as on screen)
const dogAt = (d) => { const e = S.makeEnt({ type: 'dog', c: 30 + Math.round(d / T), from: 15 }); e.x = S.P.x + d; e.y = 16 * T - e.h - 0.01; e.face = -1; e.cool = 0; S.ents.push(e); return e; };

// ---- 1. dogs: notice range and reaction delay (7fd836a: 220 px, no delay, so a dog charged on the first frame it saw you)
let range = 0;
for (let d = 80; d <= 240; d += 10) { // the farthest distance at which a dog that cannot move ever notices a standing bro
  flat(); const e = dogAt(d), x0 = e.x; let seen = false;
  for (let i = 0; i < 120; i++) { e.x = x0; e.vx = 0; e.cool = 99; step(); if (e.aware) { seen = true; break; } }
  if (seen) range = d;
}
check('a dog notices you from 150 px or less (was 220)', range > 0 && range <= 150, 'range ' + range + ' px');
flat(); { const e = dogAt(100), x0 = e.x; let f = 0; for (; f < 240 && !e.aware; f++) { e.x = x0; e.vx = 0; e.cool = 99; step(); }
  const delay = f / 60; console.log('(dog at 100 px: charges after ' + delay.toFixed(2) + ' s; on 7fd836a it was 0.02 s)');
  check('it growls first: at least 0.5 s from seeing you to the charge (was none)', delay >= 0.5 && delay <= 1.2, delay.toFixed(2) + ' s'); }
flat(); { const e = dogAt(200); run(120); check('a dog 200 px away still does not charge (was charging already)', !e.aware && Math.abs(e.x - (S.P.x + 200)) < 60, 'aware ' + e.aware); }
flat(); { const e = dogAt(100); e.hp = e.max = 50; S.hitEnemy(e, 1, 0); run(3); check('a dog you shot charges at once', e.aware || e.dead, 'aware ' + e.aware); }
// the time a bro has to shoot: from the dog coming into view (200 px) to it biting, bro walking toward it at his walking speed is not needed; stand still
flat(); { const e = dogAt(140); let t = 0; S.P.inv = 0; for (; t < 400 && S.P.alive; t++) step(); check('a dog still reaches and kills a bro who ignores it', !S.P.alive, (t / 60).toFixed(2) + ' s from 140 px'); }
flat(); { const e = dogAt(140); let t = 0; S.P.inv = 0; S.P.bro = S.BRO.einstein; S.P.face = 1; for (; t < 400 && !e.dead && S.P.alive; t++) step({ fire: true }); console.log('(a bro firing level at a dog 140 px away: ' + (e.dead ? 'dog dead' : 'bro dead') + ' after ' + (t / 60).toFixed(2) + ' s)');
  check('a bro who shoots at once kills a dog that came from 140 px', e.dead && S.P.alive, 'dead ' + e.dead + ' bro alive ' + S.P.alive); }

// ---- 2. bosses go home when the player dies or leaves the arena, with their damage kept
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const wake = (l) => {
  S.startLevel(l); S.endCeasefire(); run(1);
  const b = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  S.ents.forEach((e) => { if (e !== b && e.type !== 'flag') e.dead = true; });
  const home = [b.x, b.y]; S.P.inv = 1e9; S.P.x = (b.trig + 3) * T; S.P.y = 13 * T; run(60);
  return { b, home };
};
const off = (b, home) => Math.round(Math.hypot(b.x - home[0], b.y - home[1]));
for (const how of ['dies', 'leaves the arena']) {
  const { b, home } = wake(0);
  check('Homeopathitron wakes (' + how + ')', b.active);
  for (let k = 0; k < 6; k++) { S.P.x = (b.trig + 3 + (k % 2) * 25) * T; S.P.y = 13 * T; run(50); }
  S.hitEnemy(b, 20, 0); const hp = b.hp, away = off(b, home);
  check('after a few seconds of fighting it has moved off its spot', away > 40, away + ' px');
  if (how === 'dies') { S.P.inv = 0; S.P.shield = 0; S.killPlayer('shot'); for (let i = 0; i < 400 && !S.P.alive; i++) run(1); run(30); }
  else { S.P.x = (b.ax0 - 20) * T; S.P.y = 2 * T; run(60 * 4); }
  check('when the player ' + how + ' it calms down and is back on its start spot', !b.active && off(b, home) <= 1 && b.state === 'idle', off(b, home) + ' px off, state ' + b.state);
  check('its health is exactly what it was (no healing, no loss)', b.hp === hp && hp < b.max, b.hp + ' of ' + b.max);
  S.P.inv = 1e9; S.P.x = (b.trig + 3) * T; S.P.y = 13 * T; run(300);
  check('and it wakes again when the player returns, with the same health', b.active && b.hp <= hp);
}
{ // every other boss has the same bug and the same fix (missions: Homeopathitron, burrower, tank, engine, blimp, kopter, director, citrus)
  const bad = [];
  for (const l of [0, 1, 2, 3, 4, 5, 9, 17]) for (const how of ['dies', 'leaves']) {
    const { b, home } = wake(l);
    for (let k = 0; k < 6; k++) { S.P.x = (b.trig + 3 + (k % 2) * 25) * T; S.P.y = 13 * T; run(50); }
    S.hitEnemy(b, 10, 0); const hp = b.hp, vats = b.vats ? b.vats.map((v) => v.dead) : null;
    if (b.vats) { b.vats[0].dead = true; b.vats[0].hp = 0; if (vats) vats[0] = true; }
    if (how === 'dies') { S.P.inv = 0; S.P.shield = 0; S.killPlayer('shot'); for (let i = 0; i < 400 && !S.P.alive; i++) run(1); run(30); } else { S.P.x = (b.ax0 - 20) * T; S.P.y = 2 * T; run(60 * 4); }
    const hpOk = b.hp === hp || (b.vats && b.hp >= hp - 1), vatsOk = !vats || vats.every((d, i) => !d || b.vats[i].dead);
    if (b.active || off(b, home) > 2 || !hpOk || !vatsOk) bad.push(b.type + '/' + how + ':' + (b.active ? 'awake ' : '') + off(b, home) + 'px' + (hpOk ? '' : ' hp') + (vatsOk ? '' : ' vats'));
  }
  check('all eight boss types go home when the player dies or leaves, keeping hp and destroyed parts', !bad.length, bad.join(' '));
}

// ---- 3. campaign density: about 1.5x the quacks at NORMAL / 100% (7fd836a: the OLD counts below)
const OLD = [38, 43, 46, 46, 51, 51, 49, 48, 50, 53, 54, 60, 57, 60, 67, 64, 63, 72]; // quacks per mission on 7fd836a at NORMAL / 100%
S = boot(); // a fresh game that loads the saved NORMAL / 100%
check('the saved 100% setting is loaded', S.density() === 1 && S.DIFFS[S.difficulty()].name === 'NORMAL');
const cnt = []; for (let l = 0; l < S.nLevels; l++) { S.reset(); S.startLevel(l); cnt.push(quacks().length); }
const old = (k) => Array.from({ length: S.nLevels }, (_, i) => S.levelDef(i)).indexOf(S.ROUND5[k]); // a mission by its place among the 20 before round 6 (five more sit between them now)
const same = OLD.map((_, i) => cnt[old(i === OLD.length - 1 ? 19 : i)]); // the missions 7fd836a also had: the first 17 and the Citadel
const ratio = same.reduce((a, b) => a + b) / OLD.reduce((a, b) => a + b), per = same.map((c, i) => c / OLD[i]);
console.log('(quacks per mission now ' + cnt.join(' ') + '; before ' + OLD.join(' ') + '; ratio ' + ratio.toFixed(3) + ')');
check('NORMAL / 100% holds about 1.5x the quacks of before (1.4 to 1.6 over the campaign)', ratio >= 1.4 && ratio <= 1.6, ratio.toFixed(3));
check('and every mission got between 1.3x and 1.7x', per.every((r) => r >= 1.3 && r <= 1.7), per.map((r) => r.toFixed(2)).join(' '));
{ const threat = []; for (let l = 0; l < S.nLevels; l++) { S.reset(); S.startLevel(l); threat.push(quacks().reduce((a, e) => a + W[e.type], 0)); }
  let dips = 0; for (let l = 1; l < S.nLevels; l++) if (threat[l] < threat[l - 1] - 6) dips++;
  check('the difficulty curve still climbs from the first mission to the finale', dips === 0 && threat[0] === Math.min(...threat) && threat[S.nLevels - 1] >= Math.max(...threat) - 6, threat.map((x) => x.toFixed(0)).join(' ')); }
S.setDensity(0, false); { const n = []; for (const l of [0, 8, 17].map(old)) { S.reset(); S.startLevel(l); n.push(quacks().length); } S.setDensity(3, false); const m = []; for (const l of [0, 8, 17].map(old)) { S.reset(); S.startLevel(l); m.push(quacks().length); }
  check('the density setting still scales on top of the new base (25% holds fewer than 100%)', n.every((v, i) => v < m[i]), n.join(',') + ' vs ' + m.join(',')); }
// safe start and fair placement at every density, on every mission
{ const bad = { ceasefire: [], near: [], wall: [], shots: [] };
  const inWall = (e) => ![0, 5, 7].includes(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T)));
  for (const k of [3, 6]) for (let l = 0; l < S.nLevels; l++) {
    S.setDensity(k, false); S.reset(); S.startLevel(l); const tag = 'L' + (l + 1) + '@' + S.DENS[k] * 100;
    if (S.ceasefire < 9.9) bad.ceasefire.push(tag);
    if (quacks().some((e) => e.x < 20 * T)) bad.near.push(tag);
    if (quacks().some(inWall)) bad.wall.push(tag);
  }
  for (const l of [0, 8, 17].map(old)) { S.setDensity(6, false); S.reset(); S.startLevel(l); S.P.inv = 1e9; let fired = 0; for (let i = 0; i < 580; i++) { step(); fired += S.bullets.filter((b) => b.owner === 'e').length; } if (fired) bad.shots.push('L' + (l + 1) + ':' + fired); }
  check('safe start: a 10 s ceasefire at 100% and 300%, on all 18 missions', !bad.ceasefire.length, bad.ceasefire.join(' '));
  check('safe start: no quack within 20 tiles of the start at 100% and 300%', !bad.near.length, bad.near.join(' '));
  check('nothing spawns inside a wall at 100% and 300%', !bad.wall.length, bad.wall.join(' '));
  check('nothing fires in the first 10 s at 300%', !bad.shots.length, bad.shots.join(' ')); }
S.setDensity(3, false);

// ---- 4. frame budget: INSANE, 300% of the new base, the last mission, the busiest 30 columns, firing and blowing things up
{
  const fight = () => {
    S.setDifficulty(3, false); S.setDensity(6, false); S.reset(); S.startLevel(old(17)); S.P.bro = S.BRO.einstein; S.endCeasefire(); S.P.alt = { kind: 'minigun', ammo: 99999 };
    const q = quacks(), n = q.length; let best = 24, bn = 0;
    for (let c = 24; c < 330; c += 4) { const k = q.filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (k > bn) { bn = k; best = c; } }
    const near = q.find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60);
    for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); }
    const N = 300, t0 = Date.now();
    for (let i = 0; i < N; i++) { S.P.inv = 1e9; if (i % 20 === 0) S.explode(S.P.x + 60, S.P.y + 8, 30, 1, 'p', 0); step({ fire: true }, true); }
    return [(Date.now() - t0) / N, n, bn];
  };
  let ms = 99, n = 0, bn = 0; for (let r = 0; r < 5; r++) { const f = fight(); ms = Math.min(ms, f[0]); n = f[1]; bn = f[2]; }
  S.setDifficulty(1, false); S.setDensity(3, false);
  check('the top setting is capped: no more quacks than 7fd836a had at 300% (223 in the level, 24 in 30 columns), so the frame cost does not grow', n <= 223 && bn <= 24, n + ' / ' + bn);
  check('a fight at INSANE / 300% (' + n + ' quacks in the level, ' + bn + ' in 30 columns) costs under 3 ms a frame', ms < 3, ms.toFixed(2) + ' ms');
}
console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' tuning checks passed');
process.exit(fails ? 1 : 0);
