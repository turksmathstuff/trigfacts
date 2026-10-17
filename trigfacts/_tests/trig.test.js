// Run from the trigfacts folder with:  node --test _tests/*.test.js
// (Jekyll skips folders starting with "_", so these never get published.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STANDARD_ANGLES, GRID_ANGLES, SIGNED_ANGLES, value, valueKey, valueApprox, negate, trigOf, pointOf,
  principalValue, inverseInputs, inPrincipalRange, angleTex, angleRadians, parseValueKey,
} from '../js/trig-data.js';
import { FAMILIES, MODES, Dealer, questionsFor, correctAnswer, promptOf } from '../js/questions.js';
import { checkAnswer } from '../js/check.js';
import { load, save, recordResult, emptyStats } from '../js/storage.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;
const v = (key) => parseValueKey(key);

// Seeded RNG so dealer tests are repeatable.
function rng(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// ---------- exact values ----------

test('every standard angle matches floating-point cos/sin/tan', () => {
  for (const t of STANDARD_ANGLES) {
    const a = angleRadians(t);
    const { cos, sin, tan } = trigOf(t);
    assert.ok(close(valueApprox(cos), Math.cos(a)), `cos ${t}`);
    assert.ok(close(valueApprox(sin), Math.sin(a)), `sin ${t}`);
    if (Math.abs(Math.cos(a)) < 1e-9) assert.equal(tan.mag, 'undef', `tan ${t}`);
    else assert.ok(close(valueApprox(tan), Math.tan(a)), `tan ${t}`);
  }
});

test('spot-check exact values from the plan', () => {
  assert.equal(valueKey(trigOf(10).sin), '1/2');      // sin(5π/6)
  assert.equal(valueKey(trigOf(21).cos), 'r2/2');     // cos(7π/4)
  assert.equal(valueKey(trigOf(8).tan), '-r3');       // tan(2π/3)
  assert.equal(valueKey(trigOf(10).tan), '-r3/3');    // tan(5π/6)
  assert.equal(valueKey(trigOf(18).tan), 'undef');    // tan(3π/2)
  assert.equal(valueKey(trigOf(12).sin), '0');        // sin(π), not −0
});

test('tangent values are only 0, ±√3/3, ±1, ±√3, undefined', () => {
  const allowed = new Set(['0', 'r3/3', '-r3/3', '1', '-1', 'r3', '-r3', 'undef']);
  for (const t of STANDARD_ANGLES) assert.ok(allowed.has(valueKey(trigOf(t).tan)));
});

test('sine and cosine values are only 0, ±1/2, ±√2/2, ±√3/2, ±1', () => {
  const allowed = new Set(['0', '1/2', '-1/2', 'r2/2', '-r2/2', 'r3/2', '-r3/2', '1', '-1']);
  for (const t of STANDARD_ANGLES) {
    assert.ok(allowed.has(valueKey(trigOf(t).sin)));
    assert.ok(allowed.has(valueKey(trigOf(t).cos)));
  }
});

test('0 and undefined ignore the sign toggle', () => {
  assert.equal(valueKey(negate(value('0'))), '0');
  assert.equal(valueKey(negate(value('undef'))), 'undef');
  assert.equal(valueKey(negate(value('r3/3'))), '-r3/3');
  assert.equal(valueKey(negate(negate(value('1/2')))), '1/2');
});

test('negative angles are coterminal with their positive counterparts', () => {
  for (const t of STANDARD_ANGLES) {
    assert.deepEqual(trigOf(-t), trigOf(24 - t));
  }
});

test('angle TeX', () => {
  assert.equal(angleTex(0), '0');
  assert.equal(angleTex(12), '\\pi');
  assert.equal(angleTex(24), '2\\pi');
  assert.equal(angleTex(2), '\\frac{\\pi}{6}');
  assert.equal(angleTex(10), '\\frac{5\\pi}{6}');
  assert.equal(angleTex(-4), '-\\frac{\\pi}{3}');
  assert.equal(angleTex(18), '\\frac{3\\pi}{2}');
});

// ---------- inverse trig ----------

test('principal values from the plan', () => {
  assert.equal(principalValue('sin', v('-1/2')), -2);   // −π/6
  assert.equal(principalValue('cos', v('-r2/2')), 9);   // 3π/4
  assert.equal(principalValue('tan', v('r3')), 4);      // π/3
  assert.equal(principalValue('sin', v('-1')), -6);     // −π/2
  assert.equal(principalValue('cos', v('-1')), 12);     // π
  assert.equal(principalValue('tan', v('-1')), -3);     // −π/4
  assert.equal(principalValue('tan', v('undef')), null);
});

test('principal values agree with Math.asin / acos / atan', () => {
  const ref = { sin: Math.asin, cos: Math.acos, tan: Math.atan };
  for (const fn of ['sin', 'cos', 'tan']) {
    for (const input of inverseInputs(fn)) {
      const t = principalValue(fn, input);
      assert.ok(inPrincipalRange(fn, t));
      assert.ok(close(angleRadians(t), ref[fn](valueApprox(input))), `${fn}⁻¹(${valueKey(input)})`);
    }
  }
});

test('inverse inputs cover exactly the standard values', () => {
  assert.equal(inverseInputs('sin').length, 9);
  assert.equal(inverseInputs('cos').length, 9);
  assert.equal(inverseInputs('tan').length, 7);
});

// ---------- questions ----------

test('question pools have the expected sizes and unique ids', () => {
  const sizes = { point: 17, angle: 16, sin: 17, cos: 17, tan: 17, asin: 9, acos: 9, atan: 7 };
  for (const [family, n] of Object.entries(sizes)) {
    const qs = questionsFor(family);
    assert.equal(qs.length, n, family);
    assert.equal(new Set(qs.map((q) => q.id)).size, n, `${family} ids`);
  }
});

test('the correct answer to every question is accepted', () => {
  for (const family of Object.keys(FAMILIES)) {
    for (const q of questionsFor(family)) {
      const a = correctAnswer(q);
      assert.ok(a !== undefined && a !== null, q.id);
      assert.equal(checkAnswer(q, a).correct, true, q.id);
      assert.ok(promptOf(q).tex.length > 0);
    }
  }
});

test('every question has exactly one correct button choice', () => {
  // Value questions: exactly one signed magnitude is right.
  const allValues = ['0', '1/2', 'r2/2', 'r3/2', '1', 'r3/3', 'r3', 'undef']
    .flatMap((m) => [value(m, 1), value(m, -1)]);
  for (const fn of ['sin', 'cos', 'tan']) {
    for (const q of questionsFor(fn)) {
      const right = new Set(allValues.filter((a) => checkAnswer(q, a).correct).map(valueKey));
      assert.equal(right.size, 1, q.id);
    }
  }
  // Inverse questions: exactly one signed grid angle is right.
  const signed = STANDARD_ANGLES.filter((t) => t !== 24).flatMap((t) => (t ? [t, -t] : [0]));
  for (const family of ['asin', 'acos', 'atan']) {
    for (const q of questionsFor(family)) {
      assert.equal(signed.filter((t) => checkAnswer(q, t).correct).length, 1, q.id);
    }
  }
});

test('the inverse-trig dial covers every grid point once, over (−π, π]', () => {
  assert.equal(SIGNED_ANGLES.length, GRID_ANGLES.length);
  assert.deepEqual(SIGNED_ANGLES, [...SIGNED_ANGLES].sort((a, b) => a - b));
  assert.ok(SIGNED_ANGLES.every((t) => t > -12 && t <= 12));
  const points = new Set(SIGNED_ANGLES.map((t) => `${valueKey(pointOf(t).x)},${valueKey(pointOf(t).y)}`));
  assert.equal(points.size, GRID_ANGLES.length);
  // Every inverse question has exactly one right stop on the dial.
  for (const family of ['asin', 'acos', 'atan']) {
    for (const q of questionsFor(family)) {
      assert.equal(SIGNED_ANGLES.filter((t) => checkAnswer(q, t).correct).length, 1, q.id);
    }
  }
});

// ---------- checking ----------

const find = (family, id) => questionsFor(family).find((q) => q.id === id);

test('value answers compare sign and magnitude', () => {
  const q = find('tan', 'tan:10'); // tan(5π/6) = −√3/3
  assert.equal(checkAnswer(q, v('-r3/3')).correct, true);
  assert.equal(checkAnswer(q, v('r3/3')).correct, false);
  assert.equal(checkAnswer(q, v('-r3')).correct, false);
  assert.equal(checkAnswer(q, null).correct, false);
});

test('point answers need both coordinates right', () => {
  const q = find('point', 'point:10'); // (−√3/2, 1/2)
  assert.equal(checkAnswer(q, { x: v('-r3/2'), y: v('1/2') }).correct, true);
  assert.equal(checkAnswer(q, { x: v('r3/2'), y: v('1/2') }).correct, false);
  assert.equal(checkAnswer(q, { x: v('1/2'), y: v('-r3/2') }).correct, false);
});

test('point → angle accepts both 0 and 2π for (1, 0)', () => {
  const q = find('angle', 'angle:0');
  assert.equal(checkAnswer(q, 0).correct, true);
  assert.equal(checkAnswer(q, 24).correct, true);
  assert.equal(checkAnswer(q, 12).correct, false);
});

test('point → angle rejects angles outside the first revolution', () => {
  const q = find('angle', 'angle:2'); // (√3/2, 1/2)
  assert.equal(checkAnswer(q, 2).correct, true);
  assert.equal(checkAnswer(q, -22).correct, false);
});

test('inverse answers: right value but outside the principal range', () => {
  const q = find('asin', 'asin:1/2');                    // sin⁻¹(1/2) = π/6
  assert.deepEqual(checkAnswer(q, 2), { correct: true, reason: 'correct' });
  assert.deepEqual(checkAnswer(q, 10), { correct: false, reason: 'outsideRange' }); // 5π/6
  assert.deepEqual(checkAnswer(q, 4), { correct: false, reason: 'wrongValue' });    // π/3
});

test('inverse answers: negative toggle produces principal values', () => {
  const q = find('asin', 'asin:-r3/2');                  // sin⁻¹(−√3/2) = −π/3
  assert.equal(checkAnswer(q, -4).correct, true);
  assert.equal(checkAnswer(q, 20).reason, 'outsideRange'); // 5π/3 is coterminal but not principal
  assert.equal(checkAnswer(q, 16).reason, 'outsideRange'); // 4π/3
  assert.equal(checkAnswer(q, -8).reason, 'outsideRange'); // −2π/3

  const c = find('acos', 'acos:-1/2');                   // cos⁻¹(−1/2) = 2π/3
  assert.equal(checkAnswer(c, 8).correct, true);
  assert.equal(checkAnswer(c, -8).reason, 'outsideRange');

  const t = find('atan', 'atan:-1');                     // tan⁻¹(−1) = −π/4
  assert.equal(checkAnswer(t, -3).correct, true);
  assert.equal(checkAnswer(t, 9).reason, 'outsideRange');  // 3π/4
  assert.equal(checkAnswer(t, 21).reason, 'outsideRange'); // 7π/4
});

// ---------- dealer ----------

test('dealer never repeats a question back to back', () => {
  for (const mode of Object.keys(MODES)) {
    const d = new Dealer(mode, rng(7));
    let last = null;
    for (let i = 0; i < 300; i++) {
      const q = d.next();
      assert.notEqual(q.id, last, `${mode} draw ${i}`);
      last = q.id;
    }
  }
});

test('dealer does not repeat within a family until its deck is used up', () => {
  const d = new Dealer('inverse', rng(3));
  const seen = new Set();
  for (let i = 0; i < 21; i++) {
    const q = d.next();
    assert.ok(!seen.has(q.id), q.id);
    seen.add(q.id);
  }
});

test('mixed mode is balanced across its seven sources', () => {
  const d = new Dealer('mixed', rng(11));
  const counts = {};
  for (let i = 0; i < 140; i++) {
    const f = d.next().family;
    const source = f === 'point' || f === 'angle' ? 'circle' : f;
    counts[source] = (counts[source] || 0) + 1;
  }
  assert.equal(Object.keys(counts).length, 7);
  for (const n of Object.values(counts)) assert.equal(n, 20); // the bag guarantees exact balance
});

// ---------- storage ----------

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, val) => m.set(k, String(val)) };
}

test('recordResult tracks totals, streaks, families, and facts', () => {
  const q = { id: 'sin:2', family: 'sin' };
  let s = emptyStats();
  s = recordResult(s, q, true);
  s = recordResult(s, q, true);
  s = recordResult(s, q, false);
  s = recordResult(s, q, true);
  assert.equal(s.attempted, 4);
  assert.equal(s.correct, 3);
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 2);
  assert.deepEqual(s.families.sin, { attempted: 4, correct: 3 });
  assert.deepEqual(s.facts['sin:2'], { attempted: 4, correct: 3 });
});

test('storage round-trips and survives bad data', () => {
  const store = memoryStorage();
  assert.equal(load(store).stats.attempted, 0);
  const data = load(store);
  data.stats = recordResult(data.stats, { id: 'cos:0', family: 'cos' }, true);
  data.settings.length = 20;
  save(data, store);
  assert.equal(load(store).stats.correct, 1);
  assert.equal(load(store).settings.length, 20);

  store.setItem('turksmathstuff.trigfacts.v1', '{not json');
  assert.equal(load(store).stats.attempted, 0);
  assert.doesNotThrow(() => save(data, { setItem() { throw new Error('quota'); } }));
});

// ---------- share summary ----------

import { shareText, formatTime, bestRun } from '../js/share.js';

test('time formatting', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(9_400), '0:09');
  assert.equal(formatTime(102_000), '1:42');
  assert.equal(formatTime(600_000), '10:00');
});

test('share text has score, time, rows of five, and streak', () => {
  const marks = [1, 1, 1, 0, 1, 1, 1, 1, 1, 1].map((c) => ({ correct: !!c }));
  assert.equal(bestRun(marks), 6);
  assert.equal(shareText({ modeLabel: 'Trig Values', results: marks, elapsedMs: 102_000 }), [
    'Trig Facts · Trig Values',
    '9/10 in 1:42 ⏱️',
    '🟩🟩🟩🟥🟩',
    '🟩🟩🟩🟩🟩',
    '🔥 Best streak: 6',
    'turksmathstuff.com/trigfacts',
  ].join('\n'));
});

test('perfect rounds get a trophy; short streaks are left off', () => {
  const perfect = Array(10).fill({ correct: true });
  assert.match(shareText({ modeLabel: 'Mixed Practice', results: perfect, elapsedMs: 60_000 }), /10\/10 in 1:00 ⏱️ 🏆/);
  const choppy = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0].map((c) => ({ correct: !!c }));
  assert.doesNotMatch(shareText({ modeLabel: 'x', results: choppy, elapsedMs: 1 }), /streak/);
});
