// Every bro's main weapon against every boss: a bot that cannot die fights each one for 25 s with its specials off.
// It checks that every weapon can damage every boss (or its shield parts), and that no boss loses more than
// 40 hp in a single frame (a falling block or a bug, not a fight).
// Usage: node science-bros/tests/boss_fairness.js science-bros/index.html
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
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) console.log('FAIL ' + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const LIST = []; for (let l = 0; l < S.nLevels; l++) LIST.push([l, true]); LIST.push([1, false]); LIST.push([S.MOON, true]);
const step = (keys) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const solid = (v) => v !== 0 && v !== 5 && v !== 7;
let fights = 0, hurt = 0;
for (const [lvl, fin] of LIST) for (const b of S.BROS) {
  S.startLevel(lvl); S.endCeasefire(); S.finishObjectives(); step({});
  const B = S.ents.find((e) => BOSSES.includes(e.type) && !!e.final === fin);
  S.ents.forEach((e) => { if (e !== B && e.type !== 'flag') e.dead = true; });
  S.P.bro = S.BRO[b.id]; S.P.x = (B.trig + 2) * T; S.P.y = 2 * T;
  const total = () => Math.max(0, B.hp) + (B.vats || []).reduce((a, o) => a + (o.dead ? 0 : o.hp), 0);
  const start = total(); let last = start, stillT = 0, dist = 90, jumpT = 0, spike = 0;
  for (let f = 0; f < 25 * 60 && !(B.dead || B.doomed || B.dying > 0); f++) {
    S.P.inv = 1e9; S.P.spec = 0;
    const v = (B.vats || []).find((o) => !o.dead), t = v || B, tx = t.x + t.w / 2, ty = t.y + t.h / 2;
    const tot = total(); if (last - tot > 40) spike = last - tot; if (tot < last - 0.01) stillT = 0; else stillT += 1 / 60; last = tot;
    if (B.active && stillT > 3) { // stand where a player would: at the target's height, at another range
      stillT = 0; dist = [90, 50, 24, 140][([90, 50, 24, 140].indexOf(dist) + 1) % 4];
      let best = null, bs = 1e9;
      for (let c = B.ax0 || 0; c <= (B.ax1 || 60); c++) for (let r = 2; r < 21; r++) {
        if (!solid(S.tileAt(c, r)) || solid(S.tileAt(c, r - 1)) || solid(S.tileAt(c, r - 2))) continue;
        const sc = Math.abs(r * T - 8 - ty) + Math.abs(Math.abs(c * T + 8 - tx) - dist) * 0.6; if (sc < bs) { bs = sc; best = [c, r]; }
      }
      if (best) { S.P.x = best[0] * T + 3; S.P.y = best[1] * T - 15.01; S.P.vx = 0; S.P.vy = 0; }
    }
    const px = S.P.x + 5, py = S.P.y + 8, dx = tx - px, want = tx - Math.sign(dx || 1) * dist, keys = { fire: true };
    if (Math.abs(want - px) > 12) { if (want > px) keys.right = true; else keys.left = true; }
    jumpT -= 1 / 60;
    if (jumpT <= 0 && (ty < py - 20 || S.P.wall)) { S.pressed.jump = true; keys.jump = true; jumpT = 0.7; } else if (jumpT > 0.4) keys.jump = true;
    if (ty < py - 20) keys.up = true;
    step(keys);
    if (Math.abs(want - px) <= 12) S.P.face = dx >= 0 ? 1 : -1;
  }
  fights++;
  const dealt = start - total() > 0.5 || B.dead || B.doomed || B.dying > 0; if (dealt) hurt++;
  check(b.name + ' can hurt ' + (B.bossName || B.type), dealt, 'no damage in 25 s');
  check((B.bossName || B.type) + ' never loses 40 hp in one frame (' + b.name + ')', !spike, spike && spike.toFixed(0) + ' hp at once');
}
console.log(hurt + ' of ' + fights + ' bro and boss pairs: the weapon hurt the boss within 25 s');
console.log(fails ? fails + ' check(s) failed' : 'all boss fairness checks passed');
process.exit(fails ? 1 : 0);
