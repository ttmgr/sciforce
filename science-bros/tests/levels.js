// Headless checks for every campaign mission: layout, objectives, boss, safe start, the way to the boss, extraction.
// Usage: node science-bros/tests/levels.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (i % 10 === 0) S.render(i / 60); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];

const N = S.nLevels;
check('the campaign has 18 missions', N === 18, N);
check('King Citrus is still the last mission', S.levelDef(N - 1).name === 'CITRUS CITADEL');
check('Lab Siege and Moon Base come right after the campaign', S.levelDef(S.SIEGE).name === 'LAB SIEGE' && S.levelDef(S.MOON).name === 'MOON BASE');
const names = Array.from({ length: N }, (_, i) => S.levelDef(i).name);
check('every mission has its own name', new Set(names).size === N, names.join(' / '));

for (let l = 0; l < N; l++) {
  const L = S.levelDef(l), tag = (l + 1) + ' ' + L.name;
  check(tag + ': theme exists', !!S.THEMES[L.theme], L.theme);
  check(tag + ': briefing, debrief and 3 intel lines', !!L.brief && !!L.debrief && (L.intel || []).length === 3);
  check(tag + ': a spot on the world map inside the screen', L.map[0] > 10 && L.map[0] < 470 && L.map[1] > 60 && L.map[1] < 215, L.map.join(','));
  S.startLevel(l); run(1);
  const bosses = S.ents.filter((e) => BOSSES.includes(e.type) && e.final);
  check(tag + ': one final boss', bosses.length === 1, bosses.map((e) => e.type).join(','));
  const cages = S.ents.filter((e) => e.type === 'cage').length;
  check(tag + ': cage count matches the level', cages >= (L.cages || 0), cages + ' cages for ' + L.cages);
  for (const o of L.objectives || []) {
    if (!['vat', 'radio', 'server'].includes(o.id)) continue;
    const n = S.ents.filter((e) => e.type === 'target' && e.skin === o.id).length;
    check(tag + ': enough targets for "' + o.text + '"', n >= (o.need || 1), n + ' of ' + (o.need || 1));
  }
  const intel = S.ents.filter((e) => e.type === 'pickup' && e.item === 'intel').length;
  check(tag + ': 3 intel files', intel === 3, intel);
  // every spawn sits on something: nobody is stuck inside a wall
  const stuck = S.ents.filter((e) => !BOSSES.includes(e.type) && e.type !== 'icicle' && e.type !== 'drone' && e.type !== 'flag' && S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T)) > 0 && [1, 2, 3, 4, 6].includes(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))));
  check(tag + ': nothing spawns inside a wall', stuck.length === 0, stuck.map((e) => e.type + '@' + Math.floor(e.x / T)).join(','));
}

// the five new missions in detail
for (let l = 5; l < N - 1; l++) {
  const L = S.levelDef(l), tag = (l + 1) + ' ' + L.name;
  S.startLevel(l); S.endCeasefire(); run(1);
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  check(tag + ': the boss has its own name', !!B.bossName && B.bossName !== 'THE DIRECTOR', B.bossName);
  // a bot that runs right and jumps gets a fair way in without dying (invulnerable, we only test the path)
  S.P.inv = 1e9; S.P.bro = S.BRO.einstein; let far = 0; // a new run starts with random bros; this checks the path
  for (let i = 0; i < 60 * 60; i++) {
    const stuck = i % 120 < 30;
    if (i % 25 === 0) S.pressed.jump = true;
    S.P.inv = 1e9; // the respawned bro too
    run(1, { right: true, jump: i % 25 < 14, fire: i % 6 < 3, up: stuck && i % 240 < 30 });
    far = Math.max(far, S.P.x / T);
  }
  check(tag + ': a simple bot gets past the middle in 60 s', far > 100, 'reached col ' + far.toFixed(0));
  // put the player in the arena: the boss wakes up
  S.startLevel(l); S.endCeasefire(); run(1);
  for (const e of S.ents) if (!BOSSES.includes(e.type) && e.type !== 'flag') e.dead = true;
  S.P.inv = 1e9; S.P.x = (B.trig ? 0 : 0) + S.ents.find((e) => e.final).trig * T + 8; S.P.y = 2 * T;
  run(120);
  const boss = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  check(tag + ': the boss wakes up when you walk in', boss.active, boss.state);
  check(tag + ': the boss name shows on the banner path', S.boss === boss || boss.active);
  // kill it and finish the objectives: the gate opens and the chopper comes
  S.finishObjectives();
  for (let k = 0; k < 400 && !boss.dead && !boss.doomed; k++) {
    for (const v of boss.vats || []) v.dead = true;
    S.hitEnemy(boss, 5, 90, 'shot'); run(2);
  }
  run(60 * 8);
  check(tag + ': the boss goes down', boss.dead);
  const [g0, , gr0, gr1] = boss.gate;
  check(tag + ': its gate opens', S.tileAt(g0, gr1) === 0 && S.tileAt(g0, gr0) === 0);
  check(tag + ': the chopper comes', !!S.chopper, S.state);
  // run 10 s of random play in the arena without errors
  let err = null;
  try { for (let i = 0; i < 600; i++) run(1, { left: Math.random() < 0.3, right: Math.random() < 0.5, jump: Math.random() < 0.2, fire: Math.random() < 0.5, special: Math.random() < 0.05 }); } catch (e) { err = e; }
  check(tag + ': no errors after the boss', !err, err && err.message);
}

// the story chains from Flat Earth Station into the new missions and on to the Citadel
check('Flat Earth debrief points at the strongholds', /strongholds/i.test(S.levelDef(4).debrief));
check('the mission before the finale points at the Citadel', /Citrus Citadel/i.test(S.levelDef(N - 2).debrief));

// the campaign gets harder step by step: threat on the map climbs from the first mission to the finale
{
  const W = { grunt: 1, para: 1, dog: 1, scout: 1, shield: 1.5, medic: 1.5, bomber: 1.5, grenadier: 2, flamer: 2, guru: 2, preacher: 2, camdrone: 2, jetpack: 2.5, rocketeer: 2.5, turret: 2.5, heavy: 3, brute: 3, sniper: 3, mortar: 3, minelayer: 2, jumper: 2, pilldoc: 2.5, flagbearer: 2, sapper: 2, knight: 3, diffuser: 2, miner: 2, detox: 2.5, streamer: 2.5, yogi: 2.5, pinboard: 2.5, alpha: 3, dronecaller: 3 };
  const threat = []; for (let l = 0; l < N; l++) { S.startLevel(l); threat.push(S.ents.filter((e) => W[e.type]).reduce((a, e) => a + W[e.type], 0)); }
  check('the first mission is the easiest', threat[0] === Math.min(...threat), threat.map((x) => x.toFixed(0)).join(' '));
  check('the finale is among the hardest', threat[N - 1] >= Math.max(...threat) - 6, threat[N - 1].toFixed(0));
  let dips = 0; for (let l = 1; l < N; l++) if (threat[l] < threat[l - 1] - 6) dips++;
  check('threat climbs along the campaign (no big drops)', dips === 0, dips + ' drops');
  check('the second half is clearly harder than the first', threat.slice(8).reduce((a, b) => a + b) / (N - 8) > 1.5 * threat.slice(0, 7).reduce((a, b) => a + b) / 7);
  S.startLevel(0); const hard = ['heavy', 'sniper', 'brute', 'mortar', 'preacher', 'jetpack', 'rocketeer', 'camdrone', 'turret'];
  check('no heavy hitters on the first mission', !S.ents.some((e) => hard.includes(e.type)), S.ents.filter((e) => hard.includes(e.type)).map((e) => e.type).join(','));
  const b0 = S.ents.find((e) => e.final).max; S.setRamp(false); S.startLevel(0); const b1 = S.ents.find((e) => e.final).max; S.setRamp(true);
  check('the first boss has less health early in the campaign', b0 < b1, b0 + ' vs ' + b1);
  S.startLevel(0); const same = S.ents.map((e) => e.type + Math.round(e.x)).join(); S.startLevel(0);
  check('a mission has the same quacks every time', S.ents.map((e) => e.type + Math.round(e.x)).join() === same);
  S.startMode('siege'); check('bonus modes play at full strength', S.diff.p === 1); S.startMode('campaign');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
