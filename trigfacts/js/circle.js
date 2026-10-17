// Unit-circle diagram (SVG) with a rotating radius. Deliberately unlabeled so it never
// gives away an answer; it only shows where an angle points.

import { GRID_ANGLES, angleRadians } from './trig-data.js';

const NS = 'http://www.w3.org/2000/svg';
const ARC_R = 0.24;   // radius of the small "angle swept" arc
const DURATION = 380; // ms

function el(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// SVG y points down, so math point (cos a, sin a) is drawn at (cos a, −sin a).
const xy = (a, r = 1) => [r * Math.cos(a), -r * Math.sin(a)];

function arcPath(from, to, r) {
  const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 0.05));
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const [x, y] = xy(from + ((to - from) * i) / steps, r);
    d += `${i ? 'L' : 'M'}${x.toFixed(4)} ${y.toFixed(4)}`;
  }
  return d;
}

export function createCircle(container) {
  const svg = el('svg', { viewBox: '-1.25 -1.25 2.5 2.5', class: 'uc', role: 'img', 'aria-label': 'Unit circle' }, container);
  el('line', { x1: -1.18, y1: 0, x2: 1.18, y2: 0, class: 'uc-axis' }, svg);
  el('line', { x1: 0, y1: -1.18, x2: 0, y2: 1.18, class: 'uc-axis' }, svg);
  el('circle', { cx: 0, cy: 0, r: 1, class: 'uc-ring' }, svg);
  const range = el('path', { class: 'uc-range', d: '' }, svg);
  const rangeEnds = el('g', {}, svg);
  for (const t of GRID_ANGLES) {
    const [x, y] = xy(angleRadians(t));
    el('circle', { cx: x, cy: y, r: 0.035, class: 'uc-tick' }, svg);
  }
  const sweep = el('path', { class: 'uc-sweep', d: '' }, svg);
  const radius = el('line', { x1: 0, y1: 0, x2: 1, y2: 0, class: 'uc-radius' }, svg);
  const target = el('circle', { cx: 1, cy: 0, r: 0.075, class: 'uc-point' }, svg);
  const given = el('circle', { cx: 1, cy: 0, r: 0.085, class: 'uc-given' }, svg);
  el('circle', { cx: 0, cy: 0, r: 0.03, class: 'uc-center' }, svg);

  let current = 0; // radians currently drawn
  let frame = null;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function draw(a) {
    const [x, y] = xy(a);
    radius.setAttribute('x2', x);
    radius.setAttribute('y2', y);
    target.setAttribute('cx', x);
    target.setAttribute('cy', y);
    sweep.setAttribute('d', Math.abs(a) < 1e-6 ? '' : arcPath(0, a, ARC_R));
  }

  function setVisible(node, on) {
    node.style.display = on ? '' : 'none';
  }

  return {
    // Rotate the radius to angle t (twelfths of π), or hide it with null.
    // fromZero sweeps out from the positive x-axis instead of from the previous angle.
    setAngle(t, { fromZero = false } = {}) {
      cancelAnimationFrame(frame);
      const show = t !== null && t !== undefined;
      [radius, target, sweep].forEach((n) => setVisible(n, show));
      if (!show) {
        current = 0;
        return;
      }
      const to = angleRadians(t);
      const from = fromZero ? 0 : current;
      if (reduceMotion || Math.abs(to - from) < 1e-6) {
        current = to;
        draw(to);
        return;
      }
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / DURATION);
        const eased = 1 - Math.pow(1 - p, 3);
        current = from + (to - from) * eased;
        draw(current);
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    },

    // Mark a given point (for point → angle questions), or hide it with null.
    setGiven(t) {
      setVisible(given, t !== null && t !== undefined);
      if (t === null || t === undefined) return;
      const [x, y] = xy(angleRadians(t));
      given.setAttribute('cx', x);
      given.setAttribute('cy', y);
    },

    // Shade an inverse-trig principal range { min, max, open } (twelfths of π), or clear it.
    setRange(r) {
      rangeEnds.replaceChildren();
      if (!r) {
        range.setAttribute('d', '');
        return;
      }
      const a = angleRadians(r.min);
      const b = angleRadians(r.max);
      range.setAttribute('d', arcPath(a, b, 1));
      for (const end of [a, b]) {
        const [x, y] = xy(end);
        el('circle', { cx: x, cy: y, r: 0.06, class: r.open ? 'uc-end uc-end-open' : 'uc-end' }, rangeEnds);
      }
    },

    // 'correct', 'wrong', or null — tints the radius after checking.
    setStatus(status) {
      svg.dataset.status = status || '';
    },
  };
}
