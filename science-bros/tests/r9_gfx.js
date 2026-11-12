// Headless checks for the round 9 graphics pass: the GFX functions exist, drawing with outline, AO and glow on makes no extra random draws,
// the quack presence light is present in a normal mission and under the DARK modifier (with the bro's lamp) and absent in a blackout, and the AO pass stays inside the screen range.
// Usage: node science-bros/tests/r9_gfx.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {}, op = () => {};
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
const step = () => { for (const k in S.keys) S.keys[k] = false; S.P.inv = 1e9; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };

// 1. the functions and the switch object exist
check('GFX is a switch object with outline, ao and glow on', S.GFX && S.GFX.outline === true && S.GFX.ao === true && S.GFX.glow === true);
check('gfxOutlinePass, gfxRim, gfxAO, gfxGlow and gfxDark are functions', ['gfxOutlinePass', 'gfxRim', 'gfxAO', 'gfxGlow', 'gfxDark'].every((k) => typeof S[k] === 'function'));

// 2. a frame with everything on makes no more random draws than the same frame with everything off
{
  S.startLevel(0); S.endCeasefire(); for (let i = 0; i < 30; i++) step();
  const P = S.P, g = S.makeEnt({ type: 'grunt', c: 5, y: P.y }); g.x = P.x + 40; g.y = P.y; g.face = -1; S.ents.push(g); Object.assign(g, { aware: true, react: 0.2, huh: 0, jam: 1, zeroG: 1 });
  const dg = S.makeEnt({ type: 'dog', c: 5, y: P.y }); dg.x = P.x - 40; dg.y = P.y; S.ents.push(dg); S.render(4.9); // one warm-up frame
  const frame = (on) => { Object.assign(S.GFX, { outline: on, ao: on, glow: on }); seed = 99; draws = 0; let err = null; try { S.render(5); draws = 0; S.render(5.1); } catch (e) { err = e; } return [draws, err]; };
  frame(false); // the very first frame of a level makes some one-off draws
  const [off, e0] = frame(false), [on, e1] = frame(true), [on2] = frame(true);
  check('render with every switch on and off does not throw', !e0 && !e1, (e1 || e0) && (e1 || e0).message);
  check('switches on: no random draws beyond the switches-off frame', on === off && on2 === off, 'off ' + off + ', on ' + on + ' / ' + on2);
  let err = null; draws = 0; S.P.inv = 0; try { S.gfxOutlinePass(); S.gfxRim(); } catch (e) { err = e; }
  const onScreen = S.ents.filter((e) => !e.dead && (e.type === 'dog' || S.isQuack(e)) && e.x + e.w > S.cam.x - 32 && e.x < S.cam.x + 480 + 32).length;
  check('the outline pass (one for all characters a frame) does not throw and draws no randoms', !err && draws === 0, err ? err.message : draws + ' draws');
  check('it holds the bro and every quack and dog on screen, and nothing off screen', S.gfxN() === onScreen + 1 && onScreen >= 2 && onScreen < S.ents.length, S.gfxN() + ' drawn, ' + onScreen + ' quacks and dogs on screen of ' + S.ents.length + ' entities');
  check('the quack keeps its flags after the outline pass', g.jam === 1 && g.zeroG === 1 && g.react === 0.2);
  S.GFX.outline = false; S.gfxOutlinePass(); check('GFX.outline off: the pass draws nobody', S.gfxN() === 0); S.GFX.outline = true;
}

// 3. presence light: present normally and under DARK (which also gives the bro a lamp and is less black than a blackout), absent in a blackout
{
  Object.assign(S.GFX, { outline: true, ao: true, glow: true });
  S.startLevel(0); S.endCeasefire(); for (let i = 0; i < 30; i++) step();
  const P = S.P, g = S.makeEnt({ type: 'grunt', c: 5, y: P.y }); g.x = P.x + 40; g.y = P.y; S.ents.push(g);
  const near = () => S.gfxLights().filter((l) => !l[3] && l[2] >= 22 && l[2] <= 28 && Math.abs(l[0] - (g.x + g.w / 2)) < 1 && Math.abs(l[1] - (g.y + g.h / 2)) < 1).length;
    S.collectLights(1);   check('normal mission: a live quack on screen has a presence light', near() === 1 && !S.gfxDark());
  S.GFX.glow = false; S.collectLights(1); check('GFX.glow off: no presence light', near() === 0); S.GFX.glow = true;
  g.dead = true; S.collectLights(1); check('a dead quack has none', near() === 0); g.dead = false;
  S.startLevel(6); S.endCeasefire(); for (let i = 0; i < 120; i++) step();
  const P2 = S.P, d = S.makeEnt({ type: 'grunt', c: 5, y: P2.y }); d.x = P2.x + 40; d.y = P2.y; S.ents.push(d);
  S.collectLights(1);
  const has = S.gfxLights().some((l) => !l[3] && l[2] >= 22 && l[2] <= 28 && Math.abs(l[0] - (d.x + d.w / 2)) < 1);
  const lamp = S.gfxLights().some((l) => l[3] === S.DARK_LAMP.col && l[2] === S.DARK_LAMP.r && Math.abs(l[0] - (P2.x + 5)) < 1 && l[4] > 0.9);
  check('mission 6 (DARK): quacks keep their presence light and the bro carries his lamp (radius ' + S.DARK_LAMP.r + ')', S.modState().dark > 0.95 && !S.gfxDark() && has && lamp, 'light ' + has + ', lamp ' + lamp);
  check('DARK is less black than a blackout (' + S.DARK_AMB + ' against 0.95) and the bro\'s own light is not dimmed', Math.abs(S.evDark() - S.DARK_AMB) < 0.01 && S.DARK_AMB <= 0.85 && S.gfxLights().some((l) => l[3] === null && l[2] === 64 && l[4] > 0.5), 'evDark ' + S.evDark().toFixed(2));
  S.startLevel(0); S.endCeasefire(); for (let i = 0; i < 30; i++) step(); S.forceEvent('blackout'); for (let i = 0; i < 60; i++) step();
  const b = S.makeEnt({ type: 'grunt', c: 5, y: S.P.y }); b.x = S.P.x + 40; b.y = S.P.y; S.ents.push(b); S.collectLights(1);
  check('a blackout (the short event) stays as it was: no presence light, the bro\'s light dimmed', S.gfxDark() && !S.gfxLights().some((l) => !l[3] && l[2] >= 22 && l[2] <= 28 && Math.abs(l[0] - (b.x + b.w / 2)) < 1) && S.gfxLights().some((l) => l[3] === null && l[2] === 64 && l[4] < 0.2));
}

// 4. the AO pass stays inside the screen range and reads live tiles
{
  S.startLevel(3); S.endCeasefire(); for (let i = 0; i < 30; i++) step();
  S.gfxAO(); const A = S.GFX_AO, [c0, c1, r0, r1] = S.viewTiles();
  check('AO visits exactly the view range', A.c0 === c0 && A.c1 === c1 && A.r0 === r0 && A.r1 === r1, [A.c0, A.c1, A.r0, A.r1] + ' vs ' + [c0, c1, r0, r1]);
  check('AO range is inside the map and visits some open cells', A.c0 >= 0 && A.r0 >= 0 && A.r1 < 40 && A.c1 - A.c0 < 40 && A.n > 0 && A.n <= (c1 - c0 + 1) * (r1 - r0 + 1), A.n + ' cells');
  S.GFX.ao = false; A.n = -1; S.gfxAO(); check('GFX.ao off: nothing visited', A.n === -1); S.GFX.ao = true;
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
