// Headless checks for aiming (hold aim to keep facing and walk backwards, Up tilts the gun), the melee bros
// and the longer maps.
// Usage: node science-bros/tests/aim_melee_maps.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
// a flat floor at row 16 with nothing on it
const flat = (bro = 'einstein') => {
  S.startLevel(0); S.endCeasefire(); step();
  for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0;
  S.P.bro = S.BRO[bro]; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = 1e9; S.P.spec = 0; S.P.alt = null; step();
};
const quack = (c, r, extra = {}) => { const q = Object.assign(S.makeEnt({ type: 'heavy', c, from: r }), { face: -1, react: 99, cool: 99 }, extra); q.hp = q.max = 999; S.ents.push(q); return q; };
const newShots = (fn) => { const n = S.bullets.length; fn(); return S.bullets.slice(n).filter((b) => b.owner === 'p'); };

// ---- aiming
flat(); S.P.face = -1; const x0 = S.P.x;
run(30, { aim: true, right: true });
check('holding aim keeps your facing while you walk the other way', S.P.face === -1, 'face ' + S.P.face);
check('and you still move: walking backwards', S.P.x > x0 + 20, ((S.P.x - x0) / T).toFixed(1) + ' tiles');
flat(); S.P.face = 1; run(10, { right: true }); run(10, { left: true });
check('without aim you turn round as before', S.P.face === -1);
flat(); S.P.face = 1;
let shots = newShots(() => { S.P.cool = 0; step({ aim: true, up: true, fire: true }); });
check('aim + Up while standing: the shot flies straight up', shots.length > 0 && shots[0].vy < -400 && Math.abs(shots[0].vx) < 15, shots.map((b) => b.vx.toFixed(0) + ',' + b.vy.toFixed(0)).join(' '));
check('the arm points up', Math.abs(S.P.aim - Math.PI / 2) < 0.01);
flat(); S.P.face = 1; run(5, { aim: true, left: true });
shots = newShots(() => { S.P.cool = 0; step({ aim: true, up: true, left: true, fire: true }); });
check('aim + Up while walking backwards: 45 degrees up and forwards', shots.length > 0 && shots[0].vx > 300 && shots[0].vy < -300 && S.P.face === 1, shots.map((b) => b.vx.toFixed(0) + ',' + b.vy.toFixed(0)).join(' '));
flat(); S.P.face = 1;
shots = newShots(() => { S.P.cool = 0; step({ up: true, fire: true }); });
check('Up without aim does not tilt the gun', shots.length > 0 && Math.abs(shots[0].vy) < 20 && !S.P.aim);
// a quack hanging in the air 3 tiles over your head: only an aimed shot gets it
const above = (gap = 3) => { flat(); S.P.face = 1; const q = quack(31, 0); return q; };
const hold = (q, gap = 3) => { S.P.x = 31 * T; S.P.inv = 1e9; q.x = 31 * T; q.y = S.P.y - gap * T - q.h; q.vy = 0; q.react = 99; q.cool = 99; };
let q = above(); for (let i = 0; i < 60; i++) { hold(q); step({ fire: true }); }
check('a quack straight above is safe from a level shot', q.hp === 999);
q = above(); for (let i = 0; i < 60; i++) { hold(q); step({ aim: true, up: true, fire: true }); }
check('an aimed shot hits the quack above', q.hp < 999, (999 - q.hp).toFixed(1) + ' damage');
// beam weapons, lobs and spread guns follow the aim too
for (const id of ['galileo', 'franklin', 'faraday', 'fleming', 'tesla', 'ada', 'curie', 'feynman', 'hopper', 'hubble', 'goodall', 'wu', 'lavoisier']) {
  q = above(); S.P.bro = S.BRO[id]; S.P.alt = null;
  for (let i = 0; i < 120; i++) { hold(q); q.sick = 0; step({ aim: true, up: true, fire: true }); }
  check(id + ' aimed up hurts a quack 3 tiles over your head', q.hp < 999 || q.sick > 0 || q.dead, (999 - q.hp).toFixed(1));
}
q = above(); S.P.bro = S.BRO.archimedes; for (let i = 0; i < 60; i++) { hold(q, 0.5); step({ aim: true, up: true, fire: true }); }
check('the drill aimed up chews what is just over your head', q.hp < 999, (999 - q.hp).toFixed(1));
for (const kind of ['railgun', 'shotgun', 'rocket', 'minigun']) {
  q = above(); S.P.alt = { kind, ammo: 50 }; for (let i = 0; i < 60; i++) { hold(q); step({ aim: true, up: true, fire: true }); }
  check('the ' + kind + ' fires up when aimed', q.hp < 999 || q.dead);
}
// the right stick aims on a pad
flat(); S.P.face = -1; pad.axes[2] = 0.7; pad.axes[3] = -0.7; S.pollPad();
shots = newShots(() => { S.P.cool = 0; S.keys.fire = true; S.step(1 / 60); S.keys.fire = false; });
check('the right stick aims: diagonal up and right', S.P.face === 1 && shots.length > 0 && shots[0].vx > 300 && shots[0].vy < -300, shots.map((b) => b.vx.toFixed(0) + ',' + b.vy.toFixed(0)).join(' '));
pad.axes[2] = 0; pad.axes[3] = 0; pad.buttons[6].pressed = true; pad.buttons[12].pressed = true; S.pollPad();
check('L2 + d-pad up aims up instead of jumping', S.keys.aim && S.keys.up && !S.keys.jump);
pad.buttons[6].pressed = false; S.pollPad();
check('without L2 the d-pad up jumps again', S.keys.jump && !S.keys.up);
pad.buttons[12].pressed = false; S.pollPad();

// ---- melee bros
const melee = S.BROS.filter((b) => b.melee);
check('there are 3 melee bros', melee.length === 3, melee.map((b) => b.id).join(' '));
const hurtsAt = (id, d, keys = {}) => {
  flat(id); const q = quack(30 + d, 0);
  for (let i = 0; i < 90; i++) { S.P.x = 30 * T; S.P.face = 1; S.P.inv = 1e9; q.x = (30 + d) * T + 2; q.react = 99; q.cool = 99; step(Object.assign({ fire: true }, keys)); }
  return q.hp < 999;
};
for (const b of melee) {
  check(b.name + ' hits a quack 1 tile away', hurtsAt(b.id, 1));
  check(b.name + ' does not reach a quack 6 tiles away', !hurtsAt(b.id, 6));
}
check('the spring glove reaches 3 tiles', hurtsAt('hooke', 3));
for (const b of melee) {
  const q = above(); S.P.bro = b; for (let i = 0; i < 60; i++) { hold(q, 0.5); step({ aim: true, up: true, fire: true }); }
  check(b.name + ' aimed up hits a quack just over the head', q.hp < 999);
}
flat('vesalius'); S.bullets.push({ x: S.P.x + 22, y: S.P.y + 6, vx: -120, vy: 0, owner: 'e', dmg: 1, life: 2, kind: 'pill' });
const pill = S.bullets[S.bullets.length - 1]; S.P.cool = 0; step({ fire: true });
check('a scalpel slash cuts an enemy shot out of the air', pill.dead && S.P.alive);
flat('anning'); S.setTile(32, 15, 2); S.setTile(32, 14, 2); for (let i = 0; i < 90; i++) { S.P.x = 30 * T; S.P.face = 1; step({ fire: true }); }
check('the fossil hammer smashes a brick wall', !S.tileAt(32, 15) && !S.tileAt(32, 14));
flat('anning'); S.setTile(31, 16, 1); for (let i = 0; i < 60; i++) { S.P.x = 30 * T; S.P.face = 1; step({ fire: true }); }
check('a swing never digs the floor you stand on', S.tileAt(30, 16) && S.tileAt(31, 16));
// specials
flat('vesalius'); S.P.spec = 1; let q2 = quack(34, 0); const vx0 = S.P.x; S.pressed.special = true; run(30);
check('Fabrica dashes ahead and cuts the quack in the way', S.P.x - vx0 > 5 * T && q2.hp < 999, ((S.P.x - vx0) / T).toFixed(1) + ' tiles');
flat('hooke'); S.P.spec = 1; q2 = quack(34, 0); q2.hp = q2.max = 6; Object.assign(q2, { type: 'grunt' }); S.pressed.special = true; step();
check("Hooke's law flings a quack", q2.dead || q2.kx > 200 || q2.vy < -200, 'kx ' + q2.kx);
flat('anning'); S.P.spec = 1; q2 = quack(36, 0); S.pressed.special = true; for (let i = 0; i < 120; i++) { q2.x = 36 * T; q2.react = 99; q2.cool = 99; step(); }
check('Mass extinction drops a meteor on the quack ahead', q2.hp < 999, (999 - q2.hp).toFixed(1));

// ---- longer maps
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
check('the map is 560 columns wide (was 236, then 376)', S.LW === 560);
for (const l of [...Array(S.nLevels).keys(), S.MOON]) {
  const L = S.levelDef(l), tag = L.name;
  S.startLevel(l); S.endCeasefire(); step();
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  const cut = S.cutAt(), inGap = (e) => e.x >= cut * T && e.x < (cut + S.STRETCH) * T;
  const foes = S.ents.filter((e) => inGap(e) && !e.dead && !['flag', 'ammo', 'icicle'].includes(e.type) && !BOSSES.includes(e.type)).length;
  const flags = S.ents.filter((e) => inGap(e) && e.type === 'flag').length;
  check(tag + ': the boss arena starts ' + S.STRETCH + ' columns later', S.isStretched() && B.ax0 >= cut + S.STRETCH && B.trig >= cut + S.STRETCH, 'ax0 ' + B.ax0 + ' trig ' + B.trig);
  check(tag + ': the new stretch has quacks and four checkpoint flags', foes >= 5 && flags === 4, foes + ' quacks, ' + flags + ' flags');
  check(tag + ': the extraction pad moved with the arena', S.padOf()[0] === S.levelDef(l).pad[0] + S.STRETCH);
  // a bot that runs right and jumps gets from the end of the old path through the stretch into the arena (invulnerable)
  S.ents.forEach((e) => { if (!BOSSES.includes(e.type) && e.type !== 'flag') e.dead = true; });
  S.P.bro = S.BRO.einstein; S.P.x = (cut - 4) * T; S.P.y = 2 * T; S.P.vy = 0; let far = 0;
  for (let i = 0; i < 90 * 60 && far < B.trig; i++) {
    if (i % 25 === 0) S.pressed.jump = true;
    S.P.inv = 1e9; S.P.alive = true;
    step({ right: true, jump: i % 25 < 14, fire: i % 6 < 3 });
    far = Math.max(far, S.P.x / T);
  }
  check(tag + ': a simple bot crosses the stretch into the arena', far >= B.trig, 'reached col ' + far.toFixed(0) + ' of ' + B.trig);
}
S.startLevel(S.SIEGE); step();
check('Lab Siege keeps its yard (no stretch)', !S.isStretched() && S.padOf()[0] === S.levelDef(S.SIEGE).pad[0]);
S.startLevel(3); S.endCeasefire(); step(); S.keys.map = true; S.render(1); S.keys.map = false;
check('the full map draws the longer level', true);

// ---- random bros: a new campaign unlocks 10 at random; every respawn picks any of them but the one who died
const starts = new Set(), firsts = new Set();
for (let k = 0; k < 20; k++) {
  S.reset(); S.startMode && S.startMode('campaign');
  check('a new campaign starts with 10 bros unlocked', S.unlocked.length === 10 && new Set(S.unlocked).size === 10, S.unlocked.length);
  S.unlocked.forEach((id) => starts.add(id)); firsts.add(S.unlocked[0]);
}
check('the 10 are random: over 20 new games most bros show up', starts.size >= 30, starts.size + ' of ' + S.BROS.length);
check('and not always Albro Einstein first', firsts.size > 5, firsts.size + ' different first bros');
S.reset(); S.startMode('campaign'); S.startLevel(0); S.endCeasefire(); step();
const seen = new Set(); let same = 0;
for (let k = 0; k < 60; k++) {
  const before = S.P.bro.id; S.setLives(9); S.P.inv = 0; S.killPlayer('shot');
  for (let i = 0; i < 300 && (!S.P.alive || S.P.bro.id === before && !S.P.chute); i++) step();
  if (S.P.bro.id === before) same++; seen.add(S.P.bro.id);
  check('a respawn sends an unlocked bro', S.unlocked.includes(S.P.bro.id));
}
check('respawns are random across the unlocked bros', seen.size >= 8, seen.size + ' of 10 seen in 60 deaths');
check('a respawn never sends the bro who just died', same === 0, same);
S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); step(); const cage = S.makeEnt({ type: 'cage', c: 36, from: 0 }); S.ents.push(cage); const n0 = S.unlocked.length;
S.P.inv = 1e9; for (let i = 0; i < 120 && S.unlocked.length === n0; i++) { S.P.x = 36 * T; step({ fire: true }); if (i === 30) S.pressed.melee = true; }
check('freeing a cage unlocks one more bro', S.unlocked.length === n0 + 1, n0 + ' -> ' + S.unlocked.length);

// ---- everything takes damage: sleeping bosses, mines, and spores on objects
S.startLevel(0); S.endCeasefire(); step();
const sleeper = S.ents.find((e) => e.final); const hp0 = sleeper.hp;
check('the boss sleeps while you are far away', !sleeper.active);
S.P.inv = 1e9; S.P.x = (sleeper.trig - 30) * T; step();
S.bullets.push({ x: sleeper.x - 6, y: sleeper.y + sleeper.h / 2, vx: 500, vy: 0, owner: 'p', dmg: 1, tdmg: 0.5, life: 0.5, kind: 'photon' }); run(3);
check('a shot hurts a sleeping boss', sleeper.hp < hp0, (hp0 - sleeper.hp).toFixed(1) + ' damage');
run(30); check('and wakes it up, even from outside its arena', sleeper.active);
flat(); const mine = Object.assign(S.makeEnt({ type: 'mine', c: 34, from: 0 }), {}); S.ents.push(mine);
for (let i = 0; i < 60 && !mine.dead; i++) { S.P.x = 30 * T; S.P.face = 1; step({ fire: true }); }
check('a level shot sets off a mine on the floor', mine.dead);
for (const type of ['barrel', 'dog', 'turret', 'itemcrate']) {
  flat('fleming'); const o = Object.assign(S.makeEnt({ type, c: 33, from: 0 }), { face: -1, react: 99, cool: 99 }); S.ents.push(o); const h0 = o.hp;
  for (let i = 0; i < 90 && !o.dead; i++) { S.P.x = 30 * T; S.P.face = 1; o.x = 33 * T + 2; o.react = 99; o.cool = 99; step({ fire: true }); }
  check('Fleming\'s spores hurt a ' + type, o.dead || o.hp < h0);
}
S.render(1);

console.log(fails ? fails + ' check(s) failed' : 'all aim, melee and map checks passed');
process.exit(fails ? 1 : 0);
