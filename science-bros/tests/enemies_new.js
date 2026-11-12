// Headless checks for the slower bomber and the six newer quacks (minelayer, jumper, pilldoc, flagbearer, sapper, knight):
// their special behaviour, fair range, forgetting you after a death, and the quiet start.
// Usage: node science-bros/tests/enemies_new.js science-bros/index.html
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
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
// a flat empty yard: floor at row 16, the player (Einstein) stands at column 30 facing right, nobody else about
const flat = (bro = 'einstein') => {
  S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0;
  S.P.bro = S.BRO[bro]; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.face = 1; S.P.inv = 1e9; S.P.spec = 0; S.P.alt = null; step();
};
const add = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), { face: -1 }, extra); S.ents.push(e); return e; };
const NEW = S.NEW_FOES;
check('six new quack types are exported', NEW.length === 6 && new Set(NEW).size === 6, NEW.join(','));
check('each has a threat value and a first-appearance point in the campaign', NEW.every((t) => S.THREAT[t] > 0 && S.RAMP_FROM[t] > 0), NEW.map((t) => t + ' ' + S.RAMP_FROM[t]).join(' '));
check('they appear spread over the campaign (at least 5 different start points)', new Set(NEW.map((t) => S.RAMP_FROM[t])).size >= 5);
// where they show up in the missions
{
  const seen = {}; for (let l = 0; l < S.nLevels; l++) { S.setRamp(false); S.startLevel(l); for (const e of S.ents) if (NEW.includes(e.type)) (seen[e.type] = seen[e.type] || new Set()).add(l); } S.setRamp(true);
  check('every new type is placed in at least 2 missions', NEW.every((t) => seen[t] && seen[t].size >= 2), NEW.map((t) => t + ':' + (seen[t] ? seen[t].size : 0)).join(' '));
}

// ---- bomber: slower, with a beeping wind-up, still deadly
{
  flat(); S.P.inv = 1e9; const b = add('bomber', 40); const x0 = b.x; let beep = 0, first = -1, vmax = 0, last = b.x;
  for (let i = 0; i < 240 && !b.dead; i++) { run(1); if (b.beep > 0) beep++; if (first < 0 && b.x !== x0) first = i; vmax = Math.max(vmax, Math.abs(b.x - last) * 60); last = b.x; }
  check('the bomber speed is well under the old 125 px/s', S.BOMBER.speed <= 100 && S.BOMBER.speed >= 70, S.BOMBER.speed + ' px/s');
  check('it really runs at that speed (not faster)', vmax > 70 && vmax <= 105, vmax.toFixed(0) + ' px/s');
  check('it beeps for about half a second before it sprints', beep >= 25 && beep <= 45 && first > 25, beep + ' frames beeping, first move at frame ' + first);
  flat(); S.P.inv = 0; S.P.shield = 0; const b2 = add('bomber', 37); b2.face = -1;
  for (let i = 0; i < 60 * 6 && S.P.alive; i++) { S.P.x = 30 * T; run(1); }
  check('a bomber 7 tiles away still gets you if you stand still', !S.P.alive);
}

// ---- each new type
const cases = {};
// flag-bearer: quacks near him get braver (red pennant, faster reload, quicker walk)
cases.flagbearer = () => {
  flat(); add('flagbearer', 38); const g = add('grunt', 40); g.react = 99; run(160);
  check('flagbearer: a grunt near him is rallied (brave) and alerted', g.brave > 0 && g.aware, 'brave ' + (g.brave || 0).toFixed(1));
  flat(); add('flagbearer', 38); const far = add('grunt', 55); run(70);
  check('flagbearer: a grunt far from him is not rallied', !(far.brave > 0));
  flat(); const g2 = add('grunt', 40, { aware: true, react: 0 }), g3 = add('grunt', 36, { aware: true, react: 0 }); g2.cool = g3.cool = 5; g2.brave = 5; run(30);
  check('flagbearer: a rallied quack reloads faster than a normal one', 5 - g2.cool > (5 - g3.cool) * 1.4, 'rallied ' + (5 - g2.cool).toFixed(2) + ', normal ' + (5 - g3.cool).toFixed(2));
};
// mine-layer: drops mines behind him as he walks at you
cases.minelayer = () => {
  flat(); const m = add('minelayer', 40); run(60 * 7);
  const mines = S.ents.filter((e) => e.type === 'mine' && e.src === m && !e.dead);
  check('minelayer: drops mines (2 or 3 at a time)', mines.length >= 2 && mines.length <= 3, mines.length + ' mines');
  check('minelayer: the mines lie behind him (the side he came from)', mines.every((x) => x.x > m.x - 1), mines.map((x) => Math.round(x.x - m.x)).join(','));
  check('minelayer: he walked toward you', m.x < 40 * T - 40);
  const mine = mines[0]; if (mine) { const q = add('grunt', 60, { aware: false }); q.x = mine.x; run(30); check('minelayer: a mine goes off for a quack that steps on it', mine.dead || q.dead); }
};
// sapper: digs through soft blocks that are in his way
cases.sapper = () => {
  flat(); for (const r of [13, 14, 15]) S.setTile(38, r, 1); const s = add('sapper', 41, { aware: true, lost: 0 });
  run(60 * 5);
  check('sapper: digs a hole through a dirt wall toward you', [13, 14, 15].some((r) => S.tileAt(38, r) === 0) && s.x < 38 * T, 'x ' + (s.x / T).toFixed(1));
  flat(); for (const r of [13, 14, 15]) S.setTile(38, r, 3); const s2 = add('sapper', 41, { aware: true, lost: 0 }); run(60 * 4);
  check('sapper: cannot dig steel', [13, 14, 15].every((r) => S.tileAt(38, r) === 3));
  flat(); S.P.inv = 0; S.P.shield = 0; add('sapper', 32); run(60 * 3);
  check('sapper: swings the pickaxe at you up close', !S.P.alive);
};
// pill doctor: lobs bouncing pill grenades
cases.pilldoc = () => {
  flat(); const d = add('pilldoc', 38); d.cool = 0; let pills = 0, bounced = false, kinds = new Set();
  for (let i = 0; i < 60 * 9; i++) { S.P.x = 30 * T; run(1); for (const b of S.bullets) if (b.kind === 'pillbomb' && b.owner === 'e') { if (!kinds.has(b)) { kinds.add(b); pills++; } if (b.bounce < 2) bounced = true; } }
  check('pilldoc: throws pill grenades', pills >= 2, pills + ' pills');
  check('pilldoc: the pills bounce on the ground', bounced);
  flat(); S.P.inv = 0; S.P.shield = 0; const d2 = add('pilldoc', 36); d2.cool = 0;
  for (let i = 0; i < 60 * 8 && S.P.alive; i++) { S.P.x = 30 * T; d2.x = 36 * T + 2; run(1); }
  check('pilldoc: a pill grenade can kill you at 6 tiles', !S.P.alive);
};
// jump-jet hopper: leaps toward you
cases.jumper = () => {
  flat(); const j = add('jumper', 40); const y0 = j.y; let top = j.y, shots = 0;
  for (let i = 0; i < 60 * 4; i++) { run(1); top = Math.min(top, j.y); shots += S.bullets.filter((b) => b.owner === 'e').length ? 1 : 0; }
  check('jumper: leaps about 3 tiles high', y0 - top > 30, (y0 - top).toFixed(0) + ' px');
  check('jumper: gets closer to you by leaping', j.x < 40 * T - 30, 'x ' + (j.x / T).toFixed(1));
  check('jumper: fires while it is in the air', shots > 0);
};
// armoured knight: shots from the front barely hurt, from behind or a blast do full damage
cases.knight = () => {
  flat(); const k = add('knight', 40); k.face = -1; const hp = k.hp;
  S.hitEnemy(k, 1, 100, 'shot'); const front = hp - k.hp;
  S.hitEnemy(k, 1, -100, 'shot'); const back = hp - front - k.hp;
  check('knight: a shot from the front does a quarter damage', Math.abs(front - 0.25) < 1e-9, front.toFixed(2));
  check('knight: a shot from behind does full damage', Math.abs(back - 1) < 1e-9, back.toFixed(2));
  const k2 = add('knight', 50); S.hitEnemy(k2, 3, 0, 'blast'); check('knight: a blast does full damage', Math.abs(k2.hp - (k2.max - 3)) < 1e-9);
  const k3 = add('knight', 51); S.hitEnemy(k3, 6, 380, 'punch'); check('knight: a punch ignores the armour', k3.dead);
  flat(); S.P.inv = 0; S.P.shield = 0; add('knight', 32); run(60 * 3);
  check('knight: swings his sword at you up close', !S.P.alive);
  flat(); const k4 = add('knight', 40); const x0 = k4.x; run(60 * 3);
  check('knight: marches slowly (under 30 px/s)', x0 - k4.x > 15 && (x0 - k4.x) / 3 < 30, ((x0 - k4.x) / 3).toFixed(0) + ' px/s');
};
for (const t of NEW) { console.log('-- ' + t); cases[t](); }

// ---- all six: fair range, melee bro swing, punch, forgetting, quiet start
const reaches = (type, d, secs = 8) => {
  flat(); S.P.inv = 0; S.P.shield = 0; const e = add(type, 30 + d);
  for (let i = 0; i < 60 * secs; i++) { S.P.inv = 0; S.P.shield = 0; if (S.P.alive) S.P.x = 30 * T; e.x = (30 + d) * T + 2; e.y = Math.min(e.y, 15 * T - e.h); step(); if (!S.P.alive) return true; }
  return false;
};
for (const t of NEW) {
  check(t + ' cannot hurt you from 13 tiles', !reaches(t, 13));
  // off-screen: far away it does nothing at all
  flat(); const far = add(t, 30 + 25); let acts = 0; for (let i = 0; i < 60 * 6; i++) { S.P.x = 30 * T; far.x = 55 * T + 2; run(1); acts += S.bullets.filter((b) => b.owner === 'e').length + S.ents.filter((e) => e.type === 'mine' && e.src === far).length; }
  check(t + ' off the screen (25 tiles) does nothing', acts === 0 && !far.aware, acts + '');
  // the melee bro's swing and the punch both kill it
  for (const bro of ['vesalius', 'anning', 'hooke']) {
    flat(bro); const e = add(t, 31); e.x = 30 * T + 14; let i = 0;
    for (; i < 60 * 8 && !e.dead; i++) { S.P.inv = 1e9; S.P.x = 30 * T; S.P.face = 1; e.react = 99; e.cool = 99; e.stun = 0; e.windup = 0; if (e.x > 30 * T + 20) e.x = 30 * T + 14; run(1, { fire: true }); }
    check(t + ' dies to a ' + bro + ' swing', e.dead, e.dead ? (i / 60).toFixed(1) + ' s' : 'hp ' + e.hp);
  }
  flat(); const pe = add(t, 31); pe.x = 30 * T + 8; let pi = 0;
  for (; pi < 60 * 6 && !pe.dead; pi++) { S.P.inv = 1e9; S.P.x = 30 * T; S.P.face = 1; pe.react = 99; pe.cool = 99; pe.windup = 0; pe.stun = 0; if (pe.x > 30 * T + 14) pe.x = 30 * T + 8; S.pressed.melee = true; for (const k in S.keys) S.keys[k] = false; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; }
  check(t + ' dies to punches', pe.dead, pe.dead ? '' : 'hp ' + pe.hp);
  // forgets after a death
  flat(); const q = add(t, 36); run(100); const wasAware = q.aware;
  S.setLives(3); S.P.inv = 0; S.P.shield = 0; S.killPlayer('shot');
  for (let i = 0; i < 300 && !S.P.alive; i++) run(1);
  check(t + ' was alert before, forgets you after you die', wasAware && !q.aware && !q.provoked && !q.brave, 'aware before ' + wasAware);
  S.P.inv = 1e9; let fired = 0; for (let i = 0; i < 90; i++) { run(1); fired += S.bullets.filter((b) => b.owner === 'e').length; }
  check(t + ' does nothing to the new bro in the first seconds', fired === 0 && S.grace >= 0, fired + ' bullets, grace ' + S.grace.toFixed(1));
  // safe start: during the ceasefire it does nothing
  S.startLevel(0); step(); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; });
  const qs = add(t, Math.floor(S.P.x / T) + 5); qs.y = S.P.y; qs.x = S.P.x + 5 * T; S.P.inv = 0; S.P.shield = 0;
  const cf = S.ceasefire; let bad = 0; for (let i = 0; i < 60 * 8; i++) { run(1); bad += S.bullets.filter((b) => b.owner === 'e').length + S.ents.filter((e) => e.type === 'mine' && e.src === qs).length + (S.P.alive ? 0 : 1); }
  check(t + ' does nothing during the safe-start ceasefire', cf > 8 && bad === 0 && !qs.aware, 'ceasefire ' + cf + ', ' + bad + ' events');
}
console.log(fails ? fails + ' check(s) failed' : 'all new-enemy checks passed');
process.exit(fails ? 1 : 0);
