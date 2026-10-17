// Answer checking. Compares normalized symbolic values, never rendered text.

import { trigOf, pointOf, pointKey, valuesEqual, inPrincipalRange, isStandardAngle } from './trig-data.js';
import { FAMILIES } from './questions.js';

// Returns { correct, reason }.
// reason is 'correct', 'wrong', or, for inverse trig only:
//   'outsideRange'  the angle has the right trig value but is not a principal value
//   'wrongValue'    the angle doesn't even have the right trig value
export function checkAnswer(q, answer) {
  if (answer === null || answer === undefined) return { correct: false, reason: 'wrong' };

  switch (FAMILIES[q.family].answer) {
    case 'value':
      return verdict(valuesEqual(answer, trigOf(q.angle)[q.fn]));

    case 'point':
      if (!answer.x || !answer.y) return verdict(false);
      return verdict(pointKey(answer) === pointKey(pointOf(q.angle)));

    case 'angle':
      // Any angle in [0, 2π] at this point counts, so both 0 and 2π are accepted for (1, 0).
      return verdict(isStandardAngle(answer) && answer >= 0 && answer <= 24 &&
        pointKey(pointOf(answer)) === pointKey(q.point));

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
