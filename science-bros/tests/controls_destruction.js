// Headless checks for the movement moves (dash, wall jump, ground pound) and the extra destruction
// (blast debris, blasted back walls, spreading fire, airstrikes) plus score and combos.
// Usage: node science-bros/tests/controls_destruction.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
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
const solid = (c, r) => { const v = S.tileAt(c, r); return v !== 0 && v !== 5; };
const lone = () => { S.reset(); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1); };
const spawn = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), extra); S.ents.push(e); return e; };

// dash-roll: fast, and bullets pass through
lone(); S.P.x = 4 * T; S.P.y = 16 * T - 15.01; S.P.inv = 0; run(5);
const x0 = S.P.x; S.pressed.dash = true; run(1);
S.bullets.push({ x: S.P.x + 8, y: S.P.y + 8, vx: -165, vy: 0, owner: 'e', dmg: 1, tdmg: 0.4, life: 2, kind: 'pill' });
run(12);
check('dash moves fast', S.P.x - x0 > 50, ((S.P.x - x0) / T).toFixed(1) + ' tiles in 0.2 s');
check('a bullet passes through a rolling bro', S.P.alive);
run(40); check('dash has a cooldown', S.P.dcool <= 0);

// wall jump: jump while touching a wall kicks you away from it
lone(); S.P.inv = 1e9; S.P.x = 106 * T - 10.6; S.P.y = 14 * T; S.P.vy = 0; run(1);
S.P.x = 106 * T - 10.6; S.P.vy = 30; S.pressed.jump = true; run(1);
check('wall jump kicks away from the wall', S.P.vx < -150 && S.P.vy < -200, 'vx ' + S.P.vx.toFixed(0) + ' vy ' + S.P.vy.toFixed(0));

// ground pound: slam from the air breaks the floor and digs through soft blocks
lone(); S.P.inv = 1e9; S.P.x = 10 * T + 3; S.P.y = 12 * T; S.P.vy = 0; run(2);
S.keys.down = true; S.pressed.melee = true; run(1, { down: true });
check('down + punch in the air starts a ground pound', S.P.pound > 0);
const g = spawn('grunt', 12);
for (let i = 0; i < 90 && S.P.pound > 0; i++) run(1, { down: true });
check('ground pound smashed the floor', !solid(10, 16));
check('ground pound drilled more than one layer', !solid(10, 17), 'layers ' + S.P.layers);
check('ground pound throws nearby quacks', g.dead || g.vy < 0 || g.kx !== 0);

// blasts throw block lumps that hurt quacks, and punch holes in back walls
lone(); S.P.x = 2 * T; S.P.inv = 1e9;
S.explode(12 * T, 16 * T, 34, 6, 'p', 4);
check('blast throws block lumps', S.bodies.some((b) => b.kind === 'block'));
let wall0 = 0; for (let c = 54; c <= 56; c++) for (let r = 13; r <= 15; r++) wall0 += S.bgAt(c, r) ? 1 : 0;
S.explode(55 * T + 8, 14 * T + 8, 34, 6, 'p', 4);
let wall1 = 0; for (let c = 54; c <= 56; c++) for (let r = 13; r <= 15; r++) wall1 += S.bgAt(c, r) ? 1 : 0;
check('blast holes the bunker back wall', wall0 === 9 && wall1 <= 4, wall0 + ' -> ' + wall1 + ' wall tiles');

// fire creeps along a crate bridge
lone(); S.P.x = 2 * T; S.P.inv = 1e9;
S.ignite(82 * T + 8, 15 * T, 1, 0); S.ignite(95 * T + 8, 15 * T, 1, 0); // light two crates
let burnt = 0; for (let i = 0; i < 900; i++) { run(1); }
for (let c = 77; c <= 100; c++) if (!solid(c, 16)) burnt++;
check('fire spreads along the crates and burns them away', burnt >= 3, burnt + ' crates gone from 2 fires');
check('steel piles survive the fire', solid(80, 17) && solid(84, 17));

// airstrike pickup carpet-bombs ahead
lone(); S.P.x = 4 * T; S.P.y = 16 * T - 15.01; S.P.face = 1; S.P.inv = 1e9; run(2);
const before = []; for (let c = 8; c <= 30; c++) before.push(solid(c, 16) ? 1 : 0);
const p = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4 }); p.x = S.P.x + 1; p.strike = true; S.ents.push(p);
run(200);
let gone = 0; for (let c = 8; c <= 30; c++) if (before[c - 8] && !solid(c, 16)) gone++;
check('airstrike pickup is collected', p.dead);
check('airstrike blows up the ground ahead', gone >= 5, gone + ' surface tiles gone');
check('airstrike does not kill the bro who called it', S.P.alive);

// score and combo
lone(); S.P.x = 2 * T;
const qs = [spawn('grunt', 10), spawn('grunt', 12), spawn('grunt', 14)];
for (const q of qs) S.hitEnemy(q, 99, 90, 'shot');
check('three quick kills make a x3 combo', S.stats.best === 3);
check('combo multiplies the score', S.stats.score === 100 + 200 + 300, 'score ' + S.stats.score);

// bro-mech: walk in to board, bulldoze a wall, soak hits, jump out, and get thrown clear when it blows
lone(); S.P.inv = 0; S.P.x = 2 * T; S.P.y = 16 * T - 15.01; run(2);
const suit = spawn('mechsuit', 6); run(2);
for (let i = 0; i < 60 && !S.P.mech; i++) run(1, { right: true });
check('walking into a mech boards it', !!S.P.mech && S.P.w === 20);
const hp0 = S.P.mech.hp; S.bullets.push({ x: S.P.x + 10, y: S.P.y + 10, vx: -165, vy: 0, owner: 'e', dmg: 1, tdmg: 0.4, life: 2, kind: 'pill' }); run(2);
check('the mech takes bullets instead of the bro', S.P.alive && S.P.mech.hp === hp0 - 1, 'hp ' + S.P.mech.hp);
const wallC = Math.floor((S.P.x + S.P.w) / T) + 1; S.P.x = 19 * T - 21; run(1);
for (let i = 0; i < 120; i++) run(1, { right: true });
check('the mech bulldozes into the hill', !solid(21, 14), 'P col ' + (S.P.x / T).toFixed(1));
S.pressed.dash = true; run(1);
const parked = S.ents.find((e) => e.type === 'mechsuit' && !e.dead);
check('dash jumps out and leaves the mech parked', !S.P.mech && S.P.w === 10 && !!parked);
run(60); check('you land beside it instead of falling back in', !S.P.mech && !parked.dead);
S.P.x = parked.x + 4; S.P.y = parked.y + 8; run(3);
check('you can climb back in', !!S.P.mech);
S.P.mech.hp = 1; S.bullets.push({ x: S.P.x + 10, y: S.P.y + 10, vx: -165, vy: 0, owner: 'e', dmg: 1, tdmg: 0.4, life: 2, kind: 'pill' }); run(2);
check('a destroyed mech throws the bro clear alive', !S.P.mech && S.P.alive);

// pause menu: toggle a setting, restart the level
S.reset(); run(1);
S.pressed.pause = true; run(1); check('P pauses the game', S.paused);
const t0 = S.stats.time; run(30); check('nothing moves while paused', S.stats.time === t0);
const shake0 = S.settings.shake; S.pressed.fire = true; run(1); check('fire switches the selected setting', S.settings.shake === !shake0);
S.pressed.fire = true; run(1); // switch it back
for (let k = 0; k < 7; k++) { S.pressed.down = true; run(1); } // down to RESTART LEVEL
S.P.x = 50 * T; S.pressed.fire = true; run(1);
check('restart level from the menu', !S.paused && S.P.x < 5 * T && S.state === 'play');

// running: tap right twice quickly to run, let go to stop
S.reset(); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); S.P.inv = 1e9; S.P.x = 2 * T; S.P.y = 16 * T - 15.01; run(2);
S.pressed.right = true; run(1, { right: true }); run(4); S.pressed.right = true; run(1, { right: true });
for (let i = 0; i < 30; i++) run(1, { right: true });
check('double-tap right runs', S.P.run && S.P.vx > 160, 'vx ' + S.P.vx.toFixed(0));
run(10); S.pressed.right = true; run(30, { right: true });
check('letting go stops running; one tap walks', !S.P.run && S.P.vx < 125, 'vx ' + S.P.vx.toFixed(0));

// hit boxes: a fast shot cannot skip through a quack, and a shot that grazes past your sprite misses
lone(); S.P.x = 2 * T; const thin = spawn('grunt', 12, { react: 99, cool: 99 });
S.bullets.push({ x: thin.x - 9, y: thin.y + 8, vx: 1300, vy: 0, owner: 'p', dmg: 5, tdmg: 0, life: 0.5, kind: 'photon' }); run(1);
check('a very fast bullet still hits (swept check)', thin.dead);
lone(); S.P.x = 6 * T; S.P.y = 16 * T - 15.01; S.P.inv = 0; run(2);
S.bullets.push({ x: S.P.x + 40, y: S.P.y + 0.5, vx: -200, vy: 0, owner: 'e', dmg: 1, tdmg: 0, life: 1, kind: 'pill' }); run(20);
check('a shot skimming the top of your hair misses', S.P.alive);

console.log(fails ? fails + ' check(s) failed' : 'all control and destruction checks passed');
process.exit(fails ? 1 : 0);
