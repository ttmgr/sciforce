// Headless checks for the satire pass on the story: every text fits its box (radio, intercept, briefing, debrief,
// banners, signs, trophies, epilogue), every mission has its lines and the running gags show up, random missions
// get their names and briefings from the word lists, and no real brand or platform name appears in the game.
// Usage: node science-bros/tests/satire.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__;
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
// the game's own wrap: words onto lines of at most n characters
const wrapN = (str, n) => { const out = []; let ln = ''; for (const w of str.split(' ')) { if ((ln + ' ' + w).trim().length > n) { out.push(ln.trim()); ln = w; } else ln += ' ' + w; } if (ln.trim()) out.push(ln.trim()); return out; };
const fits = (str, n, lines) => wrapN(str, n).length <= lines && wrapN(str, n).every((l) => l.length <= n);
const over = (list, ok) => list.filter((x) => !ok(x));
const N = S.nLevels, W = S.GEN_WORDS;

// ---- every text fits its box
const radio = [], intercepts = [];
for (let l = 0; l < N; l++) {
  const st = S.STORY[S.levelDef(l).name]; if (!st) continue;
  intercepts.push(st.intercept[1]);
  for (const k of ['start', 'mid', 'midboss', 'boss', 'win']) for (const [, line] of st[k] || []) radio.push(line);
}
radio.push(...S.HQ_DEATH, ...S.BRO_QUIPS, ...Object.values(S.EVENT_RADIO).map((e) => e[1]));
let bad = over(radio, (s) => fits(s, 43, 3));
check('every radio line fits the radio box (3 lines of 43)', !bad.length, bad.join(' | '));
bad = over(intercepts, (s) => fits(s, 34, 3));
check('every intercepted message fits its box (3 lines of 34)', !bad.length, bad.join(' | '));
const defs = Array.from({ length: N }, (_, l) => S.levelDef(l)).concat([S.levelDef(S.MOON)]);
const campaign = defs.slice(0, N);
bad = over(campaign, (L) => fits(L.brief, 62, 7)).map((L) => L.name);
check('every briefing fits the briefing screen (7 lines of 62)', !bad.length, bad.join(', '));
bad = over(campaign, (L) => fits(L.debrief, 70, 3)).map((L) => L.name);
check('every debrief fits above the objectives (3 lines of 70)', !bad.length, bad.join(', '));
check('the ending fits above the epilogue (3 lines of 74)', fits(S.ENDING, 74, 3), wrapN(S.ENDING, 74).length + ' lines');
bad = over(S.EPILOGUE, (s) => s.length <= 76);
check('every epilogue line fits the screen (76 characters)', !bad.length, bad.join(' | '));
bad = []; for (const L of defs) bad.push(...over(L.intel || [], (s) => s.length <= 76));
check('every intel file fits the banner (76 characters)', !bad.length, bad.join(' | '));
bad = over(defs, (L) => L.sub.length <= 58).map((L) => L.sub);
check('every mission subtitle fits the map screen (58 characters)', !bad.length, bad.join(' | '));
const bossSubs = [], signs = [], neons = [];
for (let l = 0; l < N; l++) {
  S.startLevel(l);
  for (const e of S.ents) if (e.final && e.bossSub) bossSubs.push(e.bossSub);
  for (const d of S.decor()) if (d.kind === 'sign' || d.kind === 'plaque') signs.push(d.text); else if (d.kind === 'neon') neons.push(d.text);
}
bossSubs.push(...W.bossSub); signs.push(...W.sign); neons.push(...W.neon);
bad = over(bossSubs, (s) => s.length <= 60);
check('every boss subtitle fits the banner (60 characters)', !bad.length, bad.join(' | '));
bad = over(signs, (s) => s.length <= 19);
check('every sign fits its board (19 characters)', signs.length > 30 && !bad.length, signs.length + ' signs; ' + bad.join(' | '));
bad = over(neons, (s) => s.length <= 16);
check('every neon sign fits its frame (16 characters)', !bad.length, bad.join(' | '));
bad = over(S.ACH, (a) => a[1].length <= 22 && a[2].length <= 37).map((a) => a[1]);
check('every trophy name and line fits its column', !bad.length, bad.join(', '));

// ---- every mission has its lines, by known speakers, and the running gags show up
let missing = [];
for (let l = 0; l < N; l++) {
  const name = S.levelDef(l).name, st = S.STORY[name];
  if (!st || !st.intercept || !st.intercept[1] || !['start', 'mid', 'boss', 'win'].every((k) => (st[k] || []).length && st[k].every(([who, line]) => S.CAST[who] && line))) missing.push(name);
}
check('every mission has an intercept and start, mid, boss and win lines by known speakers', !missing.length, missing.join(', '));
check('the live-streamer is in the cast', !!(S.CAST.live && S.CAST.live.img && S.CAST.live.name));
const said = (who, re) => { const at = new Set(); for (let l = 0; l < N; l++) { const st = S.STORY[S.levelDef(l).name]; for (const k of ['start', 'mid', 'midboss', 'boss', 'win']) for (const [w, line] of st[k] || []) if ((!who || w === who) && re.test(line)) at.add(l); } return at.size; };
check('running gag: HQ\'s grant keeps coming back from Reviewer 2', said('hq', /grant/i) >= 4 && said('hq', /Reviewer 2/) >= 4, said('hq', /grant/i) + ' missions');
check('running gag: League Radio reads sponsored ads', said('goon', /sponsored|brought to you|use code/i) >= 4, said('goon', /sponsored|brought to you|use code/i) + ' missions');
check('running gag: DYOR Dale streams the war live', said('live', /chat/i) >= 6, said('live', /chat/i) + ' missions');
check('the twist is still there: King Citrus is a robot with Quackenbush inside', /ROBOT/.test(S.STORY['CITRUS CITADEL'].win.map((x) => x[1]).join(' ')) && S.STORY['CITRUS CITADEL'].win[0][0] === 'quack');
check('the epilogue closes the gags', ['DYOR DALE', 'REVIEWER 2', 'PROF. PEER REVIEW'].every((n) => S.EPILOGUE.includes(n)) && S.EPILOGUE.some((s) => /grant/i.test(s)));

// ---- random missions: names, briefings, intel and boss lines come from the word lists
const places = new Set([...Object.values(W.place).flat(), ...W.anyPlace]);
const seen = { who: new Set(), scheme: new Set(), close: new Set(), quack: new Set() };
let badName = [], badBrief = [], badIntel = [], badSub = [];
const SEEDS = 300;
for (let s = 1; s <= SEEDS; s++) {
  const L = S.genLevel(s * 7919);
  const q = W.quack.find((w) => L.name.startsWith(w + ' ') && places.has(L.name.slice(w.length + 1)));
  if (!q) badName.push(L.name); else seen.quack.add(q);
  const who = W.who.find((w) => L.brief.startsWith(w + ' ')), rest = who ? L.brief.slice(who.length + 1) : '';
  const scheme = W.scheme.find((w) => rest.startsWith(w + ' ')), close = W.close.find((w) => L.brief.endsWith(' ' + w));
  if (!who || !scheme || !close) badBrief.push(L.brief.slice(0, 60)); else { seen.who.add(who); seen.scheme.add(scheme); seen.close.add(close); }
  if (!L.intel.every((x) => W.intel.includes(x))) badIntel.push(s);
  if (!W.debrief.some((d) => L.debrief.startsWith(d))) badSub.push('debrief ' + s);
  if (!fits(L.brief, 62, 7)) badBrief.push('too long: ' + L.brief.slice(0, 40));
}
check('random map names are a satire word plus a place', !badName.length, badName.slice(0, 5).join(', '));
check('random briefings are who + scheme + objective + sign-off from the lists, and fit the screen', !badBrief.length, badBrief.slice(0, 3).join(' | '));
check('random intel and debriefs come from the lists', !badIntel.length && !badSub.length, badIntel.concat(badSub).slice(0, 5).join(', '));
check('random missions use the new satire words', ['BLOCKCHAIN', 'AI-POWERED', 'BIOHACK', 'SPONSORED'].some((w) => seen.quack.has(w)) && [...seen.who].some((w) => /podcaster|chatbot|crypto|DYOR|rage-bait|comment/.test(w)), [...seen.quack].length + ' prefixes');
check('over ' + SEEDS + ' seeds every opener, scheme and sign-off turns up', seen.who.size === W.who.length && seen.scheme.size === W.scheme.length && seen.close.size === W.close.length, seen.who.size + '/' + W.who.length + ' ' + seen.scheme.size + '/' + W.scheme.length + ' ' + seen.close.size + '/' + W.close.length);

// ---- no real brands, platforms, companies or living people in the game script
const BLOCK = [
  // social networks, video and chat platforms
  // (common words that are also brand names, such as rumble, threads or windows, would hit the game's own code, so they are left out)
  'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Twitter', 'Tweet', 'Snapchat', 'Reddit', 'LinkedIn', 'WhatsApp', 'Telegram', 'Twitch', 'Pinterest', 'Discord', 'Tumblr', 'Bluesky', 'Mastodon', 'Truth Social', 'Patreon', 'OnlyFans', 'Substack', 'Spotify', 'Podbean', 'Clubhouse', 'Kick.com',
  // big tech and AI
  'Google', 'Amazon', 'Microsoft', 'Meta Platforms', 'Netflix', 'Nvidia', 'Samsung', 'Huawei', 'OpenAI', 'ChatGPT', 'Anthropic', 'Claude', 'Copilot', 'Gemini AI', 'DeepMind', 'Grok', 'xAI', 'Midjourney', 'Alexa', 'Siri', 'iPhone', 'Android', 'SpaceX', 'Neuralink', 'Theranos', 'Juicero', 'Uber', 'Airbnb',
  // crypto
  'Bitcoin', 'Ethereum', 'Dogecoin', 'Binance', 'Coinbase', 'OpenSea', 'Solana', 'FTX', 'Bored Ape',
  // supplements, wellness, drinks and pharma
  'Goop', 'Herbalife', 'Amway', 'Centrum', 'Emergen-C', 'Redoxon', 'Athletic Greens', 'AG1', 'Gatorade', 'Red Bull', 'Monster Energy', 'Prime Hydration', 'Coca-Cola', 'Pepsi', 'Tropicana', 'Nestle', 'Starbucks', 'Fiji Water', 'Liquid Death', 'Pfizer', 'Moderna', 'AstraZeneca', 'Bayer', 'Boiron', 'Oscillococcinum', 'Infowars', 'Fox News', 'CNN',
  // living people the jokes must not name
  'Elon', 'Musk', 'Zuckerberg', 'Bezos', 'Rogan', 'Andrew Tate', 'Paltrow', 'Bryan Johnson', 'Alex Jones', 'Trump', 'Wakefield', 'Kardashian', 'MrBeast',
];
const hits = [];
for (const b of new Set(BLOCK)) { const re = new RegExp('(^|[^A-Za-z])' + b.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '([^A-Za-z]|$)', 'i'); if (re.test(src)) hits.push(b); }
check('no real brand, platform, company or living person is named (' + new Set(BLOCK).size + ' names checked)', !hits.length, hits.join(', '));
console.log(fails ? fails + ' check(s) failed' : 'all satire checks passed');
process.exit(fails ? 1 : 0);
