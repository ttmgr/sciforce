// Headless checks for every bro: each weapon hurts a quack, each special does its thing.
// Usage: node science-bros/tests/bros.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
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
const setup = (id) => {
  S.reset(); run(1); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); run(1);
  S.P.bro = S.BRO[id]; S.P.inv = 1e9; S.P.x = 4 * T; S.P.y = 16 * T - 15.01; S.P.face = 1; S.P.spec = 3; run(2);
};
const quack = (c, extra = {}) => { const e = Object.assign(S.makeEnt({ type: 'grunt', c, from: 0 }), { face: -1, react: 99, cool: 99 }, extra); S.ents.push(e); return e; };

check('there are 38 bros', S.BROS.length === 38, S.BROS.length + ' bros');
for (const b of S.BROS) {
  setup(b.id);
  const q = quack(12); // 8 tiles ahead; the bro walks toward it firing
  let i = 0; for (; i < 300 && !q.dead; i++) { q.react = 99; q.cool = 99; run(1, { fire: true, right: S.P.x < q.x - 14 }); }
  check(b.name + ': weapon kills a quack', q.dead, i + ' frames');
}
// specials that need a specific check
setup('archimedes'); const wall = solid(21, 15); S.P.x = 20 * T - 12; run(1);
for (let i = 0; i < 60; i++) run(1, { fire: true, right: true });
check('Archimedes drill bores into the hill', wall && !solid(21, 15));
setup('galileo'); let q = quack(6); S.pressed.special = true; run(1);
let i = 0; for (; i < 300 && !q.dead; i++) { q.react = 99; q.cool = 99; run(1); }
check('Galileo sun burns a quack nearby', q.dead, i + ' frames');
setup('turing'); const a = quack(10), b2 = quack(14, { face: -1 }); S.pressed.special = true; run(1); a.cool = b2.cool = 0;
check('Turing hacks the quacks on screen', a.hacked > 0 && b2.hacked > 0);
const c3 = quack(18, { face: -1 }); for (i = 0; i < 300 && !c3.dead; i++) run(1);
check('hacked quacks shoot an unhacked one', c3.dead, i + ' frames');
setup('johnson'); const js = [quack(10), quack(14), quack(18)]; S.pressed.special = true; run(90);
check('Johnson orbital strikes hit every quack on screen', js.every((e) => e.dead));
setup('meitner'); const ms = [quack(9), quack(13), quack(17)]; S.pressed.special = true; run(90);
check('Meitner chain reaction walks through a line of quacks', ms.every((e) => e.dead));
setup('archimedes'); const ar = quack(12); S.pressed.special = true; run(1);
check('Archimedes lever throws quacks up', ar.vy < -300 || ar.dead);
for (i = 0; i < 180 && !ar.dead; i++) run(1);
check('and they come down hard', ar.dead);

// upgrades and new mechanics
setup('einstein'); const p1 = quack(10), p2 = quack(10.6); for (let k = 0; k < 120 && !(p1.dead && p2.dead); k++) { p1.react = p2.react = 99; p1.cool = p2.cool = 99; run(1, { fire: true }); }
check('Einstein photons pass through the first quack', p1.dead && p2.dead);
setup('pasteur'); q = quack(10); S.P.cool = 0; run(1, { fire: true }); run(20);
check('Pasteur darts poison', q.dead || q.poison > 0);
setup('fleming'); const s1 = quack(6), s2 = quack(6.4); for (let k = 0; k < 4; k++) run(1, { fire: true });
check('Fleming spores make quacks sick', s1.sick > 0 || s1.dead);
setup('hypatia'); S.P.cool = 0; run(1, { fire: true }); const disc = S.bullets.find((b) => b.kind === 'disc'); let back = false;
for (let k = 0; k < 120 && disc && !disc.dead; k++) { run(1); if (disc.back) back = true; }
check('Hypatia disc flies out and comes back to her', back && disc.dead);
setup('faraday'); S.pressed.special = true; run(1); S.P.inv = 0;
S.bullets.push({ x: S.P.x + 30, y: S.P.y + 8, vx: -165, vy: 0, owner: 'e', dmg: 1, tdmg: 0, life: 2, kind: 'pill' }); run(20);
check('Faraday cage sends a shot back', S.P.alive && S.bullets.some((b) => b.kind === 'pill' && b.owner === 'p' && b.vx > 0));
setup('mendel'); const m1 = quack(14); S.pressed.special = true; run(1); for (let k = 0; k < 240 && !m1.dead; k++) { m1.react = 99; m1.cool = 99; run(1); }
check('Mendel pea turrets shoot a quack', m1.dead);
setup('tesla'); const t1 = quack(8); S.P.cool = 0; run(1, { fire: true });
check('Tesla arcs stun', t1.dead || t1.stun > 0);
setup('sagan'); const st = [quack(10), quack(16), quack(22)]; S.pressed.special = true; run(150);
check('Sagan star rain hits quacks across the screen', st.filter((e) => e.dead).length >= 2, st.filter((e) => e.dead).length + ' of 3');
setup('hubble'); const hb = quack(9); S.pressed.special = true; run(1);
check('Hubble flings quacks away', hb.dead || hb.kx > 300);
setup('wegener'); const wg = quack(12); S.pressed.special = true; run(2);
check('Wegener opens the ground under a quack', !(S.tileAt(12, 16) !== 0) || wg.dead);
// the six newest bros: each special (and each main weapon's trick) does what it says
setup('nobel'); let nq = quack(12); S.pressed.special = true; run(1);
const tnts = S.bullets.filter((b) => b.kind === 'tnt'); let stuckMax = 0, k = 0;
for (; k < 240 && S.bullets.some((b) => b.kind === 'tnt'); k++) { nq.react = 99; nq.cool = 99; run(1); stuckMax = Math.max(stuckMax, S.bullets.filter((b) => b.kind === 'tnt' && b.stuck).length); }
check('Nobel: blasting gelatin throws five charges that stick, then all go off', tnts.length === 5 && stuckMax >= 3 && !S.bullets.some((b) => b.kind === 'tnt'), tnts.length + ' thrown, ' + stuckMax + ' stuck at once, ' + k + ' frames');
check('Nobel: and they kill a quack ahead', nq.dead);
setup('nobel'); nq = quack(11, { hp: 50, max: 50 }); let onQuack = false;
for (k = 0; k < 60 && !onQuack; k++) { nq.react = 99; nq.cool = 99; run(1, { fire: k === 0 }); onQuack = S.bullets.some((b) => b.kind === 'tnt' && b.on === nq); }
check('Nobel: his dynamite sticks to a quack', onQuack);
setup('bohr'); const bq = quack(12); const bx0 = S.P.x; S.pressed.special = true; run(1);
check('Bohr: the quantum jump puts him several tiles ahead at once', S.P.x - bx0 >= 6 * T, ((S.P.x - bx0) / T).toFixed(1) + ' tiles');
check('Bohr: the burst where he lands kills a quack', bq.dead);
setup('bohr'); S.setTile(8, 15, 2); S.setTile(8, 14, 2);
const sq = Object.assign(S.makeEnt({ type: 'shield', c: 11, from: 0 }), { face: -1, react: 99, cool: 99 }); S.ents.push(sq);
for (k = 0; k < 120 && sq.hp === sq.max; k++) { sq.react = 99; sq.cool = 99; run(1, { fire: true }); }
check('Bohr: his shots tunnel through a wall and past a riot shield', sq.hp < sq.max && solid(8, 15) && sq.shield === 7, k + ' frames');
setup('lamarr'); S.endCeasefire(); let lq = quack(10, { aware: true }); lq.react = 0; lq.cool = 0; let shots = 0;
for (k = 0; k < 120; k++) { S.P.inv = 1e9; run(1); shots += S.bullets.filter((b) => b.owner === 'e').length; }
check('(control) an unjammed quack shoots', shots > 0, shots + ' bullet-frames');
setup('lamarr'); S.endCeasefire(); lq = quack(10, { aware: true }); lq.react = 0; lq.cool = 0;
S.bullets.push({ x: S.P.x + 40, y: S.P.y + 8, vx: -20, vy: 0, owner: 'e', dmg: 1, tdmg: 0, life: 2, kind: 'pill' });
S.pressed.special = true; run(1);
check('Lamarr: frequency hopping jams the quacks on screen and fizzles shots in the air', lq.jam > 0 && !S.bullets.some((b) => b.owner === 'e'));
for (shots = 0, k = 0; k < 120; k++) { S.P.inv = 1e9; run(1); shots += S.bullets.filter((b) => b.owner === 'e').length; }
check('Lamarr: a jammed quack cannot shoot', shots === 0 && !lq.dead, shots + ' bullet-frames');
setup('lamarr'); const lh = quack(12, { hp: 50, max: 50 }); lh.y -= 0; S.P.y -= 0; let dive = false;
for (k = 0; k < 40; k++) { lh.react = 99; lh.cool = 99; run(1, { fire: k === 0 }); const tp = S.bullets.find((b) => b.kind === 'torp'); if (tp && tp.vx > 300) dive = true; }
check('Lamarr: the torpedo speeds up and hits', dive && lh.hp < 50);
setup('lavoisier'); const dq = quack(9); S.hitEnemy(dq, 99, 60, 'shot'); run(60);
const lv = quack(14), body0 = S.bodies.find((b) => b.kind === 'corpse'); S.pressed.special = true; run(1);
check('Lavoisier: combustion sets the quacks on screen alight', lv.burn > 0 || lv.dead);
run(60);
check('Lavoisier: and the bodies go up', !!body0 && !S.bodies.includes(body0));
setup('lavoisier'); const fq = quack(9, { hp: 50, max: 50 }); for (k = 0; k < 40 && !(fq.burn > 0); k++) { fq.react = 99; fq.cool = 99; run(1, { fire: true }); }
check('Lavoisier: the torch sets a quack on fire', fq.burn > 0 || fq.dead);
setup('goodall'); const gq = quack(13); S.pressed.special = true; run(1);
check('Goodall: three chimps charge out', S.ents.filter((e) => e.type === 'chimp').length === 3);
for (k = 0; k < 300 && !gq.dead; k++) { gq.react = 99; gq.cool = 99; run(1); }
check('Goodall: the chimps maul a quack to death', gq.dead, k + ' frames');
run(520);
check('Goodall: the chimps leave after 8 s', !S.ents.some((e) => e.type === 'chimp'));
setup('goodall'); const hq = quack(8, { hp: 50, max: 50 }); let stunned = false;
for (k = 0; k < 30 && !stunned; k++) { hq.react = 99; hq.cool = 99; run(1, { fire: k === 0 }); stunned = hq.stun > 0; }
check('Goodall: the pant-hoot stuns a quack', stunned);
setup('jemison'); const jq = quack(12); const jy = jq.y; S.pressed.special = true; run(90);
check('Jemison: zero-G lifts quacks off the ground', jq.y < jy - 16 && !jq.dead, (jy - jq.y).toFixed(0) + ' px up');
check('Jemison: and she floats too', S.P.zeroG > 0);
for (k = 0; k < 400 && !jq.dead; k++) { jq.react = 99; jq.cool = 99; run(1); }
check('Jemison: when gravity comes back they crash down', jq.dead, k + ' frames');
setup('jemison'); run(1, { fire: true }); run(1);
check('Jemison: a tap fires a quick bolt', S.bullets.some((b) => b.kind === 'plasma') && !S.bullets.some((b) => b.kind === 'plasma2'));
setup('jemison'); for (k = 0; k < 40 && !S.bullets.some((b) => b.kind === 'plasma2'); k++) run(1, { fire: true });
check('Jemison: holding charges a plasma ball', S.bullets.some((b) => b.kind === 'plasma2' && b.pierce === 3), k + ' frames');

// Robert Oppenbro: Trinity, one nuke per life
setup('oppenheimer'); S.P.spec = S.specMax(S.P.bro); S.P.inv = 0;
check('Oppenbro: one nuke per life', S.P.spec === 1 && S.specMax(S.BRO.einstein) === 3);
const snap = []; for (let r = 0; r < 22; r++) for (let c = 0; c < S.LW; c++) snap.push(S.tileAt(c, r));
const oq = [quack(14), quack(20), quack(27)];
S.pressed.special = true; run(1); const nuke = S.nukes()[0];
check('Oppenbro: Trinity lobs a device that counts down', !!nuke && !nuke.boom && nuke.t > 2.5 && S.P.spec === 0);
S.pressed.special = true; run(1);
check('Oppenbro: no second nuke in the same life', S.nukes().length === 1 && S.P.spec === 0);
let pd = 0, steeled = false; for (k = 0; k < 400 && !nuke.boom; k++) { oq.forEach((q) => { q.react = 99; q.cool = 99; }); run(1); pd = Math.hypot(S.P.x + 5 - nuke.x, S.P.y + 8 - (nuke.y - 6));
  if (nuke.landed && !steeled) { steeled = true; const c = Math.floor(nuke.x / 16), r = Math.floor(nuke.y / 16); S.setTile(c, r, 3); S.setTile(c + 2, r - 2, 3); S.setTile(c - 1, r + 2, 3); for (let rr = 0; rr < 22; rr++) for (let cc = 0; cc < S.LW; cc++) snap[rr * S.LW + cc] = S.tileAt(cc, rr); } } // steel inside the blast
check('Oppenbro: the device lands ahead, the bro standing still is outside the red ring', nuke.landed && nuke.x > S.P.x + 5 && pd > S.NUKE_R, (pd / 16).toFixed(1) + ' tiles away, ring ' + (S.NUKE_R / 16) + ' tiles');
check('Oppenbro: it goes off with a white flash, a mushroom cloud and shockwaves', nuke.boom && S.flash() > 0 && S.fx.some((f) => f.kind === 'mushroom') && S.fx.filter((f) => f.kind === 'shock').length >= 3);
run(120);
check('Oppenbro: every quack on screen dies', oq.every((q) => q.dead));
check('Oppenbro: the bro outside the ring survives', S.P.alive);
let holes = 0, steelLost = 0, bottomHit = 0; const nc = Math.floor(nuke.x / 16);
for (let r = 0; r < 22; r++) for (let c = 0; c < S.LW; c++) { const was = snap[r * S.LW + c], now = S.tileAt(c, r);
  if (was === 3 && now !== 3) steelLost++; if (r >= 20 && now !== was) bottomHit++; if (Math.abs(c - nc) <= 7 && was !== 0 && was !== 5 && was !== 7 && (now === 0)) holes++; }
check('Oppenbro: it blows a crater', holes >= 20, holes + ' blocks gone');
check('Oppenbro: steel and the bottom two rows are untouched', steelLost === 0 && bottomHit === 0, steelLost + ' steel, ' + bottomHit + ' bottom');
check('Oppenbro: the mushroom cloud lingers for seconds', S.fx.some((f) => f.kind === 'mushroom'));
setup('oppenheimer'); S.P.inv = 0; S.plantNuke(S.P.x + 5 + 30, S.P.y + 15, 'p', 0.4); run(60);
check('Oppenbro: his own nuke never kills him, even inside the red ring', S.P.alive);
setup('oppenheimer'); S.P.inv = 0; S.plantNuke(S.P.x + 5 + 30, S.P.y + 15, 'npc', 0.4); run(60);
check('Oppenbro: inside the red ring of a nuke he did not throw, the bro dies', !S.P.alive);
setup('oppenheimer'); { const B = Object.assign(S.makeEnt({ type: 'boss', c: 16, from: 0 }), { active: true }); S.ents.push(B);
  S.plantNuke(14 * 16, 16 * 16, 'p', 0.3); let last = B.hp, maxHit = 0, hits = 0;
  for (k = 0; k < 150; k++) { S.P.inv = 1e9; run(1); const d = last - B.hp; if (d > 0.01) { hits++; maxHit = Math.max(maxHit, d); } last = B.hp; }
  const lost = (B.max - B.hp) / B.max;
  check('Oppenbro: a boss takes a big but capped hit, spread over many frames', maxHit <= 40 && hits >= 5 && lost > 0.15 && lost < 0.32, Math.round(lost * 100) + '% in ' + hits + ' hits, at most ' + maxHit.toFixed(1)); }
setup('oppenheimer'); S.P.spec = 1; { const pk = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4 }); pk.x = S.P.x; S.ents.push(pk); run(3); }
check('Oppenbro: a special pickup cannot give him a second nuke', S.P.spec === 1);

// pickup guns
for (const g of ['shotgun', 'rocket', 'minigun', 'railgun']) {
  setup('einstein'); const pk = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4, item: 'gun' }); pk.gun = g; pk.x = S.P.x; S.ents.push(pk); run(3);
  const tq = quack(12); let k = 0; for (; k < 300 && !tq.dead; k++) { tq.react = 99; tq.cool = 99; run(1, { fire: true, right: S.P.x < tq.x - 40 }); }
  check(g + ' pickup replaces the weapon and kills', tq.dead, k + ' frames');
}
setup('einstein'); const gp = S.makeEnt({ type: 'pickup', c: 0, y: S.P.y + 4, item: 'gun' }); gp.gun = 'railgun'; gp.x = S.P.x; S.ents.push(gp); run(3);
for (let k = 0; k < 600 && S.P.alt; k++) run(1, { fire: true });
check('a pickup gun runs out and you get your own weapon back', !S.P.alt);

// the pant-hoot stuns a quack at most once a second, so holding fire cannot lock a row of quacks
setup('goodall'); { const q = quack(9); q.hp = q.max = 999; let stunned = 0;
  for (let i = 0; i < 120; i++) { q.react = 99; q.cool = 99; run(1, { fire: true }); if (q.stun > 0) stunned++; }
  check('Goodbro: the call stuns, but a quack is free most of the time', stunned > 5 && stunned < 60, stunned + ' of 120 frames stunned'); }
console.log(fails ? fails + ' check(s) failed' : 'all bro checks passed');
process.exit(fails ? 1 : 0);
