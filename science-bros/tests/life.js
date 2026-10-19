// Headless checks for the living world: plants that bend, get cut and grow back; critters that scatter, fly off,
// land again and can be hit; grass that sprouts back on blasted earth.
// Usage: node science-bros/tests/life.js science-bros/index.html
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
const flat = () => { S.startLevel(0); S.endCeasefire(); run(1); for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.P.inv = 1e9; S.P.x = 20 * T; S.P.y = 15 * T - 15.01; };
const plantAt = (kind, c) => { const p = { kind, x: c * T + 8, y: 16 * T, c, r: 16, h: 8, bend: 0, vb: 0, seed: 1, cut: false, regrow: 0, grow: 1, col: '#ffffff' }; S.plants.push(p); return p; };

// every level grows something, except the airless Moon
for (let l = 0; l < S.nLevels; l++) {
  S.startLevel(l); run(1);
  const name = S.levelDef(l).name;
  check(name + ': plants grow and critters live here', S.plants.length >= 40 && S.critters.length >= 10, S.plants.length + ' plants, ' + S.critters.length + ' critters');
  let err = null; try { for (let i = 0; i < 120; i++) run(1, { right: true, fire: i % 4 === 0 }); } catch (e) { err = e; }
  check(name + ': two seconds of play draw without errors', !err, err && err.message);
}
S.startMode('moon'); check('the Moon is lifeless', S.plants.length === 0 && S.critters.length === 0);

// plants bend when you walk through them, and spring back
flat(); const p1 = plantAt('tuft', 24); run(5);
S.P.x = 22 * T; let maxBend = 0; for (let i = 0; i < 50; i++) { run(1, { right: true }); maxBend = Math.max(maxBend, Math.abs(p1.bend)); }
check('walking through a plant bends it', maxBend > 0.3, maxBend.toFixed(2));
S.P.x = 40 * T; run(180); check('it springs back afterwards', Math.abs(p1.bend) < 0.25, p1.bend.toFixed(2));
// a shot cuts it; it grows back as a sprout
flat(); const p2 = plantAt('flower', 30); S.P.x = 26 * T; S.P.face = 1; S.P.y = 16 * T - 15.01;
S.bullets.push({ x: 29 * T, y: 16 * T - 4, vx: 400, vy: 0, owner: 'p', dmg: 1, life: 1, kind: 'photon' }); run(4);
check('a shot cuts a plant', p2.cut);
for (let i = 0; i < 60 * 40 && p2.cut; i++) run(1);
check('it grows back later', !p2.cut);
check('first as a small sprout', p2.grow < 1, p2.grow.toFixed(2));
run(60 * 5); check('then full size', p2.grow === 1);
// fire burns plants
flat(); const p3 = plantAt('bush', 34); S.ignite(34 * T + 8, 15 * T, 6, 6); run(60);
check('fire burns a plant', p3.cut);

// critters: the ones close by scatter at gunfire, birds fly off and new ones land later
flat(); S.critters.length = 0;
const bird = S.newCritter('bird', 40 * T, 16 * T), crab = S.newCritter('crab', 44 * T, 16 * T), far = S.newCritter('crab', 85 * T, 16 * T);
S.critters.push(bird, crab, far); run(5);
check('critters go about their business when left alone', bird.state === 'idle' && crab.state === 'idle');
S.P.x = 36 * T; S.P.face = 1; run(1, { fire: true });
check('gunfire nearby scares them', bird.state === 'fly' && crab.state === 'flee');
check('a critter far away does not care', far.state === 'idle');
for (let i = 0; i < 60 * 6 && !bird.gone; i++) run(1);
check('the bird flies off the screen', S.critters.indexOf(bird) === -1);
flat(); S.P.x = 20 * T; let landed = false;
for (let i = 0; i < 60 * 25 && !landed; i++) { run(1); landed = S.critters.some((c) => c.kind === 'bird' && c.state === 'idle' && c.x > S.cam.x && c.x < S.cam.x + 480); }
check('a new bird flies in and lands on screen', landed);
// walking up to a critter makes it run
flat(); S.critters.length = 0; const liz = S.newCritter('crab', 30 * T, 16 * T); S.critters.push(liz); run(5);
const x0 = liz.x; S.P.x = 26 * T; for (let i = 0; i < 60; i++) run(1);
check('walking up to a crab makes it scuttle away', liz.state === 'flee' || Math.abs(liz.x - x0) > 20, Math.round(liz.x - x0) + ' px');
// blasts and shots kill critters
flat(); S.critters.length = 0; const c1 = S.newCritter('bird', 50 * T, 16 * T), c2 = S.newCritter('crab', 52 * T, 16 * T), c3 = S.newCritter('bird', 57 * T, 16 * T); S.critters.push(c1, c2, c3); run(2);
S.explode(51 * T, 16 * T - 6, 30, 0, 'p', 0); run(2);
check('a blast kills the critters in it', c1.dead && c2.dead);
check('and scares the ones further out', c3.state === 'fly');
flat(); S.critters.length = 0; const c4 = S.newCritter('crab', 40 * T, 16 * T); S.critters.push(c4); run(2);
S.bullets.push({ x: c4.x - 6, y: c4.y - 2, vx: 400, vy: 0, owner: 'p', dmg: 1, life: 1, kind: 'photon' }); run(3);
check('a shot kills a critter', c4.dead);

// grass sprouts back on freshly blasted earth
flat(); S.setTile(30, 15, 1); run(1); S.damageTile(30, 15, 999); run(2);
const sp = S.sproutAt();
check('breaking a block leaves the earth under it bare', sp.has(16 * 236 + 30));
const t0 = sp.get(16 * 236 + 30); run(60 * 15);
check('its grass is back after about 14 s', S.lifeT - t0 >= 14);
flat(); S.explode(40 * T, 16 * T - 4, 30, 0, 'p', 0); run(1);
check('a blast burns the grass off the earth around it', S.sproutAt().size >= 3, S.sproutAt().size + ' tiles');

console.log(fails ? fails + ' check(s) failed' : 'all living-world checks passed');
process.exit(fails ? 1 : 0);
