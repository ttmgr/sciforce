// Headless checks for gamepad input with a fake PS5-style controller (standard button mapping).
// Usage: node science-bros/tests/gamepad.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
// a fake controller: 18 buttons (0 cross, 1 circle, 2 square, 3 triangle, 4 L1, 5 R1, 6 L2, 7 R2, 8 create, 9 options, 12-15 d-pad, 17 touchpad), 2 stick axes
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
// one frame the way the real loop does it: read the pad, step, then forget one-frame presses
const frame = (n = 1) => { for (let i = 0; i < n; i++) { S.pollPad(); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } };
const press = (i, on = true) => { pad.buttons[i].pressed = on; };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };

press(0); frame(); press(0, false); frame(); check('cross on the title opens the world map', S.state === 'map');
press(0); frame(); press(0, false); frame(); check('cross again opens the briefing', S.state === 'brief');
press(9); frame(); press(9, false); frame(); check('options deploys from the briefing', S.state === 'play');
S.endCeasefire(); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.P.inv = 1e9; frame(2);
const x0 = S.P.x; pad.axes[0] = 0.6; frame(30); check('left stick moves', S.P.x > x0 + 30);
pad.axes[0] = 1; frame(30); check('stick pushed all the way runs', S.P.run && S.P.vx > 160, 'vx ' + S.P.vx.toFixed(0));
pad.axes[0] = 0; frame(20);
const y0 = S.P.y; press(0); frame(5); press(0, false); check('cross jumps', S.P.y < y0 - 5); frame(40);
S.P.bro = S.BRO.einstein; press(2); frame(3); press(2, false); check('square fires', S.bullets.some((b) => b.owner === 'p')); frame(5);
S.P.mcool = 0; press(3); frame(1); press(3, false); check('triangle punches (melee, as in Broforce)', S.P.punch > 0); frame(20);
S.P.spec = 3; press(1); frame(1); press(1, false); check('circle uses the special (as in Broforce)', S.P.spec === 2); frame(20);
press(5); frame(1); press(5, false); check('R1 dodge-rolls', S.P.dash > 0); frame(40);
press(17); frame(2); check('holding the touchpad shows the map', S.keys.map === true); press(17, false); frame(2); check('letting go hides it', !S.keys.map);
press(8); frame(2); check('holding Create shows the map too', S.keys.map === true); press(8, false); frame(2);
press(9); frame(1); press(9, false); frame(1); check('options pauses', S.paused);
press(13); frame(1); press(13, false); frame(1); press(2); frame(1); press(2, false); frame(1);
check('d-pad down and square switch a pause-menu option', S.settings.scanlines === true);
press(2); frame(1); press(2, false); frame(1); // switch it back

console.log(fails ? fails + ' check(s) failed' : 'all gamepad checks passed');
process.exit(fails ? 1 : 0);
