// Headless checks for the one-time remake of the 18 older campaign missions (missions 18 and 19 came later and are checked here too, from part 2 on): missions 1-7 got new terrain, placement and
// decoration, missions 8-18 lighter but visible changes, measured against a fingerprint of each mission's hand-made base
// (the columns before the boss arena) as it was before the remake. Every mission still builds the same way twice, keeps
// its theme, boss and objectives, has a safe start, keeps its cages, intel and targets where a bro can get to them, has
// nothing floating or stuck in a wall, keeps the campaign's difficulty curve, and a simple bot gets through its base.
// Usage: node science-bros/tests/mission_remake.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').split('<script>')[1].split('</script>')[0];
const noop = () => {};
const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
const pad = { buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
const navigator = { getGamepads: () => [pad] };
const win = { __SB_TEST__: true };
// a seeded Math.random, so the bot runs play out the same way every time
let seedA = 4242; const reseed = (v) => { seedA = v; }; // each bot run starts from its own seed, so adding missions (more random draws before it) does not move it
const M = Object.create(Math); { M.random = () => { const a = seedA = (seedA + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sb = { window: win, document: doc, navigator, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math: M, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
vm.createContext(sb); vm.runInContext(src, sb);
const S = win.__SB__, T = S.T;
const step = (keys = {}) => { for (const k in S.keys) S.keys[k] = false; Object.assign(S.keys, keys); S.step(1 / 60); for (const k in S.pressed) S.pressed[k] = false; };
const run = (n, keys = {}) => { for (let i = 0; i < n; i++) step(keys); };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };
const BOSSES = ['boss', 'kopter', 'crawler', 'tank', 'engine', 'blimp', 'citrus', 'director'];
const LW = S.LW, LH = S.LH, N = S.nLevels;

// The fingerprint of each mission before the remake (commit 78b2cd6), taken with the difficulty ramp off:
// [theme, final boss, objectives, cages on the surface before the cut, cut, a 2-character hash of each column 0..cut-1 (rows 0-21; '--' for
// columns next to an underground zone, which the stretch code digs), surface spawns before the cut, decoration before the cut]
const OLD = [
  ['island', 'boss', 'vat3 boss1 cage5 intel3', 5, 175, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dc9c9c9c9c9c9fefefefefefefemymymymybububumymymy3xdlztztztztztztztztztfufufuztztztztztztztztztdl3x7d7d7d7d7d7d7d7dsxsxsx2usxsxsx2usxsxsxd235sxsx2usxsxsx2usxsxsxsx7d7d7d7d7dmymyurixixixjcjcjcjcjcjcjcjcjcjcjcjc62jqjbjb5nixixixixixixixixixixixixuhuhuhuhuhuhuhuhuhuh7d7d7d7d7d7d7d7d7d8r8r7d7d7d7d7d7d7d7d7d7d------', 'propane@22 grunt@24 grunt@25 ammo@26 barrel@29 grunt@31 dog@33 cage@36 grunt@42 pickup@35 spring@32 guncrate@40 target@55 alarm@47 scout@47 grunt@50 barrel@53 grunt@56 barrel@59 propane@60 grunt@62 cage@64 grunt@52 medic@58 turret@66 flag@72 shield@71 ammo@74 itemcrate@76 grunt@81 turret@88 grunt@95 bomber@99 jetpack@103 sniper@112 target@113 pickup@121 grenadier@111 grunt@114 barrel@118 grunt@120 barrel@123 grunt@126 cage@119 grunt@115 grunt@131 strike@133 bomber@134 guru@137 bomber@136 flag@139 mechsuit@142 grunt@145 rocketeer@148 dog@152 grunt@155 barrel@157 propane@158 turret@160 cage@147 guncrate@151 flamer@156 fueltank@154 mine@159 mine@162 brute@163 target@165 pickup@149 itemcrate@143 alarm@152 grunt@166 shield@167 barrel@168 grunt@170 cage@173', 'palm@2 palm@9 sign@12 sandbags@6 palm@19 palm@30 sandbags@41 plaque@52 sign@74 sandbags@70 palm@107 sandbags@132 sandbags@146 sandbags@153 palm@164 sign@171'],
  ['desert', 'crawler', 'radio1 kopter1 boss1 cage3 intel3', 3, 176, 'fefefefefefefefefefefefefefefec9c9c9c9c9c9mymymymymymymyfefefefefefefefefe7dg9pnzbrtrtrtrtrtrtrtko3qlyrtrtrtrtrtrtrtzbpn7d7d7d7d7d7d7d7d7d7d7d7d7d7dmymymymy7d7d7d7d7d7d7d7d7d7d7d7d7d7dhlhl7d7d7d7d7d7d7d7d7d7dgbgb7d7d7d7d7d7d7d7d7d7dhlhl7d7d7d7d7d7dwpwp7d7d7d7d7d7d7d7d7drqrqrq2urqrqrq2urqrqrq2urqrq2urqc9c9c9c9c9c9c9zxzxzxbuc9c9c9c9c9c9c9c9c9c9--------', 'guncrate@8 cage@22 grunt@21 dog@24 scout@26 ammo@30 pickup@31 grunt@33 pickup@54 alarm@61 shield@45 medic@51 grunt@53 barrel@55 grenadier@43 ammo@47 grunt@55 guru@52 rocketeer@57 flag@62 strike@63 fueltank@67 itemcrate@76 fueltank@79 jetpack@69 barrel@65 barrel@66 dog@68 propane@70 barrel@72 rocketeer@75 heavy@80 ammo@98 ammo@110 spring@96 spring@112 target@86 kopter@110 mechsuit@127 cage@127 guncrate@129 mine@128 mine@131 grunt@130 dog@132 pickup@160 itemcrate@168 shield@138 grenadier@144 bomber@149 flamer@133 ammo@153 strike@154 heavy@155 brute@157 sniper@160 rocketeer@159 cage@164 guru@168 grunt@170 flag@171 barrel@162 barrel@163', 'cactus@3 sign@7 cactus@11 crystal@16 cactus@25 palm@35 plaque@49 cactus@38 sandbags@64 crystal@71 sign@79 sandbags@88 sandbags@99 sandbags@111 sign@85 sign@128 cactus@152 crystal@157 cactus@166 sign@175'],
  ['snow', 'tank', 'server2 boss1 cage3 intel3', 3, 176, 'fefefefefefefefefefefec9wkwkwkwkwkwkc9mymymymymymymymyc9c9c9c9c9c9c9c9c9c97d7d7d7d7dpnzbo4o4o4o4o4o4o4o4o4gzgzgzo4o4o4o4o4o4o4o4o4zbpn7d7d7d7d7d7d7d7d7dk4k4k4v8k4k4k4v8k4k4k4v8k4k4k4v8k4k4k4v8k4k4k4v8k4k4k4v8k47d7d7d7d7d7d7dq1ugugugugugugugquugugugugugugugugugugugquugugugugugugugugugugugquugugugugugug7d7d7d7d7d7d7d7d7dcpcp7d7d7d7d7d7d7dg9uhuh7d7d7d7d', 'guncrate@5 cage@28 grunt@21 dog@23 grunt@22 pickup@24 scout@25 ammo@30 itemcrate@34 grenadier@33 mechsuit@38 target@45 target@59 alarm@67 shield@48 medic@52 heavy@56 grunt@61 cage@63 guru@50 rocketeer@62 flag@70 grunt@82 jetpack@88 shield@90 dog@96 jetpack@98 bomber@101 spring@75 pickup@137 itemcrate@150 icicle@118 icicle@123 icicle@129 icicle@135 icicle@141 grunt@120 dog@126 heavy@133 grunt@146 strike@117 sniper@121 rocketeer@125 cage@131 grenadier@138 ammo@142 rocketeer@147 pickup@158 mine@157 mine@164 fueltank@166 alarm@154 flag@152 guncrate@153 flamer@155 shield@156 brute@163 grunt@158 turret@160 grunt@165 guru@167 turret@170 heavy@174', 'pine@3 sign@6 pine@9 snowman@20 pine@29 pine@35 plaque@54 snowman@69 sign@74 pine@115 pine@128 pine@149 sandbags@154 snowman@163'],
  ['plant', 'engine', 'vat2 boss1 cage4 intel3', 4, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d2j2j2j2j7d7d7d7d7d7d7d7dhlhl7t7t7thl7d7d7d7d7d7d7d7d7d7d7d7da3jr7w7w7w7w7w7w7w7w7w7w7w7wnfnfnfn4rtrtrtrtrtrtrtrtrtrtrtrtrtjra37d7d7d7d7d7d7d7d7d7d7d7d6y6y6y7d7d7d7d7d7d7d7d7d6y6y6yfefefefefefefefefe6y6y6y7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dvtvt7d7d7d7dhlhlhlhlhl7d7d7d7d7dvtvt7d7d7d7d7d7dcpcp7d7d7d7d7d7d7d7d7d7d', 'guncrate@6 grunt@23 pickup@12 fueltank@19 mine@22 shield@24 cage@29 flamer@34 itemcrate@37 barrel@38 target@52 target@69 cage@49 pickup@56 sniper@54 heavy@64 medic@66 grunt@72 alarm@47 jetpack@58 rocketeer@70 flag@80 mechsuit@84 cage@86 guncrate@91 dog@94 brute@98 itemcrate@95 rocketeer@108 strike@107 fueltank@110 grunt@119 alarm@118 flamer@122 pickup@124 spring@126 flag@128 grunt@136 shield@144 sniper@148 jetpack@152 heavy@160 grenadier@164 medic@167 cage@172 itemcrate@175', 'sign@4 sandbags@21 plaque@60 sign@87 sandbags@134 sandbags@170'],
  ['edge', 'blimp', 'radio3 boss1 cage3 intel3', 3, 166, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dq17vhj2h2h2h2h2h2h2h2h0o0o0o2h2h2h2h2h2h2h2hhj7v7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dftu1u1u1u17d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dhlhl7d7d7d7d7d7d7d7d7d7d7d7d7d7dgbgb7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d', 'guncrate@10 itemcrate@13 grunt@22 scout@25 cage@27 dog@29 target@40 target@54 target@70 shield@42 medic@46 pickup@49 grunt@52 cage@55 sniper@47 alarm@62 heavy@66 flag@73 spring@84 mine@95 mine@97 grenadier@89 rocketeer@100 strike@102 jetpack@105 heavy@110 fueltank@114 pickup@118 flag@120 mechsuit@124 brute@128 flamer@136 alarm@138 fueltank@140 guru@145 pickup@148 cage@152 grunt@156 itemcrate@158 flag@164', 'sign@6 sign@16 sandbags@3 sign@80'],
  ['sky', 'kopter', 'radio3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dzrzrzrzrzrzrzrzrjbjbzrzrzrzrzrzrzrzrzrzrzr6lefefefefefx3zrzrzrzrzrzrzrvvvvzrzrzrzrzr7d7d7dqxqx7dngngngngngngngngngngngngngngngngngngngngng8p7g7ge6y3y3vgvgvg7d7d7de0t2t2t2t2t2b9t2h5yhyhyhgoyhyhyhyhaksrakakakakaksrakakakakaksre07d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dz1fx19e4b0e419fxz17d7d7d7d7d7d7d7d7d7d7d7d7d7d7d', 'guncrate@8 itemcrate@11 minelayer@26 dog@32 target@36 shield@40 grunt@44 fueltank@51 jetpack@53 cage@59 pickup@61 flag@63 diffuser@73 propane@77 medic@80 cage@84 pickup@87 sniper@78 grenadier@86 heavy@96 flag@98 mechsuit@100 itemcrate@106 target@112 shield@115 alarm@120 rocketeer@124 grunt@128 cage@130 flag@135 dog@140 turret@145 miner@153 sniper@154 pickup@158 bomber@163 target@166 strike@169 guru@171 flag@175', 'sign@5 sandbags@2 sandbags@15'],
  ['cave', 'crawler', 'vat3 boss1 cage3 intel3', 3, 176, 'xkxkxkxkxkxkxkxkxkxkxkxkxkxkxkxkxkxkxkxkgpgpgpgpgpgpgpa1a1a1lklklklklklklk6xa1a1gpgpgpgp7d7d7d616161616161617d7d7dgpgpgpgpgpgpgpgpgp8o8o8o8o8ogpgpgpgpgp8o8o8o8o8o8o8o8o8oq1q1q1q1q18o8o8o94gpgpgpgpgpgpi1i1i1i12e2edi2e2e2e2eye42424242ky42424242ky42hi2e2edi2e2e2e2edii1i1i1i1mhmhmhmhxkxkmhu0u0u0u0zszsmhmhmhmhmhi1i1mhmhmhmhmhxkvrkokokokokos92yx6x6--------', 'guncrate@8 itemcrate@11 icicle@25 icicle@41 icicle@48 icicle@55 detox@26 dog@29 target@33 cage@36 shield@44 sniper@50 pickup@53 flag@58 icicle@69 icicle@78 icicle@84 streamer@63 heavy@69 cage@73 pickup@83 rocketeer@87 grunt@96 flag@98 jetpack@102 jumper@108 camdrone@114 grunt@120 target@133 flag@135 icicle@146 icicle@160 brute@140 target@145 preacher@150 cage@156 guru@160 pickup@164 flamer@167 itemcrate@170 flag@175', 'sign@5 crystal@2 crystal@15 crystal@3 crystal@12 crystal@21 crystal@30 crystal@39 crystal@48 crystal@57 crystal@66 crystal@75 crystal@84 crystal@93 crystal@102 crystal@111 crystal@120 crystal@129 crystal@138 crystal@147 crystal@156 crystal@165 crystal@174'],
  ['swamp', 'tank', 'server2 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dzr7d080808h5tzh57d7d7d7d7dzr7d08h5tzh508087d7d7dzr7dnenenene7d7d7d0te6e6wtwtwttewtwtwtwtwtwtwtwta6a6a6wtwtwtwtwtwtwtwtwt4rwtwtwte6e6vf7d7d7d7d7d7drqfarqrqrqfatetete1utete6ufarqygukcfukygrqfatetete1ute6urqfarqygukcfukygrqfa7d7d7d7d7d7d8a8a8a1v7d7d7d7d8a8a8a1v7d7d7d7d8a8a8a1v7d7d7d7d8a8a8a1v7d--------', 'guncrate@8 itemcrate@11 shield@23 target@30 grenadier@34 flamer@36 mortar@44 fueltank@47 pickup@53 flag@54 target@66 diffuser@70 preacher@72 medic@74 heavy@76 cage@80 sniper@84 alarm@86 flag@95 minelayer@101 dog@108 cage@116 bomber@122 grunt@127 pickup@132 flag@138 miner@145 rocketeer@148 mine@150 cage@153 guru@157 grunt@161 mortar@165 pickup@169 itemcrate@171 flag@174', 'sign@5 pine@2 pine@15 sandbags@148 sandbags@156 sandbags@164 sandbags@172'],
  ['astro', 'boss', 'radio3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dc9c9c9c9c9uhuhuhuha1a1a1a1a1ixixixixixixixixixa1a1a1a1mymymymymy7d7d7d7d7d7d7d7d7d7d7d7d7du82y2y2y2y2y2y2y2y2y2y2y2y2y2y2y2y2y2y7d7d7d7d7d7d7d7d7d7dp2ztp5t3ihcu7wii98y3yh7r7r3w3i3i3i7g7gjfjfjfee2c2ct2y3----------------------------------------------------------------------------------------------------7d', 'guncrate@8 itemcrate@11 detox@26 sniper@35 target@40 rocketeer@44 pickup@49 jetpack@53 flag@58 pilldoc@72 target@74 cage@78 sniper@80 pickup@84 mortar@85 dog@91 flag@94 yogi@101 heavy@108 cage@112 guru@118 target@121 medic@126 flag@135 pinboard@139 shield@145 jetpack@154 pickup@156 camdrone@162 brute@164 cage@166 grenadier@170 strike@172 flag@175', 'sign@5 pine@2 pine@15 plaque@155'],
  ['rust', 'director', 'vat3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dpy050505vgg8g8yfg8g8g8g8g8g8yfnunu7e7enunu61nug8g8g8g8g8yfg8g8g8vg0505ic05py7d7d7d7dzr7dq11yuctxtx39wjdfwjwjwjwjwjdfwjwjwjwjwjdf39txtxuc1yq17dzr7d7d7d7d7d7dksks7g7g7g7g7g7g7g2opc2o7g7g7g7g7g7g7g7g7gvwikvw7g7g7g7g7g7g7g7gksks7d7d7d7dzr87icz8z8lgv8v8zrzrzrzrzr87icz8z8lgv8v8zrzrzrzrzr87icz8z8lgv8v8zrzrzrzrzrzr7d', 'guncrate@8 itemcrate@11 flagbearer@28 barrel@32 target@36 shield@41 heavy@48 cage@51 grunt@53 flag@59 flamer@64 streamer@70 target@73 rocketeer@80 pickup@85 medic@91 flag@94 jumper@102 cage@110 pickup@108 jetpack@111 target@114 heavy@118 mortar@126 flag@134 mechsuit@137 cage@140 brute@145 preacher@154 guru@160 pickup@164 heavy@170 flag@175', 'sign@5 sandbags@2 sandbags@15'],
  ['sky', 'blimp', 'radio3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d3h3h7d7d7d7dqxqx7d7d7d7d3h3h7d7d7d7dqxqx7d7d7d7d3h3h7d7d7d7d7d7d7d7d7d7d7dnubgjmnubg7d7dbgbgbgbgbgnubgjmnubgbgbgbgbgbgbgbgnubgjmnu7d7d7d7d7d7d7d7d7d7d7d7d6ulvb9pjpjpjklv7v7lxqvqvqvh5pyyhy3y3y3t52f2frtwrgbgb21t3t36u7d7d7d7d7d7d7d7dbubu7d7d7d7d7dl6l67d7d7d7d7da1a17d7d7d7d7d7de1e17d7d7d7d7dbubu7d7d7d7d', 'guncrate@8 itemcrate@11 spring@31 spring@43 sapper@24 dog@29 target@35 scout@40 shield@47 cage@49 grenadier@53 pickup@56 flag@59 yogi@69 cage@73 target@76 camdrone@78 rocketeer@82 pickup@89 heavy@92 flag@98 spring@125 cage@104 pinboard@108 medic@114 preacher@120 itemcrate@122 shield@126 flag@135 spring@139 spring@153 spring@168 guncrate@138 dronecaller@145 dog@152 target@159 brute@161 pickup@167 mortar@174 flag@175', 'sign@5 scarecrow@2 scarecrow@15 scarecrow@23 scarecrow@41 scarecrow@54'],
  ['desert', 'crawler', 'vat3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dfefec9c9c9c9c9c9fefefe7d7dt6t67t7t7t7t7t7t7tt6t67d7dfefefec9c9c9c9c9c9fefe7d7d7d7d7d7d7d7d7d7deweww9w9ugugahah3c3c9v9lp4p42h2h2hp4fropopu0u08nahugug--------------------------------------------------------------------------------------------------------------------1v7d7d7d3h4e4e8a1v7d7d7d7d8a8a8a1v7d7d7d7d7d', 'guncrate@8 itemcrate@11 alpha@25 dog@29 target@33 flamer@38 shield@43 cage@47 bomber@51 pickup@55 flag@59 pickup@68 knight@70 heavy@76 cage@81 target@83 sniper@84 rocketeer@90 guru@93 flag@106 preacher@114 target@118 dronecaller@121 brute@131 jetpack@135 flag@139 pilldoc@145 mortar@149 cage@153 grenadier@157 strike@160 heavy@165 alarm@166 pickup@169 flag@174 barrel@162 barrel@163', 'sign@5 cactus@2 cactus@15 cactus@24 cactus@35 cactus@49 sandbags@148 sandbags@156 sandbags@164 sandbags@172'],
  ['snow', 'tank', 'server2 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dfefec9c9mymyuhuhbubua1a1a1a1qnqnqnw4w4w44f4f4fwkwkwkjjjjjj7d7d7d7d7d7d7d7dmx7m7jwr7j7j7j7j7j7j7j7j7j7j7j7m7g7g7g7m7j7j7j7j7j7j7j7j7j7j7j7j7j7j7mmx7d7d7d7d7doaoa14oaoaoa7dzrftftftftft7doaoa14oaoaoa7dzrncncncncnc7doaoa14oaoaoa7dzr7d7d7d7d7d7d7d7d7d7dq1ugugugugquugugugugugugugugugquugugugugugugugugugquugugug----', 'guncrate@8 itemcrate@11 sapper@25 sniper@33 dog@40 shield@45 target@52 flag@55 knight@64 sniper@64 cage@66 heavy@80 target@82 medic@86 pickup@88 alarm@90 flag@95 jumper@103 target@109 medic@110 jetpack@116 cage@123 grenadier@123 camdrone@126 pickup@130 flag@138 icicle@149 icicle@156 icicle@163 icicle@170 alpha@148 rocketeer@156 preacher@162 cage@168 pickup@171 mortar@173 flag@175', 'sign@5 pine@2 pine@15'],
  ['edge', 'kopter', 'radio3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dfefefec9c9uhuhuhbububua1a1a1q2q2q2q2q2q2q2q2a1a1a1uhuhc9c9c97d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7daga4h88p43vcag9y9y9y7d7d7d7d7d7d7d7d7d7d7d7d7d7d7drqfarqrqrqfatetete1u6urqrq2ysmsm7oismssmsm2yrqrq6u1utetetefarqrqrqfarqrq7d7d7d7d7d7dcp3r3rcp7d7d7d7d7d7d7d7d7dcp3r3rcp7d7d7d7d7d7d7d7d7dcp3r3rcp7d7d--------', 'guncrate@8 itemcrate@11 minelayer@26 rocketeer@32 sniper@38 target@41 jetpack@46 flag@55 target@61 grunt@65 sniper@71 cage@75 pickup@77 heavy@78 grenadier@86 mortar@90 flag@95 knight@101 dog@106 shield@109 cage@115 target@120 bomber@126 grunt@129 pickup@133 flag@135 guru@145 strike@147 brute@149 camdrone@156 pickup@159 preacher@161 cage@163 flamer@170 flag@175', 'sign@5 sandbags@2 sandbags@15'],
  ['sewer', 'crawler', 'vat3 boss1 cage3 intel3', 4, 176, 'l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4l4gpgpgpp1p1p1p1p1393939p1p1l4l4l4zczczcp1p1p1p1p1kmkmkmp1p1p1l4l4zczczcl4l4mh52f9f9f9akvcvcdjvcvcvcvcvcvcdj2y2ymimivcvcdjvcvcvcvcvcvcsrf9f9f9f952mhgpgpgpgpf9f9f9f9f9f9948o7cz9z9z9z9z98os8v9v9v9v9v98odrkrkrkrkrkrkrkrkrkrkrkrkrkrndndndndmhmhevmhp5p5p5p5p5p5p5p5p5p5p5p5mhevilh9h9l5l5l5l5l5l5l5l5l5l5l5mhmhmhmh', 'guncrate@8 itemcrate@11 icicle@25 icicle@33 icicle@41 icicle@49 icicle@57 pilldoc@26 dog@31 target@38 shield@44 cage@49 grenadier@53 pickup@56 flag@59 pinboard@68 barrel@70 target@76 heavy@82 cage@85 medic@90 flag@95 sapper@110 rocketeer@118 target@124 pickup@127 cage@129 flag@138 yogi@146 target@150 cage@156 flamer@160 sniper@164 guru@168 pickup@170 flag@175 barrel@162 barrel@163', 'sign@5 sandbags@2 sandbags@15'],
  ['city', 'director', 'radio3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dqxqx09i0ahopahahw8ahahopahi0opahahopi0ahopahahw8ahahopahi0opahahopi0i0razbjrjrzbrajrzbra7dg96u2xzbzb2x6uzb6u7d1ci0opahahopi0ahi07df4w8snopopsnw8opsnopop06opw8razbjrjrzbrajrra7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dftrazbjrjrzbrajrra7d7dtytyty6149497zjsjsx7x7x7x7x7x7x7x7x7x7x7tbtbtbx7x7x7jsjs7z494961tyty7d7d7d7d', 'guncrate@8 itemcrate@11 flagbearer@24 shield@29 target@34 sniper@40 cage@45 pickup@50 flag@53 knight@60 cage@65 rocketeer@70 pickup@75 target@80 jetpack@82 heavy@90 camdrone@94 flag@97 alpha@103 dog@115 grenadier@120 sniper@132 flag@134 pickup@140 medic@145 preacher@148 target@156 guru@158 brute@162 cage@166 mortar@170 flag@175 barrel@162 barrel@163', 'sign@5 sandbags@2 sandbags@15 neon@155'],
  ['grove', 'boss', 'server2 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dfefefefec9c9c9d5d5c9fefefefe7d7d7d7d7d7dc9c9c9c9eieimymymymyc9c9c9c97d7d7d7dpy050505vgg8g8yfg8g8g8g8g8g8yfnunu7e7eg8g8yfg8g8g8g8g8g8dn05050505py7d7d7dm1m1lmlmlmlm3b3blmlmlmlmlmlmlm3b3bqiqiqilmlmlmlm3b3blmlmlmlmlmlmlmlmm1m17d7dzrzrtq3u3u3u3u3u3u3u8q8q3u3u3u3u3u3u3um3m3m3m3m3m3m33u3u3u3u8q8q3u3u3u3u3utqzrzr', 'guncrate@8 itemcrate@11 flagbearer@25 dog@28 shield@35 target@38 grenadier@43 cage@51 bomber@54 pickup@56 flag@59 dronecaller@68 barrel@70 target@76 heavy@82 cage@85 flamer@90 flag@95 sapper@104 sniper@112 jetpack@118 rocketeer@124 pickup@127 flag@134 knight@144 pickup@146 heavy@157 target@158 brute@163 cage@169 mortar@171 flag@175', 'sign@5 orange@2 orange@15 orange@22 orange@27 orange@32 orange@37 orange@42 orange@47 orange@52 orange@57'],
  ['citrus', 'citrus', 'vat3 boss1 cage3 intel3', 3, 176, '7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dpnzbbqbqbqbqbqbqbqbqbqbqbqbqbq6xi0i0i0p5p5p5p5p5p5p5p5p5p5p5p5p5p5zbpn7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d2j2j2j2j2j2j2j2j2j7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7d7dftexexexex7d7d7d7d7d7d7d7d7d7d7d7d7dkp616161617d7d7d7d7d7d7d7d7d7d7d7d7d7d', 'guncrate@8 itemcrate@11 grunt@22 dog@25 scout@28 target@44 target@60 target@75 flamer@44 pickup@40 heavy@58 medic@63 cage@66 alarm@72 flag@78 mine@88 grunt@92 grunt@95 fueltank@96 grunt@98 strike@101 guru@104 pickup@107 grunt@110 grunt@113 shield@116 fueltank@118 brute@120 heavy@124 itemcrate@127 cage@102 preacher@99 mortar@126 camdrone@110 camdrone@150 flag@129 mechsuit@134 turret@141 guncrate@147 cage@150 jetpack@152 turret@159 sniper@161 grenadier@166 heavy@170 pickup@174', 'sign@14 sandbags@4 plaque@53 sign@84'],
];
const colHash = (c) => { let h = 7; for (let r = 0; r < 22; r++) h = (h * 31 + S.tileAt(c, r) + 1) % 1296; return h.toString(36).padStart(2, '0'); };
const kept = (oldList, newList) => { const pool = new Map(); for (const k of newList) pool.set(k, (pool.get(k) || 0) + 1); let n = 0; for (const k of oldList) if (pool.get(k) > 0) { n++; pool.set(k, pool.get(k) - 1); } return oldList.length ? n / oldList.length : 0; };
const solidT = (v) => v === 1 || v === 2 || v === 3 || v === 4 || v === 6;
const LOOSE = (v) => v === 2 || v === 4 || v === 6;
// loose blocks (brick, crate, ice) with nothing holding them, the way the game checks it: earth under them, or steel or a held loose block beside
const floating = () => {
  const n = LW * LH, at = (i) => S.tileAt(i % LW, Math.floor(i / LW)), seen = new Uint8Array(n), q = [];
  for (let i = 0; i < n; i++) if (solidT(at(i)) && (!LOOSE(at(i)) || i >= n - LW)) { seen[i] = 1; q.push(i); }
  while (q.length) { const i = q.pop(), c = i % LW, v = at(i), all = LOOSE(v) || v === 3; for (const j of all ? [i - LW, i + LW, c > 0 ? i - 1 : -1, c < LW - 1 ? i + 1 : -1] : [i - LW]) if (j >= 0 && j < n && !seen[j] && LOOSE(at(j))) { seen[j] = 1; q.push(j); } }
  const out = []; for (let i = 0; i < n; i++) if (LOOSE(at(i)) && !seen[i]) out.push((i % LW) + ',' + Math.floor(i / LW)); return out;
};
// where a bro can get to from the start, on foot: walk, fall, jump 3 tiles up and 3 across, climb ladders and walls,
// ride lifts and vents, float in anti-gravity. Crate doors count as open (one shot opens them); a boss gate counts as
// open (it opens when that boss goes down). Acid is never safe ground.
const reach = () => {
  const open = new Uint8Array(LW * LH), at = (c, r) => S.tileAt(c, r);
  for (let r = 0; r < LH; r++) for (let c = 0; c < LW; c++) { const v = at(c, r); open[r * LW + c] = v === 0 || v === 7 || v === 4 ? 1 : 0; }
  for (const e of S.ents) if (e.gate) { const [g0, g1, r0, r1] = e.gate; for (let r = r0; r <= r1; r++) for (let c = g0; c <= g1; c++) open[r * LW + c] = 1; }
  const isOpen = (c, r) => c >= 0 && c < LW && r >= 0 && r < LH && open[r * LW + c] === 1;
  const hard = (c, r) => c >= 0 && c < LW && r >= 0 && r < LH && (solidT(at(c, r)) || at(c, r) === 5); // something under your feet (acid: you land in it)
  const support = new Uint8Array(LW * LH), lift = new Map();
  for (const d of S.devs) {
    if (d.kind === 'lift') { const c0 = Math.floor(Math.min(d.ax, d.bx) / T), c1 = Math.floor((Math.max(d.ax, d.bx) + d.w - 1) / T), r0 = Math.floor(Math.min(d.ay, d.by) / T) - 1, r1 = Math.floor(Math.max(d.ay, d.by) / T) - 1; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r >= 0) support[r * LW + c] = 1; }
    if (d.kind === 'vent') lift.set(d.c + ',' + (d.r - 1), d.h);
    if (d.kind === 'grav') for (let r = Math.floor(d.y0 / T); r < Math.ceil(d.y1 / T); r++) for (let c = Math.floor(d.x0 / T); c < Math.ceil(d.x1 / T); c++) support[r * LW + c] = 1;
  }
  const seen = new Uint8Array(LW * LH), q = [];
  const add = (c, r) => { if (isOpen(c, r) && !seen[r * LW + c] && at(c, r) !== 5) { seen[r * LW + c] = 1; q.push(c, r); } };
  add(Math.floor((S.P.x + S.P.w / 2) / T), Math.floor((S.P.y + S.P.h - 1) / T));
  while (q.length) {
    const r = q.pop(), c = q.pop(), lad = at(c, r) === 7, onFoot = hard(c, r + 1) && at(c, r + 1) !== 5 || at(c, r + 1) === 7 || lad || support[r * LW + c], wall = hard(c - 1, r) || hard(c + 1, r);
    if (at(c, r + 1) === 5) continue; // in the acid
    if (!onFoot && !wall) { add(c, r + 1); add(c - 1, r + 1); add(c + 1, r + 1); continue; }
    add(c - 1, r); add(c + 1, r); add(c, r + 1); add(c - 1, r + 1); add(c + 1, r + 1);
    if (lad || at(c, r - 1) === 7 || wall || support[r * LW + c]) { add(c, r - 1); add(c - 1, r - 1); add(c + 1, r - 1); } // climbing pops you over the top
    if (onFoot) for (let dy = 1; dy <= 3 && isOpen(c, r - dy); dy++) for (const s of [-1, 1]) for (let dx = 0; dx <= 3 && isOpen(c + s * dx, r - dy); dx++) add(c + s * dx, r - dy);
    const h = lift.get(c + ',' + r); if (h) for (let k = 1; k <= h && isOpen(c, r - k); k++) add(c, r - k);
  }
  return (e) => { const c = Math.floor((e.x + e.w / 2) / T), r = Math.floor((e.y + e.h - 1) / T); return [[c, r], [c - 1, r], [c + 1, r], [c, r - 1]].some(([x, y]) => x >= 0 && y >= 0 && seen[y * LW + x]); };
};
const THREAT = S.THREAT, FLY = ['jetpack', 'camdrone', 'drone', 'icicle', 'flag', 'dronecaller', ...BOSSES];

check('the campaign has 25 missions, 18 of them remade (the Citadel is still last)', N === 25 && OLD.length === 18 && S.levelDef(N - 1).name === 'CITRUS CITADEL', N);
const remade = (i) => Array.from({ length: N }, (_, k) => S.levelDef(k)).indexOf(S.ROUND5[i === OLD.length - 1 ? 19 : i]); // the fingerprint's mission, by its place among the 20 before round 6: the Citadel moved from 18th to last

// ---- 1. the remake: missions 1-7 changed a lot, 8-18 changed some
// "changed" for a column: its 22 tiles hash differently from before (columns next to an underground zone are left out). "kept" for a spawn or a decoration: the same type at
// the same column is still there. Thresholds: missions 1-7 need at least 60% of their columns changed and at most 25% of
// their old spawns kept in place; missions 8-18 need at least 5% of their columns changed and at most 85% of their old spawns kept.
S.setRamp(false);
const summary = [];
for (let i = 0; i < OLD.length; i++) {
  const l = remade(i);
  S.startLevel(l); const [theme, boss, obj, cages, cut, cols, sp, dc] = OLD[i], L = S.levelDef(l), tag = (l + 1) + ' ' + L.name;
  let changed = 0, n = 0; for (let c = 0; c < cut; c++) { const was = cols.slice(c * 2, c * 2 + 2); if (was === '--' || S.deep(c)) continue; n++; if (was !== colHash(c)) changed++; }
  const fc = changed / n, now = S.spawnsNow().filter((o) => o.c < cut && !o.final && (o.from || 0) < S.GH).map((o) => o.type + '@' + Math.floor(o.c)), fs2 = kept(sp.split(' '), now);
  const fd = kept(dc.split(' ').filter(Boolean), S.decor().filter((o) => o.c < cut).map((o) => o.kind + '@' + Math.floor(o.c)));
  summary.push((l + 1) + ':' + Math.round(fc * 100) + '/' + Math.round(fs2 * 100) + '/' + Math.round(fd * 100));
  if (i < 7) check(tag + ': the base is new (at least 60% of columns changed, at most 25% of spawns in their old place)', fc >= 0.6 && fs2 <= 0.25, Math.round(fc * 100) + '% columns changed, ' + Math.round(fs2 * 100) + '% spawns kept, ' + Math.round(fd * 100) + '% decoration kept');
  else check(tag + ': the base changed (at least 5% of columns changed, at most 85% of spawns in their old place)', fc >= 0.05 && fs2 <= 0.85, Math.round(fc * 100) + '% columns changed, ' + Math.round(fs2 * 100) + '% spawns kept, ' + Math.round(fd * 100) + '% decoration kept');
  // theme, boss, objectives and cages stay what they were
  const B = S.spawnsNow().find((o) => o.final);
  check(tag + ': same theme, final boss and objectives', L.theme === theme && B && B.type === boss && (L.objectives || []).map((o) => o.id + (o.need || 1)).join(' ') === obj, L.theme + ', ' + (B && B.type));
  check(tag + ': at least as many cages as before', S.spawnsNow().filter((o) => o.type === 'cage' && o.c < cut && (o.from || 0) < S.GH).length >= cages);
  check(tag + ': the boss arena starts where it did', Math.min(S.cutAt(), 176) === cut, S.cutAt() + ' vs ' + cut);
}
console.log('     columns changed / spawns kept / decoration kept, % per mission: ' + summary.join(' '));

// ---- 2. the same mission every time: two builds give the same tiles, spawns and decoration
const snap = () => Array.from(S.tilesNow()).join('') + '|' + S.spawnsNow().map((o) => o.type + o.c + ',' + (o.from || 0)).join(';') + '|' + S.decor().map((d) => d.kind + d.c + ',' + d.r).join(';') + '|' + S.devs.map((d) => d.kind + d.x0 + ',' + d.x1).join(';');
for (let l = 0; l < N; l++) { S.startLevel(l); const a = snap(); S.startLevel(l); check((l + 1) + ': builds the same twice', snap() === a); }
S.setRamp(true);
{ S.startLevel(0); const same = S.ents.map((e) => e.type + Math.round(e.x)).join(); S.startLevel(0); check('a mission has the same quacks every time (difficulty ramp on)', S.ents.map((e) => e.type + Math.round(e.x)).join() === same); }

// ---- 3. each mission: safe start, sound build, everything that matters within reach
for (let l = 0; l < N; l++) {
  const L = S.levelDef(l), tag = (l + 1) + ' ' + L.name;
  S.startLevel(l); S.P.bro = S.BRO.einstein;
  const near = S.ents.filter((e) => (THREAT[e.type] || e.type === 'turret') && e.x < 20 * T);
  check(tag + ': no quack within 20 tiles of the start, 10 s ceasefire', near.length === 0 && Math.abs(S.ceasefire - 10) < 0.01, near.map((e) => e.type).join(','));
  const fl = floating();
  check(tag + ': no loose block floats', fl.length === 0, fl.slice(0, 6).join(' '));
  const walled = S.ents.filter((e) => !FLY.includes(e.type) && solidT(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))));
  check(tag + ': nothing spawns inside a wall', walled.length === 0, walled.map((e) => e.type + '@' + Math.floor(e.x / T)).join(','));
  const ok = reach(), cagesIn = S.ents.filter((e) => e.type === 'cage'), intel = S.ents.filter((e) => e.type === 'pickup' && e.item === 'intel'), targets = S.ents.filter((e) => e.type === 'target'), trig = S.ents.filter((e) => BOSSES.includes(e.type) && e.trig !== undefined).map((e) => ({ x: e.trig * T, y: (S.surf(e.trig, S.openRow(e.trig)) - 1) * T, w: T, h: T, type: e.type + ' arena' }));
  const lost = [...cagesIn, ...intel, ...targets, ...trig].filter((e) => !ok(e));
  check(tag + ': every cage, intel file, objective target and boss arena can be reached', lost.length === 0 && intel.length === 3, intel.length + ' intel, ' + cagesIn.length + ' cages; unreachable: ' + lost.map((e) => e.type + '@' + Math.floor(e.x / T) + ',' + Math.floor(e.y / T)).join(' '));
  // nothing sits in mid-air once the level settles (fliers and hanging things aside)
  S.endCeasefire(); S.P.inv = 1e9; S.P.x = 3 * T; run(30, {});
  const air = S.ents.filter((e) => !e.dead && !FLY.includes(e.type) && e.type !== 'para' && !solidT(S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h + 1) / T))) && S.tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h + 1) / T)) !== 7 && !S.devs.some((d) => d.kind === 'lift' && Math.abs(d.y - (e.y + e.h)) < 3 && e.x + e.w > d.x && e.x < d.x + d.w));
  check(tag + ': nothing floats in mid-air', air.length === 0, air.map((e) => e.type + '@' + Math.floor(e.x / T) + ',' + Math.floor(e.y / T)).join(' '));
}

// ---- 4. the difficulty curve: the same threat measure as tests/levels.js
{
  const threat = []; for (let l = 0; l < N; l++) { S.startLevel(l); threat.push(S.ents.filter((e) => THREAT[e.type]).reduce((a, e) => a + THREAT[e.type], 0)); }
  check('the first mission is the easiest', threat[0] === Math.min(...threat), threat.map((x) => x.toFixed(0)).join(' '));
  check('the finale is among the hardest', threat[N - 1] >= Math.max(...threat) - 6);
  let dips = 0; for (let l = 1; l < N; l++) if (threat[l] < threat[l - 1] - 6) dips++;
  check('threat climbs along the campaign (no big drops)', dips === 0, dips + ' drops');
  check('the second half is clearly harder than the first', threat.slice(8).reduce((a, b) => a + b) / (N - 8) > 1.5 * threat.slice(0, 7).reduce((a, b) => a + b) / 7);
}

// ---- 5. a bot that runs right, jumps and fires (invulnerable, as Einstein) gets through the base of missions 1-7
for (let k = 0; k < 7; k++) {
  const l = remade(k), tag = (l + 1) + ' ' + S.levelDef(l).name;
  reseed(4242 + k); S.startLevel(l); S.endCeasefire(); S.P.bro = S.BRO.einstein; const goal = S.cutAt() - 4; let far = 0, i = 0;
  for (; i < 60 * 90 && far < goal; i++) {
    const stuck = i % 120 < 30;
    if (i % 25 === 0) S.pressed.jump = true;
    S.P.inv = 1e9;
    const pc = Math.floor((S.P.x + 5) / T), overAcid = [1, 2, 3, 4].some((k) => [1, 2, 3, 4, 5, 6].some((d) => S.tileAt(pc + k, Math.floor(S.P.y / T) + d) === 5)); // acid (5) ahead: a player keeps the floes and planks whole
    step({ right: true, jump: i % 25 < 14, fire: i % 6 < 3 && !overAcid, up: stuck && i % 240 < 30 });
    far = Math.max(far, S.P.x / T);
  }
  check(tag + ': a simple bot gets through the base to the arena in 90 s', far >= goal, 'reached col ' + far.toFixed(0) + ' of ' + goal + ' in ' + (i / 60).toFixed(0) + ' s');
}

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
