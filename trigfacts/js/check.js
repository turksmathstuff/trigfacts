// Answer checking. Compares normalized symbolic values, never rendered text.

import { trigOf, valuesEqual, inPrincipalRange, isStandardAngle } from './trig-data.js';
import { FAMILIES } from './questions.js';

// Returns { correct, reason }.
// reason is 'correct', 'wrong', or, for line questions only:
//   'wrongFunction' sin θ picked for a vertical line, or cos θ for a horizontal one
// or, for inverse trig only:
//   'outsideRange'  the angle has the right trig value but is not a principal value
//   'wrongValue'    the angle doesn't even have the right trig value
export function checkAnswer(q, answer) {
  if (answer === null || answer === undefined) return { correct: false, reason: 'wrong' };

  switch (FAMILIES[q.family].answer) {
    case 'value':
      return verdict(valuesEqual(answer, trigOf(q.angle)[q.fn]));

    case 'equation':
      if (!answer.v) return verdict(false);
      if (answer.fn !== q.fn) return { correct: false, reason: 'wrongFunction' };
      return verdict(valuesEqual(answer.v, q.input));

    case 'signedAngle': {
      if (!isStandardAngle(answer)) return verdict(false);
      const hasValue = valuesEqual(trigOf(answer)[q.fn], q.input);
      if (hasValue && inPrincipalRange(q.fn, answer)) return verdict(true);
      return { correct: false, reason: hasValue ? 'outsideRange' : 'wrongValue' };
    }
  }
  throw new Error(`Unknown family: ${q.family}`);
}

function verdict(ok) {
  return { correct: ok, reason: ok ? 'correct' : 'wrong' };
}
