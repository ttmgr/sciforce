// Headless checks for the world map: it draws for every stop, picking a mission still works, the plane flies, it is cheap.
// Usage: node science-bros/tests/world_map.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const press = (k) => { for (const key in S.pressed) S.pressed[key] = false; S.pressed[k] = true; S.step(1 / 60); for (const key in S.pressed) S.pressed[key] = false; };
const idle = (n) => { for (let i = 0; i < n; i++) S.step(1 / 60); };
const N = S.nLevels;

// every selection draws without errors, with the bros at the start, half way and at the gates of the Citadel
S.startMode('campaign');
check('campaign start opens the world map', S.state === 'map', S.state);
for (const r of [0, 9, N - 1]) {
  S.setReached(r); let err = '';
  for (let l = 0; l < N; l++) {
    S.setLevel(l);
    try { for (let k = 0; k < 4; k++) { S.drawWorldMap(l * 3.1 + k * 0.7 + r * 11); S.render(l + k * 0.25); } } catch (e) { err = 'mission ' + (l + 1) + ': ' + e.message; break; }
  }
  check('the map draws for every selection with reached = ' + r, !err, err);
}
// a long run of time covers night, lightning and every cloud position
let err = ''; try { for (let k = 0; k < 400; k++) S.drawWorldMap(k * 0.37); } catch (e) { err = e.message; }
check('the map draws over a long stretch of time', !err, err);

// every stop has a landmark and a spot inside the map area
const kinds = Array.from({ length: N }, (_, i) => S.wmKind(S.levelDef(i)));
check('the Citadel is the big fortress at the end', kinds[N - 1] === 'citadel', kinds[N - 1]);
check('the pyramid, the crop circle and the lighthouse are picked out', kinds.includes('pyramid') && kinds.includes('crops') && kinds.includes('lighthouse'), kinds.join(','));
const spots = Array.from({ length: N }, (_, i) => S.levelDef(i).map);
check('stops sit between the header and the panel', spots.every(([x, y]) => x > 10 && x < 470 && y > 80 && y < 200), spots.map((p) => p.join(',')).join(' '));
let close = 99; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) close = Math.min(close, Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]));
check('no two stops crowd each other', close >= 36, 'closest ' + close.toFixed(1) + ' px');

// left/right picks only missions already reached
S.startMode('campaign'); S.setReached(5); S.setLevel(0); idle(5);
for (let i = 0; i < 12; i++) press('right');
check('right stops at the furthest mission reached', S.level === 5, S.level);
for (let i = 0; i < 12; i++) press('left');
check('left stops at the first mission', S.level === 0, S.level);
S.setReached(0); press('right');
check('with nothing reached, right does nothing', S.level === 0, S.level);

// the plane flies to the new stop instead of jumping, and gets there
S.setReached(9); S.setLevel(0); idle(120);
const at0 = S.mapPlane(), stop0 = spots[0];
check('the plane waits over the chosen stop', Math.hypot(at0[0] - stop0[0], at0[1] - stop0[1]) < 0.5, at0.map((v) => v.toFixed(1)).join(','));
for (let i = 0; i < 6; i++) press('right');
check('the selection itself changes at once', S.level === 6, S.level);
const p1 = S.mapPlane(), d1 = Math.hypot(p1[0] - spots[6][0], p1[1] - spots[6][1]);
check('right after the pick the plane is still on its way', d1 > 20, 'dist ' + d1.toFixed(1));
idle(20);
const p2 = S.mapPlane(), d2 = Math.hypot(p2[0] - spots[6][0], p2[1] - spots[6][1]);
check('a moment later it is closer', d2 < d1 && d2 > 0.5, d1.toFixed(1) + ' -> ' + d2.toFixed(1));
idle(180);
const p3 = S.mapPlane(), d3 = Math.hypot(p3[0] - spots[6][0], p3[1] - spots[6][1]);
check('after three seconds it has landed over the stop', d3 < 0.5, 'dist ' + d3.toFixed(2));

// Enter from the map still opens the briefing for the chosen mission
S.setLevel(3); press('start');
check('Enter on the map opens the briefing', S.state === 'brief', S.state);
check('the briefing is for the chosen mission', S.level === 3, S.level);

// cost: under 3 ms per frame once the land is built
S.startMode('campaign'); S.setReached(12); S.setLevel(7); S.drawWorldMap(0);
const t0 = Date.now(), F = 300; for (let k = 0; k < F; k++) S.drawWorldMap(k / 60);
const ms = (Date.now() - t0) / F;
check('drawing the map costs under 3 ms a frame', ms < 3, ms.toFixed(3) + ' ms');

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
