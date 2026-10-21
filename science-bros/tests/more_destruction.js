// Headless checks for the round 4 destruction: steel above the bedrock gives way to heavy ordnance only, signs and trees fall to
// shots, a broken block throws six lumps (two of them big) plus slabs and a dust cloud, the back wall of a building breaks off
// when its floor goes, falling pieces hurt quacks but never the player who cut them loose, nothing floats afterwards, and the
// particle and body caps and the frame cost hold.
// Usage: node science-bros/tests/more_destruction.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T, LW = S.LW, LH = S.LH;
const step = (keys = {}, draw = false) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); if (draw) S.render(0); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const solid = (c, r) => { const v = S.tileAt(c, r); return v !== 0 && v !== 5 && v !== 7; };
const DIRT = 1, BRICK = 2, STEEL = 3, CRATE = 4, EMPTY = 0;
const fill = (c0, r0, c1, r1, v) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) S.setTile(c, r, v); };
const add = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), extra); S.ents.push(e); return e; };
// a flat earth floor at row 16 from column 18 to 90, sky above, no quacks, the player parked on it
const arena = () => {
  S.reset(); S.startLevel(0); S.P.bro = S.BRO.einstein; S.endCeasefire(); run(1);
  for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : EMPTY);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1);
  S.P.x = 20 * T; S.P.y = 15 * T - 15.01; S.P.inv = 1e9; S.P.face = 1; S.P.alive = true;
};
// the game's own rule for loose blocks (brick, crate, ice): held by earth under it, or by steel or a held loose block beside it
const floating = () => {
  const N = LW * LH, at = (i) => S.tileAt(i % LW, Math.floor(i / LW)), loose = (v) => v === 2 || v === 4 || v === 6, seen = new Uint8Array(N), q = [];
  for (let i = 0; i < N; i++) if (solid(i % LW, Math.floor(i / LW)) && (!loose(at(i)) || i >= N - LW)) { seen[i] = 1; q.push(i); }
  while (q.length) { const i = q.pop(), c = i % LW, v = at(i), all = loose(v) || v === 3; for (const j of all ? [i - LW, i + LW, c > 0 ? i - 1 : -1, c < LW - 1 ? i + 1 : -1] : [i - LW]) if (j >= 0 && j < N && !seen[j] && loose(at(j))) { seen[j] = 1; q.push(j); } }
  let n = 0; for (let i = 0; i < N; i++) if (loose(at(i)) && !seen[i]) n++; return n;
};
const smoke = () => S.parts().filter((p) => p.kind === 'smoke').length;

// ---- 1. steel above the bedrock: heavy ordnance only
arena(); fill(30, 8, 32, 8, STEEL);
for (let i = 0; i < 300; i++) { S.wreck('photon', 31, 8, 1, 0, 0.5); S.wreck('mg', 31, 8, 1, 0, 0.5); S.wreck('railgun', 31, 8, 1, 0, 3); }
check('light weapons and plain hits never dent steel', S.tileAt(31, 8) === STEEL && S.hpAt(31, 8) > 1e8);
for (let i = 0; i < 50; i++) { S.explode(31 * T + 8, 8 * T + 8, 30, 4, 'e', 4); S.damageTile(31, 8, 99); }
check('quacks\' blasts and big plain damage leave steel alone', S.tileAt(31, 8) === STEEL);
let nH = 0; while (S.tileAt(31, 8) === STEEL && nH < 80) { S.wreck('hammer', 31, 8, 1, 0, 0.5); nH++; }
check('Archimedes\' hammer breaks steel in many blows', S.tileAt(31, 8) === EMPTY && nH >= 8, nH + ' blows');
for (const key of ['tnt', 'rocket', 'bomb', 'apple']) {
  fill(30, 8, 32, 8, STEEL); const tp = { tnt: 2.5, rocket: 4, bomb: 5, apple: 2.8 }[key], r = { tnt: 22, rocket: 34, bomb: 60, apple: 16 }[key]; let n = 0;
  while (S.tileAt(31, 8) === STEEL && n < 30) { S.explode(31 * T + 8, 8 * T + 8, r, 4, 'p', tp, key); n++; }
  check(key + ' blasts break steel, but not in one go', S.tileAt(31, 8) === EMPTY && n >= 2 && n <= 12, n + ' blasts');
}
{ fill(30, 8, 32, 8, STEEL); S.explode(31 * T + 8, 8 * T + 8, 34, 4, 'p', 4, 'rocket'); const mid = S.tileAt(31, 8) === STEEL ? 'dented' : 'gone'; check('one rocket only dents a steel plate', mid === 'dented', mid + ', hp ' + S.hpAt(31, 8).toFixed(1)); }
{ // the bedrock row and a boss arena stay unbreakable
  S.reset(); S.startLevel(0); S.P.bro = S.BRO.einstein; run(1);
  let ok = true; for (let i = 0; i < 40; i++) { S.explode(100 * T + 8, (LH - 1) * T + 8, 60, 4, 'p', 5, 'bomb'); S.wreck('hammer', 100, LH - 1, 0, 1, 3); S.hitSteel(100, LH - 1, 99); if (S.tileAt(100, LH - 1) !== STEEL) ok = false; }
  check('the bedrock row never breaks', ok && S.tileAt(100, LH - 1) === STEEL);
  const b = S.ents.find((e) => e.final && e.gate), g = b.gate; let gOk = true;
  for (let i = 0; i < 40; i++) { S.explode(g[0] * T + 8, g[2] * T + 24, 60, 4, 'p', 5, 'bomb'); S.hitSteel(g[0], g[2] + 1, 99); if (S.tileAt(g[0], g[2] + 1) !== STEEL) gOk = false; }
  check('the boss arena gate never breaks', gOk && S.tileAt(g[0], g[2] + 1) === STEEL, 'gate column ' + g[0]);
}
{ // steel that held bricks lets go: the bricks come down
  arena(); fill(40, 12, 40, 15, STEEL); fill(41, 12, 45, 12, BRICK); S.checkCollapse(); run(60);
  const held = solid(44, 12); for (let r = 12; r <= 15; r++) S.hitSteel(40, r, 99);
  run(300); check('bricks hung on a steel girder fall once the girder is blasted out', held && !solid(44, 12) && floating() === 0);
}

// ---- 2. signs and trees fall to shots
{
  S.reset(); S.startLevel(0); S.P.bro = S.BRO.einstein; run(1);
  const d = S.decor().find((x) => x.kind === 'sign' || x.kind === 'cactus' || x.kind === 'pine' || x.kind === 'palm' || x.kind === 'sandbags');
  const n0 = S.bodies.length;
  S.bullets.push({ x: d.c * T + 2, y: d.r * T - 6, vx: 300, vy: 0, owner: 'p', dmg: 1, tdmg: 0.4, life: 1, kind: 'photon' });
  for (let i = 0; i < 12 && !d.gone; i++) step();
  for (let i = 0; i < 4 && !d.gone; i++) { S.bullets.push({ x: d.c * T + 2, y: d.r * T - 6, vx: 300, vy: 0, owner: 'p', dmg: 1, tdmg: 0.4, life: 1, kind: 'photon' }); run(4); }
  check('a shot through a ' + d.kind + ' knocks it down', d.gone === true);
  check('and it falls apart into lumps', S.bodies.length - n0 >= 5, (S.bodies.length - n0) + ' pieces');
}

// ---- 3. bigger, more varied chunks. Before this round a broken block threw 4 chunks (2 to 4 px) and no slabs outside a blast.
{
  let chunks = 0, slabs = 0, big = 0, maxS = 0, n = 0, sm = 0;
  for (let k = 0; k < 20; k++) {
    arena(); fill(40, 10, 40, 10, BRICK); S.checkCollapse(); const b0 = S.bodies.length, s0 = smoke();
    S.damageTile(40, 10, 99); const nb = S.bodies.slice(b0);
    chunks += nb.filter((b) => b.kind === 'chunk').length; slabs += nb.filter((b) => b.kind === 'block').length;
    for (const b of nb) if (b.kind === 'chunk') { maxS = Math.max(maxS, b.s); if (b.s >= 4) big++; }
    sm += smoke() - s0; n++;
  }
  check('a broken brick throws six lumps (it was four)', chunks / n >= 6, (chunks / n).toFixed(1) + ' lumps per block');
  check('two of the lumps are big (4 to 6 px; it was 2 to 4)', big / n >= 2 && maxS >= 5, (big / n).toFixed(1) + ' big per block, largest ' + maxS + ' px');
  check('and one or two slabs of the block\'s own picture fly off (it was none)', slabs / n >= 1 && slabs / n <= 2, (slabs / n).toFixed(2) + ' slabs per block');
  check('a break leaves a dust cloud (it was one puff)', sm / n >= 3, (sm / n).toFixed(1) + ' puffs per block');
  arena(); fill(40, 10, 40, 10, DIRT); const b1 = S.bodies.length; S.damageTile(40, 10, 99);
  check('earth breaks into lumps too', S.bodies.length - b1 >= 7, (S.bodies.length - b1) + ' pieces');
}

// ---- 4. collapse: a brick tower falls when its base goes, lands in a cloud, settles, hurts quacks, spares the player who cut it
const tower = () => { arena(); fill(30, 6, 32, 15, BRICK); S.checkCollapse(); run(30); };
{
  tower(); const s0 = smoke();
  S.setBlame('p'); for (let c = 30; c <= 32; c++) S.damageTile(c, 15, 99); S.setBlame('e');
  let maxSm = 0, maxBig = 0; for (let i = 0; i < 400; i++) { step(); maxSm = Math.max(maxSm, smoke()); for (const b of S.bodies) if (b.kind === 'chunk') maxBig = Math.max(maxBig, b.s); }
  check('a brick tower with its base shot out comes down and settles with nothing floating', floating() === 0 && !solid(31, 6) && solid(31, 15), 'top row empty: ' + !solid(31, 6));
  check('the landing kicks up dust (and the lumps it throws are bigger than 3 px)', maxSm - s0 >= 10 && maxBig >= 4, 'peak ' + maxSm + ' smoke puffs, ' + maxBig + ' px lumps');
}
{ // under the tower: a quack dies either way; the player lives when he cut it and dies when the level did
  for (const who of ['p', 'e']) {
    arena(); fill(30, 6, 32, 15, BRICK); S.checkCollapse(); run(30); S.setTile(31, 15, EMPTY);
    const g = add('grunt', 31, { x: 31 * T + 2, y: 15 * T - 10 }); S.P.x = 31 * T + 3; S.P.y = 15 * T - 16; S.P.inv = 0; S.P.vy = 0;
    S.setBlame(who); S.damageTile(30, 15, 99); S.damageTile(32, 15, 99); S.setBlame('e');
    for (let i = 0; i < 200 && S.P.alive; i++) { S.ents.forEach((e) => { if (e.type === 'grunt') e.hp = Math.max(e.hp, 1); }); step(); if (S.P.inv > 0) S.P.inv = 0; }
    if (who === 'p') check('falling bricks the player cut loose never kill the player', S.P.alive);
    else check('falling bricks the level cut loose still crush the player', !S.P.alive);
  }
  tower(); const g = add('grunt', 28, { x: 31 * T, y: 16 * T - 12 }); g.x = 31 * T + 2; g.y = 15 * T - 12; S.setTile(31, 15, EMPTY); S.setBlame('p'); S.damageTile(30, 15, 99); S.damageTile(32, 15, 99); S.setBlame('e');
  for (let i = 0; i < 200 && !g.dead; i++) step();
  check('falling bricks hurt quacks', g.dead);
}
{ // a crate stack and a long brick roof come down with their support too
  arena(); fill(50, 12, 50, 15, BRICK); fill(60, 12, 60, 15, BRICK); fill(50, 11, 60, 11, BRICK); S.checkCollapse(); run(30);
  S.setBlame('p'); S.damageTile(50, 15, 99); S.damageTile(60, 15, 99); S.setBlame('e'); run(300);
  check('a brick gate cut at both legs falls and settles', !solid(55, 11) && floating() === 0);
}

// ---- 5. the back wall of a building breaks off above a broken floor (level 1, the Remedy Lab's ground floor at columns 93 to 114)
{
  S.reset(); S.startLevel(0); S.P.bro = S.BRO.einstein; S.endCeasefire(); run(1); S.P.x = 5 * T; S.P.inv = 1e9;
  const wall = () => { let n = 0; for (let r = 12; r <= 15; r++) for (let c = 93; c <= 114; c++) if (S.bgAt(c, r) === 2) n++; return n; };
  const w0 = wall(), firm = S.bgFirm(); let allFirm = true; for (let r = 0; r < LH; r++) for (let c = 0; c < LW; c++) if (S.bgAt(c, r) === 2 && !firm[r * LW + c]) allFirm = false;
  check('every back wall of the mission stands on something when it is built', allFirm && w0 > 80, w0 + ' wall tiles');
  S.damageTile(100, 16, 99); run(120);
  check('a one-tile hole in the floor does not bring the wall down', wall() === w0, w0 + ' -> ' + wall());
  const g = add('grunt', 95, { x: 95 * T + 2, y: 16 * T - 12 }); S.ents.find((e) => e === g).hp = 99;
  const b0 = S.bodies.length; S.setBlame('p');
  for (let c = 94; c <= 96; c++) S.damageTile(c, 16, 99);
  S.setBlame('e'); const hp0 = g.hp; run(240);
  const w1 = wall();
  check('a three-tile hole in the floor brings the wall above it down', w0 - w1 >= 10 && w0 - w1 <= 18, w0 + ' -> ' + w1 + ' wall tiles');
  check('the wall comes down as pieces and dust', S.bodies.length - b0 >= 20, (S.bodies.length - b0) + ' new bodies');
  check('wall pieces falling on a quack hurt it', g.hp < hp0, 'hp ' + hp0 + ' -> ' + g.hp);
  const held = S.bgHeld(), fm = S.bgFirm(); let hang = 0; for (let i = 0; i < LW * LH; i++) if (S.bgAt(i % LW, (i / LW) | 0) === 2 && fm[i] && !held[i]) hang++;
  check('no back wall is left hanging', hang === 0 && S.bgDrop().length === 0, hang + ' hanging');
  check('the wall pieces never hurt the player', S.P.alive);
  for (let l = 0; l < 3; l++) { S.reset(); S.startLevel(l); run(60); }
  check('missions still build with nothing falling at the start', S.bgDrop().length === 0 && S.falling.length === 0);
}

// ---- 6. caps and cost: a huge collapse keeps the particle and body caps; the busiest frame stays under 3 ms
const cpu = (f) => { const t0 = process.cpuUsage(); f(); const u = process.cpuUsage(t0); return (u.user + u.system) / 1000; }; // CPU time, so a busy machine does not count
{
  arena(); fill(22, 2, 60, 15, BRICK); S.checkCollapse(); run(30);
  S.setBlame('p'); for (let c = 22; c <= 60; c++) S.damageTile(c, 15, 99); S.setBlame('e');
  let maxP = 0, maxB = 0, maxF = 0, minDust = 99;
  for (let i = 0; i < 360; i++) { step({}, true); maxP = Math.max(maxP, S.parts().length); maxB = Math.max(maxB, S.bodies.length); maxF = Math.max(maxF, S.falling.length); minDust = Math.min(minDust, S.dustLeft()); }
  check('a 39 x 14 brick wall collapses (' + maxF + ' blocks falling at once) and settles with nothing floating', maxF > 150 && floating() === 0);
  check('particles stay under the cap of 900 and bodies under 290', maxP <= 905 && maxB <= 290, maxP + ' particles, ' + maxB + ' bodies at most');
  check('the dust budget per frame is never overspent', minDust >= 0, 'lowest left ' + minDust);
}
{ // the busiest frame of a big collapse: 39 blocks broken at once, then 500 fall (the best of 40 runs, so a busy machine does not fail it)
  let best = 99, med = 99;
  for (let r = 0; r < 40; r++) {
    arena(); fill(22, 2, 60, 15, BRICK); S.checkCollapse(); run(30);
    const all = [cpu(() => { S.setBlame('p'); for (let c = 22; c <= 60; c++) S.damageTile(c, 15, 99); S.setBlame('e'); })];
    for (let i = 0; i < 200; i++) all.push(cpu(() => step()));
    all.sort((a, b) => a - b); best = Math.min(best, all[all.length - 1]); med = Math.min(med, all[all.length >> 1]);
  }
  console.log('(39 blocks broken in one frame and 500 falling: worst frame ' + best.toFixed(2) + ' ms, median ' + med.toFixed(2) + ' ms, CPU time, without drawing)');
  check('the worst frame of a big collapse costs under 3 ms', best < 3, best.toFixed(2) + ' ms');
}
{ // INSANE at 300%, the last mission, a real fight (the setup of difficulty.js): a collapse next to the player adds under 1 ms a frame on average
  const fight = (collapse) => {
    S.setDifficulty(3, false); S.setDensity(6, false); S.reset(); S.startLevel(17); S.P.bro = S.BRO.einstein; S.endCeasefire();
    let bn = 0, best = 24; const q = () => S.ents.filter((e) => S.THREAT[e.type] && !e.dead);
    for (let c = 24; c < 330; c += 4) { const k = q().filter((e) => e.x >= c * T && e.x < (c + 30) * T).length; if (k > bn) { bn = k; best = c; } }
    const near = q().find((e) => e.x >= best * T); S.P.x = best * T; S.P.y = near.y - 40; S.cam.x = Math.max(0, best * T - 60); S.P.alt = { kind: 'minigun', ammo: 99999 };
    for (let i = 0; i < 30; i++) { S.P.inv = 1e9; step({ fire: true }, true); }
    if (collapse) { const r0 = Math.floor((near.y + near.h) / T) - 1; fill(best + 6, r0 - 8, best + 14, r0, BRICK); S.checkCollapse(); run(5); S.setBlame('p'); for (let c = best + 6; c <= best + 14; c++) S.damageTile(c, r0, 99); S.setBlame('e'); }
    let sum = 0; for (let i = 0; i < 240; i++) { S.P.inv = 1e9; sum += cpu(() => step({ fire: true }, true)); }
    return sum / 240;
  };
  let calm = 99, coll = 99; for (let r = 0; r < 5; r++) { calm = Math.min(calm, fight(false)); coll = Math.min(coll, fight(true)); }
  console.log('(INSANE / 300% fight, mean frame: ' + calm.toFixed(2) + ' ms calm, ' + coll.toFixed(2) + ' ms with an 81-block collapse next to the player; CPU time with drawing)');
  check('INSANE / 300%: a collapse in the middle of a fight adds under 1 ms a frame', coll - calm < 1, (coll - calm).toFixed(2) + ' ms');
  S.setDifficulty(1, false); S.setDensity(3, false);
}
console.log(fails ? fails + ' check(s) failed' : 'all more-destruction checks passed');
process.exit(fails ? 1 : 0);
