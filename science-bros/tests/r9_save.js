// Headless checks for the round 9 saved run: the autosave at mission start and at a checkpoint, what the save holds, CONTINUE after a
// reload (same storage, a fresh copy of the game) with quacks, cages, blocks, objectives, score, lives and bros as they were, the title
// menu row, SAVE AND QUIT in the pause menu, the map save after a win, what clears the save, saves the game cannot read, and that
// missions build the same way twice (the save depends on it). Saving draws no random numbers.
// Usage: node science-bros/tests/r9_save.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
let draws = 0;
const boot = (store) => { // one copy of the game on the given storage
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const M = Object.create(Math); M.random = () => { draws++; return Math.random(); };
  const win = { __SB_TEST__: true };
  const sb = { window: win, document: doc, localStorage, navigator: { getGamepads: () => [] }, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
  vm.createContext(sb); vm.runInContext(src, sb); return win.__SB__;
};
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const RUN = 'sciencebros.run';
const run = (S, n, held = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, held); S.P.inv = 1e9; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } };
const press = (S, k) => { S.keys[k] = true; S.pressed[k] = true; S.step(1 / 60); S.keys[k] = false; for (const q in S.pressed) S.pressed[q] = false; };
const begin = (S, lv = 0) => { S.setMode('campaign'); S.startLevel(lv); S.endCeasefire(); S.P.bro = S.BRO.einstein; S.saveRun(); };

// 1. nothing saved at first
const store = {};
let S = boot(store); const T = S.T;
check('a fresh game has no saved run and seven title rows', S.runSaved() === null && S.titleItems().length === 7 && !S.titleItems().some((m) => m[1] === 'continue'));

// 2. a mission, some play, a checkpoint
begin(S);
check('starting a mission writes the save', !!store[RUN] && JSON.parse(store[RUN]).name === 'PLACEBO ISLAND' && JSON.parse(store[RUN]).map === false);
S.setRun({ lives: 2, runScore: 4200, unlocked: ['reska', 'einstein', 'curie'] });
const quacks = S.ents.filter((e) => S.isQuack(e) && !e.dead).slice(0, 4), cage = S.ents.find((e) => e.type === 'cage'), flag = S.ents.filter((e) => e.type === 'flag').sort((a, b) => a.x - b.x)[1];
for (const q of quacks) { S.setBlame('p'); S.killEnemy(q); S.setBlame('e'); }
const hurt = S.ents.find((e) => e.type === 'heavy' && !e.dead) || S.ents.find((e) => e.type === 'target'); hurt.hp -= 3;
const tc = Math.floor(flag.x / T) - 6, tr = S.surf(tc, 0); S.damageTile(tc, tr, 99); S.damageTile(tc + 1, tr, 99);
const killsBefore = S.stats.kills; S.stats.time = 77.7; S.objHit('intel', 2);
S.P.x = flag.x - 30; S.P.y = flag.y + flag.h - 16; S.P.vx = 0; S.P.vy = 0; const d0 = draws;
for (let i = 0; i < 120 && !flag.on; i++) run(S, 1, { right: true });
const sv = JSON.parse(store[RUN]);
check('walking past a flag saves the run there', flag.on && Math.abs(sv.cp[0] - (flag.x - 2)) <= 1 && sv.flags.includes(flag.sid), 'cp ' + sv.cp);
check('the save holds the dead quacks, the damage, the broken blocks, the objective and the run', quacks.every((q) => sv.dead.includes(q.sid)) && sv.hp.some((h) => h[0] === hurt.sid) && sv.cut.length >= 4 && sv.obj[S.objectives.findIndex((o) => o.id === 'intel')] === 2 && sv.lives === 2 && sv.score === 4200 && sv.unlocked.join() === 'reska,einstein,curie' && sv.stats.kills === killsBefore && sv.bro === 'einstein');
check('the title offers CONTINUE first while a run is saved', S.titleItems().length === 8 && S.titleItems()[0][1] === 'continue' && S.TITLE_MENU.length === 7);
{ const before = draws; S.saveRun(); S.snapRun(false); check('saving draws no random numbers', draws === before); }

// 3. the page is closed and opened again: a fresh copy of the game on the same storage
const sidOf = { quacks: quacks.map((q) => q.sid), hurt: hurt.sid, hp: hurt.hp, cage: cage.sid }, nEnts = S.ents.filter((e) => e.sid !== undefined && !e.dead).length;
S = boot(store);
check('after a reload the save is read and CONTINUE leads the title', S.runSaved() && S.runSaved().name === 'PLACEBO ISLAND' && S.titleItems()[0][1] === 'continue' && S.state === 'title' && S.titleAt() === 0);
press(S, 'start');
const R = S.run();
check('CONTINUE goes straight into the mission', R.state === 'play' && R.mode === 'campaign' && R.level === 0 && !R.paused, R.state + ' ' + R.level);
check('the bro stands at the checkpoint, as the bro he was', Math.abs(S.P.x - sv.cp[0]) < 2 && Math.abs(S.P.y - sv.cp[1]) < 2 && S.P.bro.id === 'einstein' && S.P.alive, S.P.x.toFixed(0) + ',' + S.P.y.toFixed(0));
check('lives, score and bros are back', R.lives === 2 && R.runScore === 4200 && R.unlocked.join() === 'reska,einstein,curie');
check('dead quacks stay dead, the hurt one keeps its damage, the rest are back', sidOf.quacks.every((id) => !S.ents.some((e) => e.sid === id)) && Math.abs(S.ents.find((e) => e.sid === sidOf.hurt).hp - sidOf.hp) < 0.02 && S.ents.filter((e) => e.sid !== undefined && !e.dead).length === nEnts, S.ents.filter((e) => e.sid !== undefined && !e.dead).length + ' vs ' + nEnts);
check('broken blocks stay broken', S.tileAt(tc, tr) === 0 && S.tileAt(tc + 1, tr) === 0);
check('objectives and mission stats are back', S.objectives.find((o) => o.id === 'intel').n === 2 && S.stats.kills === sv.stats.kills && sv.stats.kills === killsBefore && Math.abs(S.stats.time - sv.stats.time) < 0.11 && sv.stats.time >= 77.7, 'time ' + S.stats.time.toFixed(1));
check('flags behind the bro are raised', S.ents.filter((e) => e.type === 'flag' && e.on).length === sv.flags.length && sv.flags.length >= 1);
{ let ok = true; const t0 = S.stats.time; for (let i = 0; i < 240; i++) { run(S, 1, { left: i > 30 }); if (!S.P.alive) ok = false; } check('and the game runs on from there', ok && S.state === 'play' && S.P.x < sv.cp[0] - 40 && S.stats.time > t0 + 3.5, 'x ' + S.P.x.toFixed(0) + ', time +' + (S.stats.time - t0).toFixed(1)); }

// 4. SAVE AND QUIT in the pause menu
{ const k0 = S.stats.kills, q = S.ents.find((e) => S.isQuack(e) && !e.dead); S.setBlame('p'); S.killEnemy(q); S.setBlame('e'); run(S, 2);
  S.setPaused(true); S.setMenuSel(S.pauseItems().findIndex((m) => m[0] === 'QUIT TO TITLE')); S.pressed.fire = true; S.pauseMenu(); S.pressed.fire = false;
  const s2 = JSON.parse(store[RUN]);
  check('SAVE AND QUIT saves the kills since the checkpoint and returns to the title, on CONTINUE', S.state === 'title' && s2.dead.includes(q.sid) && s2.stats.kills === k0 + 1 && S.titleItems()[S.titleAt()][1] === 'continue', S.state + ' kills ' + s2.stats.kills); }

// 5. after a win the run is saved on the world map
{ begin(S, 0); S.setRun({ lives: 4, runScore: 999 }); S.saveRun(true); const m = JSON.parse(store[RUN]);
  check('a map save holds the run and no mission state', m.map === true && m.lives === 4 && m.dead === undefined);
  const S2 = boot(store); press(S2, 'start'); const r = S2.run();
  check('CONTINUE from a map save opens the world map with the run', r.state === 'map' && r.lives === 4 && r.runScore === 999, r.state); }

// 6. what clears it, and what is not saved
{ begin(S, 0); S.clearRun(); check('clearRun empties the save', !store[RUN] && S.runSaved() === null && S.titleItems().length === 7);
  begin(S, 0); S.resetProgress(); check('RESET PROGRESS clears it', !store[RUN] && S.runSaved() === null);
  begin(S, 0); S.setRun({ lives: 0 }); S.P.inv = 0; S.killPlayer('shot'); for (let i = 0; i < 600 && S.state === 'play'; i++) { for (const k in S.keys) S.keys[k] = false; S.step(1 / 60); }
  check('a game over clears it', S.state === 'over' && !store[RUN], S.state);
  S.setState('title'); S.clearRun(); S.startMode('moon'); S.saveRun(); check('bonus modes save nothing', !store[RUN]);
  S.startRandom(4242, true); S.saveRun(); check('random missions save nothing', !store[RUN]); }

// 7. saves the game cannot use
for (const [name, raw] of [['broken JSON', '{"v":1,"name"'], ['another version', JSON.stringify({ v: 99, name: 'PLACEBO ISLAND', unlocked: [], map: true })], ['an unknown mission', JSON.stringify({ v: 1, name: 'NO SUCH PLACE', unlocked: [], map: true })], ['missing fields', JSON.stringify({ v: 1, name: 'PLACEBO ISLAND', unlocked: ['reska'], map: false })]]) {
  const st = { [RUN]: raw }; const S3 = boot(st); check(name + ' is ignored', S3.runSaved() === null && S3.titleItems().length === 7); }
{ begin(S, 0); S.setRun({ lives: 2, runScore: 300 }); S.saveRun(); const o = JSON.parse(store[RUN]); o.sig = 'other'; o.cp = [900, 100]; const st = { [RUN]: JSON.stringify(o) }; const S4 = boot(st); press(S4, 'start'); const r = S4.run();
  check('a save from another layout starts the mission from its beginning with the run kept', r.state === 'play' && r.lives === 2 && r.runScore === 300 && S4.P.x < 6 * T, 'x ' + S4.P.x.toFixed(0)); }

// 8. the same mission builds the same way twice, in every mission (entity numbers in the save rely on it)
{ const bad = []; for (let l = 0; l < S.nLevels; l++) { S.setMode('campaign'); S.startLevel(l); const a = S.freshSig(), n = S.ents.length; S.startLevel(l); if (S.freshSig() !== a || S.ents.length !== n) bad.push(l + 1); }
  check('all ' + S.nLevels + ' missions give the same entity fingerprint on a second build', bad.length === 0, bad.join(',')); }

console.log(fails ? fails + ' check(s) failed' : 'all saved run checks passed');
process.exit(fails ? 1 : 0);
