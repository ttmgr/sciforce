// Headless checks for the story: every mission has its script, the radio speaks at the start, the first
// checkpoint, when the boss wakes and when it goes down; the briefing shows the act and an intercepted message;
// the end screen rolls the epilogue.
// Usage: node science-bros/tests/story.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const texts = [];
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); if (k === 'fillText') return (s) => texts.push(String(s)); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; if (i % 10 === 0) S.render(i / 60); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const N = S.nLevels;
// every mission has a full script, spoken by known characters, in lines that fit the radio box
let missing = [], badWho = [], long = [];
for (let l = 0; l < N; l++) {
  const name = S.levelDef(l).name, st = S.STORY[name];
  if (!st || !st.intercept || !st.start.length || !st.mid.length || !st.boss.length || !st.win.length) { missing.push(name); continue; }
  for (const [who, line] of [st.intercept, ...st.start, ...st.mid, ...st.boss, ...st.win, ...(st.midboss || [])]) {
    if (!S.CAST[who] && who !== 'bro') badWho.push(who);
    if (line.length > 90) long.push(name + ': ' + line.length);
  }
}
check('every mission has a story script', missing.length === 0, missing.join(', '));
check('every line is spoken by a known character', badWho.length === 0, badWho.join(','));
check('every line fits the radio box (90 characters)', long.length === 0, long.join(' | '));
// acts
const acts = []; for (let l = 0; l < N; l++) { const a = S.actOf(l); acts.push(a && a.num); }
check('the campaign has four acts in order', JSON.stringify([...new Set(acts)]) === JSON.stringify(['ACT I', 'ACT II', 'ACT III', 'FINALE']), [...new Set(acts)].join(','));
check('the finale is its own act', S.actOf(N - 1).num === 'FINALE' && S.actOf(N - 1).first);
// the radio during a mission
S.startLevel(0); S.endCeasefire();
check('the mission start queues its radio lines', S.radioQ.length === S.STORY['PLACEBO ISLAND'].start.length);
let heard = []; for (let i = 0; i < 60 * 12; i++) { S.P.inv = 1e9; run(1); if (S.radioCur && !heard.includes(S.radioCur.line)) heard.push(S.radioCur.line); }
check('HQ speaks at the start of the mission', heard.includes(S.STORY['PLACEBO ISLAND'].start[0][1]), heard.length + ' lines heard');
texts.length = 0; S.say('hq', 'A test line on the radio.'); for (let i = 0; i < 60; i++) { S.P.inv = 1e9; run(1); } S.render(1);
check('the radio box shows the speaker', texts.includes('PROF. PEER REVIEW'));
const flag = S.ents.find((e) => e.type === 'flag'); S.radioQ.length = 0;
S.P.x = flag.x + 4; S.P.y = flag.y; run(3);
check('the first checkpoint brings the villain on the radio', S.radioQ.length + (S.radioCur ? 1 : 0) >= 1 && (S.radioQ.some((m) => m.who === 'placebo') || (S.radioCur && S.radioCur.who === 'placebo')));
const B = S.ents.find((e) => e.final); S.ents.forEach((e) => { if (e !== B && e.type !== 'flag') e.dead = true; }); S.radioQ.length = 0;
S.P.x = (B.trig + 2) * T; S.P.y = 2 * T; for (let i = 0; i < 60; i++) { S.P.inv = 1e9; run(1); }
check('the boss waking brings its line', B.active && (S.radioQ.some((m) => m.who === 'placebo') || (S.radioCur && /Homeopathitron/.test(S.radioCur.line))));
S.finishObjectives(); S.radioQ.length = 0; for (let k = 0; k < 400 && !B.dead; k++) { S.P.inv = 1e9; if (!B.doomed) S.hitEnemy(B, 20, 0); run(2); }
check('the boss going down brings the win line', B.dead && (S.radioQ.some((m) => /Detox Desert/.test(m.line)) || !!(S.radioCur && /Detox Desert/.test(S.radioCur.line))));
// no radio in the bonus modes
S.startMode('siege'); check('no story radio in Lab Siege', S.radioQ.length === 0); S.startMode('campaign');
// the briefing: the act and the intercepted message
S.reset(); S.pressed.pause = true; run(1); for (let k = 0; k < 9; k++) { S.pressed.down = true; run(1); } S.pressed.fire = true; run(1);
S.pressed.start = true; run(1); S.pressed.start = true; run(1);
check('on the briefing', S.state === 'brief', S.state);
S.mapT = 3; texts.length = 0; S.render(3);
check('the briefing names the act', texts.some((t) => /ACT I: THE PLACEBO EFFECT/.test(t)), texts.filter((t) => /ACT/.test(t)).join(' | '));
check('the briefing shows an intercepted League message', texts.some((t) => /INTERCEPTED/.test(t)));
// the end screen rolls the epilogue and draws the stats afterwards
let err = null; try { for (const m of [0, 5, 12, 30]) { S.mapT = m; S.render(m); } } catch (e) { err = e; }
check('the end screen draws at every point of the epilogue', !err, err && err.message);
check('the epilogue tells what became of the cast', ['PROF. QUACKENBUSH', 'DR. PLACEBO', 'KING CITRUS', 'PROF. PEER REVIEW'].every((n) => S.EPILOGUE.includes(n)));
console.log(fails ? fails + ' check(s) failed' : 'all story checks passed');
process.exit(fails ? 1 : 0);
