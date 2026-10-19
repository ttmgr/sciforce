// Headless checks that enemies calm down: bosses after you die or leave their arena, quacks after a death.
// Usage: node science-bros/tests/deaggro.js science-bros/index.html
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
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (i % 10 === 0) S.render(i / 60); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];

// the Homeopathitron: wake it, then die
const wake = () => {
  S.startLevel(0); S.endCeasefire(); run(1);
  S.ents.forEach((e) => { if (e.type !== 'boss' && e.type !== 'flag') e.dead = true; });
  const B = S.ents.find((e) => e.type === 'boss');
  S.P.inv = 1e9; S.P.x = (B.trig + 3) * T; S.P.y = 13 * T; run(90);
  return B;
};
let B = wake();
check('the Homeopathitron wakes when you walk in', B.active);
S.P.inv = 0; S.killPlayer('shot'); run(60);
check('it calms down soon after you die', !B.active, 'active ' + B.active);
check('no homing missiles chase the next bro', !S.bullets.some((b) => b.owner === 'e' && b.kind === 'missile'));
let shotsAtNewBro = 0; for (let i = 0; i < 60 * 4; i++) { run(1); shotsAtNewBro += S.bullets.filter((b) => b.owner === 'e').length; }
check('it does not attack the new bro at the checkpoint', !B.active && shotsAtNewBro === 0, shotsAtNewBro + ' enemy bullets');
S.P.inv = 1e9; S.P.x = (B.trig + 3) * T; S.P.y = 13 * T; run(60);
check('it wakes again when you walk back in', B.active);
const hp = B.hp; S.hitEnemy(B, 5, 0); check('and it kept its damage', B.hp === hp - 5 && hp <= B.max);
// leave the arena
S.P.x = (B.trig - 8) * T; S.P.y = 13 * T; run(60);
check('stepping out briefly does not calm it', B.active);
run(150);
check('staying out for a few seconds calms it', !B.active);

// every boss calms when you die
for (let l = 0; l < S.nLevels; l++) {
  S.startLevel(l); S.endCeasefire(); run(1);
  const b = S.ents.find((e) => BOSSES.includes(e.type) && e.final);
  S.ents.forEach((e) => { if (e !== b && e.type !== 'flag') e.dead = true; });
  S.P.inv = 1e9; S.P.x = (b.trig + 3) * T; S.P.y = 2 * T; run(120);
  const woke = b.active; S.P.inv = 0; S.P.shield = 0; S.killPlayer('shot'); run(60);
  check('mission ' + (l + 1) + ' boss (' + (b.bossName || b.type) + ') calms after you die', woke && !b.active);
}

// quacks forget you after a death
const flat = () => { S.startLevel(0); S.endCeasefire(); run(1); for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.P.inv = 1e9; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; run(60); };
flat();
const q = Object.assign(S.makeEnt({ type: 'grunt', c: 34, from: 0 }), { face: -1 }); S.ents.push(q);
for (let i = 0; i < 120; i++) run(1);
check('a quack next to you is on alert', q.aware);
S.P.inv = 0; S.P.shield = 0; S.killPlayer('shot');
for (let i = 0; i < 200 && S.P.alive === false; i++) run(1);
check('after you die it forgets you', !q.aware && !q.provoked);
check('the new bro gets a few quiet seconds', S.grace > 1.5, S.grace.toFixed(1));
S.P.inv = 1e9; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; let fired = 0; for (let i = 0; i < 90; i++) { run(1); fired += S.bullets.filter((b) => b.owner === 'e').length; }
check('nobody fires during them', fired === 0, fired + ' bullets');
for (let i = 0; i < 240; i++) run(1);
check('then quacks notice you again', q.aware || q.dead);
// a quack out of sight for a while gives up
flat();
const q2 = Object.assign(S.makeEnt({ type: 'grunt', c: 34, from: 0 }), { face: -1 }); S.ents.push(q2); run(90);
S.P.x = 5 * T; S.P.y = 2 * T; run(60 * 4);
check('a quack that loses sight of you gives up after a few seconds', !q2.aware);
console.log(fails ? fails + ' check(s) failed' : 'all de-aggro checks passed');
process.exit(fails ? 1 : 0);
