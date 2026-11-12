// Headless checks for round 8 sound: every sfx name has a case, the music runs on its own bus (no pan, pitch or echo from sound effects,
// nothing straight to the speakers), five region songs, music on every screen but silent when paused / muted / off, stingers fire once,
// weapon voices differ, and the volume rows in the pause menu. A fake AudioContext records the node graph.
// Usage: node science-bros/tests/r8_audio.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };

// a fake AudioContext: currentTime is moved by hand, every node records what it connects to and what its params were told
function makeAudio() {
  const nodes = [];
  const param = (v = 0) => ({ value: v, calls: [], setValueAtTime(x, t) { this.calls.push(['set', x, t]); this.value = x; }, exponentialRampToValueAtTime(x, t) { this.calls.push(['exp', x, t]); }, linearRampToValueAtTime(x, t) { this.calls.push(['lin', x, t]); },
    cancelScheduledValues() { this.calls.push(['cancel']); }, setTargetAtTime(x, t, c) { this.calls.push(['target', x, t, c]); } });
  const node = (kind, extra = {}) => { const n = Object.assign({ kind, out: [], connect(t) { this.out.push(t); return t; }, start: noop, stop: noop }, extra); nodes.push(n); return n; };
  class FakeAC {
    constructor() { this.currentTime = 10; this.sampleRate = 8000; this.destination = { kind: 'destination', out: [] }; this.nodes = nodes; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    createGain() { return node('gain', { gain: param(1) }); }
    createOscillator() { return node('osc', { frequency: param(440), type: 'sine' }); }
    createBufferSource() { return node('src', {}); }
    createBiquadFilter() { return node('filter', { frequency: param(350), Q: param(1), type: 'lowpass' }); }
    createDelay() { return node('delay', { delayTime: param(0) }); }
    createDynamicsCompressor() { return node('comp', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
    createStereoPanner() { return node('panner', { pan: param(0) }); }
  }
  return FakeAC;
}
let pnow = 1000;
const boot = (store = {}) => {
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const FakeAC = makeAudio(), win = { __SB_TEST__: true, AudioContext: FakeAC };
  const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => pnow }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise, Number };
  vm.createContext(sb); vm.runInContext(src, sb);
  return win.__SB__;
};
const reach = (n, seen = new Set()) => { if (seen.has(n)) return seen; seen.add(n); (n.out || []).forEach((m) => reach(m, seen)); return seen; };
const newNodes = (AC, from) => AC.nodes.slice(from);

// ---- (1) every sfx name used in the game has a case
{
  const used = new Set(), body = src.slice(src.indexOf('function sfx(n, wx)'));
  const cases = new Set([...body.slice(0, body.indexOf('// ----')).matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]));
  for (const m of src.matchAll(/\bsfx\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) for (const q of m[1].replace(/[!=]==? '[a-z_]+'/g, '').matchAll(/'([a-z_]+)'/g)) used.add(q[1]); // comparisons are not sound names
  const missing = [...used].filter((n) => !cases.has(n));
  check('every sfx name used in the source has a case', missing.length === 0, 'missing: ' + missing.join(', ') + ' of ' + used.size);
  const want = ['ui_move', 'ui_ok', 'ui_back', 'ui_deny', 'tick', 'rank', 'combo', 'lifelost', 'bossintro', 'whoosh', 'checkpoint'];
  check('the eleven new names all have a case', want.every((n) => cases.has(n)), want.filter((n) => !cases.has(n)).join(', '));
}

const S = boot(); S.reset();
S.audioInit();
const AC = S.audio.AC;
check('audioInit works on the fake context', !!AC && !!S.buses().musicBus && !!S.buses().sfxBus);
const pump = (sec = 3) => { for (let i = 0; i < sec * 10; i++) { AC.currentTime += 0.1; S.updateMusic(); } }; // the game calls updateMusic every frame
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };

// ---- (2) a hard-panned effect leaves no trace on the music
S.updateMusic(); // state play, first call: the level song starts
pnow += 1000; S.sfx('hit', S.cam.x + 2000); // far to the right of the screen
check('the effect itself is panned (sanity)', AC.nodes.some((n) => n.kind === 'panner' && n.pan.value !== 0));
let from = AC.nodes.length; pump(2);
const mus = newNodes(AC, from), drums = mus.filter((n) => n.kind === 'src'), oscs = mus.filter((n) => n.kind === 'osc');
check('the music scheduled drums and notes', drums.length > 0 && oscs.length > 0, drums.length + ' drums, ' + oscs.length + ' notes');
check('music drums do not pass through a panner', drums.length > 0 && drums.every((d) => ![...reach(d)].some((n) => n.kind === 'panner' || n === S.audio.echo)));
const filt = mus.filter((n) => n.kind === 'filter');
check('drum filters keep their own frequency (no sfx pitch scaling)', filt.length > 0 && filt.every((f) => [2500, 8000].includes(f.frequency.calls[0][1])), filt.map((f) => f.frequency.calls[0][1]).slice(0, 4).join(','));
check('music notes and drums reach the speakers through the music bus and compressor', [...drums, ...oscs].every((n) => { const r = reach(n); return r.has(S.buses().musicBus) && r.has(S.buses().comp); }));

// ---- (3) nothing but the compressor connects to the speakers
{
  const direct = AC.nodes.filter((n) => n.out.includes(AC.destination));
  check('only the compressor connects straight to the destination', direct.length === 1 && direct[0].kind === 'comp', direct.map((n) => n.kind).join(','));
}

// ---- (4) five region songs
{
  const names = S.RSONG, defs = names.map((k) => S.SONGS[k]);
  check('five region songs exist', names.length === 5 && defs.every(Boolean));
  check('each has at least 64 steps, two sections, bass, lead and arp', defs.every((d) => d.len >= 64 && d.bass.some(Boolean) && d.lead.some(Boolean) && d.arp.some(Boolean)) && Object.values(S.SONG_DEFS).every((d) => d.A && d.B && new Set([...d.form]).size >= 2));
  const sig = (d) => JSON.stringify([d.bpm, d.bass, d.lead, d.k, d.s, d.h]);
  check('the five region songs differ from each other', new Set(defs.map(sig)).size === 5);
  check('they differ in key and tempo too', new Set(names.map((k) => S.SONG_DEFS[k].key)).size === 5 && new Set(defs.map((d) => d.bpm)).size === 5);
  check('boss, finale and calm songs exist, and the stingers', ['boss', 'finale', 'calm'].every((k) => S.SONGS[k]) && ['win', 'done', 'over', 'bossintro', 'trophy'].every((k) => S.STING[k]));
}

// ---- (5) music on title and map, none while paused or muted
const scheduled = (state, setup) => { S.setState(state); setup && setup(); const f = AC.nodes.length; pump(); return newNodes(AC, f).filter((n) => n.kind === 'osc').length; };
check('music plays on the title', scheduled('title') > 0);
check('music plays on the world map', scheduled('map') > 0);
check('music plays in the briefing', scheduled('brief') > 0);
scheduled('title'); check('title music is the calm song', S.music().cur === 'calm');
check('no music while paused', scheduled('play', () => S.setPaused(true)) === 0);
S.setPaused(false);
check('music plays in a level again after the pause', scheduled('play') > 0);
check('no music while muted', scheduled('play', () => S.setMuted(true)) === 0);
S.setMuted(false);
{ // a level song follows the region; only one sequencer
  S.startLevel(0); S.setState('play'); AC.currentTime += 3; S.updateMusic();
  check('a campaign level plays its region song', S.music().cur === S.RSONG[0], S.music().cur);
  const b = S.ents.length; AC.currentTime += 0.01; const f = AC.nodes.length; S.updateMusic(); const per = newNodes(AC, f).filter((n) => n.kind === 'osc').length;
  AC.currentTime += 0.01; const f2 = AC.nodes.length; S.updateMusic();
  check('one sequencer: a second call right away schedules nothing new', newNodes(AC, f2).length === 0, per + ' then ' + newNodes(AC, f2).length);
}

// ---- (6) volume
{
  S.setState('title'); S.setVol('musicVol', 0);
  check('musicVol 0 sets the bus to 0 and switches settings.music off', S.buses().musicBus.gain.value === 0 && S.settings.music === false);
  check('musicVol 0 schedules nothing', scheduled('title') === 0);
  S.setVol('musicVol', 0.75);
  check('musicVol 75% gives the old loudness (bus 1) and music on', Math.abs(S.buses().musicBus.gain.value - 1) < 1e-9 && S.settings.music === true);
  check('and schedules again', scheduled('title') > 0);
  const old = boot({ 'sciencebros.settings': JSON.stringify({ music: false, shake: true }) });
  check('an old save with music:false loads as musicVol 0', old.settings.musicVol === 0 && old.settings.music === false);
  old.audioInit(); old.setState('title'); const A2 = old.audio.AC; A2.currentTime += 3; const f = A2.nodes.length; old.updateMusic();
  check('and is silent', newNodes(A2, f).length === 0);
  const old2 = boot({ 'sciencebros.settings': JSON.stringify({ shake: true }) });
  check('an old save with no music key loads as before: music on, 75%, sfx 100%', old2.settings.music === true && old2.settings.musicVol === 0.75 && old2.settings.sfxVol === 1);
  const nw = boot({ 'sciencebros.settings': JSON.stringify({ musicVol: 0.5, sfxVol: 0.25 }) });
  check('a new save keeps both volumes', nw.settings.musicVol === 0.5 && nw.settings.sfxVol === 0.25 && nw.settings.music === true);
  const bad = boot({ 'sciencebros.settings': JSON.stringify({ musicVol: 7, sfxVol: 'x' }) });
  check('broken volumes are clamped or defaulted', bad.settings.musicVol === 1 && bad.settings.sfxVol === 1);
}

// ---- (7) stingers fire once on entering a state
{
  S.setState('play'); S.updateMusic(); const n0 = S.music().stingN;
  AC.currentTime += 5; S.setState('win'); S.updateMusic();
  check('entering win fires the win stinger', S.music().stingN === n0 + 1 && S.music().stingLast === 'win');
  AC.currentTime += 0.1; S.updateMusic(); S.updateMusic();
  check('and only once', S.music().stingN === n0 + 1);
  AC.currentTime += 8; S.setState('play'); S.updateMusic(); S.setState('over'); S.updateMusic();
  check('entering over fires the over stinger', S.music().stingN === n0 + 2 && S.music().stingLast === 'over');
  const f = AC.nodes.length; AC.currentTime += 8; S.updateMusic();
  check('game over is silent after its stinger', newNodes(AC, f).length === 0);
  S.setState('done'); S.updateMusic(); check('done has its own stinger', S.music().stingLast === 'done');
  S.setState('modedone'); S.updateMusic(); check('modedone plays the win stinger', S.music().stingLast === 'win');
  S.setState('title'); S.updateMusic();
}

// ---- (8) weapon voices
{
  const shotOsc = (id) => {
    S.reset(); S.setState('play'); S.endCeasefire(); S.P.bro = S.BRO[id]; S.P.alt = null; S.P.cool = 0; pnow += 1000;
    const f = AC.nodes.length; step({ fire: true }); step({});
    const o = newNodes(AC, f).filter((n) => n.kind === 'osc' && n.frequency.calls.length && n.frequency.calls[0][1] > 500);
    return o.length ? { type: o[0].type, f0: o[0].frequency.calls[0][1] } : null;
  };
  const a = shotOsc('einstein'), b = shotOsc('turing'), c = shotOsc('gauss');
  check('einstein, turing and gauss each produced a shot oscillator', !!a && !!b && !!c, JSON.stringify([a, b, c]));
  check('two bros that both use shot get different oscillator settings', a && b && c && a.type !== b.type && b.type !== c.type && Math.abs(b.f0 / a.f0 - 1) > 0.2 && Math.abs(c.f0 / a.f0 - 1) > 0.2, JSON.stringify([a, b, c]));
  const ids = Object.keys(S.BRO), keyOf = (id) => S.voiceOf(id).slice(0, 2).join('/') + '/' + S.voiceOf(id)[2];
  check('every bro has a voice, and the 23 named ones are all different', ids.every((id) => S.voiceOf(id).length === 3) && new Set(['einstein', 'ada', 'turing', 'mendel', 'pasteur', 'hubble', 'hopper', 'wu', 'rutherford', 'mendeleev', 'gauss', 'schrodinger', 'fibonacci', 'linnaeus', 'jemison', 'curie', 'newton', 'johnson', 'hypatia', 'davinci', 'nobel', 'torricelli', 'nightingale'].map(keyOf)).size === 23);
}

// ---- ducking, new sounds, throttle
{
  const f = AC.nodes.length; pnow += 1000; S.sfx('boom'); const bus = S.buses().musicBus;
  check('boom ducks the music bus (gain automation on the audio clock)', bus.gain.calls.some((c) => c[0] === 'target' && c[1] < 0.6 * bus.gain.value + 1e-9 + 1) && bus.gain.calls.filter((c) => c[0] === 'target').length >= 2);
  let k = bus.gain.calls.length; pnow += 1000; S.sfx('nuke'); const nuke = bus.gain.calls.slice(k).filter((c) => c[0] === 'target');
  k = bus.gain.calls.length; pnow += 1000; S.sfx('boom'); const boom = bus.gain.calls.slice(k).filter((c) => c[0] === 'target');
  check('nuke ducks longer than boom', nuke.length === 2 && boom.length === 2 && nuke[1][2] - nuke[0][2] > boom[1][2] - boom[0][2], (nuke[1][2] - nuke[0][2]).toFixed(2) + ' vs ' + (boom[1][2] - boom[0][2]).toFixed(2));
  let g = AC.nodes.length; pnow += 1000; ['ui_move', 'ui_ok', 'ui_back', 'ui_deny', 'rank', 'combo', 'lifelost', 'bossintro', 'whoosh', 'checkpoint'].forEach((n) => { pnow += 100; S.sfx(n); });
  check('the new effects make sound', newNodes(AC, g).filter((n) => n.kind === 'osc' || n.kind === 'src').length >= 10);
  g = AC.nodes.length; pnow += 1000; S.sfx('tick'); pnow += 30; S.sfx('tick'); pnow += 10; S.sfx('tick');
  check('tick repeats at 25 ms (two of the three fire)', newNodes(AC, g).filter((n) => n.kind === 'osc').length === 2);
  g = AC.nodes.length; pnow += 1000; S.sfx('ui_move'); pnow += 30; S.sfx('ui_move');
  check('other names keep the 45 ms throttle', newNodes(AC, g).filter((n) => n.kind === 'osc').length === 1);
  S.setCombo(1, 1); pnow += 1000; g = AC.nodes.length; S.sfx('combo'); const lo = newNodes(AC, g).find((n) => n.kind === 'osc').frequency.calls[0][1];
  S.setCombo(30, 1); pnow += 1000; g = AC.nodes.length; S.sfx('combo'); const hi = newNodes(AC, g).find((n) => n.kind === 'osc').frequency.calls[0][1];
  S.setCombo(60, 1); pnow += 1000; g = AC.nodes.length; S.sfx('combo'); const hi2 = newNodes(AC, g).find((n) => n.kind === 'osc').frequency.calls[0][1];
  check('combo pitch rises with the count and is capped', hi > lo * 1.3 && Math.abs(hi2 / hi - 1) < 0.15, [lo, hi, hi2].map(Math.round).join(' '));
  S.setCombo(0, 0);
}

// ---- intensity layer
{
  S.reset(); S.setState('play'); S.startLevel(0); S.endCeasefire(); S.setCombo(0, 0); S.ents.forEach((e) => { e.aware = false; });
  const count = () => { const f = AC.nodes.length; pump(8); return newNodes(AC, f).filter((n) => n.kind === 'osc' || n.kind === 'src').length; };
  pump(1); const calm = count();
  S.setCombo(5, 2); const hot = count(); S.setCombo(0, 0);
  check('a running combo adds the intensity layer', hot > calm, calm + ' vs ' + hot);
}

// ---- pause menu rows
{
  S.reset(); S.setState('play'); S.setPaused(false); step({}); S.pressed.pause = true; step({}); const n = S.pauseItems().length;
  check('the pause list keeps its 10 entries and MUSIC stays in place', n === 10 && S.pauseItems()[2][0] === 'MUSIC');
  const vals = []; for (let i = 0; i < 2; i++) { S.pressed.down = true; step({}); }
  for (let i = 0; i < 5; i++) { S.pressed.fire = true; step({}); vals.push(S.settings.musicVol); }
  check('fire on MUSIC cycles 100, OFF, 25, 50, 75 %', JSON.stringify(vals) === JSON.stringify([1, 0, 0.25, 0.5, 0.75]), vals.join(','));
  check('and keeps settings.music in step', S.settings.music === true);
  S.pressed.fire = true; step({}); S.pressed.fire = true; step({}); check('music flag is false at OFF', S.settings.musicVol === 0 && S.settings.music === false);
  for (let i = 0; i < 2; i++) { S.pressed.fire = true; step({}); } // 25 %, 50 %
  while (S.menuSel() !== n + 2) { S.pressed.down = true; step({}); }
  const sv = []; for (let i = 0; i < 6; i++) { S.pressed.right = true; step({}); sv.push(S.settings.sfxVol); }
  check('right on SOUND cycles through OFF and 25-100 %', JSON.stringify(sv) === JSON.stringify([0, 0.25, 0.5, 0.75, 1, 0]), sv.join(','));
  S.pressed.left = true; step({}); check('left on SOUND goes back', S.settings.sfxVol === 1);
  S.pressed.down = true; step({}); check('the cursor wraps from SOUND to the first row', S.menuSel() === 0);
  let threw = false; try { S.render(1); } catch (e) { threw = true; console.log(e); } check('the pause screen draws', !threw);
  S.pressed.pause = true; step({});
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
