// UI and session state. Math lives in trig-data.js / questions.js / check.js;
// this file only renders and wires up events.

import {
  PAD_MAGNITUDES, GRID_ANGLES, SIGNED_ANGLES, INVERSE_RANGES, valueKey,
  value, negate, isSignable, valueApprox, trigOf, angleTex, valueTex,
} from './trig-data.js';
import { FAMILIES, MODES, SIN_COS_VALUES, Dealer, correctAnswer, promptOf, answerTex } from './questions.js';
import { checkAnswer } from './check.js';
import { load, save, recordResult, emptyStats } from './storage.js';
import { createCircle } from './circle.js';
import { createWheel } from './wheel.js';
import { shareText, formatTime } from './share.js';

const $ = (id) => document.getElementById(id);
const fnTex = { sin: '\\sin', cos: '\\cos', tan: '\\tan' };

let data = load();
let session = null;
const persist = () => save(data);

// ---------- math rendering ----------

// Plain-text fallback in case KaTeX failed to load (e.g. offline).
function texToText(tex) {
  return tex
    .replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√$1')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\^\{-1\}/g, '⁻¹')
    .replace(/\\pi/g, 'π').replace(/\\theta/g, 'θ')
    .replace(/\\(left|right|!|,)/g, '').replace(/\\ /g, ' ')
    .replace(/\\(sin|cos|tan)/g, '$1')
    .replace(/-/g, '−');
}

function renderMath(node, tex) {
  if (window.katex) {
    window.katex.render(tex, node, { throwOnError: false });
  } else {
    node.textContent = texToText(tex);
  }
  return node;
}

function math(tex, className = 'm') {
  return renderMath(Object.assign(document.createElement('span'), { className }), tex);
}

function button(className, onClick, ...children) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.append(...children);
  b.addEventListener('click', onClick);
  return b;
}

// ---------- theme ----------

function applyTheme() {
  const root = document.documentElement;
  if (data.settings.theme) root.dataset.theme = data.settings.theme;
  else delete root.dataset.theme;
  const dark = isDark();
  $('theme-toggle').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  $('theme-toggle').dataset.mode = dark ? 'dark' : 'light';
}

function isDark() {
  const t = data.settings.theme;
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

$('theme-toggle').addEventListener('click', () => {
  data.settings.theme = isDark() ? 'light' : 'dark';
  persist();
  applyTheme();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- home screen ----------

function showScreen(id) {
  for (const s of ['home', 'practice', 'summary']) $(s).hidden = s !== id;
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

function renderHome() {
  const list = $('mode-list');
  list.replaceChildren();
  for (const [key, mode] of Object.entries(MODES)) {
    const b = button('mode-btn', () => {
      data.settings.mode = key;
      persist();
      renderHome();
    });
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(data.settings.mode === key));
    b.innerHTML = `<span class="mode-name"></span><span class="mode-blurb"></span>`;
    b.querySelector('.mode-name').textContent = mode.label;
    b.querySelector('.mode-blurb').textContent = mode.blurb;
    list.append(b);
  }
  for (const b of $('length-choice').querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(Number(b.dataset.length) === data.settings.length));
  }
  for (const b of $('circle-choice').querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String((b.dataset.circle === 'on') === data.settings.showCircle));
  }
  for (const b of $('input-choice').querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.input === data.settings.input));
  }
  renderStats();
}

$('length-choice').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  data.settings.length = Number(b.dataset.length);
  persist();
  renderHome();
});

$('circle-choice').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  data.settings.showCircle = b.dataset.circle === 'on';
  persist();
  renderHome();
});

$('input-choice').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  data.settings.input = b.dataset.input;
  persist();
  renderHome();
});

const pct = (c, n) => (n ? `${Math.round((100 * c) / n)}%` : '—');

function renderStats() {
  const s = data.stats;
  $('stat-attempted').textContent = s.attempted;
  $('stat-accuracy').textContent = pct(s.correct, s.attempted);
  $('stat-streak').textContent = s.streak;
  $('stat-best').textContent = s.bestStreak;
  const rows = $('family-stats');
  rows.replaceChildren();
  for (const [key, fam] of Object.entries(FAMILIES)) {
    const t = s.families[key] || { attempted: 0, correct: 0 };
    const row = document.createElement('div');
    row.className = 'fam-row';
    const share = t.attempted ? t.correct / t.attempted : 0;
    row.innerHTML = `<span class="fam-name"></span><span class="fam-bar"><span></span></span><span class="fam-pct"></span>`;
    row.querySelector('.fam-name').textContent = fam.label;
    row.querySelector('.fam-bar span').style.width = `${Math.round(share * 100)}%`;
    row.querySelector('.fam-pct').textContent = t.attempted ? `${pct(t.correct, t.attempted)} of ${t.attempted}` : '—';
    rows.append(row);
  }
}

let resetArmed = null;
$('reset-btn').addEventListener('click', () => {
  const b = $('reset-btn');
  if (!resetArmed) {
    b.textContent = 'Tap again to erase all progress';
    b.classList.add('armed');
    resetArmed = setTimeout(() => {
      resetArmed = null;
      b.textContent = 'Reset progress';
      b.classList.remove('armed');
    }, 4000);
    return;
  }
  clearTimeout(resetArmed);
  resetArmed = null;
  data.stats = emptyStats();
  persist();
  b.textContent = 'Progress reset';
  b.classList.remove('armed');
  setTimeout(() => { b.textContent = 'Reset progress'; }, 2000);
  renderStats();
});

$('start-btn').addEventListener('click', () => startSession());

// ---------- practice ----------

const circle = createCircle($('circle-wrap'));
const pads = {}; // pad key → pad element, built once
const wheels = {}; // pad key → dial, for the pads that are dials

function startSession() {
  const { mode, length } = data.settings;
  session = { mode, length, dealer: new Dealer(mode), index: 0, correct: 0, results: [], startedAt: Date.now() };
  $('mode-label').textContent = MODES[mode].label;
  applyCircleSetting();
  showScreen('practice');
  nextQuestion();
}

function applyCircleSetting() {
  $('practice').classList.toggle('no-circle', !data.settings.showCircle);
  $('circle-toggle').setAttribute('aria-pressed', String(data.settings.showCircle));
  $('circle-toggle').setAttribute('aria-label', data.settings.showCircle ? 'Hide unit circle' : 'Show unit circle');
}

$('circle-toggle').addEventListener('click', () => {
  data.settings.showCircle = !data.settings.showCircle;
  persist();
  applyCircleSetting();
});

$('quit-btn').addEventListener('click', () => {
  session = null;
  renderHome();
  showScreen('home');
});

function emptySelection(type) {
  if (type === 'equation') return { fn: 'sin', v: null };
  if (type === 'signedAngle') return { t: null, neg: false };
  return null;
}

function nextQuestion() {
  const q = session.dealer.next();
  const type = FAMILIES[q.family].answer;
  Object.assign(session, { question: q, type, sel: emptySelection(type), checked: false });

  const prompt = promptOf(q);
  $('family-tag').textContent = FAMILIES[q.family].label;
  $('caption').textContent = prompt.caption;
  renderMath($('prompt'), prompt.tex);
  $('feedback').replaceChildren();
  $('feedback').className = 'feedback';
  $('stage').dataset.status = '';
  $('stage').classList.toggle('circle-question', type === 'equation');
  document.querySelectorAll('.flash').forEach((n) => n.classList.remove('is-on', 'is-correct', 'is-wrong'));
  $('check-btn').classList.remove('is-waiting');

  // Unit circle: show the given angle or line; selected angles are drawn as the student picks.
  circle.setStatus(null);
  circle.setRange(null);
  circle.setLine(type === 'equation' ? q.fn : null, q.input);
  circle.setAngle(q.angle ?? null, { fromZero: true });

  showPad(type);
  renderSelection();
  updateMeters();
}

let padKey = null; // which pad is on screen

function showPad(type) {
  const useWheel = data.settings.input === 'wheel';
  const key = useWheel ? `${type}Wheel` : type;
  if (!pads[key]) {
    if (useWheel) {
      wheels[key] = buildWheel(type);
      pads[key] = type === 'equation' ? withFnToggle(wheels[key].el) : wheels[key].el;
    } else if (type === 'signedAngle') {
      pads[key] = buildAnglePad();
    } else {
      const pad = buildValuePad(type === 'equation' ? SIN_COS_VALUES : WHEEL_VALUES);
      pads[key] = type === 'equation' ? withFnToggle(pad) : pad;
    }
  }
  padKey = key;
  $('pad').replaceChildren(pads[key]);
  for (const b of pads[key].querySelectorAll('button')) b.disabled = false;
  const wheel = wheels[key];
  if (wheel) {
    wheel.setDisabled(false);
    wheel.setIndex(wheel.indexOf('0')); // every question starts the wheel at 0
  }
  if (!data.settings.seenHelp[key]) openHelp(key);
}

// ---------- how-to popup ----------

// What to do with each pad, keyed like pads. Controls only, never hints about the math.
const KEYS = (text) => `<span class="keys">Keyboard: ${text}</span>`;
const CHECK = 'Press <b>Check</b> when it’s right.';
const HELP = {
  valueWheel: { title: 'Turning the dial', items: [
    'Turn the dial until your answer sits in the blue window. Drag it, tap a value, or use the ‹ › buttons.',
    CHECK,
    KEYS('<kbd>←</kbd> <kbd>→</kbd> turn the dial, <kbd>-</kbd> flips the sign, <kbd>Enter</kbd> checks.'),
  ] },
  equationWheel: { title: 'Naming the line', items: [
    'Pick <b>sin θ</b> or <b>cos θ</b> with the switch above the dial.',
    'Turn the dial until the value sits in the blue window. Drag it, tap a value, or use the ‹ › buttons.',
    CHECK,
    KEYS('<kbd>↑</kbd> <kbd>↓</kbd> switch between sin θ and cos θ, <kbd>←</kbd> <kbd>→</kbd> turn the dial, <kbd>-</kbd> flips the sign, <kbd>Enter</kbd> checks.'),
  ] },
  signedAngleWheel: { title: 'Turning the angle dial', items: [
    'Turn the dial until your angle sits in the blue window. It runs from −5π/6 up to π, so the negative angles are on it too.',
    CHECK,
    KEYS('<kbd>←</kbd> <kbd>→</kbd> turn the dial, <kbd>-</kbd> jumps to the opposite angle, <kbd>Enter</kbd> checks.'),
  ] },
  value: { title: 'Picking a value', items: [
    'Tap the exact value. Each negative sits right under its positive.',
    CHECK,
    KEYS('<kbd>-</kbd> flips the sign, <kbd>Enter</kbd> checks.'),
  ] },
  equation: { title: 'Naming the line', items: [
    'Pick <b>sin θ</b> or <b>cos θ</b>, then tap the value.',
    CHECK,
    KEYS('<kbd>↑</kbd> <kbd>↓</kbd> switch between sin θ and cos θ, <kbd>-</kbd> flips the sign, <kbd>Enter</kbd> checks.'),
  ] },
  signedAngle: { title: 'Picking an angle', items: [
    'Tap an angle. Tap <b>+/−</b> to make it negative.',
    CHECK,
    KEYS('<kbd>-</kbd> makes the angle negative, <kbd>Enter</kbd> checks.'),
  ] },
};

let helpOpenedAt = 0;

function openHelp(key = padKey) {
  const help = HELP[key];
  if (!help || $('help').open) return;
  $('help-title').textContent = help.title;
  $('help-list').innerHTML = help.items.map((item) => `<li>${item}</li>`).join('');
  data.settings.seenHelp = { ...data.settings.seenHelp, [key]: true };
  persist();
  helpOpenedAt = Date.now();
  $('help').showModal();
}

$('help-btn').addEventListener('click', () => openHelp());
$('help-close').addEventListener('click', () => $('help').close());
$('help').addEventListener('click', (e) => {
  // A click outside the box (on the backdrop) closes it too.
  const r = $('help').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('help').close();
});
$('help').addEventListener('close', () => {
  if (session) session.startedAt += Date.now() - helpOpenedAt; // reading the help doesn't count against the clock
  activeWheel()?.el.focus({ preventScroll: true });
});

// ---------- wheel input ----------

// All exact values in number-line order. "undefined" sits at the wrap point between √3 and −√3,
// the way tangent jumps from +∞ to −∞.
const WHEEL_VALUES = (() => {
  const signed = PAD_MAGNITUDES.filter((m) => m !== 'undef')
    .flatMap((m) => (m === '0' ? [value(m)] : [value(m, -1), value(m, 1)]));
  return [...signed.sort((a, b) => valueApprox(a) - valueApprox(b)), value('undef')];
})();

// The dial on screen right now, or null when the pad is buttons.
const activeWheel = () => (session && wheels[padKey]) || null;

// Value questions get every exact value; line questions only the sine/cosine values, and
// leave the up/down arrows for switching between sin θ and cos θ. Inverse trig turns
// through −5π/6 to π.
function buildWheel(type) {
  if (type === 'signedAngle') {
    const items = SIGNED_ANGLES.map((t) => ({ key: String(t), text: texToText(angleTex(t)), render: () => math(angleTex(t)) }));
    return createWheel(items, { label: 'Angle', onChange: (i) => wheelChanged(SIGNED_ANGLES[i]) });
  }
  const values = type === 'equation' ? SIN_COS_VALUES : WHEEL_VALUES;
  const items = values.map((v) => ({
    key: valueKey(v),
    text: texToText(valueTex(v)),
    render: () => (v.mag === 'undef'
      ? Object.assign(document.createElement('span'), { className: 'wheel-word', textContent: 'undefined' })
      : math(valueTex(v))),
  }));
  return createWheel(items, { label: 'Exact value', onChange: (i) => wheelChanged(values[i]), verticalKeys: type !== 'equation' });
}

// v is an exact value, or an angle in twelfths for inverse trig.
function wheelChanged(v) {
  if (!session || session.checked) return;
  if (session.type === 'equation') {
    session.sel.v = v;
  } else if (session.type === 'signedAngle') {
    session.sel = { t: Math.abs(v), neg: v < 0 };
    circle.setAngle(currentAnswer());
  } else {
    session.sel = v;
  }
  renderSelection();
}

function setWheelTo(key) {
  const wheel = activeWheel();
  wheel.setIndex(wheel.indexOf(key));
}

// sin θ / cos θ picker above a line question's pad. The up and down arrows switch it too.
function withFnToggle(pad) {
  const wrap = document.createElement('div');
  const toggle = document.createElement('div');
  toggle.className = 'segmented fn-toggle';
  for (const fn of ['sin', 'cos']) {
    const b = button('', () => setFn(fn), math(`${fnTex[fn]}\\theta`));
    b.dataset.fn = fn;
    toggle.append(b);
  }
  wrap.append(toggle, pad);
  return wrap;
}

function setFn(fn) {
  if (session.checked || session.type !== 'equation') return;
  session.sel.fn = fn;
  renderSelection();
}

// Two rows of the offered values: 0 and the positives on top; undefined (when offered) and the
// negatives below, so each negative sits directly under its positive.
function buildValuePad(values) {
  const offered = new Set(values.map(valueKey));
  const positives = PAD_MAGNITUDES.filter((m) => m !== '0' && m !== 'undef' && offered.has(m)).map((m) => value(m));
  const rows = [
    [value('0'), ...positives],
    [offered.has('undef') ? value('undef') : null, ...positives.map(negate)],
  ];
  const grid = document.createElement('div');
  grid.className = 'pad-grid value-pad';
  grid.style.gridTemplateColumns = `repeat(${rows[0].length}, 1fr)`;
  for (const v of rows.flat()) {
    if (!v) {
      grid.append(document.createElement('span'));
      continue;
    }
    const label = v.mag === 'undef' ? 'undef' : math(valueTex(v));
    const b = button('pad-btn', () => pickValue(v), label);
    b.dataset.value = valueKey(v);
    if (v.mag === 'undef') {
      b.classList.add('pad-word');
      b.setAttribute('aria-label', 'undefined');
    }
    grid.append(b);
  }
  return grid;
}

function buildAnglePad() {
  const wrap = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'pad-grid cols-4';
  for (const t of GRID_ANGLES) {
    const b = button('pad-btn', () => pickAngle(t), math(angleTex(t)));
    b.dataset.angle = t;
    grid.append(b);
  }
  const sign = button('pad-btn sign-btn sign-wide', toggleSign, '+/−');
  sign.setAttribute('aria-label', 'Toggle negative');
  wrap.append(grid, sign);
  return wrap;
}

function pickValue(v) {
  if (session.checked) return;
  if (session.type === 'equation') session.sel.v = v;
  else session.sel = v;
  renderSelection();
}

function pickAngle(t) {
  if (session.checked) return;
  session.sel = { t, neg: false };
  renderSelection();
  circle.setAngle(currentAnswer());
}

function toggleSign() {
  if (session.checked) return;
  const s = session.sel;
  if (session.type === 'signedAngle') {
    if (activeWheel()) {
      // Jump to the opposite angle when the dial has it (π and 0 have no partner).
      const key = String(-currentAnswer());
      if (activeWheel().indexOf(key) >= 0) setWheelTo(key);
    } else if (s.t) {
      s.neg = !s.neg;
      circle.setAngle(currentAnswer());
      renderSelection();
    }
    return;
  }
  const v = session.type === 'equation' ? s.v : s;
  if (!v || !isSignable(v)) return;
  if (activeWheel()) setWheelTo(valueKey(negate(v)));
  else pickValue(negate(v));
}

function currentAnswer() {
  const s = session.sel;
  switch (session.type) {
    case 'equation': return s.v ? { fn: s.fn, v: s.v } : null;
    case 'signedAngle': return s.t === null ? null : (s.neg ? -s.t : s.t);
    default: return s;
  }
}

function renderSelection() {
  const s = session.sel;
  const a = currentAnswer();
  const label = Object.assign(document.createElement('span'), { className: 'answer-label', textContent: 'Your answer' });
  let shown;
  if (a !== null) shown = math(answerTex(session.question, a));
  else if (session.type === 'equation') shown = math(`${fnTex[s.fn]}\\theta = \\,?`);
  else shown = Object.assign(document.createElement('span'), { className: 'blank', textContent: '?' });
  shown.classList.add('answer-value');
  $('answer').replaceChildren(label, shown);

  // Highlight the pressed pad buttons.
  const pad = $('pad');
  const v = session.type === 'equation' ? s.v : session.type === 'value' ? s : null;
  for (const b of pad.querySelectorAll('[data-value]')) {
    b.setAttribute('aria-pressed', String(!!v && valueKey(v) === b.dataset.value));
  }
  for (const b of pad.querySelectorAll('[data-angle]')) {
    b.setAttribute('aria-pressed', String(s.t === Number(b.dataset.angle)));
  }
  for (const b of pad.querySelectorAll('[data-fn]')) {
    b.setAttribute('aria-pressed', String(s.fn === b.dataset.fn));
  }
  const sign = pad.querySelector('.sign-btn');
  if (sign) sign.setAttribute('aria-pressed', String(s.neg));

  $('check-btn').disabled = !session.checked && a === null;
  if (!session.checked) $('check-btn').textContent = 'Check';
}

function updateMeters() {
  const answered = session.results.length;
  $('q-num').textContent = Math.min(session.index + 1, session.length);
  $('q-total').textContent = session.length;
  $('streak').textContent = data.stats.streak;
  $('accuracy').textContent = pct(session.correct, answered);
  $('progress-fill').style.width = `${(100 * answered) / session.length}%`;
}

function check() {
  const q = session.question;
  const answer = currentAnswer();
  if (answer === null) return;
  const result = checkAnswer(q, answer);
  session.checked = true;
  session.results.push({ question: q, answer, correct: result.correct });
  if (result.correct) session.correct++;
  data.stats = recordResult(data.stats, q, result.correct);
  persist();

  for (const b of $('pad').querySelectorAll('button')) b.disabled = true;
  activeWheel()?.setDisabled(true);
  $('stage').dataset.status = result.correct ? 'correct' : 'wrong';
  circle.setStatus(result.correct ? 'correct' : 'wrong');
  if (session.type === 'signedAngle') circle.setRange(INVERSE_RANGES[q.fn]);
  if (!result.correct && session.type === 'signedAngle') {
    circle.setAngle(correctAnswer(q));
  }

  renderSelection();
  updateMeters();
  $('check-btn').textContent = session.index + 1 >= session.length ? 'See results' : 'Next →';

  // Right answers flash green checks; wrong ones show red X's and the right answer.
  // Either way the next question comes up by itself, and the button stays locked meanwhile
  // so a double-click can't skip past the feedback.
  flash(result.correct ? 'correct' : 'wrong');
  if (!result.correct) renderFeedback(q, answer, result);
  const wait = result.correct ? AUTO_NEXT_MS : WRONG_WAIT_MS;
  const btn = $('check-btn');
  btn.disabled = true;
  btn.dataset.wait = result.correct ? 'correct' : 'wrong';
  btn.style.setProperty('--wait', `${wait}ms`);
  btn.classList.add('is-waiting');
  const s = session;
  session.autoNext = setTimeout(() => { if (session === s) advance(); }, wait);
}

const AUTO_NEXT_MS = 700;
const WRONG_WAIT_MS = 1200;

function flash(kind) {
  for (const node of document.querySelectorAll('.flash')) {
    node.classList.remove('is-on', 'is-correct', 'is-wrong');
    void node.offsetWidth; // restart the animation
    node.classList.add('is-on', `is-${kind}`);
  }
}

function renderFeedback(q, answer, result) {
  const fb = $('feedback');
  fb.className = `feedback ${result.correct ? 'is-correct' : 'is-wrong'}`;
  const head = Object.assign(document.createElement('p'), { className: 'fb-head' });
  if (result.correct) {
    head.textContent = '✓ Correct';
    fb.replaceChildren(head);
    return;
  }
  head.textContent = '✗ Not quite';
  const line = Object.assign(document.createElement('p'), { textContent: 'Correct answer: ' });
  line.append(math(answerTex(q, correctAnswer(q))));
  fb.replaceChildren(head, line);

  const why = document.createElement('p');
  why.className = 'fb-why';
  if (result.reason === 'outsideRange') {
    why.append(
      math(`${fnTex[q.fn]}\\!\\left(${angleTex(answer)}\\right) = ${valueTex(q.input)}`),
      ', but ', math(angleTex(answer)), ` is outside the range of `, math(`${fnTex[q.fn]}^{-1}`), ': ',
      math(INVERSE_RANGES[q.fn].tex), '.',
    );
  } else if (result.reason === 'wrongValue') {
    why.append('Your angle gives ', math(`${fnTex[q.fn]}\\!\\left(${angleTex(answer)}\\right) = ${valueTex(trigOf(answer)[q.fn])}`), '.');
  } else if (result.reason === 'wrongFunction') {
    why.append(q.fn === 'cos' ? 'A vertical line fixes x, and x = ' : 'A horizontal line fixes y, and y = ', math(`${fnTex[q.fn]}\\theta`), '.');
  }
  if (why.childNodes.length) fb.append(why);
}

function advance() {
  clearTimeout(session.autoNext);
  session.index++;
  if (session.index >= session.length) showSummary();
  else nextQuestion();
}

$('check-btn').addEventListener('click', () => {
  if (!session.checked) check();
});

document.addEventListener('keydown', (e) => {
  if (!session || $('practice').hidden || $('help').open || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && activeWheel() && !e.target.closest('.dial')) {
    e.preventDefault();
    activeWheel().step(e.key === 'ArrowLeft' ? -1 : 1);
  } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && session.type === 'equation') {
    e.preventDefault();
    setFn(session.sel.fn === 'sin' ? 'cos' : 'sin');
  } else if (e.key === 'Enter' && (e.target.closest('.dial') || !e.target.closest('button:not(#check-btn)'))) {
    e.preventDefault();
    if (!$('check-btn').disabled) $('check-btn').click();
  } else if (e.key === '-' || e.key === '_') {
    toggleSign();
  }
});

// ---------- summary ----------

function showSummary() {
  const n = session.results.length;
  $('sum-score').textContent = `${session.correct} / ${n}`;
  $('sum-pct').textContent = pct(session.correct, n);
  $('sum-mode').textContent = MODES[session.mode].label;
  const elapsedMs = Date.now() - session.startedAt;
  $('sum-time').textContent = formatTime(elapsedMs);
  $('share-text').textContent = shareText({ modeLabel: MODES[session.mode].label, results: session.results, elapsedMs });
  $('copy-btn').textContent = 'Copy results';
  $('share-btn').hidden = !navigator.share;
  const list = $('sum-missed');
  list.replaceChildren();
  const missed = session.results.filter((r) => !r.correct);
  $('sum-missed-wrap').hidden = missed.length === 0;
  for (const r of missed) {
    const li = document.createElement('li');
    const prompt = promptOf(r.question);
    const ask = math(prompt.reviewTex ?? prompt.tex);
    const right = math(answerTex(r.question, correctAnswer(r.question)), 'm sum-right');
    const theirs = math(answerTex(r.question, r.answer), 'm sum-theirs');
    const q = Object.assign(document.createElement('span'), { className: 'sum-q' });
    q.append(ask);
    const a = Object.assign(document.createElement('span'), { className: 'sum-a' });
    a.append(right, Object.assign(document.createElement('span'), { className: 'sum-you', textContent: 'you: ' }), theirs);
    li.append(q, a);
    list.append(li);
  }
  showScreen('summary');
}

$('copy-btn').addEventListener('click', async () => {
  const text = $('share-text').textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // Older browsers / insecure contexts: select the text so it can be copied by hand.
    const range = document.createRange();
    range.selectNodeContents($('share-text'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ok = document.execCommand?.('copy') ?? false;
  }
  $('copy-btn').textContent = ok ? 'Copied ✓' : 'Select and copy above';
});

$('share-btn').addEventListener('click', () => {
  navigator.share({ text: $('share-text').textContent }).catch(() => {});
});

$('again-btn').addEventListener('click', () => startSession());
$('modes-btn').addEventListener('click', () => {
  session = null;
  renderHome();
  showScreen('home');
});

// ---------- boot ----------

applyTheme();
renderHome();
showScreen('home');
