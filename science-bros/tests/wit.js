// Headless checks for the wit pass (round 5): quack barks, per-bro quips, radio chatter and event lines, pause and title
// tips, extra signs and the bigger random-map word lists. Every new line passes the satire.js name rules and fits its box,
// no pool has duplicates, and barks and quips are rate limited so they never spam.
// Usage: node science-bros/tests/wit.js science-bros/index.html
const fs = require('fs'), vm = require('vm'), path = require('path');
const srcAll = fs.readFileSync(process.argv[2], 'utf8');
const src = srcAll.split('<script>')[1].split('</script>')[0];
const noop = () => {};
const texts = [];
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); if (k === 'fillText') return (s) => texts.push(String(s)); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, W = S.GEN_WORDS;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const wrapN = (str, n) => { const out = []; let ln = ''; for (const w of str.split(' ')) { if ((ln + ' ' + w).trim().length > n) { out.push(ln.trim()); ln = w; } else ln += ' ' + w; } if (ln.trim()) out.push(ln.trim()); return out; };
const fits = (str, n, lines) => wrapN(str, n).length <= lines && wrapN(str, n).every((l) => l.length <= n);
const over = (list, ok) => list.filter((x) => !ok(x));
const dupes = (list) => list.filter((x, i) => list.indexOf(x) !== i);
const N = S.nLevels;

// ---- the pools grew by the amounts added in this round (the sizes before the round are the baseline)
const base = { quack: 30, who: 13, scheme: 19, close: 9, debrief: 8, intel: 21, neon: 9, sign: 7, bossSub: 11, hq: 7, quips: 12 };
const grew = { quack: 12, who: 5, scheme: 8, close: 4, debrief: 4, intel: 8, neon: 9, sign: 14, bossSub: 8 };
for (const k of Object.keys(grew)) check('GEN_WORDS.' + k + ' grew by ' + grew[k], W[k].length === base[k] + grew[k], W[k].length + ' lines');
check('HQ_DEATH grew by 8', S.HQ_DEATH.length === base.hq + 8, S.HQ_DEATH.length);
check('BRO_QUIPS (rescue lines) grew by 8', S.BRO_QUIPS.length === base.quips + 8, S.BRO_QUIPS.length);
const barkCount = S.QUACK_BARKS.spot.length + S.QUACK_BARKS.hit.length + S.QUACK_BARKS.die.length + Object.values(S.TYPE_BARKS).flat().length;
check('quack barks: 40 generic plus 12 for special types', barkCount === 52, barkCount);
const bros = S.BROS.map((b) => b.id);
check('every bro has a kill shout, a special line and a respawn line', bros.every((id) => S.BRO_LINES[id] && S.BRO_LINES[id].k && S.BRO_LINES[id].s && S.BRO_LINES[id].r) && Object.keys(S.BRO_LINES).length === bros.length, bros.length + ' bros, ' + Object.keys(S.BRO_LINES).length + ' entries');
check('radio chatter has 16 lines, event radio has 3 extra lines per event, 28 tips, 60 level signs', S.RADIO_CHATTER.length === 16 && Object.keys(S.EVENT_EXTRA).length === 7 && Object.values(S.EVENT_EXTRA).every((a) => a.length === 3) && S.PAUSE_TIPS.length === 28 && Object.values(S.WIT_SIGNS).flat().length === 60);
check('every campaign mission has its three signs', Array.from({ length: N }, (_, l) => S.levelDef(l).name).every((n) => (S.WIT_SIGNS[n] || []).length === 3));
check('every event has extra radio lines', Object.keys(S.EVENT_RADIO).every((k) => S.EVENT_EXTRA[k]));

// ---- every new line passes the satire.js name rules (the block list is read from that test)
const satSrc = fs.readFileSync(path.join(__dirname, 'satire.js'), 'utf8');
const BLOCK = eval(satSrc.match(/const BLOCK = (\[[\s\S]*?\n\]);/)[1]);
const newLines = [].concat(
  ...Object.values(S.QUACK_BARKS), ...Object.values(S.TYPE_BARKS), ...Object.values(S.BRO_LINES).flatMap((o) => [o.k, o.s, o.r]), S.RADIO_CHATTER.map((x) => x[1]), ...Object.values(S.EVENT_EXTRA).map((a) => a.map((x) => x[1])),
  S.PAUSE_TIPS, Object.values(S.WIT_SIGNS).flat(), S.HQ_DEATH, S.BRO_QUIPS, W.quack, W.who, W.scheme, W.close, W.debrief, W.intel, W.neon, W.sign, W.bossSub, S.ACH.map((a) => a[1] + ' ' + a[2]));
const hits = [];
for (const b of new Set(BLOCK)) { const re = new RegExp('(^|[^A-Za-z])' + b.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '([^A-Za-z]|$)', 'i'); const bad = newLines.find((l) => re.test(l)); if (bad) hits.push(b + ' in "' + bad + '"'); }
check('no new line names a real brand, platform, company or living person (' + new Set(BLOCK).size + ' names, ' + newLines.length + ' lines)', !hits.length, hits.join('; '));
const slurs = /\b(retard|cripple|spastic|midget|tard)\w*/i;
check('no new line uses a slur', !newLines.some((l) => slurs.test(l)));

// ---- no duplicates, and every line fits its box
for (const [name, list] of Object.entries({ barks: [].concat(...Object.values(S.QUACK_BARKS), ...Object.values(S.TYPE_BARKS)), tips: S.PAUSE_TIPS, chatter: S.RADIO_CHATTER.map((x) => x[1]), hq: S.HQ_DEATH, rescue: S.BRO_QUIPS, quack: W.quack, who: W.who, scheme: W.scheme, close: W.close, debrief: W.debrief, intel: W.intel, neon: W.neon, sign: W.sign, bossSub: W.bossSub, wit_signs: Object.values(S.WIT_SIGNS).flat(), bro_kill: Object.values(S.BRO_LINES).map((o) => o.k), bro_special: Object.values(S.BRO_LINES).map((o) => o.s), bro_respawn: Object.values(S.BRO_LINES).map((o) => o.r), event_all: Object.values(S.EVENT_RADIO).map((e) => e[1]).concat(...Object.values(S.EVENT_EXTRA).map((a) => a.map((x) => x[1]))) })) {
  const d = dupes(list); check('no duplicates in ' + name, !d.length, d.join(' | '));
}
const radioLines = [].concat(S.RADIO_CHATTER.map((x) => x[1]), ...Object.values(S.EVENT_EXTRA).map((a) => a.map((x) => x[1])), Object.values(S.BRO_LINES).flatMap((o) => [o.s, o.r]), S.HQ_DEATH, S.BRO_QUIPS);
let bad = over(radioLines, (s) => fits(s, 43, 3));
check('every new radio line fits the radio box (3 lines of 43)', !bad.length, bad.join(' | '));
check('every chatter and event speaker is in the cast', S.RADIO_CHATTER.concat(...Object.values(S.EVENT_EXTRA)).every(([who]) => S.CAST[who]));
bad = over([].concat(...Object.values(S.QUACK_BARKS), ...Object.values(S.TYPE_BARKS)), (s) => s.length <= 22);
check('every bark is at most 22 characters (about 130 px, well inside the 480 px screen)', !bad.length, bad.join(' | '));
bad = over(Object.values(S.BRO_LINES), (o) => o.k.length <= 24);
check('every bro kill shout is at most 24 characters', !bad.length, bad.map((o) => o.k).join(' | '));
bad = over(S.PAUSE_TIPS, (s) => ('TIP: ' + s).length <= 76);
check('every tip fits one line on the pause and title screens (76 characters with the label)', !bad.length, bad.join(' | '));
bad = over(Object.values(S.WIT_SIGNS).flat().concat(W.sign), (s) => s.length <= 19);
check('every sign fits its board (19 characters)', !bad.length, bad.join(' | '));
bad = over(W.neon, (s) => s.length <= 16);
check('every neon sign fits its frame (16 characters)', !bad.length, bad.join(' | '));
bad = over(W.bossSub, (s) => s.length <= 60);
check('every boss subtitle fits the banner (60 characters)', !bad.length, bad.join(' | '));
bad = over(W.intel, (s) => s.length <= 76);
check('every intel file fits the banner (76 characters)', !bad.length, bad.join(' | '));
bad = over(W.debrief, (s) => s.length <= 70);
check('every debrief line fits (70 characters)', !bad.length, bad.join(' | '));
bad = over(W.quack, (s) => s.length <= 15);
check('every random-map name word is at most 15 characters', !bad.length, bad.join(' | '));
bad = over(S.ACH, (a) => a[1].length <= 22 && a[2].length <= 37).map((a) => a[1]);
check('every trophy name and line fits its column', !bad.length, bad.join(', '));
check('there are still 19 trophies', S.ACH.length === 19);

// ---- extra signs are placed on flat, open ground, spread out, away from spawns
let placed = 0, miss = [], clash = [];
for (let l = 0; l < N; l++) {
  S.startLevel(l);
  const want = S.WIT_SIGNS[S.levelDef(l).name], got = S.decor().filter((d) => d.kind === 'sign' && want.includes(d.text));
  placed += got.length; if (got.length < 2) miss.push(S.levelDef(l).name + ':' + got.length);
  const all = S.decor().filter((d) => d.kind === 'sign' || d.kind === 'plaque');
  for (const g of got) {
    const half = Math.ceil((g.text.length * 6 + 6) / 32), wide = Array.from({ length: 2 * half + 1 }, (_, i) => g.c - half + i).every((c) => !S.isSolidT(S.tileAt(c, g.r - 1)) && !S.isSolidT(S.tileAt(c, g.r - 2)));
    const solid = S.isSolidT(S.tileAt(g.c, g.r)), open = wide && [1, 2, 3, 4].every((k) => !S.isSolidT(S.tileAt(g.c, g.r - k)));
    if (!solid || !open || all.some((o) => o !== g && Math.abs(o.c - g.c) < 9 && o.kind === 'sign' && want.includes(o.text)) || S.spawnsNow().some((s) => Math.abs(s.c - g.c) < 3)) clash.push(S.levelDef(l).name + ' col ' + g.c);
  }
}
check('at least two of the three extra signs are placed in every mission', !miss.length, miss.join(', ') + '; ' + placed + ' of 54 placed');
check('extra signs stand on solid ground with the whole board in open air, 9 columns apart, away from spawns', !clash.length, clash.join(', '));
S.reset();
S.startLevel(0);
check('placing the extra signs does not use Math.random (decor seeds are fixed)', S.decor().filter((d) => S.WIT_SIGNS['PLACEBO ISLAND'].includes(d.text)).every((d) => d.seed === 3 || d.seed === 4 || d.seed === 5));
const r1 = JSON.stringify(S.decor().map((d) => [d.kind, d.c, d.r, d.text])); S.startLevel(0);
check('the same mission gets the same extra signs every time', JSON.stringify(S.decor().filter((d) => S.WIT_SIGNS['PLACEBO ISLAND'].includes(d.text)).map((d) => d.c)) === JSON.stringify(JSON.parse(r1).filter((d) => S.WIT_SIGNS['PLACEBO ISLAND'].includes(d[3])).map((d) => d[1])));

// ---- barks show in play and never spam
const stepN = (n) => { for (let i = 0; i < n; i++) { for (const k in S.pressed) S.pressed[k] = false; S.step(1 / 60); } };
const barkSet = new Set([].concat(...Object.values(S.QUACK_BARKS), ...Object.values(S.TYPE_BARKS)));
S.startLevel(0); S.resetWit();
const quack = S.ents.find((e) => e.type === 'grunt');
Object.assign(S.cam, { x: Math.max(0, quack.x - 200), y: quack.y - 100 });
const seenFx = new Set(), start = S.lifeT;
let pool = [];
for (let i = 0; i < 1200; i++) { // 20 seconds: ask for a bark of each kind every frame
  S.P.inv = 99; quack.dead = false; quack.hp = 99; Object.assign(S.cam, { x: Math.max(0, quack.x - 200), y: quack.y - 100 });
  S.bark(quack, ['spot', 'hit', 'die'][i % 3]);
  for (const f of S.fx) if (f.kind === 'text' && barkSet.has(f.txt)) { seenFx.add(f); pool.push(f.txt); }
  stepN(1);
}
const secs = (S.lifeT - start);
check('barks show up as floating text over the quack', seenFx.size > 0, seenFx.size + ' barks in ' + secs.toFixed(1) + ' s');
check('barks are rate limited: at most one every 2.4 s', seenFx.size <= Math.ceil(secs / 2.4) + 1, seenFx.size + ' barks in ' + secs.toFixed(1) + ' s');
check('bark lines vary (not the same line over and over)', new Set(pool).size >= Math.min(5, seenFx.size), new Set(pool).size + ' different');
S.resetWit(); S.fx.length = 0; Object.assign(S.cam, { x: 0, y: 0 });
const far = Object.assign({}, quack, { x: S.cam.x + 5000 });
S.bark(far, 'spot');
check('a quack off screen never barks', !S.fx.some((f) => f.kind === 'text' && barkSet.has(f.txt)));

// ---- bro quips: special and kill lines are rate limited and use the bro's own line
S.startLevel(0); S.resetWit();
const bro = S.BRO.curie; S.P.bro = bro;
S.radioQ.length = 0;
for (let i = 0; i < 12; i++) S.broQuip('s');
const sq = S.radioQ.filter((m) => m.who === 'bro').map((m) => m.line);
check('a special draws the bro\'s own radio line', sq.length === 1 && sq[0] === S.BRO_LINES.curie.s, sq.join(' | '));
S.fx.length = 0;
for (let i = 0; i < 100; i++) S.broQuip('k');
const kq = S.fx.filter((f) => f.kind === 'text' && f.txt === S.BRO_LINES.curie.k);
check('kill shouts are rare: one in a hundred kills in no time at all', kq.length === 1, kq.length);
for (const id of bros) { S.P.bro = S.BRO[id]; S.resetWit(); S.radioQ.length = 0; S.broQuip('s'); S.broQuip('s'); if (!S.radioQ.some((m) => m.line === S.BRO_LINES[id].s)) { check('every bro quips on a special (' + id + ')', false); break; } }

// ---- a killed bro and the next one: the respawn line shows on every second respawn
S.startLevel(0); S.resetWit(); S.radioQ.length = 0;
let lines = [];
for (let d = 0; d < 4; d++) {
  S.P.inv = 0; S.killPlayer('shot', 1);
  for (let i = 0; i < 400 && !S.P.alive || i < 5; i++) { stepN(1); if (S.P.alive && i > 3) break; }
  for (const m of S.radioQ) if (Object.values(S.BRO_LINES).some((o) => o.r === m.line)) lines.push(m.line);
  S.radioQ.length = 0; stepN(30);
}
check('the respawn quip shows on about every second respawn', lines.length >= 1 && lines.length <= 2, lines.length + ' of 4');

// ---- events: four calls cover the original line and the three extras
S.startLevel(0);
const evSeen = {};
for (const name of Object.keys(S.EVENT_RADIO)) { evSeen[name] = new Set(); for (let i = 0; i < 4; i++) { S.radioQ.length = 0; S.forceEvent(name); for (const m of S.radioQ) evSeen[name].add(m.line); } }
check('each event cycles through four different radio lines', Object.values(evSeen).every((s) => s.size === 4), Object.entries(evSeen).map(([k, s]) => k + ':' + s.size).join(' '));

// ---- radio chatter: arrives when the air is quiet, about once every 100 s, from the pool
S.startLevel(1); S.radioQ.length = 0;
const chat = new Set(S.RADIO_CHATTER.map((x) => x[1])), heard = [];
let last = null;
for (let i = 0; i < 60 * 260; i++) { S.P.inv = 99; S.step(1 / 60); const c = S.radioCur; if (c && c !== last && chat.has(c.line)) heard.push(c.line); last = c || last; if (S.state !== 'play') break; }
check('chatter shows up in play, from the chatter pool', heard.length >= 1, heard.length + ' lines in 260 s');
check('chatter is rare: no more than one line per 90 seconds', heard.length <= 3, heard.length + ' lines in 260 s');

// ---- tips: pause screen and title screen draw one
S.startLevel(0); texts.length = 0;
S.pressed.pause = true; S.step(1 / 60); S.pressed.pause = false;
S.render(1);
check('the pause screen shows a tip', texts.some((t) => t.startsWith('TIP: ') && S.PAUSE_TIPS.includes(t.slice(5))), S.paused + ' ' + texts.filter((t) => t.startsWith('TIP')).join('|'));
const first = texts.find((t) => t.startsWith('TIP: '));
S.pressed.pause = true; S.step(1 / 60); S.pressed.pause = false; S.pressed.pause = true; S.step(1 / 60); S.pressed.pause = false; texts.length = 0; S.render(1);
check('the next pause shows a different tip', texts.find((t) => t.startsWith('TIP: ')) !== first);
S.pressed.pause = true; S.step(1 / 60); S.pressed.pause = false;
S.setState('title'); texts.length = 0; const seenTip = new Set();
for (let t = 0; t < 8 * 6; t += 8) { texts.length = 0; S.render(t); const tip = texts.find((x) => x.startsWith('TIP: ')); if (tip) seenTip.add(tip); }
check('the title screen shows a tip that changes every 8 seconds', seenTip.size === 6 && [...seenTip].every((t) => S.PAUSE_TIPS.includes(t.slice(5))), seenTip.size + ' different');
console.log(fails ? fails + ' check(s) failed' : 'all wit checks passed');
process.exit(fails ? 1 : 0);
