// Headless checks for the eight quacks of the second round (streamer, diffuser, detox, miner, yogi, pinboard, alpha, dronecaller)
// and the mixed groups in random maps: each one's special move, fair range, forgetting you after a death, and the quiet start.
// Usage: node science-bros/tests/enemies_more.js science-bros/index.html
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
const NEW = S.MORE_FOES;
check('eight new quack types are exported', NEW.length === 8 && new Set(NEW).size === 8, NEW.join(','));
check('they are different from the first six', NEW.every((t) => !S.NEW_FOES.includes(t)));
check('each has a threat value and a first-appearance point in the campaign', NEW.every((t) => S.THREAT[t] > 0 && S.RAMP_FROM[t] > 0), NEW.map((t) => t + ' ' + S.RAMP_FROM[t]).join(' '));
check('they appear spread over the campaign (at least 6 different start points)', new Set(NEW.map((t) => S.RAMP_FROM[t])).size >= 6);
check('the random generator can field every one of them', NEW.every((t) => S.RANDOM_FOES.some((f) => f[0] === t)));
// where they show up in the missions
{
  const seen = {}; for (let l = 0; l < S.nLevels; l++) { S.setRamp(false); S.startLevel(l); for (const e of S.ents) if (NEW.includes(e.type)) (seen[e.type] = seen[e.type] || new Set()).add(l); } S.setRamp(true);
  check('every new type is placed in at least 2 missions', NEW.every((t) => seen[t] && seen[t].size >= 2), NEW.map((t) => t + ':' + (seen[t] ? seen[t].size : 0)).join(' '));
}

// ---- each new type
const cases = {};
// streamer: the ring light flashes, then viewers (paratroopers) drop in
cases.streamer = () => {
  flat(); const s = add('streamer', 38); let flash = false, paras = 0;
  for (let i = 0; i < 60 * 4; i++) { S.P.x = 30 * T; run(1); if (S.fx.some((f) => f.kind === 'screen' && f.col === '#fff6c2')) flash = true; paras = Math.max(paras, S.ents.filter((e) => e.type === 'para' && !e.dead).length); }
  check('streamer: the ring light flashes the screen', flash);
  check('streamer: calls in viewers (1 to 5 paratroopers)', paras >= 1 && paras <= 5, paras + ' paras');
  flat(); add('streamer', 38); let max = 0; for (let i = 0; i < 60 * 40; i++) { S.P.x = 30 * T; run(1); max = Math.max(max, S.ents.filter((e) => e.type === 'para' && !e.dead).length); }
  check('streamer: never more than 5 viewers about at once', max <= 5, max + '');
};
// diffuser: leaves oil mist that halves your speed
cases.diffuser = () => {
  flat(); const d = add('diffuser', 40); run(60 * 5);
  const clouds = S.fx.filter((f) => f.kind === 'oil' && f.t > 0);
  check('diffuser: leaves oil clouds (1 to 4 out)', clouds.length >= 1 && clouds.length <= 4, clouds.length + ' clouds');
  if (clouds[0]) { S.P.x = clouds[0].x - 5; S.P.y = clouds[0].y - 8; check('diffuser: standing in the mist slows you to half speed', S.oilSlow() === 0.5); S.P.x = clouds[0].x - 5 + 80; check('diffuser: outside the mist you run at full speed', S.oilSlow() === 1); }
  flat(); const d2 = add('diffuser', 40); d2.layT = 0; run(30); const c = S.fx.find((f) => f.kind === 'oil'); S.P.inv = 1e9;
  if (c) { S.P.x = c.x - 5; S.P.vx = 0; let vmax = 0; for (let i = 0; i < 40; i++) { S.P.x = Math.min(S.P.x, c.x - 5); run(1, { right: true }); vmax = Math.max(vmax, Math.abs(S.P.vx)); } check('diffuser: you cannot run at full speed in the mist', vmax < 70, vmax.toFixed(0) + ' px/s'); }
};
// detox: three green globs in an arc, bursting where they land
cases.detox = () => {
  flat(); const d = add('detox', 38); d.cool = 0; let globs = new Set();
  for (let i = 0; i < 60 * 4; i++) { S.P.x = 30 * T; run(1); for (const b of S.bullets) if (b.kind === 'vomit' && b.owner === 'e') globs.add(b); }
  check('detox: spits three globs at a time', globs.size >= 3, globs.size + ' globs');
  check('detox: the globs fly in an arc (gravity)', [...globs].every((b) => b.grav > 0));
  flat(); S.P.inv = 0; S.P.shield = 0; const d2 = add('detox', 36); d2.cool = 0;
  for (let i = 0; i < 60 * 8 && S.P.alive; i++) { S.P.x = 30 * T; d2.x = 36 * T + 2; run(1); }
  check('detox: a glob can kill you at 6 tiles', !S.P.alive);
};
// miner: coins roll out and explode
cases.miner = () => {
  flat(); const m = add('miner', 38); let coins = new Set(), most = 0;
  for (let i = 0; i < 60 * 6; i++) { S.P.x = 30 * T; run(1); const live = S.bullets.filter((b) => b.kind === 'coin' && b.owner === 'e' && !b.dead); live.forEach((b) => coins.add(b)); most = Math.max(most, live.length); }
  check('miner: drops several coins', coins.size >= 3, coins.size + ' coins');
  check('miner: at most 3 coins out at once', most >= 1 && most <= 3, most + '');
  check('miner: the coins explode (they do not last forever)', [...coins].every((b) => b.dead || b.life < 2.3));
  flat(); S.P.inv = 0; S.P.shield = 0; const m2 = add('miner', 35); m2.layT = 0;
  for (let i = 0; i < 60 * 8 && S.P.alive; i++) { S.P.x = 30 * T; m2.x = 35 * T + 2; run(1); }
  check('miner: an exploding coin can kill you', !S.P.alive);
};
// yogi: blinks to another spot, then fires
cases.yogi = () => {
  flat(); const y = add('yogi', 38); let last = y.x, jumps = 0, big = 0, shots = 0;
  for (let i = 0; i < 60 * 9; i++) { S.P.x = 30 * T; run(1); if (Math.abs(y.x - last) > 3 * T) { jumps++; big = Math.max(big, Math.abs(y.x - last)); } last = y.x; shots += S.bullets.filter((b) => b.owner === 'e' && b.age === undefined && b.life > 1.7).length ? 1 : 0; }
  check('yogi: teleports short distances (4 to 7 tiles)', jumps >= 2 && big <= 7.5 * T, jumps + ' jumps, biggest ' + (big / T).toFixed(1) + ' tiles');
  check('yogi: fires right after he blinks', shots > 0);
  flat(); const y2 = add('yogi', 31); y2.cool = 99; run(100); check('yogi: blinks away at once when you walk up to him', Math.abs(y2.x - 31 * T) > 3 * T || y2.aim > 0, 'x ' + (y2.x / T).toFixed(1));
};
// pinboard: builds a crate wall in front of himself that you can cut
cases.pinboard = () => {
  flat(); const p = add('pinboard', 40); run(60 * 4);
  const wall = [34, 35, 36, 37, 38, 39].filter((c) => S.tileAt(c, 15) === 4 && S.tileAt(c, 14) === 4);
  check('pinboard: pins up a two-block wall of red-string crates in front of himself', wall.length === 1 && wall[0] === 37, wall.join(','));
  if (wall[0]) { for (let i = 0; i < 12; i++) S.damageTile(wall[0], 15, 1); check('pinboard: the wall can be cut (blocks break)', S.tileAt(wall[0], 15) === 0); }
  const n0 = S.tiles().filter((v) => v === 4).length; run(60 * 20);
  check('pinboard: never more than 5 walls from one guy', S.tiles().filter((v) => v === 4).length <= n0 + 8);
  flat(); S.P.x = 37 * T; S.P.y = 15 * T - 15.01; const p2 = add('pinboard', 40); p2.layT = 0; p2.cool = 99; step(); run(30); check('pinboard: does not wall you in (no block on top of you)', S.tileAt(37, 15) === 0 && S.tileAt(37, 14) === 0);
};
// alpha: triple damage from above; stomp kills only if you stay on the ground; charges
cases.alpha = () => {
  flat(); const a = add('alpha', 40); a.face = -1; const hp = a.hp; S.P.y = a.y - 40; S.P.onGround = false;
  S.hitEnemy(a, 1, 100, 'shot'); const top = hp - a.hp;
  S.P.y = a.y + a.h - 15; S.hitEnemy(a, 1, 100, 'shot'); const side = hp - top - a.hp;
  check('alpha: a hit from above (the head) does triple damage', Math.abs(top - 3) < 1e-9, top.toFixed(2));
  check('alpha: a hit from the side does normal damage', Math.abs(side - 1) < 1e-9, side.toFixed(2));
  flat(); const a2 = add('alpha', 40); a2.cool = 0; const x0 = a2.x; let vmax = 0, last = a2.x;
  for (let i = 0; i < 60 * 3; i++) { S.P.x = 30 * T; run(1); vmax = Math.max(vmax, Math.abs(a2.x - last) * 60); last = a2.x; }
  check('alpha: charges at you fast (over 150 px/s)', vmax > 150, vmax.toFixed(0) + ' px/s');
  flat(); S.P.inv = 0; S.P.shield = 0; const a3 = add('alpha', 32); a3.cool = 0; a3.x = 30 * T + 22;
  for (let i = 0; i < 60 * 3 && S.P.alive; i++) { S.P.x = 30 * T; a3.x = 30 * T + 22; run(1); }
  check('alpha: the stomp kills you if you stay on the ground', !S.P.alive);
  flat(); S.P.inv = 0; S.P.shield = 0; const a4 = add('alpha', 32); a4.cool = 0; let jumped = false;
  for (let i = 0; i < 60 * 3 && S.P.alive; i++) { a4.x = 30 * T + 22; if (a4.stomp > 0 && a4.stomp < 0.2 && !jumped) { S.P.y -= 80; S.P.onGround = false; jumped = true; } else if (!jumped) S.P.x = 30 * T; run(1); if (jumped && i > 0 && !S.P.alive) break; }
  check('alpha: jumping over the stomp saves you', jumped && S.P.alive);
};
// drone swarm controller: sends camera drones
cases.dronecaller = () => {
  flat(); const d = add('dronecaller', 38); let most = 0;
  for (let i = 0; i < 60 * 5; i++) { S.P.x = 30 * T; run(1); most = Math.max(most, S.ents.filter((e) => e.type === 'camdrone' && e.src === d && !e.dead).length); }
  check('dronecaller: sends out camera drones (up to 3)', most >= 1 && most <= 3, most + ' drones');
  flat(); const d2 = add('dronecaller', 38); let n = 0; for (let i = 0; i < 60 * 30; i++) { S.P.x = 30 * T; run(1); n = Math.max(n, S.ents.filter((e) => e.type === 'camdrone' && e.src === d2 && !e.dead).length); }
  check('dronecaller: never more than 3 of his drones at once', n <= 3, n + '');
  flat(); const d3 = add('dronecaller', 38); d3.cool = 0; run(60 * 2); const dr = S.ents.find((e) => e.type === 'camdrone' && e.src === d3);
  if (dr) { S.hitEnemy(dr, 5, 0, 'shot'); check('dronecaller: the drones can be shot down', dr.dead); }
};
for (const t of NEW) { console.log('-- ' + t); cases[t](); }

// ---- all eight: fair range, melee bro swing, punch, forgetting, quiet start
const reaches = (type, d, secs = 8) => {
  flat(); S.P.inv = 0; S.P.shield = 0; const e = add(type, 30 + d);
  for (let i = 0; i < 60 * secs; i++) { S.P.inv = 0; S.P.shield = 0; if (S.P.alive) S.P.x = 30 * T; e.x = (30 + d) * T + 2; e.y = Math.min(e.y, 15 * T - e.h); step(); if (!S.P.alive) return true; }
  return false;
};
const attacks = () => S.bullets.filter((b) => b.owner === 'e').length + S.ents.filter((e) => (e.type === 'mine' || e.type === 'camdrone' || e.type === 'para') && !e.dead).length + S.fx.filter((f) => f.kind === 'oil').length;
for (const t of NEW) {
  check(t + ' cannot hurt you from 13 tiles', !reaches(t, 13));
  // off-screen: far away it does nothing at all
  flat(); const far = add(t, 30 + 25); let acts = 0; for (let i = 0; i < 60 * 6; i++) { S.P.x = 30 * T; far.x = 55 * T + 2; run(1); acts += attacks(); }
  check(t + ' off the screen (25 tiles) does nothing', acts === 0 && !far.aware, acts + '');
  // the melee bro's swing and the punch both kill it
  for (const bro of ['vesalius', 'anning', 'hooke']) {
    flat(bro); const e = add(t, 31); e.x = 30 * T + 14; let i = 0;
    for (; i < 60 * 8 && !e.dead; i++) { S.P.inv = 1e9; S.P.x = 30 * T; S.P.face = 1; e.react = 99; e.cool = 99; e.stun = 0; e.windup = 0; e.stomp = 0; if (e.x > 30 * T + 20) e.x = 30 * T + 14; run(1, { fire: true }); }
    check(t + ' dies to a ' + bro + ' swing', e.dead, e.dead ? (i / 60).toFixed(1) + ' s' : 'hp ' + e.hp);
  }
  flat(); const pe = add(t, 31); pe.x = 30 * T + 8; let pi = 0;
  for (; pi < 60 * 6 && !pe.dead; pi++) { S.P.inv = 1e9; S.P.x = 30 * T; S.P.face = 1; pe.react = 99; pe.cool = 99; pe.windup = 0; pe.stun = 0; pe.stomp = 0; if (pe.x > 30 * T + 14) pe.x = 30 * T + 8; S.pressed.melee = true; for (const k in S.keys) S.keys[k] = false; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; }
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
  const cf = S.ceasefire; let bad = 0; for (let i = 0; i < 60 * 8; i++) { run(1); bad += attacks() + (S.P.alive ? 0 : 1); }
  check(t + ' does nothing during the safe-start ceasefire', cf > 8 && bad === 0 && !qs.aware, 'ceasefire ' + cf + ', ' + bad + ' events');
}

// ---- random maps: mixed groups (a medic behind a shield, a flag-bearer with grunts ...) and the new types in the mix
{
  check('mixed groups are defined and use known types', S.GEN_GROUPS.length >= 8 && S.GEN_GROUPS.every((g) => g.length >= 2 && g.every((t) => S.RANDOM_FOES.some((f) => f[0] === t))));
  S.setGenDiff('hard'); const pairs = {}, kinds = new Set(); let maps = 0;
  for (let seed = 1; seed <= 80; seed++) {
    S.startRandom(seed, true); maps++;
    const qs = S.ents.filter((e) => !e.dead && (S.NEW_FOES.includes(e.type) || NEW.includes(e.type) || ['grunt', 'shield', 'medic', 'sniper'].includes(e.type))).sort((a, b) => a.x - b.x);
    for (const e of S.ents) if (NEW.includes(e.type)) kinds.add(e.type);
    for (const g of S.GEN_GROUPS) for (const a of qs) if (a.type === g[0] && qs.some((b) => b.type === g[1] && Math.abs(b.x - a.x - T) < 4)) pairs[g.join('+')] = (pairs[g.join('+')] || 0) + 1;
  }
  S.setGenDiff('normal');
  check('random maps contain mixed posts of at least 4 different kinds', Object.keys(pairs).length >= 4, JSON.stringify(pairs));
  check('a medic stands right behind a shield in some random post', (pairs['shield+medic'] || 0) >= 1);
  check('hard random maps field at least 6 of the 8 new types', kinds.size >= 6, [...kinds].join(','));
}
console.log(fails ? fails + ' check(s) failed' : 'all second-round enemy checks passed');
process.exit(fails ? 1 : 0);
