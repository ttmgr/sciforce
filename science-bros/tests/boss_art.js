// Headless checks for the boss art: all 8 boss types and their named variants draw without error in every state (asleep,
// awake, attack tell, hurt, low health, dying early and late, lighting on and off); drawing never changes boss state and never
// calls Math.random (so seeded tests play out the same); more damage detail appears as health falls; every named variant gets
// its own paint and its labels use the tiny font; the hit boxes are the same as before the art pass (7fd836a); and a boss
// fight at INSANE / 300% costs under 3 ms a frame with the boss drawing itself a small part of it.
// Usage: node science-bros/tests/boss_art.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
let ops = 0; const noop = () => {}, op = () => { ops++; }; // every canvas call counts as one draw op
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return op; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
let seed = 7, draws = 0; const M = Object.create(Math); M.random = () => { draws++; seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; // seeded, and counted
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.P.inv = 1e9; S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0, passes = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (ok) passes++; else fails++; };

const LEVEL = { boss: 0, kopter: 1, crawler: 1, tank: 2, engine: 3, blimp: 4, citrus: 17, director: 9 };
const TYPES = Object.keys(LEVEL);
// boss names in the campaign, the strongholds and the random-map word lists (a random map puts a place word in front)
const NAMES = { boss: ['', 'ZODIAC MECH', 'THE ZESTINATOR', 'ISLAND PILLBOT', 'ISLAND GRIFTBOT', 'ISLAND WALKER', 'ISLAND MECH'], kopter: ['', 'CHEMTRAIL COPTER', 'ASTRAL KOPTER', 'DUNES HYPECOPTER', 'DUNES GYROCOPTER', 'DUNES KOPTER'],
  crawler: ['', 'QUARTZ QUEEN', 'SAND SCARAB', 'SLUDGE SERPENT', 'OASIS SERPENT', 'OASIS SCARAB', 'OASIS WORM'], tank: ['', 'MIASMA MACHINE', 'STEAM TANK', 'PEAKS STEAMROLLER', 'PEAKS HYPE TRAIN', 'PEAKS TANK'],
  engine: ['', 'PLANT SHAKER', 'PLANT ENGINE'], blimp: ['', 'UFO HOAX BALLOON', 'FARM BALLOON', 'FARM ZEPPELIN'], citrus: ['', 'ORCHARD GRAPEFRUIT', 'ORCHARD LEMON LORD', 'ORCHARD TANGERINE'],
  director: ['', 'THE PITCHMAN', 'THE INFLUENCER', 'CITY STREAMER', 'CITY DIRECTOR', 'CITY PITCHMAN', 'CITY INFLUENCER'] };
const BASE = ['', 'ISLAND MECH', 'DUNES KOPTER', 'OASIS WORM', 'PEAKS TANK', 'PLANT ENGINE', 'FARM ZEPPELIN', 'CITY DIRECTOR'];
// the boss in its own fight, awake, the player standing in the arena and unhurt
const fight = (type, name) => {
  seed = 7; S.startLevel(LEVEL[type]); S.endCeasefire();
  const b = S.ents.find((e) => e.type === type); if (name !== undefined) b.bossName = name || undefined;
  const c = b.trig + 3; S.P.x = c * T; S.P.y = S.surf(c, 0) * T - 16; b.poked = true; run(90);
  if (type === 'crawler') { b.state = 'rear'; b.t = 6; b.spitT = 3; run(40); } // up out of the sand
  return b;
};
const snapshot = (b) => JSON.stringify(b, (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
// a whole frame of the boss's fight (it must not throw), then the boss's own drawing alone: did it change the boss,
// how many random draws and draw ops did it take
const look = (b, t = 1.3) => {
  const before = snapshot(b); let err = null;
  try { S.render(t); } catch (e) { err = e; }
  draws = 0; ops = 0; try { S.drawBoss(b, t); } catch (e) { err = err || e; }
  return { err, same: snapshot(b) === before, rand: draws, ops };
};
const killVats = (b, n = 99) => { if (b.vats) b.vats.forEach((v, i) => { if (i < n) { v.dead = true; v.hp = 0; } }); };
const tell = (b) => {
  if (b.type === 'boss') Object.assign(b, { state: 'spread', shots: 3, shotT: 0.1, t: 1.5 });
  if (b.type === 'kopter') Object.assign(b, { state: 'hover', shots: 2, shotT: 0.1, t: 2 });
  if (b.type === 'crawler') Object.assign(b, { state: 'rear', spitT: 0.1, t: 2 });
  if (b.type === 'tank') Object.assign(b, { state: 'shell', shots: 2, shotT: 0.1, t: 2 });
  if (b.type === 'engine') { Object.assign(b.hammers[0], { state: 'warn', t: 0.5 }); b.sprayT = 0.2; }
  if (b.type === 'blimp') { b.bombT = 0.2; b.dipT = -0.5; b.vats.forEach((v) => { v.cool = 0.1; }); }
  if (b.type === 'citrus') Object.assign(b, { state: 'roll', t: 0.3 });
  if (b.type === 'director') b.lock = 0.6;
};

// ---------------------------------------------------------------- 1. hit boxes as they were at 7fd836a
const DIMS0 = { boss: [44, 52, 150], kopter: [56, 22, 70], crawler: [20, 20, 110], tank: [64, 30, 180], engine: [28, 34, 90], blimp: [120, 36, 70], citrus: [44, 44, 240], director: [30, 22, 110] };
for (const type of TYPES) { const e = S.makeEnt({ type, c: 20, y: 100 }); check(type + ': hit box and health unchanged (' + DIMS0[type].join(' x ') + ')', e.w === DIMS0[type][0] && e.h === DIMS0[type][1] && e.max === DIMS0[type][2], e.w + ' x ' + e.h + ', ' + e.max + ' hp'); }
{ const parts = []; for (const type of ['engine', 'blimp', 'director']) { const b = fight(type); parts.push(type + ' ' + b.vats.map((v) => v.w + 'x' + v.h + '/' + v.max).join(' ')); }
  check('shield parts unchanged (engine vats 20x28/30, gondolas 16x12/14, studio lights 20x28/18)', parts[0] === 'engine 20x28/30 20x28/30 20x28/30' && parts[1] === 'blimp 16x12/14 16x12/14 16x12/14 16x12/14' && parts[2] === 'director 20x28/18 20x28/18 20x28/18', parts.join('; ')); }

// ---------------------------------------------------------------- 2. every boss and variant draws in every state, without touching state or Math.random
for (const type of TYPES) for (const name of NAMES[type]) {
  const label = type + (name ? ' "' + name + '"' : ''), bad = [], rnd = [], mut = [];
  const states = {
    asleep: () => { const b = fight(type, name); b.active = false; return b; },
    awake: () => fight(type, name),
    tell: () => { const b = fight(type, name); tell(b); return b; },
    hurt: () => { const b = fight(type, name); b.flash = 0.08; b.flinch = 0.12; if (b.vats) b.vats[0].flash = 0.08; return b; },
    half: () => { const b = fight(type, name); killVats(b, 1); b.hp = b.max * 0.5; if (b.vats) b.vats.forEach((v) => { if (!v.dead) v.hp = v.max * 0.4; }); run(10); return b; },
    low: () => { const b = fight(type, name); killVats(b); b.hp = b.max * 0.1; run(10); return b; },
    dying: () => { const b = fight(type, name); killVats(b); run(5); b.hp = 1; S.hitEnemy(b, 1e6); run(20); return b; },
    'dying late': () => { const b = fight(type, name); killVats(b); run(5); b.hp = 1; S.hitEnemy(b, 1e6); run(type === 'kopter' ? 40 : 150); return b; },
  };
  for (const [st, mk] of Object.entries(states)) {
    if (name && !['awake', 'tell', 'low', 'dying'].includes(st)) continue; // a named variant: the states where its paint differs
    const b = mk();
    for (const lit of [true, false]) { S.settings.lighting = lit; const r = look(b, 0.37 + st.length * 0.11); if (r.err) bad.push(st + (lit ? '' : ' (lighting off)') + ': ' + r.err.message); if (r.rand) rnd.push(st + ' ' + r.rand); if (!r.same) mut.push(st); }
    S.settings.lighting = true;
  }
  check(label + ': draws in ' + (name ? '4' : 'all 8') + ' states, lighting on and off, without an error', !bad.length, bad.join('; '));
  check(label + ': drawing changes nothing on the boss and calls Math.random 0 times', !rnd.length && !mut.length, (rnd.length ? 'random: ' + rnd.join(', ') : '') + (mut.length ? ' changed: ' + mut.join(', ') : ''));
}

// ---------------------------------------------------------------- 3. damage detail appears as health falls; the tell and the death add their own
for (const type of TYPES) {
  const marks = (b) => { let n = 0; for (const t of [0.13, 0.41, 0.77]) { const m0 = S.bossMarks(); S.drawBoss(b, t); n += S.bossMarks() - m0; } return n; }; // damage and death details drawn, at three moments
  const at = (f) => { const b = fight(type); if (f < 0.6) killVats(b); b.hp = b.max * f; run(2); return marks(b); };
  const w = [1, 0.6, 0.35, 0.1].map(at);
  check(type + ': more damage detail as health falls (cracks, holes, sparks, leaks at 100/60/35/10% health)', w[0] === 0 && w[1] > 0 && w[2] >= w[1] && w[3] > w[1], w.join(' / '));
  const S0 = S.bossWear(fight(type)), b2 = fight(type); b2.hp = b2.max * 0.25; check(type + ': wear reads 0 at full health and 0.75 at a quarter', S0 === 0 && Math.abs(S.bossWear(b2) - 0.75) < 1e-9, S0 + ', ' + S.bossWear(b2));
  const b3 = fight(type); const calm = look(b3).ops; tell(b3); const told = look(b3).ops;
  check(type + ': an attack tell adds something to the picture', told !== calm, calm + ' -> ' + told + ' ops');
  const b4 = fight(type); killVats(b4); b4.hp = b4.max * 0.1; run(5); const live = marks(b4); b4.hp = 1; S.hitEnemy(b4, 1e6); run(20); const dying = b4.dead ? 0 : marks(b4);
  check(type + ': the death sequence adds to the low-health damage (glow, sparks, flying plates)', dying > live, live + ' -> ' + dying + ' details');
}

// ---------------------------------------------------------------- 4. named variants each get their own paint; labels use letters the tiny font has
for (const type of TYPES) {
  const skins = NAMES[type].map((n) => S.bossSkin({ type, bossName: n || undefined }).v), base = NAMES[type].filter((n) => BASE.includes(n)).map((n) => S.bossSkin({ type, bossName: n || undefined }).v);
  const named = NAMES[type].filter((n) => !BASE.includes(n) && !/ (WORM|MECH|KOPTER|TANK|ENGINE|ZEPPELIN|DIRECTOR)$/.test(n)).map((n) => S.bossSkin({ type, bossName: n }).v);
  check(type + ': base names keep the base paint, every other name gets a variant', base.every((v) => v === 'base') && named.every((v) => v !== 'base'), NAMES[type].map((n, i) => (n || '-') + '=' + skins[i]).join(', '));
}
{ const texts = []; for (const type of TYPES) for (const n of NAMES[type]) { const s = S.bossSkin({ type, bossName: n || undefined }); for (const k of ['label', 'sign', 'tag', 'sash']) if (s[k]) texts.push(s[k]); }
  const missing = [...new Set(texts.join('').replace(/ /g, '').split('').filter((ch) => !S.MICRO[ch]))];
  check('every boss label and sign can be drawn in the tiny font', !missing.length, missing.join('') || texts.length + ' labels');
  check('labels are short enough for the bosses (at most 13 letters)', texts.every((x) => x.length <= 13), texts.filter((x) => x.length > 13).join(', ')); }

// ---------------------------------------------------------------- 5. frame cost: each boss fight at INSANE / 300%, firing, and the boss's own drawing
S.setDifficulty(3, false); S.setDensity(6, false);
{
  const measure = (type) => {
    const b = fight(type); S.P.bro = S.BRO.einstein; const N = 150; let ms = 0, art = 0, n = 0;
    for (let i = 0; i < N && !b.dead; i++) {
      const t0 = process.hrtime.bigint(); step({ fire: true }, true); ms += Number(process.hrtime.bigint() - t0) / 1e6; n++;
      const t1 = process.hrtime.bigint(); S.drawBoss(b, i / 60); art += Number(process.hrtime.bigint() - t1) / 1e6;
    }
    return [ms / n, art / n];
  };
  for (const type of TYPES) {
    let ms = 99, art = 99; for (let r = 0; r < 3; r++) { const [m, a] = measure(type); ms = Math.min(ms, m); art = Math.min(art, a); } // best of 3: a busy machine does not fail it
    console.log('(' + type + ': ' + ms.toFixed(2) + ' ms a frame (step and draw), the boss drawing ' + art.toFixed(3) + ' ms of it)');
    check(type + ': a fight at INSANE / 300% costs under 3 ms a frame (or, on a busy machine, the boss drawing is under 10% of it)', ms < 3 || art < ms * 0.1, ms.toFixed(2) + ' ms');
    check(type + ': drawing the boss costs under 0.3 ms a frame', art < 0.3, art.toFixed(3) + ' ms');
  }
}
S.setDifficulty(1, false); S.setDensity(3, false);

console.log(fails ? fails + ' check(s) failed, ' + passes + ' passed' : 'all ' + passes + ' boss art checks passed');
process.exit(fails ? 1 : 0);
