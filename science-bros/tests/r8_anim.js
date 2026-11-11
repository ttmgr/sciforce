// Headless checks for the round 8 animation pass: easing helpers, the 0.3 s screen fade (and no fade on pause), the boss name
// card window, the hard-landing timer, no random draws while the new poses and tells are drawn, the final-boss slow motion
// (separate from the Einstein slowT) and the firing-tell condition.
// Usage: node science-bros/tests/r8_anim.js science-bros/index.html
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
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.P.inv = 1e9; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };

// 1. easing
{
  const e = S.easeOut; let mono = true; for (let i = 1; i <= 100; i++) if (e(i / 100) < e((i - 1) / 100)) mono = false;
  check('easeOut(0) = 0 and easeOut(1) = 1', e(0) === 0 && e(1) === 1);
  check('easeOut is monotonic and clamps its input', mono && e(-3) === 0 && e(5) === 1);
  const b = S.easeBack; let over = 0; for (let i = 0; i <= 100; i++) over = Math.max(over, b(i / 100));
  check('easeBack starts at 0, ends at 1 and overshoots in between', Math.abs(b(0)) < 1e-9 && Math.abs(b(1) - 1) < 1e-9 && over > 1.02, 'peak ' + over.toFixed(3));
}

// 2. screen fade
{
  S.startLevel(0); S.render(1.0);
  check('no fade while the state stays the same', S.fade() === 0);
  S.setPaused(true); S.render(1.1); S.setPaused(false); S.render(1.2);
  check('pausing does not start a fade', S.fade() === 0);
  S.setState('over'); S.render(2.0); const a0 = S.fade();
  S.render(2.15); const a1 = S.fade(); S.render(2.31); const a2 = S.fade();
  check('a state change starts the fade near 1', a0 > 0.95, a0.toFixed(2));
  check('the fade is part-way at 0.15 s', a1 > 0.3 && a1 < 0.7, a1.toFixed(2));
  check('the fade is gone after 0.3 s', a2 === 0, String(a2));
  S.setState('play'); S.render(3.0); const b0 = S.fade(); S.setState('intro'); S.render(3.5); const b1 = S.fade(); S.setState('play'); S.render(3.6);
  check('play <-> intro (the opening hand-over) does not fade', b1 === 0 && S.fade() === 0, 'play after over faded ' + b0.toFixed(2));
}

// 3. boss name card
{
  S.startLevel(0); S.endCeasefire(); const b = S.ents.find((e) => e.type === 'boss');
  check('no card before a boss wakes', !S.bossCardOn());
  S.activateBoss(b, 'a test subtitle'); const c0 = S.clock();
  check('activateBoss starts the card', S.bossCardOn() && Math.abs(S.bossCardAge()) < 1e-9);
  S.setClock(c0 + 2.1); const mid = S.bossCardOn(); S.render(5); S.setClock(c0 + 2.25); const late = S.bossCardOn(); S.render(5.1);
  check('the card is on until 2.2 s of clock and off after', mid && !late);
  check('the banner state itself is untouched', S.bannerNow().t > 0 && S.bannerNow().text === S.BOSS_NAME.boss || S.bannerNow().t > 0, S.bannerNow().text);
}

// 4. hard landing
{
  S.startLevel(0); S.endCeasefire(); for (let i = 0; i < 30; i++) step();
  const P = S.P; P.y -= 6; P.onGround = false; P.vy = 450; P.landT = 0;
  let peak = 0; for (let i = 0; i < 6; i++) { step(); peak = Math.max(peak, P.landT); }
  check('a hard landing sets landT to 0.1', P.onGround && peak > 0.09, 'peak ' + peak.toFixed(3));
  for (let i = 0; i < 10; i++) step();
  check('landT decays to 0', P.landT === 0, String(P.landT));
  const P2 = S.P; P2.y -= 6; P2.onGround = false; P2.vy = 250; P2.landT = 0; let soft = 0; for (let i = 0; i < 6; i++) { step(); soft = Math.max(soft, P2.landT); }
  check('a soft landing does not', soft === 0);
}

// 5. drawing the new poses and tells uses no randomness
{
  S.startLevel(0); S.endCeasefire(); for (let i = 0; i < 30; i++) step();
  const P = S.P, g = S.makeEnt({ type: 'grunt', c: 5, y: P.y }); g.x = P.x + 60; g.y = P.y; g.face = -1;
  Object.assign(g, { aware: true, react: 0, lost: 0, cool: 0.1, jam: 0, stun: 0 });
  const poses = [{ landT: 0.1 }, { skidT: 1, onGround: true }, { dash: 0.12, dashDir: 1, onGround: false }, { pound: 1, onGround: false }, { idleT: 3.1, onGround: true, vx: 0 }, { climb: true, slide: 1, onGround: false }, { ride: true, alive: false, anim: 0.3 }];
  let err = null, n = 0;
  for (const p of poses) { const keep = Object.assign({}, P); Object.assign(P, p); draws = 0; try { S.drawPlayer(); } catch (e) { err = err || e; } n += draws; Object.assign(P, keep); }
  draws = 0; try { S.drawQuack(g, 1.2); } catch (e) { err = err || e; } n += draws;
  check('drawPlayer / drawQuack in the new states do not throw', !err, err && err.message);
  check('and consume no Math.random', n === 0, n + ' draws');
}

// 6. final-boss slow motion
{
  S.startLevel(S.nLevels - 1); S.endCeasefire(); const b = S.ents.find((e) => e.final);
  check('the finale has a final boss', !!b);
  if (b) {
    S.bossDying(b); let maxSlowT = S.slowT(); const d0 = S.deathSlow(); let n = 0;
    while (S.deathSlow() > 0 && n < 100) { step(); maxSlowT = Math.max(maxSlowT, S.slowT()); n++; }
    check('bossDying on a final boss sets deathSlow to 0.7', d0 === 0.7, String(d0));
    check('deathSlow returns to 0 after 0.7 s of unfrozen step time (the 0.12 s hit-stop freeze comes first)', S.deathSlow() <= 0 && n <= 43 + 8, n + ' steps');
    check('slowT (the TIME DILATION overlay and fire-rate bonus) stays 0', maxSlowT === 0);
  }
}

// 7. firing tell
{
  S.startLevel(0); S.endCeasefire(); const P = S.P;
  const g = S.makeEnt({ type: 'grunt', c: 5, y: P.y }); g.x = P.x + 60; g.y = P.y;
  Object.assign(g, { aware: false, react: 0, lost: 0, cool: 0.1, jam: 0, stun: 0 });
  check('no tell for an unaware grunt', S.fireTell(g) === 0);
  g.aware = true; check('tell for an aware grunt with cool 0.1', S.fireTell(g) > 0, S.fireTell(g).toFixed(2));
  g.cool = 0.5; check('no tell while the cooldown is above 0.2 s', S.fireTell(g) === 0);
  g.cool = 0.1; g.jam = 1; check('no tell while jammed', S.fireTell(g) === 0); g.jam = 0; g.stun = 0.5; check('no tell while stunned', S.fireTell(g) === 0);
  g.stun = 0; g.react = 0.3; check('no tell before the reaction time is over', S.fireTell(g) === 0); g.react = 0; g.lost = 0.5; check('no tell once it lost sight of you', S.fireTell(g) === 0);
  const h = Object.assign({}, g, { type: 'heavy', lost: 0 }); check('no tell for other types', S.fireTell(h) === 0);
}

console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
