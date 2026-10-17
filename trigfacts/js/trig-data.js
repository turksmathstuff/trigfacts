// Canonical exact trig facts for the standard unit-circle angles.
// Everything is symbolic: an angle is an integer count of twelfths of π (π/6 → 2, 3π/4 → 9),
// and a value is a named magnitude plus a sign. No floating point is used for answers.

export const TWELFTHS_PER_TURN = 24;

// Magnitudes a student can pick. `approx` is only for drawing, never for checking.
export const MAGNITUDES = {
  '0':     { tex: '0',                 approx: 0 },
  '1/2':   { tex: '\\frac{1}{2}',      approx: 0.5 },
  'r2/2':  { tex: '\\frac{\\sqrt{2}}{2}', approx: Math.SQRT2 / 2 },
  'r3/2':  { tex: '\\frac{\\sqrt{3}}{2}', approx: Math.sqrt(3) / 2 },
  '1':     { tex: '1',                 approx: 1 },
  'r3/3':  { tex: '\\frac{\\sqrt{3}}{3}', approx: Math.sqrt(3) / 3 },
  'r3':    { tex: '\\sqrt{3}',         approx: Math.sqrt(3) },
  'undef': { tex: '\\text{undefined}', approx: NaN },
};

// Order of the exact-value answer buttons.
export const PAD_MAGNITUDES = ['0', '1/2', 'r2/2', 'r3/2', '1', 'r3/3', 'r3', 'undef'];

// Magnitudes that have no sign (+/− does nothing to them).
const UNSIGNED = new Set(['0', 'undef']);

// The only stored trig facts: the first-quadrant reference angles.
const FIRST_QUADRANT = {
  0: { cos: '1',    sin: '0',    tan: '0' },
  2: { cos: 'r3/2', sin: '1/2',  tan: 'r3/3' },
  3: { cos: 'r2/2', sin: 'r2/2', tan: '1' },
  4: { cos: '1/2',  sin: 'r3/2', tan: 'r3' },
  6: { cos: '0',    sin: '1',    tan: 'undef' },
};

// Standard angles from 0 to 2π, and the 16 shown in answer grids (2π omitted; it shares 0's point).
export const STANDARD_ANGLES = [0, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24];
export const GRID_ANGLES = STANDARD_ANGLES.filter((t) => t !== 24);

export const FUNCTIONS = ['sin', 'cos', 'tan'];

// ---------- exact values ----------

export function value(mag, sign = 1) {
  if (!(mag in MAGNITUDES)) throw new Error(`Unknown magnitude: ${mag}`);
  return Object.freeze({ mag, sign: UNSIGNED.has(mag) ? 1 : (sign < 0 ? -1 : 1) });
}

export function isSignable(v) {
  return !UNSIGNED.has(v.mag);
}

export function negate(v) {
  return value(v.mag, -v.sign);
}

// Normalized string form used for comparison and storage, e.g. "-r3/3", "undef".
export function valueKey(v) {
  return (v.sign < 0 ? '-' : '') + v.mag;
}

export function parseValueKey(key) {
  return key.startsWith('-') ? value(key.slice(1), -1) : value(key, 1);
}

export function valuesEqual(a, b) {
  return valueKey(a) === valueKey(b);
}

export function valueTex(v) {
  return (v.sign < 0 ? '-' : '') + MAGNITUDES[v.mag].tex;
}

export function valueApprox(v) {
  return v.sign * MAGNITUDES[v.mag].approx;
}

// ---------- angles ----------

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

export function isStandardAngle(t) {
  if (!Number.isInteger(t)) return false;
  return referenceAngle(t).ref in FIRST_QUADRANT;
}

// Reference angle (in twelfths) plus the signs of cos and sin for any integer angle t.
function referenceAngle(t) {
  const m = ((t % TWELFTHS_PER_TURN) + TWELFTHS_PER_TURN) % TWELFTHS_PER_TURN;
  if (m <= 6) return { ref: m, cosSign: 1, sinSign: 1 };
  if (m <= 12) return { ref: 12 - m, cosSign: -1, sinSign: 1 };
  if (m <= 18) return { ref: m - 12, cosSign: -1, sinSign: -1 };
  return { ref: 24 - m, cosSign: 1, sinSign: -1 };
}

// Exact { cos, sin, tan } for a standard angle (any integer number of twelfths, including negatives).
export function trigOf(t) {
  const { ref, cosSign, sinSign } = referenceAngle(t);
  const base = FIRST_QUADRANT[ref];
  if (!base) throw new Error(`Not a standard angle: ${t}/12 π`);
  return {
    cos: value(base.cos, cosSign),
    sin: value(base.sin, sinSign),
    tan: value(base.tan, cosSign * sinSign),
  };
}

export function pointOf(t) {
  const { cos, sin } = trigOf(t);
  return { x: cos, y: sin };
}

export function pointKey(p) {
  return `${valueKey(p.x)},${valueKey(p.y)}`;
}

export function pointTex(p) {
  return `\\left(${valueTex(p.x)},\\ ${valueTex(p.y)}\\right)`;
}

// TeX for an angle in twelfths of π: 10 → \frac{5\pi}{6}, -4 → -\frac{\pi}{3}, 12 → \pi.
export function angleTex(t) {
  if (t === 0) return '0';
  const a = Math.abs(t);
  const g = gcd(a, 12);
  const n = a / g;
  const d = 12 / g;
  const num = n === 1 ? '\\pi' : `${n}\\pi`;
  return (t < 0 ? '-' : '') + (d === 1 ? num : `\\frac{${num}}{${d}}`);
}

export function angleRadians(t) {
  return (t * Math.PI) / 12;
}

// ---------- inverse trig ----------

// Principal-value ranges, in twelfths of π.
export const INVERSE_RANGES = {
  sin: { min: -6, max: 6, open: false, tex: '\\left[-\\frac{\\pi}{2},\\ \\frac{\\pi}{2}\\right]' },
  cos: { min: 0, max: 12, open: false, tex: '\\left[0,\\ \\pi\\right]' },
  tan: { min: -6, max: 6, open: true, tex: '\\left(-\\frac{\\pi}{2},\\ \\frac{\\pi}{2}\\right)' },
};

export function inPrincipalRange(fn, t) {
  const r = INVERSE_RANGES[fn];
  return r.open ? t > r.min && t < r.max : t >= r.min && t <= r.max;
}

// The unique standard angle in fn's principal range whose fn-value is v, or null.
export function principalValue(fn, v) {
  const r = INVERSE_RANGES[fn];
  for (let t = r.min; t <= r.max; t++) {
    if (isStandardAngle(t) && inPrincipalRange(fn, t) && valuesEqual(trigOf(t)[fn], v)) return t;
  }
  return null;
}

// Every standard value that fn⁻¹ accepts, in increasing order.
export function inverseInputs(fn) {
  const seen = new Map();
  for (const t of STANDARD_ANGLES) {
    const v = trigOf(t)[fn];
    if (principalValue(fn, v) !== null) seen.set(valueKey(v), v);
  }
  return [...seen.values()].sort((a, b) => valueApprox(a) - valueApprox(b));
}
