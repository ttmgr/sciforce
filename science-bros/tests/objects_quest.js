// Headless checks for objects and items (ladders, springs, mines, alarms, fuel tanks, item crates and
// powerups, intel, objective targets), objective-gated extraction, and the campaign screens.
// Usage: node science-bros/tests/objects_quest.js science-bros/index.html
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
// these checks are about enemy behaviour, so skip the 10 s quiet start of each mission
{ const sl = S.startLevel, rs = S.reset; S.startLevel = (n) => { sl(n); S.endCeasefire(); }; S.reset = () => { rs(); S.endCeasefire(); }; }
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (i % 10 === 0) S.render(i / 60); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const solid = (c, r) => { const v = S.tileAt(c, r); return v !== 0 && v !== 5 && v !== 7; };
const lone = (lvl = 0) => { S.startLevel(lvl); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1); S.P.inv = 1e9; };
const spawn = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), extra); S.ents.push(e); return e; };
const drew = () => { try { S.render(0); return true; } catch (err) { console.log(err); return false; } };

// campaign flow: title -> world map -> briefing -> play
check('starts on the title', S.state === 'title' && drew());
S.pressed.start = true; run(1); check('enter opens the world map', S.state === 'map' && drew());
S.pressed.start = true; run(1); check('enter opens the briefing', S.state === 'brief' && drew());
S.pressed.start = true; run(1); check('enter deploys into level 1', S.state === 'play' && S.level === 0);
check('level 1 lists its objectives', S.objectives.length === 4 && S.objectives.filter((o) => o.req).length === 2);

// ladder: up climbs it
lone(); S.P.x = 105 * T + 3; S.P.y = 16 * T - 15.01; run(2); // the ladder between the Remedy Lab's floors
const y0 = S.P.y; run(40, { jump: true });
check('ladder: holding up climbs', S.P.y < y0 - 30, ((y0 - S.P.y) / T).toFixed(1) + ' tiles');

// spring
lone(); spawn('spring', 10); run(2); S.P.x = 10 * T + 1; S.P.y = 13 * T; S.P.vy = 100; let minVy = 0;
for (let i = 0; i < 30; i++) { run(1); minVy = Math.min(minVy, S.P.vy); }
check('spring launches you', minVy < -450, 'vy ' + minVy.toFixed(0));

// mine
lone(); S.P.x = 30 * T; S.P.y = 15 * T - 15.01; const mine = spawn('mine', 12); /* you stand behind the quack, out of its view */ const g = spawn('grunt', 15, { face: -1, walking: true, walkT: 9 });
for (let i = 0; i < 300 && !mine.dead; i++) { g.face = -1; g.walking = true; run(1); }
check('a quack sets off a mine', mine.dead); check('the mine kills it', g.dead);

// alarm
lone(); S.P.x = 4 * T; S.P.y = 16 * T - 15.01; S.P.inv = 1e9; spawn('alarm', 9); const lookout = spawn('grunt', 12, { face: -1 });
run(150);
check('an alarm calls in paratroopers once a quack spots you', S.ents.some((e) => e.type === 'para'));
lone(); S.P.x = 4 * T; const al2 = spawn('alarm', 9); S.hitEnemy(al2, 9, 0); spawn('grunt', 12, { face: -1 }); run(150);
check('a destroyed alarm stays quiet', !S.ents.some((e) => e.type === 'para'));

// fuel tank
lone(); S.P.x = 2 * T; const ft = spawn('fueltank', 12); run(2); S.hitEnemy(ft, 9, 0); run(2);
let holes = 0; for (let c = 9; c <= 15; c++) for (let r = 16; r <= 17; r++) if (!solid(c, r)) holes++;
check('fuel tank makes a big crater', holes >= 6, holes + ' tiles gone');

// item crate and powerups
lone(); S.P.x = 4 * T; S.P.y = 16 * T - 15.01; const ic = spawn('itemcrate', 6, { item: 'shield' }); run(2); S.hitEnemy(ic, 9, 0); run(40);
const pk = S.ents.find((e) => e.type === 'pickup' && !e.dead); if (pk) { S.P.x = pk.x; S.P.y = pk.y - 4; } run(5);
check('item crate drops a shield and you pick it up', S.P.shield > 0);
S.P.inv = 0; S.bullets.push({ x: S.P.x + 8, y: S.P.y + 8, vx: -165, vy: 0, owner: 'e', dmg: 1, tdmg: 0.4, life: 2, kind: 'pill' }); run(3);
check('the shield takes a killing shot', S.P.alive && !(S.P.shield > 0));
S.P.bro = S.BRO.einstein; S.P.inv = 1e9; const ov = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4, item: 'overclock' }); ov.x = S.P.x; S.ents.push(ov); run(3);
S.P.cool = 0; run(1, { fire: true }); check('overclock halves the fire delay', S.P.over > 0 && S.P.cool < 0.06, 'cool ' + S.P.cool.toFixed(3));
const jp = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4, item: 'jetpack' }); jp.x = S.P.x; S.ents.push(jp); run(3);
S.pressed.jump = true; run(1, { jump: true }); const jy = S.P.y; run(60, { jump: true });
check('jetpack keeps you climbing while jump is held', S.P.y < jy - 60, ((jy - S.P.y) / T).toFixed(1) + ' tiles');

// intel and targets feed the objectives; the chopper waits for the required ones
lone(); S.P.x = 4 * T; S.P.y = 16 * T - 15.01;
const intel = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4, item: 'intel' }); intel.x = S.P.x; S.ents.push(intel); run(3);
check('intel counts toward the objective and joins the dossier', S.objectives.find((o) => o.id === 'intel').n === 1 && S.dossier.length === 1);
const vat = spawn('target', 12, { skin: 'vat' }); vat.skin = 'vat'; run(2); S.hitEnemy(vat, 99, 0); run(2);
check('smashing a vat ticks the vat objective', S.objectives.find((o) => o.id === 'vat').n === 1);
S.reset(); run(1); S.ents.forEach((e) => { if (e.type !== 'boss' && e.type !== 'flag') e.dead = true; }); run(1);
S.P.inv = 1e9; S.P.x = S.arenaCol(184) * T; S.P.y = 15 * T - 16; run(5);
S.hitEnemy(S.boss, 999, 0); for (let i = 0; i < 400 && !S.boss.dead; i++) run(1);
check('boss dead but vats left: no chopper yet', S.boss.dead && !S.chopper);
S.finishObjectives(); S.objectives.find((o) => o.id === 'vat').n = 2; // two of three
const lastVat = spawn('target', S.arenaCol(190), { skin: 'vat' }); lastVat.skin = 'vat'; run(2); S.hitEnemy(lastVat, 99, 0); run(2);
check('the last required objective calls the chopper', !!S.chopper);

// debrief and level 4 map node draw
for (let i = 0; i < 60 * 25 && S.state === 'play'; i++) { S.P.inv = 1e9; run(1, { right: true, jump: (i % 30) < 15 }); if (i % 30 === 0) S.pressed.jump = true; }
check('extraction leads to the debrief', S.state === 'win' && drew());
S.pressed.start = true; run(1); check('then the world map for level 2', S.state === 'map' && S.level === 1 && drew());

console.log(fails ? fails + ' check(s) failed' : 'all object and quest checks passed');
process.exit(fails ? 1 : 0);
