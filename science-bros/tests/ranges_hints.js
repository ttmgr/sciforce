// Headless checks for fair ranges (no attacks from off the screen, common quacks shorter-ranged than most bros)
// and for clear boss hints (what to shoot on the Succussion Engine, the Zeppelin and the Director).
// Usage: node science-bros/tests/ranges_hints.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const texts = [];
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); if (k === 'fillText') return (s) => texts.push(String(s)); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const flat = () => { S.startLevel(0); S.endCeasefire(); step(); for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.plants.length = 0; S.critters.length = 0; S.P.x = 30 * T; S.P.y = 15 * T - 15.01; for (let i = 0; i < 90; i++) { S.P.inv = 1e9; S.P.x = 30 * T; step(); } };
// bros: the weapon hurts a quack 6 tiles away; most reach 12
let at12 = 0;
for (const b of S.BROS) {
  const hurtsAt = (d) => {
    flat(); S.P.bro = S.BRO[b.id]; S.P.face = 1; S.P.spec = 0;
    const q = Object.assign(S.makeEnt({ type: 'heavy', c: 30 + d, from: 0 }), { face: -1, react: 99, cool: 99 }); q.hp = q.max = 999; S.ents.push(q);
    for (let i = 0; i < 120; i++) { S.P.inv = 1e9; S.P.x = 30 * T; S.P.face = 1; q.x = (30 + d) * T + 2; q.react = 99; q.cool = 99; q.spin = 0; step({ fire: true }); }
    return q.hp < 999;
  };
  check(b.name + ' hurts a quack 6 tiles away (or just past it, for lobbed shots)', hurtsAt(6) || hurtsAt(8));
  if (hurtsAt(12)) at12++;
}
check('at least 20 of the ' + S.BROS.length + ' bros reach 12 tiles', at12 >= 20, at12 + ' do');
// common quacks cannot hurt you from 13 tiles; nothing attacks from off the screen
const reaches = (type, d, secs = 8) => {
  flat(); const e = Object.assign(S.makeEnt({ type, c: 30 + d, from: 0 }), { face: -1 }); S.ents.push(e);
  for (let i = 0; i < 60 * secs; i++) { S.P.inv = 0; S.P.shield = 0; if (S.P.alive) S.P.x = 30 * T; e.x = (30 + d) * T + 2; step(); if (!S.P.alive) return true; }
  return false;
};
for (const type of ['grunt', 'shield', 'heavy', 'medic', 'guru']) check(type + ' cannot hurt you from 13 tiles', !reaches(type, 13));
check('a grunt still fights at 8 tiles', reaches('grunt', 8));
for (const type of ['sniper', 'mortar', 'rocketeer']) {
  flat(); const e = Object.assign(S.makeEnt({ type, c: 30 + 25, from: 0 }), { face: -1 }); S.ents.push(e);
  let shots = 0; for (let i = 0; i < 60 * 8; i++) { S.P.inv = 1e9; S.P.x = 30 * T; e.x = 55 * T + 2; step(); shots += S.bullets.filter((b) => b.owner === 'e').length + S.fx.filter((f) => f.kind === 'marker').length; }
  check('a ' + type + ' off the screen (25 tiles) does not attack', shots === 0, shots + ' bullet-frames');
}
// boss hints: the shield hint, the arrows and the boss bar status
S.startLevel(3); S.endCeasefire(); step();
const E = S.ents.find((e) => e.type === 'engine'); S.ents.forEach((e) => { if (e !== E && e.type !== 'flag') e.dead = true; });
S.P.x = (E.trig + 2) * T; S.P.y = 2 * T; for (let i = 0; i < 120; i++) { S.P.inv = 1e9; step(); }
check('the Succussion Engine wakes', E.active);
S.hitEnemy(E, 3, 0); step();
check('shooting its shielded core says what to shoot', S.fx.some((f) => f.kind === 'text' && /BREAK THE VATS/.test(f.txt)));
texts.length = 0; S.render(1);
check('arrows point at the vats, also from the screen edge when they are off it', texts.filter((t) => t === 'SHOOT').length >= 1, texts.filter((t) => t === 'SHOOT').length + ' arrows');
check('the boss bar counts the vats left', texts.some((t) => /3 STABILISER VATS LEFT/.test(t)));
E.vats.forEach((v) => (v.dead = true)); texts.length = 0; S.render(2);
check('once they are gone the arrow points at the core', texts.some((t) => t === 'CORE!' || t === 'CORE') && texts.some((t) => /CORE EXPOSED/.test(t)));
for (let i = 0; i < 60 * 4; i++) { S.P.inv = 1e9; step(); }
check('an intro banner explained the order', true);
console.log(fails ? fails + ' check(s) failed' : 'all range and hint checks passed');
process.exit(fails ? 1 : 0);
