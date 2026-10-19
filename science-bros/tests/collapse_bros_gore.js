// Headless checks for: only loose blocks (brick, crate, ice) fall, fair random bro picks when freeing cages,
// the six newest bros' specials, and the blood and gore setting.
// Usage: node science-bros/tests/collapse_bros_gore.js science-bros/index.html
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
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (i % 10 === 0) S.render(i / 60); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const EMPTY = 0, DIRT = 1, BRICK = 2, STEEL = 3, CRATE = 4;
const solid = (c, r) => { const v = S.tileAt(c, r); return v !== 0 && v !== 5 && v !== 7; };
// a flat empty yard (columns 18-89) on mission 1, the player out of the way at column 20
const arena = () => {
  S.startLevel(0); S.endCeasefire(); run(1);
  for (let c = 18; c < 90; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? DIRT : EMPTY);
  S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1);
  S.P.x = 20 * T; S.P.y = 15 * T - 15.01; S.P.inv = 1e9; S.P.face = 1;
};
const fill = (c0, r0, c1, r1, v) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) S.setTile(c, r, v); };
const add = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), extra); S.ents.push(e); return e; };

// ---- collapse: earth stays, the loose set falls
arena(); fill(40, 10, 46, 15, DIRT); fill(41, 13, 45, 15, EMPTY); // an earth arch over a gap
S.checkCollapse(); run(60);
check('an earth overhang with nothing under it stays up', solid(43, 12) && solid(43, 10));
arena(); fill(50, 8, 50, 15, BRICK); fill(51, 8, 56, 8, BRICK); fill(56, 9, 56, 15, BRICK); // a brick gate
S.damageTile(50, 15, 999); S.damageTile(56, 15, 999); run(240);
check('cut both brick legs and the gate comes down', !solid(53, 8));
arena(); fill(60, 6, 63, 15, DIRT); fill(64, 6, 68, 6, BRICK); // a brick ledge stuck to the side of an earth pillar
S.checkCollapse(); run(240);
check('a brick ledge held only by earth at its side falls', !solid(66, 6));
arena(); fill(60, 6, 60, 15, STEEL); fill(61, 6, 65, 6, BRICK); // the same ledge on a steel girder
S.checkCollapse(); run(240);
check('steel holds bricks at its side', solid(63, 6));
arena(); fill(70, 12, 72, 15, CRATE); S.damageTile(71, 15, 999); run(240);
check('a crate stack stays up while one crate still stands under it', solid(70, 12) && solid(72, 12));
arena(); fill(30, 14, 34, 15, DIRT); fill(32, 10, 32, 13, DIRT); S.damageTile(32, 13, 999); run(120);
check('earth floating after a blast stays where it is', solid(32, 10) && solid(32, 12));
for (let l = 0; l < S.nLevels; l++) { S.startLevel(l); if (S.checkCollapse() !== 0) { check('mission ' + (l + 1) + ' builds with nothing loose and unsupported', false); break; } if (l === S.nLevels - 1) check('every mission builds with nothing loose and unsupported', true); }

// ---- fair random bro picks
S.reset(); run(1);
check('cages do not know their bro before you open them', S.ents.filter((e) => e.type === 'cage').every((e) => !e.bro));
const firsts = {};
const NB = S.BROS.length, NL = NB - 1; // every bro, and every bro but the first
for (let k = 0; k < 100 * NL; k++) { S.unlocked.length = 0; S.unlocked.push('einstein'); const id = S.pickRescueBro(); firsts[id] = (firsts[id] || 0) + 1; }
const counts = Object.values(firsts), lo = Math.min(...counts), hi = Math.max(...counts);
check('the first freed bro can be any of the ' + NL + ' locked ones, about equally often', Object.keys(firsts).length === NL && !firsts.einstein && lo > 50 && hi < 160, 'min ' + lo + ' max ' + hi);
// free cages one after another: new bros first, never a repeat while bros are still locked
arena(); S.unlocked.length = 0; S.unlocked.push('einstein'); S.P.bro = S.BRO.einstein;
let dup = false, got = [];
for (let k = 0; k < NL; k++) { const c = add('cage', 30); c.bro = null; S.P.x = c.x; run(2); got.push(S.P.bro.id); if (got.indexOf(S.P.bro.id) !== got.length - 1) dup = true; }
check(NL + ' cages free all ' + NL + ' locked bros, no repeats', !dup && new Set(got).size === NL && S.unlocked.length === NB, S.unlocked.length + ' unlocked');
// with everyone free: never the bro you are playing, and everyone comes up before repeats
const seq = []; let same = 0;
for (let k = 0; k < 54; k++) { const before = S.P.bro.id; const c = add('cage', 30); c.bro = null; S.P.x = c.x; run(2); if (S.P.bro.id === before) same++; seq.push(S.P.bro.id); }
check('freeing a cage never gives you the bro you already are', same === 0, same + ' repeats');
check('every bro comes up within ' + NB + ' rescues', new Set(seq.slice(0, NB)).size >= NB - 2, new Set(seq.slice(0, NB)).size + ' different');
// respawns pick from the bros you have, never the one that just died
let rsame = 0; for (let k = 0; k < 30; k++) { const before = S.P.bro.id; S.P.inv = 0; S.killPlayer && S.killPlayer('shot'); for (let i = 0; i < 180 && S.P.bro.id === before && S.P.alive === false; i++) run(1); if (S.P.bro.id === before) rsame++; S.P.inv = 1e9; }
check('a respawn never sends the bro that just died', rsame === 0, rsame + ' of 30');

// ---- the six newest bros
const setupBro = (id) => { arena(); S.P.bro = S.BRO[id]; S.P.spec = 3; S.P.x = 30 * T; for (let i = 0; i < 90; i++) { S.P.x = 30 * T; run(1); } }; // let the camera catch up
setupBro('hawking'); let q = add('grunt', 36, { react: 99, cool: 99 }); fill(36, 13, 37, 14, BRICK); S.pressed.special = true; run(1);
const hole = S.fx.find((f) => f.kind === 'hole'); for (let i = 0; i < 200; i++) { q.react = 99; q.cool = 99; run(1); }
check('Hawking: the black hole pulls a quack in and kills it', !!hole && q.dead);
check('Hawking: the black hole eats blocks', !solid(36, 13) || !solid(37, 13) || !solid(36, 14) || !solid(37, 14));
setupBro('hopper'); q = add('grunt', 36, { react: 99, cool: 99 }); S.pressed.special = true; run(1);
check('Hopper: quacks on screen are marked as bugs', q.bug > 0);
let hp0 = q.hp = 10; S.hitEnemy(q, 1, 0); check('Hopper: a bug takes double damage', hp0 - q.hp === 2, (hp0 - q.hp) + ' damage');
setupBro('wu'); q = add('grunt', 36, { react: 99, cool: 99, face: -1 }); q.hp = q.max = 20; S.pressed.special = true; run(1);
check('Wu: quacks are turned round and stunned', q.face === 1 && q.stun > 0);
setupBro('wu'); const back = add('grunt', 25, { react: 99, cool: 99, face: 1 }); for (let i = 0; i < 120 && !back.dead; i++) { back.react = 99; back.cool = 99; S.P.face = 1; run(1, { fire: true }); }
check('Wu: her mirror shot hits a quack behind her', back.dead);
setupBro('hodgkin'); q = add('grunt', 36, { react: 99, cool: 99 }); S.pressed.special = true; for (let i = 0; i < 90; i++) { q.react = 99; q.cool = 99; run(1); }
check('Hodgkin: crystal spikes kill a quack ahead', q.dead && S.fx.length >= 0);
setupBro('davinci'); S.pressed.special = true; run(1);
check('da Vinci: the flying machine lets him fly', S.P.jet > 7);
setupBro('rutherford'); S.pressed.special = true; run(1);
const alphas = S.bullets.filter((b) => b.kind === 'alpha');
check('Rutherford: gold foil fires 12 bouncing particles', alphas.length === 12 && alphas.every((b) => b.bounce === 3));

// ---- blood and gore
const killOne = (gore) => {
  arena(); S.settings.gore = gore; fill(40, 10, 40, 15, DIRT); // a wall behind the quack
  const g = add('grunt', 38, { react: 99, cool: 99 }); S.P.x = 30 * T;
  for (let k = 0; k < 3; k++) S.hitEnemy(g, 0.4, 160, 'shot');
  S.hitEnemy(g, 9, 160, 'shot'); run(300);
  let n = 0; for (const [, a] of S.decals) for (const d of a) if (d[2] === '#9b2335' || d[2] === '#6e1423' || d[2] === '#7a1a2a') n++;
  return n;
};
const off = killOne(0), on = killOne(1), extra = killOne(2);
check('gore off: no blood at all', off === 0, off + ' stains');
check('gore on: blood stains, including on the wall behind', on > 5, on + ' stains');
check('gore extra: much more blood', extra > on * 1.4, extra + ' vs ' + on);
arena(); S.settings.gore = 1; const g2 = add('grunt', 38); S.hitEnemy(g2, 9, 60, 'shot'); run(400);
const corpse = S.bodies.find((b) => b.kind === 'corpse');
check('a resting corpse leaves a pool of blood', !!corpse && corpse.pool >= 4, corpse && 'pool ' + corpse.pool);
arena(); S.settings.gore = 2; const g3 = add('grunt', 38); S.explode(g3.x + 5, g3.y + 8, 30, 9, 'p', 0); run(2);
check('gore extra: explosions throw meat chunks', S.bodies.filter((b) => b.kind === 'chunk' && b.bleed > 0).length >= 5);
arena(); S.settings.gore = 0; const g4 = add('grunt', 38); S.explode(g4.x + 5, g4.y + 8, 30, 9, 'p', 0); run(2);
check('gore off: explosions leave a dust puff, no body parts', S.bodies.filter((b) => b.kind === 'gib').length === 0);
S.settings.gore = 1;
// the pause menu cycles it
S.reset(); S.pressed.pause = true; run(1); for (let k = 0; k < 6; k++) { S.pressed.down = true; run(1); }
S.pressed.fire = true; run(1); const a1 = S.settings.gore; S.pressed.fire = true; run(1); const a2 = S.settings.gore; S.pressed.fire = true; run(1);
check('the pause menu cycles gore on, extra, off', a1 === 2 && a2 === 0 && S.settings.gore === 1, [a1, a2, S.settings.gore].join(' > '));

console.log(fails ? fails + ' check(s) failed' : 'all collapse, bro and gore checks passed');
process.exit(fails ? 1 : 0);
