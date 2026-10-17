// UI and session state. Math lives in trig-data.js / questions.js / check.js;
// this file only renders and wires up events.

import {
  PAD_MAGNITUDES, GRID_ANGLES, INVERSE_RANGES, valueKey,
  value, negate, isSignable, valueApprox, trigOf, pointOf, pointKey, angleTex, valueTex, pointTex,
} from './trig-data.js';
import { FAMILIES, MODES, Dealer, correctAnswer, promptOf, answerTex } from './questions.js';
import { checkAnswer } from './check.js';
import { load, save, recordResult, emptyStats } from './storage.js';
import { createCircle } from './circle.js';
import { createWheel } from './wheel.js';

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
const pads = {}; // answer type → pad element, built once

function startSession() {
  const { mode, length } = data.settings;
  session = { mode, length, dealer: new Dealer(mode), index: 0, correct: 0, results: [] };
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
  if (type === 'point') return { x: null, y: null, active: 'x', last: null };
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

  // Unit circle: show the given angle or point; selected angles are drawn as the student picks.
  circle.setStatus(null);
  circle.setRange(null);
  circle.setGiven(type === 'angle' ? GRID_ANGLES.find((t) => sameP(pointOf(t), q.point)) : null);
  circle.setAngle(q.angle ?? null, { fromZero: true });

  showPad(type);
  renderSelection();
  updateMeters();
}

const sameP = (a, b) => pointKey(a) === pointKey(b);

function showPad(type) {
  let key = type === 'point' ? 'value' : type;
  if (key === 'value' && data.settings.input === 'wheel') key = 'wheel';
  if (!pads[key]) {
    if (key === 'wheel') {
      wheel = buildWheel();
      pads.wheel = wheel.el;
    } else {
      pads[key] = key === 'value' ? buildValuePad() : buildAnglePad(key === 'signedAngle');
    }
  }
  $('pad').replaceChildren(pads[key]);
  for (const b of pads[key].querySelectorAll('button')) b.disabled = false;
  if (key === 'wheel') {
    wheel.setDisabled(false);
    wheel.setIndex(wheel.indexOf('0')); // every question starts the wheel at 0
  }
}

// ---------- wheel input ----------

// All exact values in number-line order. "undefined" sits at the wrap point between √3 and −√3,
// the way tangent jumps from +∞ to −∞.
const WHEEL_VALUES = (() => {
  const signed = PAD_MAGNITUDES.filter((m) => m !== 'undef')
    .flatMap((m) => (m === '0' ? [value(m)] : [value(m, -1), value(m, 1)]));
  return [...signed.sort((a, b) => valueApprox(a) - valueApprox(b)), value('undef')];
})();

let wheel = null;

const wheelActive = () => !!session && $('pad').firstChild === pads.wheel && !!pads.wheel;

function buildWheel() {
  const items = WHEEL_VALUES.map((v) => ({
    key: valueKey(v),
    text: texToText(valueTex(v)),
    render: () => (v.mag === 'undef'
      ? Object.assign(document.createElement('span'), { className: 'wheel-word', textContent: 'undefined' })
      : math(valueTex(v))),
  }));
  return createWheel(items, { label: 'Exact value', onChange: (i) => wheelChanged(WHEEL_VALUES[i]) });
}

function wheelChanged(v) {
  if (!session || session.checked) return;
  if (session.type === 'point') {
    const s = session.sel;
    s[s.active] = v;
    s.last = s.active;
  } else {
    session.sel = v;
  }
  renderSelection();
}

function setWheelTo(v) {
  wheel.setIndex(wheel.indexOf(valueKey(v)));
}

// With the wheel, Enter/Check on x locks it in and moves on to y.
const lockingX = () => wheelActive() && session.type === 'point' && session.sel.active === 'x';

function lockIn() {
  if (lockingX()) {
    session.sel.active = 'y';
    setWheelTo(session.sel.y ?? value('0'));
    wheel.el.focus({ preventScroll: true });
    return;
  }
  check();
}

// Two rows of exact values: 0 and the positives on top; undefined and the negatives below,
// so each negative sits directly under its positive.
function buildValuePad() {
  const signed = PAD_MAGNITUDES.filter((m) => m !== '0' && m !== 'undef');
  const rows = [
    [value('0'), ...signed.map((m) => value(m, 1))],
    [value('undef'), ...signed.map((m) => value(m, -1))],
  ];
  const grid = document.createElement('div');
  grid.className = 'pad-grid cols-7 value-pad';
  for (const v of rows.flat()) {
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

function buildAnglePad(withSign) {
  const wrap = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'pad-grid cols-4';
  for (const t of GRID_ANGLES) {
    const b = button('pad-btn', () => pickAngle(t), math(angleTex(t)));
    b.dataset.angle = t;
    grid.append(b);
  }
  wrap.append(grid);
  if (withSign) {
    const sign = signButton();
    sign.classList.add('sign-wide');
    wrap.append(sign);
  }
  return wrap;
}

function signButton() {
  const b = button('pad-btn sign-btn', toggleSign, '+/−');
  b.setAttribute('aria-label', 'Toggle negative');
  return b;
}

function pickValue(v) {
  if (session.checked) return;
  if (session.type === 'point') {
    const s = session.sel;
    s[s.active] = v;
    s.last = s.active;
    if (s.active === 'x') s.active = 'y';
  } else {
    session.sel = v;
  }
  renderSelection();
}

function pickAngle(t) {
  if (session.checked) return;
  if (session.type === 'signedAngle') session.sel = { t, neg: false };
  else session.sel = t;
  renderSelection();
  circle.setAngle(currentAnswer());
}

function toggleSign() {
  if (session.checked) return;
  const s = session.sel;
  if (wheelActive()) {
    const v = session.type === 'point' ? s[s.active] : s;
    if (v && isSignable(v)) setWheelTo(negate(v));
    return;
  }
  if (session.type === 'value') {
    if (s && isSignable(s)) session.sel = negate(s);
  } else if (session.type === 'point') {
    if (s.last && s[s.last] && isSignable(s[s.last])) s[s.last] = negate(s[s.last]);
  } else if (session.type === 'signedAngle') {
    if (s.t) {
      s.neg = !s.neg;
      circle.setAngle(currentAnswer());
    }
  }
  renderSelection();
}

function selectSlot(slot) {
  if (session.checked) return;
  session.sel.active = slot;
  session.sel.last = slot;
  if (wheelActive()) setWheelTo(session.sel[slot] ?? value('0'));
  renderSelection();
}

function currentAnswer() {
  const s = session.sel;
  switch (session.type) {
    case 'point': return s.x && s.y ? { x: s.x, y: s.y } : null;
    case 'signedAngle': return s.t === null ? null : (s.neg ? -s.t : s.t);
    default: return s;
  }
}

function slotContent(v) {
  return v ? math(valueTex(v)) : Object.assign(document.createElement('span'), { className: 'blank', textContent: '?' });
}

function renderSelection() {
  const box = $('answer');
  box.replaceChildren();
  const s = session.sel;

  if (session.type === 'point') {
    const slot = (name) => {
      const b = button(s[name] ? 'slot filled' : 'slot', () => selectSlot(name), slotContent(s[name]));
      b.setAttribute('aria-label', `${name === 'x' ? 'x' : 'y'} coordinate`);
      b.setAttribute('aria-pressed', String(!session.checked && s.active === name));
      b.disabled = session.checked;
      return b;
    };
    box.append(paren('('), slot('x'), paren(','), slot('y'), paren(')'));
  } else {
    const label = Object.assign(document.createElement('span'), { className: 'answer-label', textContent: 'Your answer' });
    const a = currentAnswer();
    const shown = a === null ? slotContent(null) : math(answerTex(session.question, a));
    shown.classList.add('answer-value');
    box.append(label, shown);
  }

  // Highlight the pressed pad button.
  const pad = $('pad');
  for (const b of pad.querySelectorAll('[data-value]')) {
    b.setAttribute('aria-pressed', String(session.type === 'value' && !!s && valueKey(s) === b.dataset.value));
  }
  for (const b of pad.querySelectorAll('[data-angle]')) {
    const t = session.type === 'signedAngle' ? s.t : s;
    b.setAttribute('aria-pressed', String(t === Number(b.dataset.angle)));
  }
  const sign = pad.querySelector('.sign-btn');
  if (sign) sign.setAttribute('aria-pressed', String(session.type === 'signedAngle' && s.neg));

  $('check-btn').disabled = !session.checked && currentAnswer() === null && !lockingX();
  if (!session.checked) $('check-btn').textContent = lockingX() ? 'Lock in x →' : 'Check';
}

function paren(text) {
  return Object.assign(document.createElement('span'), { className: 'paren', textContent: text });
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
  if (wheelActive()) wheel.setDisabled(true);
  $('stage').dataset.status = result.correct ? 'correct' : 'wrong';
  circle.setStatus(result.correct ? 'correct' : 'wrong');
  if (session.type === 'signedAngle') circle.setRange(INVERSE_RANGES[q.fn]);
  if (!result.correct && (session.type === 'angle' || session.type === 'signedAngle')) {
    circle.setAngle(correctAnswer(q));
  }

  renderSelection();
  renderFeedback(q, answer, result);
  updateMeters();
  $('check-btn').textContent = session.index + 1 >= session.length ? 'See results' : 'Next →';
  $('check-btn').focus({ preventScroll: true });
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
  } else if (session.type === 'angle') {
    why.append('Your angle ', math(angleTex(answer)), ' lands at ', math(pointTex(pointOf(answer))), '.');
  }
  if (why.childNodes.length) fb.append(why);
}

function advance() {
  session.index++;
  if (session.index >= session.length) showSummary();
  else nextQuestion();
}

$('check-btn').addEventListener('click', () => (session.checked ? advance() : lockIn()));

document.addEventListener('keydown', (e) => {
  if (!session || $('practice').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && wheelActive() && !e.target.closest('.dial')) {
    e.preventDefault();
    wheel.step(e.key === 'ArrowLeft' ? -1 : 1);
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
  const list = $('sum-missed');
  list.replaceChildren();
  const missed = session.results.filter((r) => !r.correct);
  $('sum-missed-wrap').hidden = missed.length === 0;
  for (const r of missed) {
    const li = document.createElement('li');
    const prompt = promptOf(r.question);
    const ask = math(prompt.tex);
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
