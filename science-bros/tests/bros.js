// Headless checks for every bro: each weapon hurts a quack, each special does its thing.
// Usage: node science-bros/tests/bros.js science-bros/index.html
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
const solid = (c, r) => { const v = S.tileAt(c, r); return v !== 0 && v !== 5; };
const setup = (id) => {
  S.reset(); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1);
  S.P.bro = S.BRO[id]; S.P.inv = 1e9; S.P.x = 4 * T; S.P.y = 16 * T - 15.01; S.P.face = 1; S.P.spec = 3; run(2);
};
const quack = (c, extra = {}) => { const e = Object.assign(S.makeEnt({ type: 'grunt', c, from: 0 }), { face: -1, react: 99, cool: 99 }, extra); S.ents.push(e); return e; };

check('there are 22 bros', S.BROS.length === 22, S.BROS.length + ' bros');
for (const b of S.BROS) {
  setup(b.id);
  const q = quack(12); // 8 tiles ahead; the bro walks toward it firing
  let i = 0; for (; i < 300 && !q.dead; i++) { q.react = 99; q.cool = 99; run(1, { fire: true, right: S.P.x < q.x - 14 }); }
  check(b.name + ': weapon kills a quack', q.dead, i + ' frames');
}
// specials that need a specific check
setup('archimedes'); const wall = solid(21, 15); S.P.x = 20 * T - 12; run(1);
for (let i = 0; i < 60; i++) run(1, { fire: true, right: true });
check('Archimedes drill bores into the hill', wall && !solid(21, 15));
setup('galileo'); let q = quack(6); S.pressed.special = true; run(1);
let i = 0; for (; i < 300 && !q.dead; i++) { q.react = 99; q.cool = 99; run(1); }
check('Galileo sun burns a quack nearby', q.dead, i + ' frames');
setup('turing'); const a = quack(10), b2 = quack(14, { face: -1 }); S.pressed.special = true; run(1); a.cool = b2.cool = 0;
check('Turing hacks the quacks on screen', a.hacked > 0 && b2.hacked > 0);
const c3 = quack(18, { face: -1 }); for (i = 0; i < 300 && !c3.dead; i++) run(1);
check('hacked quacks shoot an unhacked one', c3.dead, i + ' frames');
setup('johnson'); const js = [quack(10), quack(14), quack(18)]; S.pressed.special = true; run(90);
check('Johnson orbital strikes hit every quack on screen', js.every((e) => e.dead));
setup('meitner'); const ms = [quack(9), quack(13), quack(17)]; S.pressed.special = true; run(90);
check('Meitner chain reaction walks through a line of quacks', ms.every((e) => e.dead));
setup('archimedes'); const ar = quack(12); S.pressed.special = true; run(1);
check('Archimedes lever throws quacks up', ar.vy < -300 || ar.dead);
for (i = 0; i < 180 && !ar.dead; i++) run(1);
check('and they come down hard', ar.dead);

// upgrades and new mechanics
setup('einstein'); const p1 = quack(10), p2 = quack(10.6); for (let k = 0; k < 120 && !(p1.dead && p2.dead); k++) { p1.react = p2.react = 99; p1.cool = p2.cool = 99; run(1, { fire: true }); }
check('Einstein photons pass through the first quack', p1.dead && p2.dead);
setup('pasteur'); q = quack(10); S.P.cool = 0; run(1, { fire: true }); run(20);
check('Pasteur darts poison', q.dead || q.poison > 0);
setup('fleming'); const s1 = quack(6), s2 = quack(6.4); for (let k = 0; k < 4; k++) run(1, { fire: true });
check('Fleming spores make quacks sick', s1.sick > 0 || s1.dead);
setup('hypatia'); S.P.cool = 0; run(1, { fire: true }); const disc = S.bullets.find((b) => b.kind === 'disc'); let back = false;
for (let k = 0; k < 120 && disc && !disc.dead; k++) { run(1); if (disc.back) back = true; }
check('Hypatia disc flies out and comes back to her', back && disc.dead);
setup('faraday'); S.pressed.special = true; run(1); S.P.inv = 0;
S.bullets.push({ x: S.P.x + 30, y: S.P.y + 8, vx: -165, vy: 0, owner: 'e', dmg: 1, tdmg: 0, life: 2, kind: 'pill' }); run(20);
check('Faraday cage sends a shot back', S.P.alive && S.bullets.some((b) => b.kind === 'pill' && b.owner === 'p' && b.vx > 0));
setup('mendel'); const m1 = quack(14); S.pressed.special = true; run(1); for (let k = 0; k < 240 && !m1.dead; k++) { m1.react = 99; m1.cool = 99; run(1); }
check('Mendel pea turrets shoot a quack', m1.dead);
setup('tesla'); const t1 = quack(8); S.P.cool = 0; run(1, { fire: true });
check('Tesla arcs stun', t1.dead || t1.stun > 0);
setup('sagan'); const st = [quack(10), quack(16), quack(22)]; S.pressed.special = true; run(150);
check('Sagan star rain hits quacks across the screen', st.filter((e) => e.dead).length >= 2, st.filter((e) => e.dead).length + ' of 3');
setup('hubble'); const hb = quack(9); S.pressed.special = true; run(1);
check('Hubble flings quacks away', hb.dead || hb.kx > 300);
setup('wegener'); const wg = quack(12); S.pressed.special = true; run(2);
check('Wegener opens the ground under a quack', !(S.tileAt(12, 16) !== 0) || wg.dead);
// pickup guns
for (const g of ['shotgun', 'rocket', 'minigun', 'railgun']) {
  setup('einstein'); const pk = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4, item: 'gun' }); pk.gun = g; pk.x = S.P.x; S.ents.push(pk); run(3);
  const tq = quack(12); let k = 0; for (; k < 300 && !tq.dead; k++) { tq.react = 99; tq.cool = 99; run(1, { fire: true, right: S.P.x < tq.x - 40 }); }
  check(g + ' pickup replaces the weapon and kills', tq.dead, k + ' frames');
}
setup('einstein'); const gp = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4, item: 'gun' }); gp.gun = 'railgun'; gp.x = S.P.x; S.ents.push(gp); run(3);
for (let k = 0; k < 600 && S.P.alt; k++) run(1, { fire: true });
check('a pickup gun runs out and you get your own weapon back', !S.P.alt);

console.log(fails ? fails + ' check(s) failed' : 'all bro checks passed');
process.exit(fails ? 1 : 0);
