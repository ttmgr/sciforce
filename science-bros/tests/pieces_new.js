// Headless checks for the variety pack: new level pieces, new boss arenas, and the theme-aware stretch.
// Usage: node science-bros/tests/pieces_new.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const L0 = S.levelDef(0), build0 = L0.build, pad0 = L0.pad;
// build mission 0 with our own layout instead: flat ground, the thing under test at column 20, the old flat arena behind it
const withBuild = (fn, padSpec) => { L0.build = fn; if (padSpec) L0.pad = padSpec; S.startLevel(0); S.endCeasefire(); S.P.bro = S.BRO.einstein; step(); L0.build = build0; };
const solid = (c, r) => S.isSolidT(S.tileAt(c, r));
const A = 20; // the piece starts here

// ---- pieces
const kinds = Object.keys(S.NEW_PIECES);
check('at least 10 new pieces are defined', kinds.length >= 10, kinds.length + ' pieces');
check('every new piece exists in SEG and has a width range and themes', kinds.every((k) => typeof S.SEG[k] === 'function' && S.NEW_PIECES[k].w.length === 2 && S.NEW_PIECES[k].w[0] <= S.NEW_PIECES[k].w[1] && S.NEW_PIECES[k].themes.length > 0 && S.NEW_PIECES[k].themes.every((t) => S.THEMES[t])));
for (const kind of kinds) for (const w of [...new Set(S.NEW_PIECES[kind].w)]) {
  const tag = kind + ' (' + w + ' wide)';
  withBuild((H) => { H.ground(0, A - 1, 16); S.SEG[kind](H, A, w, {}); H.ground(A + w, 175, 16); S.ARENA.flat(H, { boss: 'boss' }); });
  check(tag + ': builds with nothing loose and unsupported', S.checkCollapse() === 0);
  // nothing spawns inside a wall
  const inWall = S.ents.filter((e) => e.type !== 'flag' && e.x >= A * T && e.x < (A + w) * T).filter((e) => {
    for (let r = Math.floor((e.y + 0.5) / T); r <= Math.floor((e.y + e.h - 0.5) / T); r++) for (let c = Math.floor((e.x + 0.5) / T); c <= Math.floor((e.x + e.w - 0.5) / T); c++) if (solid(c, r)) return true;
    return false;
  });
  check(tag + ': nothing spawns inside a wall', inWall.length === 0, inWall.map((e) => e.type + '@' + Math.floor(e.x / T) + ',' + Math.floor(e.y / T)).join(' '));
  // no steel ceiling low over the walkway (rows 13 to 15 with open air under them and a floor close below)
  const low = [];
  for (let c = A; c < A + w; c++) for (let r = 13; r <= 15; r++) if (S.tileAt(c, r) === 3 && !solid(c, r + 1)) { let f = r + 1; while (f < 21 && !solid(c, f)) f++; if (f - r <= 3) low.push(c + ',' + r); }
  check(tag + ': no steel overhangs the walkway', low.length === 0, low.slice(0, 6).join(' '));
  check(tag + ': ground meets the neighbours at row 16', solid(A - 1, 16) && solid(A + w, 16) && !solid(A - 1, 15) && !solid(A + w, 15) || S.tileAt(A + w, 15) === 7);
  // an invulnerable bot (right + jump + fire) crosses it in 40 s
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; });
  S.P.x = (A - 6) * T; S.P.y = 14 * T; S.P.vx = 0; S.P.vy = 0; S.P.alive = true; let far = 0, i = 0;
  for (; i < 40 * 60 && far < A + w + 3; i++) {
    if (i % 25 === 0) S.pressed.jump = true;
    S.P.inv = 1e9; S.P.alive = true;
    step({ right: true, jump: i % 25 < 14, fire: i % 6 < 3 });
    far = Math.max(far, S.P.x / T);
  }
  check(tag + ': a simple bot crosses it', far >= A + w + 3, 'reached col ' + far.toFixed(0) + ' of ' + (A + w + 3) + ' in ' + (i / 60).toFixed(1) + ' s');
}

// ---- the stretch picks from the wider pool
const seen = {}, orig = {};
for (const k of kinds) { orig[k] = S.SEG[k]; S.SEG[k] = (H, c, w, o) => { seen[k] = (seen[k] || 0) + 1; cur.add(k); return orig[k](H, c, w, o); }; }
let cur = new Set(); const used = new Set();
for (const l of [...Array(S.nLevels).keys(), S.MOON]) {
  cur = new Set(); S.startLevel(l); S.endCeasefire(); step();
  const th = S.levelDef(l).theme, fit = kinds.filter((k) => S.NEW_PIECES[k].themes.includes(th));
  check(S.levelDef(l).name + ': the stretch uses new pieces that fit the ' + th + ' theme', cur.size >= 1 && [...cur].every((k) => fit.includes(k)), [...cur].join(', '));
  cur.forEach((k) => used.add(k));
  check(S.levelDef(l).name + ': the boss arena is still in place', S.isStretched() && S.boss && S.boss.ax0 >= S.cutAt() + S.STRETCH);
}
for (const k of kinds) S.SEG[k] = orig[k];
check('every new piece turns up in some mission', used.size === kinds.length, used.size + ' of ' + kinds.length + ' used; missing ' + kinds.filter((k) => !used.has(k)).join(', '));

// ---- arenas
const arenas = Object.keys(S.NEW_ARENAS);
check('at least 3 new arenas are defined', arenas.length >= 3, arenas.join(', '));
for (const kind of arenas) {
  check(kind + ': it exists and lists boss types', typeof S.ARENA[kind] === 'function' && S.NEW_ARENAS[kind].bosses.length >= 2 && S.NEW_ARENAS[kind].bosses.every((b) => BOSSES.includes(b)), S.NEW_ARENAS[kind].bosses.join(', '));
  for (const boss of S.NEW_ARENAS[kind].bosses) {
    L0.pad = pad0;
    const tag = kind + ' + ' + boss, padRow = kind === 'quarry' ? 12 : 16;
    withBuild((H) => { H.ground(0, 175, 16); S.ARENA[kind](H, { kind, boss }); }, [231, padRow]);
    const B = S.boss, g = B && B.gate;
    check(tag + ': the boss spawns, final, with its zone', !!B && B.type === boss && B.final && B.ax0 >= S.STRETCH + 176 && !B.active);
    check(tag + ': the gate is steel and the pad is solid and flat', !!g && [g[0], g[1]].every((c) => { for (let r = g[2]; r <= g[3]; r++) if (S.tileAt(c, r) !== 3) return false; return true; }) && solid(S.padOf()[0], padRow) && !solid(S.padOf()[0], padRow - 1), 'pad ' + S.padOf());
    // walk in: the boss wakes
    S.ents.forEach((e) => { if (e.type !== 'flag' && e !== B) e.dead = true; });
    S.P.x = (B.trig - 5) * T; S.P.y = 2 * T; S.P.vx = 0; S.P.vy = 0; S.P.alive = true; let woke = -1, err = '';
    try {
      for (let i = 0; i < 12 * 60; i++) { S.P.inv = 1e9; S.P.alive = true; step({ right: i < 200 }); if (woke < 0 && B.active) woke = i; }
    } catch (e) { err = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    check(tag + ': it wakes when you walk in and runs 12 s without errors', woke >= 0 && !err, err || 'woke at frame ' + woke);
  }
}

L0.build = build0; L0.pad = pad0;
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
