// Headless checks for the new quacks (preacher, mortar crew, camera drone), the title menu modes
// (Lab Siege, Boss Rush, Moon Base) and the trophies.
// Usage: node science-bros/tests/modes_content.js science-bros/index.html
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
// a flat empty yard (columns 18-89) on mission 1 with the player at column 30
const arena = () => { S.startLevel(0); S.endCeasefire(); run(1); for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1); S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.inv = 1e9; };
const add = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), extra); S.ents.push(e); return e; };

// ---- preacher
arena();
const pr = add('preacher', 40, { face: -1 }), g1 = add('grunt', 37, { face: -1 }), g2 = add('grunt', 60, { face: -1 });
let preached = false; for (let i = 0; i < 60 * 8 && !preached; i++) { run(1); preached = g1.fervor > 0; }
check('the preacher powers up a quack next to him', preached);
check('a quack far away gets nothing', !(g2.fervor > 0));
let hp = g1.hp; g1.fervor = 5; S.hitEnemy(g1, 1, 0); const lost = hp - g1.hp;
check('a preached quack takes less damage', Math.abs(lost - 0.6) < 1e-6, lost.toFixed(2));
check('the preacher draws without errors', (() => { try { S.render(1); return true; } catch (e) { console.log(e); return false; } })());
S.killEnemy(pr); for (let i = 0; i < 60 * 8; i++) run(1);
check('kill the preacher and the power-up wears off', !(g1.fervor > 0));

// ---- mortar crew
arena();
const mo = add('mortar', 44, { face: -1 });
let marked = false, shell = false, boom = false; const hp0 = S.P.hp;
S.P.inv = 0;
for (let i = 0; i < 60 * 6; i++) { run(1); if (S.fx.some((f) => f.kind === 'marker')) marked = true; if (S.bullets.some((b) => b.kind === 'bomb' && b.owner === 'e')) shell = true; if (shell && !S.bullets.some((b) => b.kind === 'bomb')) boom = true; S.P.inv = Math.max(S.P.inv, 0); }
check('the mortar crew marks your spot', marked);
check('then lobs a shell', shell);
check('the shell comes down and goes off', boom);
check('standing still on the mark hurts', !S.P.alive || S.P.hp < hp0 || S.lives < 3, 'alive ' + S.P.alive);
arena(); const mo2 = add('mortar', 33, { face: -1 }); const x0 = mo2.x; for (let i = 0; i < 90; i++) run(1);
check('up close the mortar crew backs away instead of firing', mo2.x > x0 + 4 && !S.bullets.some((b) => b.kind === 'bomb'), (mo2.x - x0).toFixed(1) + ' px');

// ---- camera drone
arena();
for (let i = 0; i < 90; i++) { S.P.inv = 1e9; S.P.x = 30 * T; run(1); } // let the camera catch up: nothing attacks from off the screen
const d1 = add('camdrone', 44, { face: -1 });
check('the drone hovers above the ground', d1.y < 15 * T - 40, (d1.y / T).toFixed(1));
const y0 = d1.y; for (let i = 0; i < 30; i++) run(1);
check('it does not fall', Math.abs(d1.y - y0) < 8);
let dove = false; for (let i = 0; i < 60 * 6 && !d1.dead; i++) { S.P.inv = 1e9; run(1); if (d1.dive) dove = true; }
check('it spots you and dives', dove);
check('it blows up on contact', d1.dead);
arena(); S.P.x = 30 * T; const d2 = add('camdrone', 70); const gq = add('grunt', 71); for (let i = 0; i < 10; i++) run(1);
d2.y = gq.y - 14; const dr0 = S.career.drones; S.hitEnemy(d2, 5, 0); run(3);
check('shooting it down blows it up, and the blast hits quacks under it', d2.dead && (gq.dead || gq.hp < 2), 'grunt hp ' + gq.hp);
check('drone kills count for the CAMERA SHY trophy', S.career.drones === dr0 + 1);
// a drone during the ceasefire leaves you alone
arena(); S.startLevel(0); run(1); for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.P.x = 30 * T; S.P.y = 15 * T - 15.01;
const d3 = add('camdrone', 36); for (let i = 0; i < 120; i++) run(1);
check('during the ceasefire the drone does not dive', !d3.dive && !d3.dead);

// ---- new quacks show up in the new missions
let counts = { preacher: 0, mortar: 0, camdrone: 0 };
for (let l = 0; l < S.nLevels; l++) { S.startLevel(l); for (const e of S.ents) if (e.type in counts) counts[e.type]++; }
check('the new quacks appear in the campaign', counts.preacher >= 5 && counts.mortar >= 5 && counts.camdrone >= 5, JSON.stringify(counts));

// ---- title menu
S.reset(); S.pressed.pause = true; run(1); for (let k = 0; k < 9; k++) { S.pressed.down = true; run(1); } S.pressed.fire = true; run(1);
check('back on the title', S.state === 'title');
S.pressed.down = true; run(1); S.pressed.start = true; run(1);
check('the second menu entry starts Lab Siege', S.state === 'play' && S.mode === 'siege', S.mode);
check('Lab Siege gives you every bro', S.unlocked.length === S.BROS.length);

// ---- Lab Siege
for (let i = 0; i < 60 * 10; i++) { S.P.inv = 1e9; run(1); }
check('wave 1 starts after the ceasefire and a short break', S.siege.wave === 1, 'wave ' + S.siege.wave);
const clearWave = () => { for (let k = 0; k < 60 * 30; k++) { S.P.inv = 1e9; S.ents.forEach((e) => { if (!e.dead && e.type !== 'flag' && e.x < 62 * T && e.type !== 'barrel' && e.type !== 'propane' && e.type !== 'itemcrate' && e.type !== 'guncrate') { if (e.vats) e.vats.forEach((v) => (v.dead = true)); S.hitEnemy(e, 50, 0); } }); run(1); if (!S.siege.queue.length && S.siege.breakT > 0) return true; } return false; };
check('clearing wave 1 starts a break', clearWave(), 'queue ' + S.siege.queue.length);
for (let w = 2; w <= 5; w++) { for (let i = 0; i < 60 * 9 && S.siege.wave < w; i++) { S.P.inv = 1e9; run(1); } if (w < 5) clearWave(); }
check('wave 5 is a boss wave', S.siege.wave === 5 && (S.siege.queue.some((t) => ['tank', 'boss', 'kopter'].includes(t)) || S.ents.some((e) => ['tank', 'boss', 'kopter'].includes(e.type) && !e.dead)), 'wave ' + S.siege.wave);
check('reaching wave 5 unlocks HOLD THE LINE', !!S.trophies.siege5);
S.P.inv = 0; S.P.hp = 1; let over = false;
for (let i = 0; i < 60 * 60 && !over; i++) { S.P.inv = 0; if (S.P.alive) S.hitEnemy && (S.P.hp = 0.01); run(1); over = S.state === 'over'; S.ents.forEach((e) => { if (e.type === 'pickup') e.dead = true; }); }
check('running out of bros ends the siege', over, S.state + ' lives ' + S.lives);

// ---- Boss Rush
S.startMode('rush');
check('Boss Rush starts with the first boss', S.state === 'play' && S.mode === 'rush' && S.rush.i === 0);
check('Boss Rush has 16 bosses including the new ones', S.RUSH.length === 16, S.RUSH.length);
let names = [];
for (let i = 0; i < S.RUSH.length; i++) {
  const B = S.ents.find((e) => e.type === S.RUSH[i][2] && !e.dead);
  if (!B) { check('rush boss ' + (i + 1) + ' is there', false, S.RUSH[i][2]); break; }
  names.push(B.bossName || B.type);
  S.P.inv = 1e9; S.P.x = (B.trig + 2) * T; run(60);
  if (B.vats) B.vats.forEach((v) => (v.dead = true));
  for (let k = 0; k < 400 && !B.dead; k++) { S.P.inv = 1e9; if (!B.doomed) S.hitEnemy(B, 20, 0); run(2); }
  for (let k = 0; k < 60 * 4 && S.rush.i === i && S.state === 'play'; k++) { S.P.inv = 1e9; run(1); }
}
check('beating every boss finishes the rush', S.state === 'modedone', S.state + ' at ' + S.rush.i);
check('the rush includes the new bosses', ['CHEMTRAIL COPTER', 'QUARTZ QUEEN', 'MIASMA MACHINE', 'ZODIAC MECH', 'THE PITCHMAN', 'UFO HOAX BALLOON', 'SAND SCARAB', 'STEAM TANK', 'ASTRAL KOPTER'].every((n) => names.includes(n)), names.join(','));
check('clearing the rush unlocks BOSS RUSHER', !!S.trophies.rush);
check('the finish screen draws', (() => { try { S.render(1); return true; } catch (e) { console.log(e); return false; } })());

// ---- Moon Base
S.startMode('moon');
check('Moon Base starts', S.state === 'play' && S.mode === 'moon' && S.level === S.MOON);
check('the Moon has low gravity', S.G < 500, S.G);
S.endCeasefire(); S.P.inv = 1e9; S.P.vy = 0; S.pressed.jump = true; let topY = S.P.y, y0m = S.P.y;
for (let i = 0; i < 120; i++) { S.P.inv = 1e9; run(1, { jump: i < 20 }); topY = Math.min(topY, S.P.y); }
check('jumps go higher on the Moon', y0m - topY > 3.5 * T, ((y0m - topY) / T).toFixed(1) + ' tiles');
const dir = S.ents.find((e) => e.type === 'director');
check('the Director waits at the end', !!dir && dir.final);
S.ents.forEach((e) => { if (e.type !== 'director' && e.type !== 'flag') e.dead = true; });
S.P.x = (dir.trig + 2) * T; S.P.y = 2 * T; run(120);
check('the Director wakes up', dir.active);
let shielded = dir.hp; S.hitEnemy(dir, 10, 0); check('its studio lights shield it', dir.hp === shielded);
dir.vats.forEach((v) => (v.dead = true)); S.finishObjectives();
for (let k = 0; k < 400 && !dir.dead; k++) { S.P.inv = 1e9; if (!dir.doomed) S.hitEnemy(dir, 20, 0); run(2); }
check('the Director goes down and the chopper comes', dir.dead && !!S.chopper);
for (let i = 0; i < 60 * 30 && S.state === 'play'; i++) { S.P.inv = 1e9; const c = S.chopper; if (c && c.state === 'hover' && S.P.alive) { S.P.x = c.x - 5; S.P.y = c.y + 40; S.P.vy = 0; } run(1, { up: true }); }
check('leaving on the chopper finishes the Moon', S.state === 'modedone', S.state);
check('it unlocks MOONWALKER', !!S.trophies.moon);
check('G goes back to normal on a normal mission', (S.startMode('campaign'), S.startLevel(0), S.G === 900), S.G);

// ---- trophies
check('19 trophies exist', S.ACH.length === 19, S.ACH.length);
check('trophy ids are unique', new Set(S.ACH.map((a) => a[0])).size === S.ACH.length);
S.reset(); S.pressed.pause = true; run(1); for (let k = 0; k < 9; k++) { S.pressed.down = true; run(1); } S.pressed.fire = true; run(1);
S.titleSel = 4; S.pressed.start = true; run(1);
check('the last menu entry opens the trophy screen', S.state === 'trophies', S.state);
check('the trophy screen draws', (() => { try { S.render(1); return true; } catch (e) { console.log(e); return false; } })());
S.pressed.start = true; run(1); check('enter goes back to the title', S.state === 'title');

console.log(fails ? fails + ' check(s) failed' : 'all mode and content checks passed');
process.exit(fails ? 1 : 0);
