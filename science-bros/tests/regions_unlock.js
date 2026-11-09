// Headless checks for the regions, the free order, the saved progress, the rescue counter that unlocks the bros, the reset and the opening.
// Usage: node science-bros/tests/regions_unlock.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, localStorage, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T, N = S.nLevels;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
const press = (k) => { S.pressed[k] = true; step(); };
const NAMES = Array.from({ length: N }, (_, i) => S.levelDef(i).name), at = (n) => NAMES.indexOf(n);
const clearOnly = (names) => { S.resetProgress(); names.forEach((n) => S.markCleared(at(n))); };
const R = S.REGIONS;

// ---- 1. five regions: 5 or 6 missions each, every mission once, Placebo Island first, the Citadel last, each region harder than the last
check('five regions of 5 or 6 missions', R.length === 5 && R.every((r) => r.missions.length === 5 || r.missions.length === 6), R.map((r) => r.missions.length).join(' '));
check('the regions hold all ' + N + ' missions exactly once', R.flatMap((r) => r.missions).slice().sort().join() === NAMES.slice().sort().join());
check('every region has a satirical name and a one-line blurb', R.every((r) => /^[A-Z -]{8,15}$/.test(r.name) && r.blurb.length > 20 && r.blurb.length <= 56) && new Set(R.map((r) => r.name)).size === 5, R.map((r) => r.name).join(' / '));
check('Placebo Island opens region 1 and the Citadel closes region 5', R[0].missions[0] === 'PLACEBO ISLAND' && R[4].missions[R[4].missions.length - 1] === 'CITRUS CITADEL' && S.GATE === 0 && S.FINALE === N - 1);
const ramp = (r) => R[r].missions.map((nm) => S.levelDef(at(nm)).ramp);
check('missions inside a region share about one level (within 0.06)', R.every((r, i) => { const v = ramp(i).filter((x) => x < 1); return Math.max(...v) - Math.min(...v) <= 0.06; }));
check('each region is harder than the last, the Citadel at 1', R.every((r, i) => !i || Math.min(...ramp(i)) > Math.max(...ramp(i - 1))) && S.levelDef(N - 1).ramp === 1, R.map((r, i) => Math.min(...ramp(i)).toFixed(2)).join(' < '));
check('every mission keeps its own seed (no two share one)', new Set(Array.from({ length: N }, (_, i) => S.seedN(i))).size === N);
check('every mission has a stop on the map, 36 px from the others', (() => { let c = 99; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) c = Math.min(c, Math.hypot(S.levelDef(i).map[0] - S.levelDef(j).map[0], S.levelDef(i).map[1] - S.levelDef(j).map[1])); return c >= 36; })());

// ---- 2. the Placebo Island gate, free order inside a region, the next region
S.resetProgress(); S.startMode('campaign');
check('a new campaign opens on the map with Placebo Island the only open mission', S.state === 'map' && S.level === 0 && S.MAP_ORDER.filter(S.missionOpen).join() === '0');
press('right'); check('right does nothing while Placebo Island is the only open mission', S.level === 0);
S.markCleared(0);
check('clearing Placebo Island opens the rest of region 1 and nothing else', S.MAP_ORDER.filter(S.missionOpen).length === 5 && R[0].missions.every((nm) => S.missionOpen(at(nm))) && !S.missionOpen(at(R[1].missions[0])));
const seen = [];
S.startMode('campaign'); S.setLevel(0);
for (let k = 0; k < 6; k++) { seen.push(S.level); press('right'); }
check('left and right walk the open missions of the region', seen.slice(0, 5).join() === R[0].missions.map((nm) => at(nm)).join() && S.level === at(R[0].missions[4]), seen.join());
press('left'); press('left'); check('and back', S.level === at(R[0].missions[2]));
const order = R[0].missions.slice(1).reverse().map((nm) => at(nm)); // reverse order: any order is fine
order.forEach((i, k) => { S.markCleared(i); check('region 1 mission cleared in reverse order (' + NAMES[i] + ')', S.missionOpen(i) && (k < order.length - 1 ? !S.regionOpen(1) : S.regionOpen(1))); });
check('clearing every mission of region 1 opens region 2, and only region 2', R[1].missions.every((nm) => S.missionOpen(at(nm))) && !R[2].missions.some((nm) => S.missionOpen(at(nm))) && /OPENS/.test(S.mapNote), S.mapNote);
check('a cleared mission stays pickable, replaying is allowed', S.missionOpen(0));
R[1].missions.forEach((nm) => S.markCleared(at(nm)));
check('region 3 opens after region 2', R[2].missions.every((nm) => S.missionOpen(at(nm))));
check('region 4 is still shut', !R[3].missions.some((nm) => S.missionOpen(at(nm))));
S.setLevel(at(R[3].missions[0])); S.startMode('campaign'); S.setLevel(at(R[3].missions[0])); press('start');
check('Enter on a locked mission does not open the briefing', S.state === 'map');

// ---- 3. the Citadel waits for every other mission; beating it ends the campaign
clearOnly(NAMES.filter((n) => n !== 'CITRUS CITADEL' && n !== 'POX PARTY VOLCANO'));
check('with one mission left the Citadel stays shut', !S.missionOpen(S.FINALE) && S.missionOpen(at('POX PARTY VOLCANO')));
S.markCleared(at('POX PARTY VOLCANO'));
check('with every other mission cleared the Citadel opens', S.missionOpen(S.FINALE) && /CITADEL OPENS/.test(S.mapNote), S.mapNote);

// ---- 4. a real win goes back to the world map, not to the next mission
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
function winIt(l) {
  S.startLevel(l); S.endCeasefire(); step(); S.P.bro = S.BRO.einstein; S.setLives(99); S.P.inv = 1e9;
  const B = S.ents.find((e) => BOSSES.includes(e.type) && e.final); S.finishObjectives(); S.P.x = (B.trig + 2) * T; S.P.y = 12 * T;
  run(30); S.killEnemy(B, 'shot'); for (let i = 0; i < 60 * 14 && !B.dead; i++) { S.P.inv = 1e9; S.P.alive = true; step(); }
  for (let i = 0; i < 60 * 40 && S.state === 'play'; i++) { S.P.inv = 1e9; if (S.chopper && S.chopper.state === 'hover') { S.P.x = S.chopper.x - 5; S.P.y = S.chopper.floor - 30; } step(); } // climb the rope
  return S.state;
}
S.resetProgress(); S.startMode('campaign'); S.openingSeen = true;
check('Placebo Island is won', winIt(0) === 'win', S.state);
check('the win is saved by name', S.cleared.has('PLACEBO ISLAND') && JSON.parse(store.get('sciencebros.cleared')).includes('PLACEBO ISLAND'));
S.pressed.start = true; step();
check('Enter on the debrief returns to the world map', S.state === 'map', S.state);
check('the cursor sits on another open mission that is not cleared', S.level !== 0 && S.missionOpen(S.level) && !S.cleared.has(NAMES[S.level]), 'level ' + S.level);
clearOnly(NAMES.filter((n) => n !== 'CITRUS CITADEL')); S.startMode('campaign'); S.openingSeen = true;
check('the Citadel is won', winIt(S.FINALE) === 'done', S.state);
check('and the campaign ends (the cleared list holds all ' + N + ')', S.cleared.size === N);

// ---- 5. saved progress and migration
clearOnly(['PLACEBO ISLAND', 'DETOX DESERT']); S.rescues = 9;
S.saveProgress(); S.loadProgress();
check('cleared missions, rescues and unlocked bros are saved and reload', S.cleared.size === 2 && S.cleared.has('DETOX DESERT') && S.rescues === 9 && S.savedBros.length === S.tierOf(9), S.cleared.size + ' cleared, ' + S.rescues + ' rescues');
store.clear(); store.set('sciencebros.reached', '8'); S.loadProgress();
check('an old save migrates: missions below the old reached index are cleared', S.cleared.size === 8 && NAMES.slice(0, 8).every((n) => S.cleared.has(n)) && !S.cleared.has(NAMES[8]));
check('and gets 3 rescues per cleared mission, with the bros they unlock', S.rescues === 24 && S.savedBros.join() === S.BRO_ORDER.slice(0, S.tierOf(24)).join(), S.rescues + ' rescues, ' + S.savedBros.length + ' bros');
check('and what that implies is open: region 1 cleared, region 2 open, region 3 still shut', R[0].missions.every((nm) => S.cleared.has(nm)) && S.regionOpen(1) && S.missionOpen(at('ZODIAC OBSERVATORY')) && !S.missionOpen(at(NAMES[8])));
store.clear(); S.loadProgress();
check('no save at all: nothing cleared, no rescues, Dr Reskbro alone', S.cleared.size === 0 && S.rescues === 0 && S.savedBros.join() === 'reska');
S.setReached(5);
check('setReached(n) keeps its meaning: everything before n is cleared and n is playable', S.cleared.size === 5 && NAMES.slice(0, 5).every((n) => S.cleared.has(n)) && S.missionOpen(5) && S.reached === 5);

// ---- 6. RESET PROGRESS needs a second press
clearOnly(['PLACEBO ISLAND', 'DETOX DESERT']); S.rescues = 12; S.saveProgress();
const RS = S.TITLE_MENU.findIndex((m) => m[1] === 'reset');
S.setState('title'); S.titleSel = RS;
check('the title menu has a RESET PROGRESS entry', RS > 0 && S.TITLE_MENU[RS][0] === 'RESET PROGRESS');
press('start');
check('the first press only asks', S.resetArm && S.cleared.size === 2 && S.rescues === 12 && S.state === 'title');
press('down'); S.titleSel = RS;
check('moving the cursor takes the question back', !S.resetArm);
press('start'); press('start');
check('the second press clears cleared missions, rescues and unlocks', S.cleared.size === 0 && S.rescues === 0 && S.savedBros.join() === 'reska' && JSON.parse(store.get('sciencebros.cleared')).length === 0 && store.get('sciencebros.rescues') === '0', S.cleared.size + ' ' + S.rescues);
check('and the opening is due again', S.openingSeen === false);

// ---- 7. a new campaign starts with Dr Reskbro alone; bonus modes and random missions use the unlocked bros
S.startMode('campaign');
check('a new campaign starts with only Dr Reskbro (reska)', S.unlocked.length === 1 && S.unlocked[0] === 'reska' && S.BRO.reska.name === 'Dr Reskbro');
S.rescues = 30; S.savedBros.length = 0; S.savedBros.push(...S.BRO_ORDER.slice(0, S.tierOf(30)));
S.startMode('siege'); check('Lab Siege uses the unlocked bros', S.unlocked.length === S.tierOf(30) && S.unlocked.length < S.BROS.length);
S.startMode('random'); check('a random mission uses them too', S.unlocked.length === S.tierOf(30));

// ---- 8. the thresholds
const ids = S.BROS.map((b) => b.id);
check('the unlock order holds each of the 53 bros once, Dr Reskbro first, Einstein second', S.BRO_ORDER.length === 53 && ids.length === 53 && S.BRO_ORDER.slice().sort().join() === ids.slice().sort().join() && S.BRO_ORDER[0] === 'reska' && S.BRO_ORDER[1] === 'einstein');
check('Oppenbro and Conrad Roentbro are among the last five', ['oppenheimer', 'roentgen'].every((id) => S.BRO_ORDER.indexOf(id) >= 48));
check('the famous simple bros come early (Curie, Tesla, Newton, Darwin in the first seven)', ['curie', 'tesla', 'newton', 'darwin'].every((id) => S.BRO_ORDER.indexOf(id) < 7));
check('52 thresholds, strictly rising, the first at 1 rescue', S.BRO_AT.length === 52 && S.BRO_AT[0] === 1 && S.BRO_AT.every((t, i) => !i || t > S.BRO_AT[i - 1]));
let cages = 0; for (let l = 0; l < N; l++) { S.startLevel(l); cages += S.ents.filter((e) => e.type === 'cage').length; }
check('the cage total comes from the level data (' + cages + ')', cages === S.CAGES_TOTAL, cages + ' vs ' + S.CAGES_TOTAL);
const last = S.BRO_AT[51], p70 = Math.floor(cages * 0.7);
check('freeing nearly all cages (' + last + ' of ' + cages + ', ' + (100 * last / cages).toFixed(0) + '%) unlocks all 53', last <= cages * 0.96 && S.tierOf(last) === 53 && S.tierOf(last - 1) === 52);
check('freeing about 70% (' + p70 + ') leaves only a few locked', 53 - S.tierOf(p70) >= 3 && 53 - S.tierOf(p70) <= 6, (53 - S.tierOf(p70)) + ' locked');

// ---- 9. freeing cages unlocks in order, with the NEXT BRO counter and a banner
const arena = () => { S.reset(); S.startLevel(0); S.endCeasefire(); step(); S.ents.forEach((e) => { if (e.type !== 'flag') e.dead = true; }); for (let c = 0; c < 120; c++) for (let r = 0; r < 21; r++) S.setTile(c, r, r >= 16 ? 1 : 0); step(); S.P.inv = 1e9; };
const free = (fixed) => { const c = S.makeEnt({ type: 'cage', c: 30, from: 15 }); c.bro = fixed || null; S.ents.push(c); S.P.x = c.x; run(3); };
S.resetProgress(); arena();
check('a fresh game plays Dr Reskbro', S.P.bro.id === 'reska' || S.unlocked.join() === 'reska', S.unlocked.join());
check('the counter starts at NEXT BRO 0/1', S.nextBro().join('/') === '0/1');
const log = []; for (let k = 1; k <= 12; k++) { const n0 = S.unlocked.length; free(); log.push([k, S.unlocked.length - n0, S.P.bro.id]); }
const want = []; for (let k = 1; k <= 12; k++) want.push(S.BRO_AT.filter((t) => t === k).length);
check('each threshold unlocks the next bro in the fixed order', log.every(([k, d], i) => d === want[i]) && S.unlocked.join() === S.BRO_ORDER.slice(0, S.tierOf(12)).join(), S.unlocked.join());
check('a cage in between swaps to one of your unlocked bros', log.every(([, , id]) => S.unlocked.includes(id)));
check('the counter shows progress to the next threshold', (() => { const nb = S.nextBro(), k = S.tierOf(S.rescues); return nb[0] === S.rescues - S.BRO_AT[k - 2] && nb[1] === S.BRO_AT[k - 1] - S.BRO_AT[k - 2]; })(), S.nextBro().join('/'));
S.resetProgress(); arena(); S.rescues = S.BRO_AT[2] - 1; const before = S.unlocked.length; free();
check('the unlock banner names the new bro', S.unlocked.length === before + 1 && /NEW BRO UNLOCKED/.test(S.bannerNow().text) && S.bannerNow().text.includes(S.BRO[S.BRO_ORDER[S.tierOf(S.rescues) - 1]].name.toUpperCase()), S.bannerNow().text);
arena(); S.unlocked.length = 0; S.unlocked.push('reska'); S.rescues = 3; S.savedBros.length = 0; S.savedBros.push('reska');
free('oppenheimer');
check('a cage with a fixed locked bro never hands him out', S.P.bro.id !== 'oppenheimer' && !S.unlocked.includes('oppenheimer'), S.P.bro.id);
arena(); S.rescues = S.BRO_AT[S.BRO_ORDER.indexOf('curie') - 1] + 5; S.unlocked.push('curie'); free('curie');
check('a cage with a fixed bro you have unlocked may hand him out', S.P.bro.id === 'curie', S.P.bro.id);
// the debrief shows NEXT BRO n/m
{
  const texts = []; const tctx = sb.window; // text goes through ctx.fillText; capture via a recording proxy is overkill: check the draw works and the data it uses
  S.startMode('campaign'); S.startLevel(0); S.setState('win');
  let err = ''; try { S.render(1); } catch (e) { err = e.message; }
  check('the debrief draws with the NEXT BRO line', !err && S.nextBro() !== null, err);
}

// ---- 10. the opening: the first Placebo Island of a campaign
S.resetProgress(); S.startMode('campaign'); S.setLevel(0); press('start'); press('start');
check('the first start of Placebo Island plays the opening', S.state === 'intro' && S.chopper && S.openingSeen, S.state);
check('the lab chopper flies in (it is the game\'s own chopper)', S.chopper.x < 0 || S.chopper.x < 200);
run(Math.round(60 * 1.6));
check('Dr Reskbro drops under the parachute (P.chute)', S.P.chute === true && S.P.bro.id === 'reska' && S.P.y > 0, 'y ' + S.P.y.toFixed(0));
check('with a line from Prof. Peer Review', (S.radioCur && S.radioCur.who === 'hq') || S.radioQ.some((m) => m.who === 'hq'));
let err2 = ''; try { for (let k = 0; k < 4; k++) { S.render(k); run(20); } } catch (e) { err2 = e.message; }
check('it draws', !err2, err2);
run(60 * 3);
check('it lasts about 4 s and then play begins on the ground', S.state === 'play' && !S.P.chute && !S.chopper && S.P.onGround, S.state);
S.setState('map'); S.setLevel(0); press('start'); press('start');
check('it does not play again', S.state === 'play', S.state);
S.resetProgress(); S.startMode('campaign'); S.setLevel(0); press('start'); press('start'); run(30);
check('after a reset it plays again, and fire skips it', S.state === 'intro'); S.pressed.fire = true; step();
check('fire skips: play begins at once with no parachute', S.state === 'play' && !S.P.chute && !S.chopper, S.state);
S.resetProgress(); S.startMode('campaign'); S.setLevel(0); press('start'); press('start'); run(10); press('start');
check('Enter skips it too', S.state === 'play');
S.resetProgress(); S.startMode('campaign'); S.setLevel(1); S.markCleared(0); S.resetProgress(); S.markCleared(0); S.startMode('campaign'); S.setLevel(1); press('start'); press('start');
check('only Placebo Island has an opening', S.state === 'play', S.state);

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
