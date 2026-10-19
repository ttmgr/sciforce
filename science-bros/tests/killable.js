// Headless check that every enemy type can be killed the normal way: by shooting it and by blowing it up.
// Usage: node science-bros/tests/killable.js science-bros/index.html
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
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
// a flat empty yard on mission 1; the player stands at column 30 facing right
const arena = () => {
  S.startLevel(0); S.endCeasefire(); run(1);
  for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1);
  S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.face = 1; S.P.inv = 1e9;
};
const FOES = ['grunt', 'shield', 'heavy', 'scout', 'grenadier', 'rocketeer', 'guru', 'para', 'jetpack', 'sniper', 'flamer', 'brute', 'medic', 'preacher', 'mortar', 'bomber', 'dog', 'turret', 'camdrone'];

for (const type of FOES) {
  // shot: Einstein fires at it from 5 tiles away; it may not move or fight back
  arena();
  const e = Object.assign(S.makeEnt({ type, c: 35, from: 0 }), { face: 1 }); S.ents.push(e);
  if (type === 'camdrone') e.y = e.home = S.P.y + 2; // bring the drone down to gun height
  if (type === 'para') e.chute = false;
  let i = 0;
  for (; i < 60 * 12 && !e.dead; i++) {
    S.P.inv = 1e9; S.P.x = 30 * T; S.P.face = 1; e.x = 35 * T; e.react = 99; e.cool = 99; e.stun = 0; e.charge = 0; e.dive = false; e.lockT = 0;
    if (type === 'camdrone') { e.y = S.P.y + 2; e.vy = 0; }
    run(1, { fire: true });
  }
  check(type + ' dies when shot', e.dead, e.dead ? (i / 60).toFixed(1) + ' s' : 'hp ' + e.hp + ' after 12 s');
  // blast: a big explosion right on it
  arena();
  const b = S.makeEnt({ type, c: 50, from: 0 }); S.ents.push(b);
  for (let k = 0; k < 4 && !b.dead; k++) { S.explode(b.x + b.w / 2, b.y + b.h / 2, 40, 6, 'p', 3); run(30); }
  check(type + ' dies in explosions', b.dead, b.dead ? '' : 'hp ' + b.hp);
}
console.log(fails ? fails + ' check(s) failed' : 'all killable checks passed');
process.exit(fails ? 1 : 0);
