// Headless checks for the DIFFICULTY (EASY / NORMAL / HARD / INSANE) and ENEMY DENSITY (25% to 300%) settings:
// each step moves the numbers the right way, both are saved, the random mission follows the difficulty,
// the safe start and fair ranges hold at the hardest setting and the highest density, and the default plays as before.
// Usage: node science-bros/tests/difficulty.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const store = {}; // a pretend browser storage, so the settings can be saved and loaded again
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const boot = () => { // one game in its own world
  const win = { __SB_TEST__: true };
  const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
  vm.createContext(sb); vm.runInContext(src, sb); return win.__SB__;
};
const S = boot(), T = S.T;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const inc = (a) => a.every((v, i) => !i || v > a[i - 1]), dec = (a) => a.every((v, i) => !i || v < a[i - 1]);
const quacks = () => S.ents.filter((e) => S.THREAT[e.type] && !e.dead);
const level = (n, d, k) => { S.setDifficulty(d, false); S.setDensity(k, false); S.reset(); S.startLevel(n); S.P.bro = S.BRO.einstein; };
const inWall = (e) => ![0, 5, 7].includes(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))); // not empty, acid or a ladder: a solid block
const flat = (n = 0) => { S.startLevel(n); S.endCeasefire(); step(); for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.P.bro = S.BRO.einstein; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.alt = null; step(); };

// ---- the default is normal and 100%, and plays as before
check('the default difficulty is NORMAL and the density 100%', S.DIFFS[S.difficulty()].name === 'NORMAL' && S.density() === 1);
for (const n of [0, 5, 11, 17, 18, S.nLevels - 1]) { // the ramp keeps its 18-mission spacing (n / 17, the Citadel at 1); missions 18 and 19 set their own place on it
  S.reset(); S.startLevel(n); const L = S.levelDef(n), p = n === S.nLevels - 1 ? 1 : L.ramp !== undefined ? L.ramp : S.seedN(n) / 17, d = S.diff; // seedN: its place in the 18-mission campaign
  check('level ' + (n + 1) + ' at the default: the numbers are the campaign ramp', Math.abs(d.react - (1 - p) * 0.5) < 1e-9 && Math.abs(d.fire - (0.65 + 0.35 * p)) < 1e-9 && Math.abs(d.bossHp - (0.65 + 0.35 * p)) < 1e-9 && d.shot === 1 && d.pace === 1 && d.drop === 0);
}
S.reset(); check('a new game starts with 3 bros at the default', S.lives === 3);

// ---- density: more quacks at every step (campaign)
for (const n of [2, 9, 17]) {
  const c = []; for (let k = 0; k < S.DENS.length; k++) { level(n, 1, k); c.push(quacks().length); }
  check('level ' + (n + 1) + ': quacks grow with the density (25/50/75/100/150/200%; 300% equals 200% in the campaign, capped to keep the frame cost)', inc(c.slice(0, 6)) && c[6] >= c[5], c.join(' < '));
}
// ---- density never breaks the safe start and puts no quack inside a wall
let early = 0, embedded = 0, embedded1 = 0;
for (const n of [0, 3, 8, 12, 17]) {
  level(n, 3, 6); early += quacks().filter((e) => e.x < 20 * T).length; embedded += quacks().filter(inWall).length;
  level(n, 1, 3); embedded1 += quacks().filter(inWall).length;
}
check('INSANE at 300%: no quack in the first 20 columns of any of 5 levels', early === 0, early + ' found');
check('and no new quack stands inside a wall', embedded <= embedded1, embedded + ' vs ' + embedded1 + ' at the default');
level(0, 3, 6); check('the 10 s ceasefire still opens the level', Math.abs(S.ceasefire - 10) < 0.01);
{ let shots = 0; for (let i = 0; i < 590; i++) { S.P.inv = 0; run(1, { right: true }); shots += S.bullets.filter((b) => b.owner === 'e').length; } check('and nobody fires during it at INSANE / 300%', shots === 0 && S.P.alive, shots + ' shots'); }

// ---- density: random missions, Lab Siege waves, event paratroopers
{
  const c = []; for (let k = 0; k < S.DENS.length; k++) { S.setDensity(k, false); S.setDifficulty(2, false); S.startRandom(4242, true); c.push(quacks().length); }
  check('random mission (same seed): quacks grow with the density', inc(c), c.join(' < '));
  S.setDensity(6, false); S.startRandom(4242, true); check('and none in the first 24 columns at 300%', quacks().every((e) => e.x >= 24 * T));
  const w = []; for (const k of [0, 3, 6]) { S.setDensity(k, false); S.reset(); S.startMode('siege'); for (let i = 0; i < 60 * 20 && S.siege.wave < 1; i++) { S.P.inv = 1e9; run(1); } w.push(S.siege.queue.length); }
  S.startMode('campaign'); check('Lab Siege: wave 1 holds more quacks with the density (25/100/300%)', inc(w), w.join(' < '));
  const a = []; let early2 = true; for (const k of [0, 3, 6]) { S.setDensity(k, false); S.reset(); S.startLevel(Array.from({ length: S.nLevels }, (_, i) => S.levelDef(i)).indexOf(S.ROUND5[8])); S.endCeasefire(); S.P.x = 30 * T; step(); S.forceEvent('ambush'); a.push(S.ev().paras.length); if (S.ev().paras.some((p) => p.x < 20 * T)) early2 = false; }
  check('ambush paratroopers: more with the density (25/100/300%)', inc(a), a.join(' < '));
  check('and none of them drops into the first 20 columns', early2);
  S.setDensity(3, false); S.setDifficulty(1, false);
}

// ---- difficulty: every step moves the numbers the right way (last mission, so the ramp is at 1)
const row = [];
for (let d = 0; d < 4; d++) {
  S.setDifficulty(d, false); S.setDensity(3, false); S.reset(); S.startLevel(S.nLevels - 1); const df = S.diff, bossHp = S.boss ? S.boss.max : 0, lives = S.lives;
  flat(S.nLevels - 1); // a grunt on flat ground 8 tiles away: time to the first shot, shots in 12 s, bullet speed and range
  const g = Object.assign(S.makeEnt({ type: 'grunt', c: 38, from: 0 }), { face: -1 }); S.ents.push(g);
  let first = -1, react0 = -1, n = 0, vmax = 0, range = 0; const seen = new Set();
  for (let i = 0; i < 720; i++) {
    S.P.inv = 1e9; S.P.x = 30 * T; g.x = 38 * T + 2; step(); if (react0 < 0 && g.aware) react0 = g.react;
    for (const b of S.bullets) if (b.owner === 'e' && !seen.has(b)) { seen.add(b); n++; if (first < 0) first = i / 60; vmax = Math.max(vmax, Math.abs(b.vx)); range = Math.abs(b.vx) * b.life; }
  }
  row.push({ name: S.DIFFS[d].name, react: df.react, fire: df.fire, bossHp, first, react0, shots: n, speed: vmax, range, lives });
}
const col = (k) => row.map((r) => r[k]);
console.log(row.map((r) => r.name + ': react ' + r.react.toFixed(2) + ', fire x' + r.fire.toFixed(2) + ', last boss ' + r.bossHp + ' hp, delay before it shoots ' + r.react0.toFixed(2) + ' s, ' + r.shots + ' shots, bullet ' + r.speed.toFixed(0) + ' px/s, range ' + r.range.toFixed(0) + ' px, bros ' + r.lives).join('\n'));
check('reaction time shrinks from EASY to INSANE', dec(col('react')), col('react').map((v) => v.toFixed(2)).join(' > '));
check('a quack that has noticed you waits less before it shoots', dec(col('react0')), col('react0').map((v) => v.toFixed(2)).join(' > '));
check('fire rate grows', inc(col('fire')), col('fire').join(' < '));
check('more shots in 12 s on INSANE than NORMAL, and on NORMAL than EASY', col('shots')[3] > col('shots')[1] && col('shots')[1] > col('shots')[0], col('shots').join(' / '));
check('enemy bullets get faster', inc(col('speed')), col('speed').map((v) => v.toFixed(0)).join(' < '));
check('but they fly just as far (the fair range does not change)', col('range').every((v) => Math.abs(v - col('range')[1]) < 6), col('range').map((v) => v.toFixed(0)).join(' '));
check('the last boss has more health', inc(col('bossHp')), col('bossHp').join(' < '));
check('bros at the start: EASY 5, NORMAL 3, HARD 3, INSANE 2', col('lives').join(',') === '5,3,3,2', col('lives').join(','));
{
  const pace = [0, 1, 2, 3].map((d) => { S.setDifficulty(d, false); return S.diff.pace; }); check('bosses play faster', inc(pace), pace.join(' < '));
  const drops = [0, 1, 2, 3].map((d) => { S.setDifficulty(d, false); return S.diff.drop; }); check('only EASY drops specials from dead quacks', drops[0] > 0 && drops[1] === 0 && drops[2] === 0 && drops[3] === 0, drops.join(','));
  const safe = S.DIFFS.map((d) => d.safe); check('cover time after a respawn is longest on EASY, shortest on INSANE', dec(safe.slice().reverse().map((v) => -v)) && safe[1] === 1, safe.join(' '));
  const crates = []; for (let d = 0; d < 4; d++) { level(9, d, 3); crates.push(S.ents.filter((e) => e.type === 'ammo' && !e.dead).length); }
  check('harder levels keep fewer ammo crates', crates[1] >= crates[2] && crates[2] >= crates[3] && crates[3] < crates[1] && crates[0] === crates[1], crates.join(' >= '));
  const cv = []; for (const d of [0, 1, 3]) { level(0, d, 3); S.endCeasefire(); step(); S.killPlayer(); let g = 0; for (let i = 0; i < 600 && !g; i++) { run(1); g = S.grace; } cv.push(g); }
  check('after a respawn the quacks stay unaware longer on EASY than NORMAL than INSANE', cv[0] > cv[1] && cv[1] > cv[2], cv.map((v) => v.toFixed(2)).join(' > '));
  S.setDifficulty(1, false);
}
{ const hp = []; for (const d of [0, 1, 3]) { S.setDifficulty(d, false); S.reset(); S.startMode('rush'); hp.push(S.boss.max); } check('Boss Rush: boss health follows the difficulty', inc(hp), hp.join(' < ')); S.setDifficulty(1, false); }
{ level(S.nLevels - 1, 1, 3); S.state; const b = S.boss, h0 = b.max; S.setDifficulty(3, true); check('changing the difficulty mid-level changes the live boss health', b.max > h0 && Math.abs(b.hp / b.max - 1) < 0.01, h0 + ' -> ' + b.max); check('and the numbers quacks use right now', S.diff.fire > 1.3 && S.diff.shot > 1.1); S.setDifficulty(1, false); }

// ---- the random mission follows the difficulty
{
  const c = [], keys = []; for (const d of [0, 1, 2]) { S.setDifficulty(d, false); S.setDensity(3, false); keys.push(S.genDiffKey()); S.startRandom(777, true); c.push(quacks().length); }
  check('the random mission uses the difficulty: EASY / NORMAL / HARD', keys.join() === 'easy,normal,hard', keys.join());
  check('and holds more quacks the harder it is', inc(c), c.join(' < '));
  S.setDifficulty(3, false); check('INSANE makes a random map like HARD (the extra bite comes from the numbers)', S.genDiffKey() === 'hard'); S.setDifficulty(1, false);
}

// ---- menus: title, pause
{
  S.startMode('campaign'); S.reset(); S.pressed.pause = true; step(); for (let k = 0; k < 9; k++) { S.pressed.down = true; step(); } S.pressed.fire = true; step(); // to the title
  S.setDifficulty(1, false); S.setDensity(3, false); S.titleSel = 0; check('on the title', S.state === 'title');
  S.pressed.right = true; step(); const t1 = S.difficulty(); S.pressed.left = true; step(); const t2 = S.difficulty();
  check('title: right makes it harder, left easier', t1 === 2 && t2 === 1);
  S.pressed.special = true; step(); const d1 = S.density(); S.pressed.melee = true; step(); S.pressed.melee = true; step(); const d2 = S.density();
  check('title: X adds quacks, C removes them', d1 === 1.5 && d2 === 0.75, d1 + ' ' + d2);
  S.setDensity(3, false);
  S.startMode('campaign'); S.reset(); S.pressed.pause = true; step(); const n = S.pauseItems().length;
  for (let k = 0; k < n; k++) { S.pressed.down = true; step(); }
  check('pause: the difficulty row sits under the list', S.menuSel() === n);
  S.pressed.right = true; step(); check('pause: right on it raises the difficulty', S.difficulty() === 2);
  S.pressed.left = true; step(); S.pressed.left = true; step(); check('and left lowers it', S.difficulty() === 0);
  S.pressed.down = true; step(); S.pressed.right = true; step(); check('pause: the next row is the density', S.density() === 1.5);
  check('the list above is unchanged (10 entries, quit last)', n === 10 && S.pauseItems()[9][0] === 'QUIT TO TITLE');
  S.pressed.pause = true; step(); S.setDifficulty(1, false); S.setDensity(3, false);
}

// ---- saved: a new game in a fresh world loads the saved choice
S.setDifficulty(3, false); S.setDensity(5, false);
{ const S2 = boot(); check('difficulty and density are saved and loaded again', S2.difficulty() === 3 && S2.density() === 2, S2.difficulty() + ' / ' + S2.density());
  S2.reset(); check('a loaded INSANE game starts with 2 bros', S2.lives === 2); check('and its random maps follow it', S2.genDiffKey() === 'hard'); }
store['sciencebros.settings'] = JSON.stringify({ difficulty: 99, density: -4 });
{ const S3 = boot(); check('a broken saved value falls back to NORMAL and 100%', S3.difficulty() === 1 && S3.density() === 1); }
S.setDifficulty(1, false); S.setDensity(3, false);

// ---- fair ranges at INSANE: common quacks cannot hurt you from 13 tiles; nothing attacks from off the screen
S.setDifficulty(3, false);
const reaches = (type, d, secs = 8) => {
  flat(); const e = Object.assign(S.makeEnt({ type, c: 30 + d, from: 0 }), { face: -1 }); S.ents.push(e);
  for (let i = 0; i < 60 * secs; i++) { S.P.inv = 0; S.P.shield = 0; if (S.P.alive) S.P.x = 30 * T; e.x = (30 + d) * T + 2; step(); if (!S.P.alive) return true; }
  return false;
};
for (const type of ['grunt', 'shield', 'heavy', 'medic', 'guru']) check('INSANE: ' + type + ' cannot hurt you from 13 tiles', !reaches(type, 13));
check('INSANE: a grunt still fights at 8 tiles', reaches('grunt', 8));
{ flat(); const far = Object.assign(S.makeEnt({ type: 'grunt', c: 80, from: 0 }), { face: -1 }); S.ents.push(far); let b = 0; for (let i = 0; i < 600; i++) { S.P.inv = 1e9; S.P.x = 30 * T; far.x = 80 * T; step(); b += S.bullets.filter((q) => q.owner === 'e').length; }
  check('INSANE: a quack off the screen never fires', b === 0, b + ' shots'); }
{ flat(); const g = Object.assign(S.makeEnt({ type: 'heavy', c: 38, from: 0 }), { face: -1 }); S.ents.push(g); let t0 = -1;
  for (let i = 0; i < 400; i++) { S.P.inv = 1e9; S.P.x = 30 * T; g.x = 38 * T + 2; step(); if (t0 < 0 && S.bullets.some((q) => q.owner === 'e')) t0 = i / 60; }
  check('INSANE: even a heavy takes at least 0.2 s from noticing you to the first shot', t0 >= 0.2, t0.toFixed(2) + ' s'); }
S.setDifficulty(1, false);

// ---- frame cost at 300% (INSANE, the last mission, a real fight in its busiest 30 columns)
{
  const fight = (d, k) => {
  level(S.nLevels - 1, d, k); S.endCeasefire(); S.P.alt = { kind: 'minigun', ammo: 99999 };
  const n300 = quacks().length; let best = 24, bn = 0;
  for (let c = 24; c < 330; c += 4) { const k = quacks().filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (k > bn) { bn = k; best = c; } }
  const near = quacks().find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60);
  for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); }
  const N = 300, t0 = Date.now();
  for (let i = 0; i < N; i++) { S.P.inv = 1e9; if (i % 20 === 0) S.explode(S.P.x + 60, S.P.y + 8, 30, 1, 'p', 0); step({ fire: true }, true); }
  return [(Date.now() - t0) / N, n300, bn]; };
  let base = 99, ms = 99, n300 = 0, bn = 0; for (let r = 0; r < 5; r++) { base = Math.min(base, fight(1, 3)[0]); const f = fight(3, 6); ms = Math.min(ms, f[0]); n300 = f[1]; bn = f[2]; } // the best of 5, so a busy machine does not fail it
  console.log('(for scale: ' + base.toFixed(2) + ' ms at NORMAL / 100% in the same spot)');
  check('a fight at INSANE / 300% (' + n300 + ' quacks in the level, ' + bn + ' in 30 columns) costs under 3 ms a frame', ms < 3, ms.toFixed(2) + ' ms');
  S.setDifficulty(1, false); S.setDensity(3, false);
}
console.log(fails ? fails + ' check(s) failed' : 'all difficulty and density checks passed');
process.exit(fails ? 1 : 0);
