// Headless checks for the quiet start of every mission, the briefing choices (bro and gear) and mission select.
// Usage: node science-bros/tests/safe_start.js science-bros/index.html
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
const FOE = ['preacher', 'mortar', 'camdrone', 'grunt', 'shield', 'heavy', 'scout', 'grenadier', 'rocketeer', 'guru', 'para', 'jetpack', 'sniper', 'flamer', 'brute', 'medic', 'bomber', 'dog', 'turret'];

for (let l = 0; l < S.nLevels; l++) {
  const name = 'mission ' + (l + 1);
  S.startLevel(l); S.state === 'play' || null;
  const near = S.ents.filter((e) => FOE.includes(e.type) && e.x < 20 * T);
  check(name + ': no enemy within 20 tiles of the start', near.length === 0, near.map((e) => e.type).join(','));
  check(name + ': starts with a 10 s ceasefire', Math.abs(S.ceasefire - 10) < 0.01);
  // stand still for 10 s: nobody shoots
  S.P.inv = 0; let shots = 0;
  for (let i = 0; i < 590; i++) { run(1); shots += S.bullets.filter((b) => b.owner === 'e').length; }
  check(name + ': standing still for 10 s, no quack fires', shots === 0 && S.P.alive);
  // walk and jump forward for 10 s: still nobody shoots
  S.startLevel(l); S.P.inv = 0; shots = 0;
  for (let i = 0; i < 590; i++) { if (i % 40 === 0) S.pressed.jump = true; run(1, { right: true, jump: (i % 40) < 20 }); shots += S.bullets.filter((b) => b.owner === 'e').length; }
  check(name + ': pushing forward for 10 s, no quack fires', shots === 0, 'reached col ' + (S.P.x / T).toFixed(0));
}
// after the ceasefire they wake up
S.startLevel(0); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; });
S.P.inv = 1e9; S.P.x = 30 * T; S.P.y = 15 * T - 15.01;
const g = Object.assign(S.makeEnt({ type: 'grunt', c: 33, from: 0 }), { face: -1 }); S.ents.push(g);
run(300); check('during the ceasefire a quack in plain view stays calm', !g.aware);
let fired = 0; for (let i = 0; i < 400; i++) { run(1); fired += S.bullets.filter((b) => b.owner === 'e').length; }
check('after 10 s it spots you and shoots', g.aware && fired > 0);
// shooting first provokes that quack only
S.startLevel(0); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; });
S.P.x = 30 * T; S.P.y = 15 * T - 15.01; S.P.inv = 1e9;
const a = Object.assign(S.makeEnt({ type: 'heavy', c: 33, from: 0 }), { face: -1 }); const b = Object.assign(S.makeEnt({ type: 'grunt', c: 31.5, from: 0 }), { face: -1 }); S.ents.push(a, b);
S.hitEnemy(a, 1, 90, 'shot'); run(200);
check('shoot one during the ceasefire and it fights back', a.aware && a.provoked);
check('the others stay calm', !b.provoked && S.ceasefire > 0);

// briefing: choose a freed bro and gear
S.reset(); S.unlocked.push('curie', 'tesla'); S.state;
S.startLevel(0); // through the screens instead:
// go to the title and walk through map -> briefing
S.pressed.pause = true; run(1); for (let k = 0; k < 7; k++) { S.pressed.down = true; run(1); } S.pressed.fire = true; run(1); // pause menu -> quit to title
check('quit to title from the pause menu', S.state === 'title');
S.pressed.start = true; run(1); check('on the world map', S.state === 'map');
S.unlocked.push('curie', 'tesla');
S.pressed.start = true; run(1); check('on the briefing', S.state === 'brief');
S.pressed.right = true; run(1); // next bro
S.pressed.down = true; run(1); for (let k = 0; k < 4; k++) { S.pressed.right = true; run(1); } // gear: shotgun
S.pressed.start = true; run(1);
check('deployed as the chosen bro', S.state === 'play' && S.P.bro.id === 'curie', S.P.bro.id);
check('with the chosen gear', S.P.alt && S.P.alt.kind === 'shotgun', S.P.alt && S.P.alt.kind);

// world map: pick any mission reached before
S.pressed.pause = true; run(1); for (let k = 0; k < 7; k++) { S.pressed.down = true; run(1); } S.pressed.fire = true; run(1);
S.setReached(2); S.pressed.start = true; run(1);
S.pressed.right = true; run(1); S.pressed.right = true; run(1); S.pressed.right = true; run(1);
check('left/right on the map moves only as far as you have reached', S.level === 2, 'level ' + S.level);
S.pressed.start = true; run(1); S.pressed.start = true; run(1);
check('and deploys into that mission', S.state === 'play' && S.level === 2);

console.log(fails ? fails + ' check(s) failed' : 'all safe start and choice checks passed');
process.exit(fails ? 1 : 0);
