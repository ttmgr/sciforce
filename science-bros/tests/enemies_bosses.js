// Headless checks for the enemy roster, the bosses, the new bros and the level flow.
// Usage: node science-bros/tests/enemies_bosses.js science-bros/index.html
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
// clear the level of everything but what a check needs, then drop an enemy at a column
const lone = (lvl = 0) => { if (lvl) S.startLevel(lvl); else S.reset(); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1); S.P.inv = 1e9; };
const spawn = (type, c, extra = {}) => { const e = Object.assign(S.makeEnt({ type, c, from: 0 }), extra); S.ents.push(e); return e; };
const stand = (c) => { S.P.x = c * T + 3; S.P.y = 16 * T - 16; S.P.vx = 0; S.P.vy = 0; };

// end screens draw without errors (title now; level clear and game complete further down)
let drew = true; try { S.render(0); } catch (err) { drew = false; console.log(err); }
check('title screen draws', drew);

// levels
S.reset(); check('level 1 builds with nothing floating', S.checkCollapse() === 0);
S.startLevel(1); check('level 2 builds with nothing floating', S.checkCollapse() === 0);
check('level 2 has 2 cages and 2 bosses', S.ents.filter((e) => e.type === 'cage').length === 2 && S.ents.some((e) => e.type === 'kopter') && S.ents.some((e) => e.type === 'crawler'));

// riot shield: blocks from the front, not from behind, and a punch knocks it away
lone(); stand(10); let e = spawn('shield', 14, { face: -1 });
S.hitEnemy(e, 1, -90, 'shot'); check('shield takes shots from behind', e.hp === 1, 'hp ' + e.hp);
e.hp = 2; S.hitEnemy(e, 1, 90, 'shot'); check('shield blocks shots from the front', e.hp === 2 && e.shield === 6, 'hp ' + e.hp + ' shield ' + e.shield);
S.P.x = e.x - 12; S.P.face = 1; S.P.mcool = 0; S.pressed.melee = true; run(1);
check('punch knocks the shield away', e.shield === 0 && !e.dead);

// heavy: 20 hp and barely moved by bullets; spins up and hoses the area
lone(); stand(4); e = spawn('heavy', 12, { face: -1 });
for (let i = 0; i < 19; i++) S.hitEnemy(e, 1, 90, 'shot');
check('heavy survives 19 hits', !e.dead && e.hp === 1); check('heavy shrugs off knockback', Math.abs(e.kx) < 300, 'kx ' + e.kx.toFixed(0));
e.hp = 20; e.kx = 0; run(150);
check('heavy fires machine-gun bullets after spinning up', S.bullets.some((b) => b.kind === 'mg') || S.stats.deaths > 0);

// grenadier lobs grenades; a punch bats one back
lone(); stand(6); e = spawn('grenadier', 14, { face: -1 });
let thrown = false; for (let i = 0; i < 240 && !thrown; i++) { run(1); thrown = S.bullets.some((b) => b.kind === 'grenade'); }
check('grenadier throws a grenade', thrown);
const g = S.bullets.find((b) => b.kind === 'grenade');
if (g) { g.x = S.P.x + S.P.w + 6; g.y = S.P.y + 6; g.vx = -50; g.vy = 0; S.P.face = 1; S.P.mcool = 0; S.pressed.melee = true; run(1); }
check('punch sends a grenade back', g && g.owner === 'p' && g.vx > 0);

// rocketeer kneels, aims, fires; you can shoot the rocket down
lone(); stand(4); e = spawn('rocketeer', 16, { face: -1 });
let rocket = null; for (let i = 0; i < 300 && !rocket; i++) { run(1); rocket = S.bullets.find((b) => b.kind === 'rocket'); }
check('rocketeer fires a rocket', !!rocket);
if (rocket) { S.P.face = 1; S.P.cool = 0; let i = 0; for (; i < 120 && !rocket.dead; i++) run(1, { fire: true }); check('rocket can be shot down', rocket.dead && S.P.alive, i + ' frames'); }

// dog runs at you and leaps
lone(); stand(6); S.P.inv = 0; e = spawn('dog', 12, { face: -1 });
let leapt = false; for (let i = 0; i < 180 && S.P.alive; i++) { run(1); if (e.vy < -100) leapt = true; }
check('attack dog leaps', leapt); check('attack dog kills on contact', !S.P.alive);

// scout runs off whistling and wakes quacks far away
lone(); stand(6); e = spawn('scout', 12, { face: -1 }); const far = spawn('grunt', 26, { face: 1 });
run(120);
check('scout raises the alarm', e.alarm > 0 || e.dead); check('alarm wakes a quack 14 tiles away', far.aware);

// guru calls paratroopers, who land and fight
lone(); stand(6); e = spawn('guru', 14, { face: -1 });
run(150); const paras = S.ents.filter((o) => o.type === 'para');
check('guru calls paratroopers', paras.length >= 3, paras.length + ' paras');
run(400); check('paratroopers land', paras.length > 0 && paras.every((p) => p.dead || !p.chute));

// supply crate gives a special back
lone(); stand(6); S.P.spec = 1; e = spawn('ammo', 9); S.hitEnemy(e, 1, 90, 'shot'); run(60);
const pk = S.ents.find((o) => o.type === 'pickup'); if (pk) { S.P.x = pk.x; S.P.y = pk.y - 4; } run(10);
check('supply crate refills a special', S.P.spec === 2, 'spec ' + S.P.spec);

// new bros
lone(); stand(6); S.P.bro = S.ents.length >= 0 && S.P.bro; // keep the object, swap id via cage rescue below
const cage = spawn('cage', 9, { bro: 'ada' }); run(1); S.P.x = cage.x; run(2);
check('rescuing Ada unlocks her', S.unlocked.includes('ada') && S.P.bro.id === 'ada');
e = spawn('grunt', 16, { face: -1, aware: false }); S.P.face = 1; S.P.spec = 3; S.pressed.special = true; run(1);
const drone = S.ents.find((o) => o.type === 'drone'); run(120);
check('Ada drone appears and kills', !!drone && e.dead);
lone(); stand(6); const c2 = spawn('cage', 9, { bro: 'darwin' }); run(1); S.P.x = c2.x; run(2);
const weak = [spawn('grunt', 14), spawn('dog', 18), spawn('scout', 20)];
S.P.spec = 3; S.pressed.special = true; run(2);
check('Darwin natural selection kills the weak on screen', weak.every((w) => w.dead));

// Homeopathitron overdose mode fires homing missiles
lone(); S.reset(); run(1); S.ents.forEach((o) => { if (o.type !== 'boss' && o.type !== 'flag') o.dead = true; }); run(1);
const mech = S.boss; S.P.inv = 1e9; S.P.x = 184 * T; S.P.y = 15 * T - 16; run(5);
mech.hp = 55; let missile = false; for (let i = 0; i < 600 && !missile; i++) { run(1); missile = S.bullets.some((b) => b.kind === 'missile'); }
check('Homeopathitron enters overdose mode and fires missiles', mech.p2 && missile);

// Detoxkopter: wakes up, attacks, crashes when killed and opens the gate
S.startLevel(1); run(1); S.ents.forEach((o) => { if (o.type !== 'kopter' && o.type !== 'crawler' && o.type !== 'flag') o.dead = true; }); run(1);
const kop = S.ents.find((o) => o.type === 'kopter'); S.P.inv = 1e9; S.P.x = 90 * T; S.P.y = 16 * T - 16; run(5);
check('Detoxkopter activates', kop.active);
let attacked = false; for (let i = 0; i < 900 && !attacked; i++) { run(1); attacked = S.bullets.some((b) => b.owner === 'e'); }
check('Detoxkopter attacks', attacked);
S.hitEnemy(kop, 999, 0); let k = 0; for (; k < 600 && !kop.dead; k++) run(1);
check('Detoxkopter crashes and dies', kop.dead, k + ' frames'); check('kopter gate opens', !solid(124, 10) && !solid(125, 14));

// Crystal Crawler: tunnels, surfaces, dies segment by segment, chopper comes, level 2 ends the game
const crawl = S.ents.find((o) => o.type === 'crawler'); S.P.x = 185 * T; S.P.y = 12 * T - 16; S.P.vy = 0; run(5);
check('Crystal Crawler activates', crawl.active && crawl.segs.length === 14);
let surfaced = false; for (let i = 0; i < 900 && !surfaced; i++) { S.P.inv = 1e9; run(1); surfaced = crawl.hy < crawl.surfY - 10; }
check('Crystal Crawler surfaces', surfaced);
S.hitEnemy(crawl, 999, 0); k = 0; for (; k < 600 && !crawl.dead; k++) run(1);
check('Crystal Crawler dies', crawl.dead && !!S.chopper, k + ' frames');
for (let i = 0; i < 60 * 25 && S.state === 'play'; i++) { S.P.inv = 1e9; run(1, { right: true, jump: (i % 30) < 15 }); if (i % 30 === 0) S.pressed.jump = true; }
check('extraction on level 2 ends the game', S.state === 'done', S.state);
drew = true; try { S.render(0); } catch (err) { drew = false; console.log(err); }
check('game-complete screen draws', drew);

// level flow: clearing level 1 leads to level 2 with your bros kept
S.reset(); run(1); S.unlocked.push('tesla');
// pretend level 1 was cleared
S.startLevel(0); run(1);
const keep = S.unlocked.slice();
S.startLevel(1); run(1);
check('bros carry over to level 2', S.level === 1 && keep.every((b) => S.unlocked.includes(b)));

console.log(fails ? fails + ' check(s) failed' : 'all enemy and boss checks passed');
process.exit(fails ? 1 : 0);
