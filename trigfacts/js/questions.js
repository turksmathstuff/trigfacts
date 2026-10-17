// Question families, modes, and a dealer that hands out balanced, non-repeating questions.
// Every question is derived from trig-data.js; there is no stored question bank.

import {
  STANDARD_ANGLES, GRID_ANGLES, FUNCTIONS,
  trigOf, pointOf, inverseInputs, principalValue, valueKey,
  angleTex, valueTex, pointTex,
} from './trig-data.js';

// answer: which answer pad the family uses.
//   value       exact-value buttons + sign toggle
//   point       two exact-value slots (x, y)
//   angle       angle grid, 0 to 2π
//   signedAngle angle grid + negative toggle
export const FAMILIES = {
  point: { label: 'Angle → Point', answer: 'point' },
  angle: { label: 'Point → Angle', answer: 'angle' },
  sin:   { label: 'Sine values', answer: 'value' },
  cos:   { label: 'Cosine values', answer: 'value' },
  tan:   { label: 'Tangent values', answer: 'value' },
  asin:  { label: 'Inverse sine', answer: 'signedAngle' },
  acos:  { label: 'Inverse cosine', answer: 'signedAngle' },
  atan:  { label: 'Inverse tangent', answer: 'signedAngle' },
};

// Each mode lists its families with relative weights. Mixed treats the two unit-circle
// directions together as one source, so all seven sources show up about equally.
export const MODES = {
  circle:  { label: 'Unit Circle Points', blurb: 'Angles ↔ points (cos θ, sin θ)', weights: { point: 1, angle: 1 } },
  values:  { label: 'Trig Values', blurb: 'sin, cos, and tan of standard angles', weights: { sin: 1, cos: 1, tan: 1 } },
  inverse: { label: 'Inverse Trig', blurb: 'sin⁻¹, cos⁻¹, tan⁻¹ with principal values', weights: { asin: 1, acos: 1, atan: 1 } },
  mixed:   { label: 'Mixed Practice', blurb: 'A balanced mix of everything', weights: { point: 1, angle: 1, sin: 2, cos: 2, tan: 2, asin: 2, acos: 2, atan: 2 } },
};

const fnName = { sin: '\\sin', cos: '\\cos', tan: '\\tan' };

// All questions in a family.
export function questionsFor(family) {
  if (FUNCTIONS.includes(family)) {
    return STANDARD_ANGLES.map((t) => ({ id: `${family}:${t}`, family, fn: family, angle: t }));
  }
  if (family === 'point') {
    return STANDARD_ANGLES.map((t) => ({ id: `point:${t}`, family, angle: t }));
  }
  if (family === 'angle') {
    return GRID_ANGLES.map((t) => ({ id: `angle:${t}`, family, point: pointOf(t) }));
  }
  const fn = family.slice(1); // asin → sin
  return inverseInputs(fn).map((v) => ({ id: `${family}:${valueKey(v)}`, family, fn, input: v }));
}

// The canonical correct answer, in the same shape the matching answer pad produces.
export function correctAnswer(q) {
  switch (FAMILIES[q.family].answer) {
    case 'value': return trigOf(q.angle)[q.fn];
    case 'point': return pointOf(q.angle);
    case 'angle': return GRID_ANGLES.find((t) => valueKey(trigOf(t).cos) === valueKey(q.point.x) && valueKey(trigOf(t).sin) === valueKey(q.point.y));
    case 'signedAngle': return principalValue(q.fn, q.input);
  }
}

// TeX for the question itself, plus a short caption shown above it.
export function promptOf(q) {
  switch (q.family) {
    case 'point':
      return { caption: 'Find the point on the unit circle at', tex: `\\theta = ${angleTex(q.angle)}` };
    case 'angle':
      return { caption: 'Which angle lands on this point?', tex: pointTex(q.point) };
    case 'asin': case 'acos': case 'atan':
      return { caption: 'Evaluate (exact, in radians)', tex: `${fnName[q.fn]}^{-1}\\!\\left(${valueTex(q.input)}\\right)` };
    default:
      return { caption: 'Evaluate (exact)', tex: `${fnName[q.fn]}\\!\\left(${angleTex(q.angle)}\\right)` };
  }
}

export function answerTex(q, answer) {
  switch (FAMILIES[q.family].answer) {
    case 'value': return valueTex(answer);
    case 'point': return pointTex(answer);
    default: return angleTex(answer);
  }
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deals questions for a mode. Families come from a shuffled weighted bag and questions from a
// shuffled deck per family, so a session is balanced and nothing repeats until a deck runs out.
export class Dealer {
  constructor(mode, rng = Math.random) {
    if (!MODES[mode]) throw new Error(`Unknown mode: ${mode}`);
    this.weights = MODES[mode].weights;
    this.rng = rng;
    this.bag = [];
    this.decks = {};
    this.lastId = null;
  }

  next() {
    if (this.bag.length === 0) {
      const families = Object.entries(this.weights).flatMap(([f, w]) => Array(w).fill(f));
      this.bag = shuffle(families, this.rng);
    }
    const family = this.bag.pop();
    let deck = this.decks[family];
    if (!deck || deck.length === 0) {
      deck = this.decks[family] = shuffle(questionsFor(family), this.rng);
      // Don't start a fresh deck with the question that was just asked.
      if (deck.length > 1 && deck[deck.length - 1].id === this.lastId) deck.unshift(deck.pop());
    }
    const q = deck.pop();
    this.lastId = q.id;
    return q;
  }
}
