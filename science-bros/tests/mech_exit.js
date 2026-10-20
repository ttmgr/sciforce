// Headless checks that you can always get out of the bro-mech (Shift or V, a pad shoulder button, Down + Jump),
// that the empty suit stays and that you can climb back in.
// Usage: node science-bros/tests/mech_exit.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
// one frame the way the real loop does it: read the pad, step, draw now and then, forget one-frame presses
let fr = 0;
const run = (n, held = {}) => { for (let i = 0; i < n; i++) { S.pollPad(); for (const k in held) S.keys[k] = held[k]; S.step(1 / 60); if (fr++ % 10 === 0) S.render(fr / 60); for (const k in S.pressed) S.pressed[k] = false; } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const lone = () => { S.reset(); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.P.bro = S.BROS[0]; S.P.inv = 1e9; run(1); };
const suits = () => S.ents.filter((e) => e.type === 'mechsuit' && !e.dead);
// put a fresh suit on the floor and walk into it
const enter = (col) => {
  lone(); S.P.x = 2 * T; S.P.y = 16 * T - 15.01; run(2);
  const s = S.makeEnt({ type: 'mechsuit', c: col, from: 0 }); S.ents.push(s); run(2);
  for (let i = 0; i < 90 && !S.P.mech; i++) run(1, { right: true, left: false });
  S.keys.right = false; run(1);
  return !!S.P.mech;
};
const kdown = (k) => { S.keys[k] = true; S.pressed[k] = true; };

// 1 keyboard roll key (Shift or V both map to dash)
check('walking in boards the suit', enter(6));
kdown('dash'); run(1); S.keys.dash = false;
check('Shift / V gets you out', !S.P.mech && S.P.w === 10 && suits().length === 1);
run(70); check('the empty suit stays and you do not fall back in', !S.P.mech && suits().length === 1);
const s1 = suits()[0]; S.P.x = s1.x + 5; S.P.y = s1.y + 8; run(3);
check('you can walk back in', !!S.P.mech);

// 2 Down + Jump
kdown('down'); kdown('jump'); run(1); S.keys.down = false; S.keys.jump = false;
check('Down + Jump gets you out', !S.P.mech && S.P.w === 10 && suits().length === 1);
check('Down + Jump does not also jump the empty suit', suits()[0].dead === false);
run(70); const s2 = suits()[0]; S.P.x = s2.x + 5; S.P.y = s2.y + 8; run(3);
check('and back in again', !!S.P.mech);

// 3 gamepad: L1 and R1 dodge, Down (stick) + Cross
pad.buttons[4].pressed = true; run(1); pad.buttons[4].pressed = false; run(1);
check('pad L1 gets you out', !S.P.mech && suits().length === 1);
run(70); const s3 = suits()[0]; S.P.x = s3.x + 5; S.P.y = s3.y + 8; run(3);
check('walk back in (pad)', !!S.P.mech);
pad.buttons[5].pressed = true; run(1); pad.buttons[5].pressed = false; run(1);
check('pad R1 gets you out', !S.P.mech && suits().length === 1);
run(70); const s4 = suits()[0]; S.P.x = s4.x + 5; S.P.y = s4.y + 8; run(3);
pad.axes[1] = 1; run(1); pad.buttons[0].pressed = true; run(1); pad.buttons[0].pressed = false; pad.axes[1] = 0; run(1);
check('pad stick down + Cross gets you out', !S.P.mech && suits().length === 1);

// 4 the old trap: a wall behind the suit and the key held toward it must not pull you back in
check('board again for the wall case', enter(6));
const wallC = Math.floor((S.P.x + S.P.w) / T);
for (let r = 12; r < 16; r++) S.setTile(Math.floor(S.P.x / T) - 1, r, 3); S.P.x = Math.floor(S.P.x / T) * T + 1;
S.P.face = 1; kdown('dash'); run(1); S.keys.dash = false;
check('out with a wall behind', !S.P.mech);
run(120);
check('standing in the blocked spot for 2 s does not re-board', !S.P.mech && suits().length === 1);
const s5 = suits()[0]; S.P.x = s5.x + 24; S.P.y = s5.y + 11 - 0.01; run(3); for (let i = 0; i < 60 && !S.P.mech; i++) run(1, { left: true });
check('stepping clear and walking in again boards', !!S.P.mech);

// 5 a destroyed suit still throws you out and leaves no suit
S.P.mech.hp = 0; run(2);
check('a wrecked suit ejects you and is gone', !S.P.mech && S.P.alive && suits().length === 0);

console.log(fails ? fails + ' check(s) failed' : 'all mech exit checks passed');
process.exit(fails ? 1 : 0);
