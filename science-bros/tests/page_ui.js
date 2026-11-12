// Headless checks for the page around the game: game first with the story in a toggle, fullscreen (button and F key),
// the live controls panel (keyboard keys from KEYMAP, pad button names once a pad is connected), the bro roster
// (built from BROS, locked bros as silhouettes, cards by mouse and keyboard), the hidden extras, and that none of it
// throws or runs under the standard test stubs. The page script runs here against a small fake DOM.
// Usage: node science-bros/tests/page_ui.js science-bros/index.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const noop = () => {};
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!ok) fails++; };

// ---------------------------------------------------------------- 1. the page text: layout, story toggle, CSS
const at = (s) => html.indexOf(s);
check('the game canvas comes before the story in the page', at('<canvas id="game"') > 0 && at('<details') > at('<canvas id="game"'));
const story = (html.match(/<details[^>]*id="story"[^>]*>([\s\S]*?)<\/details>/) || [])[0] || '';
check('the story sits in a details toggle with a Story summary, closed at the start', /<summary>Story<\/summary>/.test(story) && /class="premise"/.test(story) && !/<details[^>]*\sopen/.test(story));
check('the title is a slim top line before the game', at('<h1 id="title">') > 0 && at('<h1 id="title">') < at('<canvas id="game"'));
const css = html.split('<style>')[1].split('</style>')[0];
check('the game column is sized from the window height at 16:9', /\.wrap \{[^}]*max-width: calc\(\(100vh - var\(--chrome\)\) \* 16 \/ 9\)/.test(css));
check('the canvas stays 16:9 and pixel-sharp', /canvas#game \{[^}]*aspect-ratio: 16 \/ 9[^}]*image-rendering: pixelated/.test(css));
check('fullscreen letterboxes the canvas at 16:9 on black', /\.stage:fullscreen \{[^}]*justify-content: center[^}]*background: #000/.test(css) && /\.stage:fullscreen canvas#game \{ width: min\(100vw, calc\(100vh \* 16 \/ 9\)\)/.test(css));
check('a 16px side gutter and a phone viewport', /padding-left: max\(16px/.test(css) && /name="viewport" content="width=device-width/.test(html));
const urls = html.match(/https?:\/\/[^"' )]+/g) || [];
check('no external requests beyond the font link', urls.every((u) => /^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)), urls.join(' '));
check('no emoji on the page', !/[\u{1F000}-\u{1FAFF}]/u.test(html));

// ---------------------------------------------------------------- 2. the standard stubs: nothing throws, the page code stays off
{
  const ctxProxy = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set: (t, k, v) => { t[k] = v; return true; } });
  const mkEl = () => ({ getContext: () => ctxProxy, addEventListener: noop, appendChild: noop, focus: noop, style: {}, dataset: {} });
  const doc = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelectorAll: () => [], querySelector: () => mkEl(), fonts: { load: () => Promise.resolve() } };
  const win = { __SB_TEST__: true };
  const sb = { window: win, document: doc, addEventListener: noop, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, Float32Array, Uint8Array, Promise };
  let err = null, warned = 0;
  sb.console = { log: noop, warn: () => warned++, error: noop };
  try { vm.createContext(sb); vm.runInContext(src, sb); win.__SB__.reset(); for (let i = 0; i < 30; i++) win.__SB__.step(1 / 60); win.__SB__.render(0.5); } catch (e) { err = e; }
  check('nothing throws under the standard test stubs', !err && !warned, err ? String(err) : warned ? warned + ' warning(s)' : '');
  check('the page code stays off under the standard stubs', !err && win.__SB__.page() === null);
}

// ---------------------------------------------------------------- 3. a small fake DOM for the page code
const winL = {}, docL = {};
const fire = (map, t, e) => { for (const f of map[t] || []) f(e); };
const evt = (type, extra = {}) => Object.assign({ type, defaultPrevented: false, stopped: false, repeat: false, detail: 0, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } }, extra);
const mkCtx = (owner) => new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop }); if (k === 'measureText') return () => ({ width: 10 }); return (...a) => { if (owner) owner.calls.push([k, t.globalCompositeOperation, ...a]); }; }, set: (t, k, v) => { t[k] = v; return true; } });
let doc;
class El {
  constructor(tag, id) { this.tagName = tag.toUpperCase(); this.id = id || ''; this.children = []; this.parentNode = null; this.listeners = {}; this.attrs = {}; this.style = {}; this.dataset = {}; this.hidden = false; this._text = ''; this.calls = []; this.width = 0; this.height = 0; this._cls = new Set(); const s = this._cls; this.classList = { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c), toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); return on; } }; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this._cls.add(c)); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode && c.parentNode.children) c.parentNode.children = c.parentNode.children.filter((x) => x !== c); c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((x) => x !== this); this.parentNode = null; } }
  contains(n) { while (n) { if (n === this) return true; n = n.parentNode; } return false; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  getContext() { return this._ctx || (this._ctx = mkCtx(this)); }
  focus() { doc.activeElement = this; }
  blur() { if (doc.activeElement === this) doc.activeElement = null; }
  requestFullscreen() { this.calls.push(['requestFullscreen']); return Promise.resolve(); }
  find(pred) { for (const c of this.children) { if (!(c instanceof El)) continue; if (pred(c)) return c; const f = c.find(pred); if (f) return f; } return null; }
  all(pred, out = []) { for (const c of this.children) { if (!(c instanceof El)) continue; if (pred(c)) out.push(c); c.all(pred, out); } return out; }
  // an event that bubbles up the tree, then to the document and the window, like a real one
  dispatch(type, extra = {}) { const e = evt(type, Object.assign({ target: this }, extra)); let n = this; while (n && !e.stopped) { for (const f of n.listeners[type] || []) f(e); n = n.parentNode; } if (!e.stopped) fire(docL, type, e); if (!e.stopped) fire(winL, type, e); return e; }
}
const ids = {};
const mkId = (tag, id, parent) => { const e = new El(tag, id); ids[id] = e; if (parent) parent.appendChild(e); return e; };
const body = new El('body');
const wrap = mkId('div', 'wrap', body);
const header = new El('header'); wrap.appendChild(header);
const title = mkId('h1', 'title', header); title._text = 'Science Bros';
const sub = mkId('div', 'sub', header); sub._text = 'War on the Anti-Science League';
const stage = mkId('div', 'stage', wrap);
const game = mkId('canvas', 'game', stage);
const storyEl = mkId('details', 'story', wrap);
const fsBtn = mkId('button', 'fs', wrap); mkId('span', 'fslabel', fsBtn)._text = 'Fullscreen';
const keysEl = mkId('ul', 'keys', wrap); const modeEl = mkId('span', 'padmode', wrap); modeEl._text = 'Keyboard';
const freedEl = mkId('span', 'freed', wrap); const rosterEl = mkId('div', 'roster', wrap);
doc = {
  body, title: 'Science Bros', hidden: false, activeElement: null, fullscreenElement: null, exits: 0,
  getElementById: (id) => ids[id] || mkId('div', id),
  createElement: (tag) => new El(tag),
  createTextNode: (t) => ({ textContent: String(t), parentNode: null }),
  querySelectorAll: () => [], querySelector: () => new El('div'),
  fonts: { load: () => Promise.resolve() },
  addEventListener: (t, f) => { (docL[t] = docL[t] || []).push(f); },
  exitFullscreen() { this.exits++; return Promise.resolve(); },
};
const pads = [null];
const navigator = { getGamepads: () => pads };
const store = {}, writes = [];
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { writes.push(k); store[k] = String(v); } };
const win = { __SB_TEST__: true };
const sb = { window: win, document: doc, navigator, localStorage, addEventListener: (t, f) => { (winL[t] = winL[t] || []).push(f); }, performance: { now: () => Date.now() }, requestAnimationFrame: noop, console, Math, setTimeout, Set, Map, Array, Object, String, JSON, Float32Array, Uint8Array, Promise };
let err = null;
try { vm.createContext(sb); vm.runInContext(src, sb); } catch (e) { err = e; }
check('the page code runs against a real-looking DOM without throwing', !err, err ? String(err.stack || err) : '');
const S = win.__SB__, P = S.page();
check('the page code starts when there is a page', !!P);
const key = (type, code, extra = {}) => { const e = evt(type, Object.assign({ code, target: body }, extra)); fire(winL, type, e); return e; };
const tap = (code) => { key('keydown', code); key('keyup', code); };

// ---------------------------------------------------------------- 4. fullscreen
fsBtn.dispatch('click', { detail: 1 });
check('the Fullscreen button puts the stage in fullscreen', stage.calls.some((c) => c[0] === 'requestFullscreen'));
check('focus goes back to the game canvas', doc.activeElement === game);
const KEYMAP = vm.runInNewContext('(' + src.match(/const KEYMAP = (\{[\s\S]*?\});/)[1] + ')');
check('F is free in the game key map', !('KeyF' in KEYMAP));
stage.calls.length = 0; doc.activeElement = null;
let e = key('keydown', 'KeyF'); key('keyup', 'KeyF');
check('the F key puts the stage in fullscreen', stage.calls.some((c) => c[0] === 'requestFullscreen') && doc.activeElement === game);
check('the F key presses no game key', !Object.values(S.keys).some(Boolean) && !Object.values(S.pressed).some(Boolean));
doc.fullscreenElement = stage; fire(docL, 'fullscreenchange', evt('fullscreenchange'));
check('the button offers the way out while in fullscreen', ids.fslabel.textContent === 'Exit fullscreen');
tap('KeyF');
check('F again leaves fullscreen', doc.exits === 1);
doc.fullscreenElement = null; fire(docL, 'fullscreenchange', evt('fullscreenchange'));
check('the button label comes back after leaving', ids.fslabel.textContent === 'Fullscreen');
e = key('keydown', 'KeyF', { ctrlKey: true }); key('keyup', 'KeyF');
check('Ctrl+F is left to the browser', !e.defaultPrevented && doc.exits === 1);

// ---------------------------------------------------------------- 5. the live controls panel
const rows = keysEl.all((n) => n.tagName === 'LI');
const kbdsOf = (li, pad) => li.all((n) => n.tagName === 'KBD' && n.classList.contains('pad') === pad);
const rowOf = (act) => rows.find((li) => li.dataset.acts.split(' ').includes(act));
const KEY_LABEL = (c) => ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc' })[c] || c.replace(/^Key/, '');
const missing = Object.keys(KEYMAP).filter((c) => { const li = rowOf(KEYMAP[c]); return !li || !kbdsOf(li, false).some((k) => k.textContent === KEY_LABEL(c)); });
check('every key in the game key map shows in the controls panel', rows.length >= 12 && !missing.length, missing.join(' '));
check('the fullscreen key shows too', !!rowOf('fullscreen') && kbdsOf(rowOf('fullscreen'), false)[0].textContent === 'F');
const kbdFor = (code) => keysEl.find((n) => n.tagName === 'KBD' && n.dataset.code === code);
key('keydown', 'KeyZ');
check('holding Z lights its key hint and the fire row', kbdFor('KeyZ').classList.contains('on') && rowOf('fire').classList.contains('on'));
check('the other fire key stays dark', !kbdFor('KeyJ').classList.contains('on'));
key('keyup', 'KeyZ');
check('letting go of Z turns it off again', !kbdFor('KeyZ').classList.contains('on') && !rowOf('fire').classList.contains('on'));
key('keydown', 'ShiftRight');
check('right Shift lights the one Shift hint', kbdFor('ShiftLeft').classList.contains('on'));
key('keyup', 'ShiftRight');
key('keydown', 'ArrowLeft'); fire(winL, 'blur', evt('blur'));
check('leaving the window clears the hints', !kbdFor('ArrowLeft').classList.contains('on'));
check('keyboard key names show before a pad is seen', !keysEl.classList.contains('padmode') && modeEl.textContent === 'Keyboard');
const pad = { id: 'test pad', buttons: Array.from({ length: 18 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
pads[0] = pad; S.pollPad(); P.tick();
check('pad button names show once a pad is connected', keysEl.classList.contains('padmode') && /Controller/.test(modeEl.textContent));
check('the pad names follow the game pad layout', kbdsOf(rowOf('jump'), true).map((k) => k.textContent).join() === '✕' && kbdsOf(rowOf('fire'), true).map((k) => k.textContent).join() === '□,R2' && kbdsOf(rowOf('melee'), true)[0].textContent === '△');
pad.buttons[0].pressed = true; S.pollPad(); P.tick();
check('holding cross lights the jump row and its pad name', rowOf('jump').classList.contains('on') && kbdsOf(rowOf('jump'), true)[0].classList.contains('on'));
pad.buttons[0].pressed = false; S.pollPad(); P.tick();
check('letting go of cross turns it off', !rowOf('jump').classList.contains('on'));
pads[0] = null; P.tick();
check('keyboard names come back when the pad is gone', !keysEl.classList.contains('padmode') && modeEl.textContent === 'Keyboard');
for (const k in S.pressed) S.pressed[k] = false;

// ---------------------------------------------------------------- 6. the bro roster
S.reset(); for (const k in S.keys) S.keys[k] = false; P.tick();
const tiles = rosterEl.all((n) => n.tagName === 'BUTTON' && n.classList.contains('bro'));
const broTiles = tiles.filter((t) => t.dataset.id);
const card = ids.brocard || rosterEl.find((n) => n.id === 'brocard');
check('the roster has one tile per bro in BROS, in order', broTiles.length === S.BROS.length && broTiles.every((t, i) => t.dataset.id === S.BROS[i].id));
const unl = S.unlocked, isLocked = (t) => t.classList.contains('locked');
const lockedOk = broTiles.every((t) => isLocked(t) === !unl.includes(t.dataset.id));
check('bros not yet freed are marked locked, freed ones are not', lockedOk && broTiles.filter((t) => !isLocked(t)).length === unl.length, unl.length + ' unlocked');
const lockedTile = broTiles.find(isLocked), openTile = broTiles.find((t) => !isLocked(t));
check('a locked tile hides the name', lockedTile.textContent === '???' && openTile.textContent === S.BRO[openTile.dataset.id].name);
const lastDraw = (cnv) => { const c = cnv.calls, i = c.map((x) => x[0]).lastIndexOf('clearRect'); return c.slice(i); }; // the tile's latest drawing
check('a locked tile draws a dark silhouette', lastDraw(lockedTile.children[0]).some((c) => c[0] === 'fillRect' && c[1] === 'source-in') && !lastDraw(openTile.children[0]).some((c) => c[1] === 'source-in'));
check('the freed count reads the unlocked list', freedEl.textContent === unl.length + ' / ' + S.BROS.length + ' freed');
check('every tile can be focused (a button)', tiles.every((t) => t.tagName === 'BUTTON' && t.type === 'button'));
openTile.dispatch('mouseenter');
const b = S.BRO[openTile.dataset.id], txt = card.textContent;
check('hovering a bro shows the card', !card.hidden && openTile.classList.contains('open'));
check('the card shows name, weapon, special and formula from BROS', [b.name, b.weapon, b.wdesc, b.special, b.sdesc, b.formula].every((s) => txt.includes(s)), txt.slice(0, 80));
openTile.dispatch('mouseleave');
check('leaving the tile hides the card', card.hidden);
openTile.dispatch('click', { detail: 1 }); openTile.dispatch('mouseleave');
check('a click keeps the card open', !card.hidden);
body.dispatch('click', { detail: 1 });
check('a click elsewhere closes it', card.hidden);
lockedTile.dispatch('click', { detail: 1 });
check('a locked bro says "Free me from a cage" and keeps its secret', card.textContent.includes('Free me from a cage') && !card.textContent.includes(S.BRO[lockedTile.dataset.id].name));
lockedTile.dispatch('click', { detail: 1 });
check('a second click closes it', card.hidden);
for (const k in S.keys) S.keys[k] = false;
e = openTile.dispatch('keydown', { code: 'Enter' });
check('Enter on a focused tile opens its card', !card.hidden && card.textContent.includes(b.name) && e.defaultPrevented);
e = openTile.dispatch('keydown', { code: 'Space' });
check('Space closes it, and the game does not jump', card.hidden && !S.keys.jump && !S.pressed.start);
const freeMe = lockedTile.dataset.id;
S.unlocked.push(freeMe); P.tick();
check('freeing a bro updates the roster live', !isLocked(lockedTile) && lockedTile.textContent === S.BRO[freeMe].name && freedEl.textContent.startsWith(unl.length + ' / '));

// ---------------------------------------------------------------- 7. hidden extras (cosmetic only)
const before = JSON.stringify([S.settings, S.trophies, S.unlocked, S.lives, S.state, S.career]);
const nWrites = writes.length;
const type = (word) => { for (const ch of word) tap('Key' + ch.toUpperCase()); };
type('theory');
check('hidden extra 1 works', !!wrap.find((n) => n.id === 'lore') && wrap.find((n) => n.id === 'lore').textContent.length > 80);
for (const c of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']) tap(c);
const x2 = game.className;
for (const c of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']) tap(c);
check('hidden extra 2 works', /x-/.test(x2) && !/x-/.test(game.className));
for (let i = 0; i < 5; i++) title.dispatch('click', { detail: 1 });
const x3 = [game.className, sub.textContent];
for (let i = 0; i < 5; i++) title.dispatch('click', { detail: 1 });
check('hidden extra 3 works', /x-/.test(x3[0]) && x3[1] !== 'War on the Anti-Science League' && sub.textContent === 'War on the Anti-Science League' && !/x-/.test(game.className));
const extra = tiles.find((t) => !t.dataset.id);
extra.dispatch('click', { detail: 1 });
check('hidden extra 4 works', !!extra && !card.hidden && card.textContent.length > 40 && !S.BROS.some((x) => card.textContent.includes(x.name)));
body.dispatch('click', { detail: 1 });
doc.hidden = true; fire(docL, 'visibilitychange', evt('visibilitychange'));
const t5 = doc.title;
doc.hidden = false; fire(docL, 'visibilitychange', evt('visibilitychange'));
check('hidden extra 5 works', t5 !== 'Science Bros' && doc.title === 'Science Bros');
for (const k in S.keys) S.keys[k] = false;
check('the hidden extras change nothing in the game and save nothing', JSON.stringify([S.settings, S.trophies, S.unlocked, S.lives, S.state, S.career]) === before && writes.length === nWrites);

// ---------------------------------------------------------------- 8. the game still runs
err = null;
try { S.startLevel(0); for (let i = 0; i < 60; i++) { S.step(1 / 60); P.tick(); } S.render(1); } catch (x) { err = x; }
check('the game steps and draws with the page running', !err, err ? String(err) : '');

console.log(fails ? fails + ' check(s) failed' : 'all page checks passed');
process.exit(fails ? 1 : 0);
