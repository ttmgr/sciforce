// Headless checks for the Think Tank (the drivable tank, entity 'tanksuit', P.mech.kind 'tank'): boarding with the THINK TANK banner,
// 40 hp and the hp bar, slower than the walker, driving over small quacks, a one-tile step climbed, a two-tile earth wall rammed through and a steel one not, a three-tile jump, no
// ladders, the cannon shell that explodes and breaks blocks, the same exit keys as the walker, getting out when wedged against a wall, the
// walker unchanged, the eight placed tanks (each on flat ground, reachable on foot from the start by a static walk graph), and random maps.
// Usage: node science-bros/tests/think_tank.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
let rec = false, ops = [];
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); if (k === 'fillRect' && rec) return (x, y, w, h) => ops.push([t.fillStyle, x, y, w, h]); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, localStorage: { getItem: () => null, setItem: noop }, navigator: { getGamepads: () => [] }, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const DIRT = 1, BRICK = 2, STEEL = 3, LADDER = 7;
const run = (n, held = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, held); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; } };
const tap = (k) => { S.keys[k] = true; S.pressed[k] = true; S.step(1 / 60); S.keys[k] = false; for (const q in S.pressed) S.pressed[q] = false; };
// a flat floor at row 16 over columns 0-119, the bro mortal-proof, nothing else alive
const flat = () => {
  S.startLevel(0); S.endCeasefire(); run(1);
  for (let c = 0; c < 130; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : 0);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.bullets.length = 0; S.plants.length = 0; S.critters.length = 0;
  S.P.bro = S.BROS[0]; S.P.x = 10 * T; S.P.y = 16 * T - S.P.h - 0.01; S.P.vx = 0; S.P.vy = 0; S.P.inv = 1e9; S.P.mech = null; S.P.w = 10; S.P.h = 15; run(2);
};
const addSuit = (type, c) => { const e = S.makeEnt({ type, c, from: 0 }); S.ents.push(e); return e; };
const enter = (type = 'tanksuit', col = 14) => { flat(); const s = addSuit(type, col); run(2); for (let i = 0; i < 200 && !S.P.mech; i++) run(1, { right: true }); S.keys.right = false; return s; };
const live = (type) => S.ents.filter((e) => e.type === type && !e.dead);
const speedOf = (type) => { enter(type); const x0 = S.P.x; run(60, { right: true }); return S.P.x - x0; };

// ---------------------------------------------------------------- 1. boarding
enter('tanksuit');
check('walking into a tanksuit boards it as a tank', !!S.P.mech && S.P.mech.kind === 'tank' && live('tanksuit').length === 0);
check('the banner reads THINK TANK', S.bannerNow().text === 'THINK TANK' && S.bannerNow().t > 1, S.bannerNow().text);
check('40 hp (the walker has 24)', S.P.mech.hp === 40 && S.P.mech.max === 40);
{ const walker = speedOf('mechsuit'), tank = speedOf('tanksuit'); check('it is slower than the walker', tank > 20 && tank < walker * 0.75, tank.toFixed(0) + ' px/s against ' + walker.toFixed(0)); }
{ enter('tanksuit'); rec = true; ops = []; S.render(0); rec = false;
  const bar = ops.filter((o) => o[2] === 31 && o[3] === 60 * S.P.mech.hp / S.P.mech.max); check('the hp bar is drawn full', bar.length >= 1, ops.filter((o) => o[2] === 31).map((o) => o[3].toFixed(0)).join(','));
  S.P.mech.hp = 10; rec = true; ops = []; S.render(0); rec = false; const half = ops.filter((o) => o[2] === 31 && Math.abs(o[3] - 15) < 0.01); check('and shrinks with the damage (10 of 40 hp = 15 px)', half.length >= 1); }
{ enter('tanksuit'); S.P.inv = 0; const d0 = S.stats.deaths; S.killPlayer('shot'); check('a shot costs 1 hp and does not kill him', S.P.mech && S.P.mech.hp === 39 && S.stats.deaths === d0);
  S.P.inv = 0; S.killPlayer('crush'); check('a crush destroys the tank, not the bro', !S.P.mech && S.P.alive); }

// ---------------------------------------------------------------- 2. driving
{ enter(); const g = S.makeEnt({ type: 'grunt', c: 24, from: 0 }); g.react = 99; g.cool = 99; S.ents.push(g); S.P.x = 18 * T; S.P.mech.hp = 40;
  for (let i = 0; i < 200 && !g.dead; i++) { g.cool = 99; run(1, { right: true }); }
  check('driving over a small quack kills it', g.dead && S.P.mech && S.P.mech.hp === 40, 'tank hp ' + (S.P.mech && S.P.mech.hp)); }
{ enter(); for (let c = 24; c < 60; c++) S.setTile(c, 15, DIRT); S.P.x = 18 * T; run(2); const y0 = S.P.y; for (let i = 0; i < 200 && S.P.x < 27 * T; i++) run(1, { right: true });
  check('it climbs a one-tile step', S.P.x > 26 * T && Math.abs(S.P.y - (y0 - T)) < 1, 'x ' + (S.P.x / T).toFixed(1) + ', rise ' + ((y0 - S.P.y) / T).toFixed(2)); }
{ enter(); for (let c = 24; c < 60; c++) { S.setTile(c, 15, DIRT); S.setTile(c, 14, DIRT); } S.P.x = 18 * T; run(2); for (let i = 0; i < 300; i++) run(1, { right: true });
  check('a two-tile earth wall is rammed through (round 9)', S.P.x > 27 * T && S.P.y > 16 * T - S.P.h - 2 && S.tileAt(25, 15) === 0 && S.tileAt(25, 14) === 0, 'x ' + (S.P.x / T).toFixed(1)); }
{ enter(); for (let c = 24; c < 60; c++) { S.setTile(c, 15, STEEL); S.setTile(c, 14, STEEL); } S.P.x = 18 * T; run(2); for (let i = 0; i < 300; i++) run(1, { right: true });
  check('a two-tile steel wall stops it', S.P.x + S.P.w <= 24 * T + 0.1 && S.P.y > 16 * T - S.P.h - 2 && S.tileAt(24, 15) === STEEL, 'x ' + (S.P.x / T).toFixed(1)); }
{ enter(); const y0 = S.P.y; let top = y0; for (let i = 0; i < 60; i++) { S.keys.jump = true; S.pressed.jump = i % 20 === 0; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; top = Math.min(top, S.P.y); } S.keys.jump = false;
  check('it jumps about three tiles (round 9)', y0 - top > 40 && y0 - top < 56, (y0 - top).toFixed(1) + ' px'); }
{ enter(); for (let r = 8; r <= 15; r++) S.setTile(S.P.x / T + 3 | 0, r, LADDER); const x0 = S.P.x; S.P.x = ((S.P.x / T + 3) | 0) * T - 10; run(2); const y0 = S.P.y; for (let i = 0; i < 60; i++) run(1, { up: true, right: true }); 
  check('it cannot climb a ladder', S.P.y >= y0 - 1 && !S.P.climb, (y0 - S.P.y).toFixed(1) + ' px up'); }
{ enter(); S.setTile(24, 14, BRICK); S.setTile(24, 15, BRICK); S.P.x = 18 * T; run(2); for (let i = 0; i < 300; i++) run(1, { right: true });
  check('it rams a brick wall down by driving at it (round 9)', S.tileAt(24, 15) === 0 && S.tileAt(24, 14) === 0 && S.P.x > 25 * T, 'x ' + (S.P.x / T).toFixed(1)); }
// round 9: both suits break blocks faster. Frames from first contact with a 3-column brick wall until the suit is past it; the roof of a jumping suit breaks an earth ceiling; a hard landing breaks the floor
{ const through = (type, wall) => { enter(type); if (wall) for (let c = 24; c < 27; c++) for (let r = 12; r <= 15; r++) S.setTile(c, r, BRICK); S.P.x = 22 * T - S.P.w; run(2); let n = 0; while (n < 900 && S.P.x < 27 * T) { run(1, { right: true }); n++; } return n; };
  const nt = through('tanksuit', true) - through('tanksuit', false), nw = through('mechsuit', true) - through('mechsuit', false);
  check('three columns of brick cost the tank under 1 s more than open ground', nt > 0 && nt < 60, nt + ' frames'); check('and the walker under 1.5 s (it was 1.2 s a column before)', nw > 0 && nw < 90, nw + ' frames'); }
for (const type of ['tanksuit', 'mechsuit']) { enter(type); const c0 = Math.floor(S.P.x / T) - 1; for (let c = c0; c <= c0 + 4; c++) S.setTile(c, 12, DIRT); const y0 = S.P.y; let top = y0;
  for (let i = 0; i < 50; i++) { S.keys.jump = true; S.pressed.jump = i === 0; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; top = Math.min(top, S.P.y); } S.keys.jump = false;
  let holes = 0; for (let c = c0; c <= c0 + 4; c++) if (S.tileAt(c, 12) === 0) holes++;
  check('the jumping ' + type + ' breaks an earth ceiling with its roof', holes >= 1 && !!S.P.mech, holes + ' blocks'); }
{ enter('mechsuit'); const c0 = Math.floor(S.P.x / T) - 1; for (let c = c0; c <= c0 + 4; c++) S.setTile(c, 12, STEEL); const y0 = S.P.y; let top = y0;
  for (let i = 0; i < 50; i++) { S.keys.jump = true; S.pressed.jump = i === 0; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; top = Math.min(top, S.P.y); } S.keys.jump = false;
  check('a steel ceiling holds', S.tileAt(c0 + 1, 12) === STEEL && top >= 13 * T - 0.5, 'top ' + (top / T).toFixed(2)); }
{ enter(); const c = Math.floor((S.P.x + S.P.w / 2) / T); S.P.y -= 7 * T; S.P.vy = 0; let n = 0; while (n < 200 && !(S.P.onGround && n > 5)) { run(1); n++; } run(2);
  check('a hard landing breaks the earth it lands on', S.tileAt(c, 16) === 0, 'tile ' + S.tileAt(c, 16)); }

// ---------------------------------------------------------------- 3. the cannon
{ enter(); for (let r = 10; r <= 15; r++) for (let c = 24; c <= 26; c++) S.setTile(c, r, BRICK); S.P.x = 14 * T; S.P.face = 1; run(2);
  const n0 = () => { let n = 0; for (let r = 10; r <= 15; r++) for (let c = 24; c <= 26; c++) if (S.tileAt(c, r)) n++; return n; }, before = n0();
  run(1, { fire: true }); const sh = S.bullets.filter((b) => b.kind === 'tshell');
  check('Z fires one slow shell', sh.length === 1 && Math.abs(sh[0].vx) < 260 && sh[0].explode > 0 && sh[0].tp > 0, sh[0] && ('vx ' + sh[0].vx.toFixed(0)));
  for (let i = 0; i < 180; i++) run(1, { fire: i > 90 && i < 100 });
  check('the shell explodes and breaks blocks', n0() < before, before + ' -> ' + n0() + ' bricks'); }
{ enter(); run(2); S.P.face = 1; run(1, { fire: true }); const a = S.bullets.find((b) => b.kind === 'tshell');
  enter(); run(2); S.P.face = 1; run(1, { fire: true, aim: true, up: true }); const b = S.bullets.find((bb) => bb.kind === 'tshell');
  check('the aim key and Up raise the barrel', a && b && a.vy > -1 && b.vy < -50, a && b ? a.vy.toFixed(0) + ' vs ' + b.vy.toFixed(0) : 'no shell'); }
{ enter(); run(2); S.P.face = 1; run(1, { fire: true }); const t0 = S.bullets.filter((b) => b.kind === 'tshell').length; run(20, { fire: true }); const t1 = S.bullets.filter((b) => b.kind === 'tshell').length + 0;
  check('it fires slowly (one shell, then a pause)', t0 === 1 && t1 <= 1); }
{ enter(); S.P.mech.hp = 40; const d0 = S.stats.deaths; S.P.face = 1; run(1, { fire: true }); for (let i = 0; i < 120; i++) run(1); check('its own shell never hurts the driver (point blank at a wall too)', S.P.mech && S.P.mech.hp === 40 && S.stats.deaths === d0);
  enter(); S.setTile(16, 15, STEEL); S.setTile(16, 14, STEEL); S.setTile(16, 13, STEEL); S.P.x = 14 * T; S.P.face = 1; run(1); S.P.mech.hp = 40; run(1, { fire: true }); run(100); check('and a shell into a steel wall beside him leaves him alone', S.P.mech && S.P.mech.hp === 40); }

// ---------------------------------------------------------------- 4. getting out
for (const [name, act] of [['Shift / V', () => tap('dash')], ['Down + Jump', () => { S.keys.down = true; tap('jump'); S.keys.down = false; }], ['a double tap of Jump', () => { tap('jump'); run(3); tap('jump'); }]]) {
  enter(); act(); run(1);
  check('exit with ' + name + ': he is on foot and the empty tank stays', !S.P.mech && S.P.w === 10 && S.P.h === 15 && live('tanksuit').length === 1 && !S.rectSolid(S.P.x, S.P.y, S.P.w, S.P.h));
}
{ enter(); run(80); const s = live('tanksuit')[0]; tap('dash'); run(70); check('he does not fall straight back in; he can walk back in', !S.P.mech && live('tanksuit').length === 1);
  const t = live('tanksuit')[0]; S.P.x = t.x + 12; S.P.y = t.y + 2; run(3); check('and the tank keeps its hp', !!S.P.mech && S.P.mech.kind === 'tank'); }
{ // wedged: a wall on the right, a low roof: the exit must still put him in free air
  enter(); S.P.x = 40 * T; S.P.y = 16 * T - S.P.h - 0.01; run(1); for (let c = 38; c <= 44; c++) for (let r = 12; r <= 13; r++) S.setTile(c, r, DIRT); // a roof 2 tiles above the floor
  for (let r = 12; r <= 15; r++) S.setTile(Math.floor((S.P.x + S.P.w) / T) + 1, r, DIRT); run(30, { right: true });
  tap('dash'); run(2);
  check('against a wall under a low roof, the exit puts him on free ground (not inside a block)', !S.P.mech && !S.rectSolid(S.P.x, S.P.y, S.P.w, S.P.h));
  let moved = false; const x0 = S.P.x; run(40, { left: true }); moved = S.P.x < x0 - 5; check('and he can walk away', moved); }
{ enter(); S.P.mech.hp = 1; S.P.inv = 0; S.killPlayer('shot'); run(1); check('when it is destroyed he is thrown clear and the tank is gone', !S.P.mech && S.P.alive && live('tanksuit').length === 0); }

// ---------------------------------------------------------------- 4b. round 10: the charge (forward twice) and the mortar salvo (special key)
const dtap = (k) => { tap(k); run(2); tap(k); };
{ enter(); const x0 = S.P.x; dtap('right'); const on = S.P.mech.charge > 0; run(20); const v = (S.P.x - x0) / (23 / 60);
  check('forward twice starts the charge at about ' + S.TANK.chargeV + ' px/s (driving is 50)', on && v > 200 && v < 280, v.toFixed(0) + ' px/s');
  run(60); check('it ends by itself after ' + S.TANK.chargeT + ' s', !(S.P.mech.charge > 0) && Math.abs(S.P.vx) < 60, 'vx ' + S.P.vx.toFixed(0)); }
{ enter(); tap('right'); run(30); tap('right'); run(5); check('two presses 0.5 s apart are not a charge', !(S.P.mech.charge > 0)); }
{ enter(); dtap('right'); run(50); const x1 = S.P.x; dtap('right'); check('a second charge has to wait ' + S.TANK.chargeCool + ' s', !(S.P.mech.charge > 0)); run(80); dtap('right'); check('and then it goes again', S.P.mech.charge > 0); }
{ enter(); for (let c = 24; c < 27; c++) for (let r = 12; r <= 15; r++) S.setTile(c, r, BRICK); S.P.x = 23 * T - S.P.w - 4; run(2); dtap('right'); run(34);
  let gone = 0; for (let c = 24; c < 27; c++) for (let r = 14; r <= 15; r++) if (S.tileAt(c, r) === 0) gone++;
  check('the charge goes through three columns of brick without slowing down', gone === 6 && S.P.x > 27 * T, gone + ' of 6 blocks gone, x ' + (S.P.x / T).toFixed(1)); }
{ enter(); const h = S.makeEnt({ type: 'heavy', c: 24, from: 0 }), g = S.makeEnt({ type: 'grunt', c: 26, from: 0 }), b = S.makeEnt({ type: 'barrel', c: 28, from: 0 }); S.ents.push(h, g, b); run(3); for (const e of [h, g]) { e.cool = 99; e.react = 99; }
  S.P.x = 22 * T - S.P.w; run(1); const hp0 = S.P.mech.hp; dtap('right'); run(34);
  check('it runs down a heavy (20 hp), a grunt and a barrel in its way and drives on (into the barrel\'s crater)', h.dead && g.dead && b.dead && S.P.x > 25 * T && !!S.P.mech, 'heavy ' + h.dead + ', grunt ' + g.dead + ', barrel ' + b.dead + ', x ' + (S.P.x / T).toFixed(1));
  check('the barrel it set off does not hurt the tank', S.P.mech.hp === hp0, 'hp ' + S.P.mech.hp + ' of ' + hp0); }
{ enter(); for (let r = 12; r <= 15; r++) S.setTile(26, r, STEEL); S.P.x = 22 * T - S.P.w; run(2); dtap('right'); run(40);
  check('steel stops the charge', S.P.x + S.P.w <= 26 * T + 0.1 && S.tileAt(26, 15) === STEEL && !(S.P.mech.charge > 0), 'x ' + ((S.P.x + S.P.w) / T).toFixed(2)); }
{ enter('mechsuit', 14); dtap('right'); check('the walker has no charge', !(S.P.mech.charge > 0)); }
{ enter(); for (let r = 13; r <= 15; r++) S.setTile(22, r, STEEL); const h = S.makeEnt({ type: 'heavy', c: 27, from: 0 }); S.ents.push(h); run(3); h.cool = 99; h.react = 99; S.P.x = 16 * T; S.P.face = 1; run(2);
  S.bullets.length = 0; tap('special'); let shells = S.bullets.filter((q) => q.kind === 'tshell' && q.grav > 300).length; for (let i = 0; i < 30; i++) { h.cool = 99; h.react = 99; run(1); shells = Math.max(shells, S.bullets.filter((q) => q.kind === 'tshell' && q.grav > 300).length); }
  check('the special key fires a salvo of ' + S.TANK.mortars + ' mortar shells', shells === S.TANK.mortars, shells + ' shells');
  tap('special'); run(2); const again = S.bullets.filter((q) => q.kind === 'tshell' && q.grav > 300).length; for (let i = 0; i < 200; i++) { h.cool = 99; h.react = 99; run(1); }
  check('they arc over a three-block steel wall and hurt the heavy behind it', h.dead || h.hp < 20, 'heavy hp ' + h.hp.toFixed(1));
  check('and the salvo has a pause of ' + S.TANK.mortarCool + ' s', again <= S.TANK.mortars, again + ' shells in the air after a second press'); }

// ---------------------------------------------------------------- 5. the walker is unchanged
{ enter('mechsuit', 14); check('the walker is still a 24 hp walker', S.P.mech.kind === 'walker' && S.P.mech.hp === 24 && S.P.w === 20 && S.P.h === 26);
  const y0 = S.P.y; let top = y0; for (let i = 0; i < 30; i++) { S.keys.jump = true; S.pressed.jump = i === 0; S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; top = Math.min(top, S.P.y); } S.keys.jump = false; check('the walker still jumps', y0 - top > 20, (y0 - top).toFixed(0) + ' px');
  tap('dash'); run(1); check('and leaves a walker suit behind', live('mechsuit').length === 1 && live('tanksuit').length === 0); }

// ---------------------------------------------------------------- 6. the placed tanks
const PLACED = []; for (let i = 0; i < S.nLevels; i++) { S.startLevel(i); const t = S.ents.filter((e) => e.type === 'tanksuit'); if (t.length) PLACED.push([i, t, S.ents.some((e) => e.type === 'mechsuit')]); }
check('the Think Tank turns up in 8 of the 26 campaign missions', PLACED.length === 8 && S.nLevels === 26, PLACED.map((p) => p[0] + 1).join(','));
check('one per mission, mostly where there is no walker', PLACED.every((p) => p[1].length === 1) && PLACED.filter((p) => !p[2]).length >= 7, PLACED.filter((p) => p[2]).map((p) => p[0] + 1).join(',') + ' also have a walker');
// a static walk graph: stand cells joined by a walk, a step up of at most 3 tiles, a fall, a jump of up to 3 columns, and ladders
function reach(level) {
  S.startLevel(level); const BREAKS = new Set([BRICK, 4]); // crates and bricks are gates a bro shoots open, so the walk graph walks through them
  const isFloor = (c, r) => c >= 0 && c < 560 && r >= 0 && r < S.LH && S.isSolidT(S.tileAt(c, r)), solid = (c, r) => c < 0 || c >= 560 || (r >= 0 && r < S.LH && S.isSolidT(S.tileAt(c, r)) && !BREAKS.has(S.tileAt(c, r))), lad = (c, r) => S.tileAt(c, r) === LADDER;
  const stand = (c, r) => !solid(c, r) && !solid(c, r - 1) && (isFloor(c, r + 1) || lad(c, r) || lad(c, r + 1));
  const sx = Math.floor((S.P.x + 5) / T), sy = Math.floor((S.P.y + 14) / T), seen = new Set(), key = (c, r) => c * 100 + r, q = [[sx, sy]]; seen.add(key(sx, sy));
  const push = (c, r) => { if (c >= 0 && c < 560 && r >= 1 && r < S.LH - 1 && !seen.has(key(c, r))) { seen.add(key(c, r)); q.push([c, r]); } };
  while (q.length) {
    const [c, r] = q.pop();
    if (lad(c, r) || lad(c, r + 1)) { for (let k = 1; k < 40 && !solid(c, r - k) && (lad(c, r - k + 1) || lad(c, r - k)); k++) push(c, r - k); for (let k = 1; k < 40 && !solid(c, r + k); k++) { push(c, r + k); if (stand(c, r + k) && !lad(c, r + k)) break; } }
    for (const d of [-1, 1]) for (let g = 1; g <= 3; g++) {
      const cc = c + d * g; let free = true; for (let j = 1; j <= g; j++) if (solid(c + d * j, r) || solid(c + d * j, r - 1)) { free = false; break; }
      if (g === 1 && !free) { for (let up = 1; up <= 3; up++) if (!solid(cc, r - up) && !solid(cc, r - up - 1) && !solid(c, r - up) && !solid(c, r - up - 1)) { push(cc, r - up); break; } }
      if (!free) continue;
      for (let rr = r; rr < S.LH - 1; rr++) { if (solid(cc, rr)) break; if (stand(cc, rr)) { push(cc, rr); break; } if (rr > r + 30) break; }
      for (let rr = r - 1; rr >= r - 3; rr--) if (stand(cc, rr) && !solid(cc, rr - 1) && !solid(c, rr - 1)) push(cc, rr);
    }
  }
  return seen;
}
for (const [i] of PLACED) {
  S.startLevel(i); const L = S.levelDef(i).name, t = S.ents.find((e) => e.type === 'tanksuit'), c = Math.floor((t.x + t.w / 2) / T), r = Math.floor((t.y + t.h - 1) / T); // r: the row the tank's feet are in; the floor is r + 1
  let flatRun = true; for (let k = -1; k <= 1; k++) { const cc = Math.floor((t.x + t.w / 2) / T) + k; if (!S.isSolidT(S.tileAt(cc, r + 1)) || S.isSolidT(S.tileAt(cc, r)) || S.isSolidT(S.tileAt(cc, r - 1))) flatRun = false; }
  const seen = reach(i);
  const near = [c - 1, c, c + 1].some((cc) => seen.has(cc * 100 + r));
  check((i + 1) + ' ' + L + ': the tank stands on flat ground with room over it', flatRun, 'col ' + c + ' row ' + r);
  check((i + 1) + ' ' + L + ': the tank can be reached on foot from the start (static walk graph)', near, near ? seen.size + ' cells' : 'not reached, furthest ' + Math.max(...[...seen].map((k) => Math.floor(k / 100))) + ' of ' + c);
  S.startLevel(i); S.endCeasefire(); const tt = S.ents.find((e) => e.type === 'tanksuit'); S.P.inv = 1e9; S.P.x = tt.x - 20; S.P.y = tt.y - 2; S.P.vx = 0; S.P.vy = 0; run(4, { right: true }); for (let k = 0; k < 80 && !S.P.mech; k++) run(1, { right: true });
  check((i + 1) + ' ' + L + ': walking into it boards the tank', !!S.P.mech && S.P.mech.kind === 'tank');
}

// ---------------------------------------------------------------- 7. random maps
{ let tanks = 0, walkers = 0, same = true; for (let seed = 1; seed <= 150; seed++) { S.startRandom(seed, true); const e = S.ents; tanks += e.some((x) => x.type === 'tanksuit') ? 1 : 0; walkers += e.some((x) => x.type === 'mechsuit') ? 1 : 0; }
  check('random maps sometimes have a Think Tank, and still more often a walker', tanks >= 3 && walkers > tanks && tanks < 60, tanks + ' tanks, ' + walkers + ' walkers in 150 maps');
  S.startRandom(42, true); const a = S.ents.filter((x) => x.type === 'tanksuit' || x.type === 'mechsuit').map((x) => x.type + Math.round(x.x)).join(); S.startRandom(42, true); const b = S.ents.filter((x) => x.type === 'tanksuit' || x.type === 'mechsuit').map((x) => x.type + Math.round(x.x)).join();
  check('the same seed gives the same map', a === b, a); }
console.log(fails ? fails + ' check(s) failed' : 'all think tank checks passed');
process.exit(fails ? 1 : 0);
