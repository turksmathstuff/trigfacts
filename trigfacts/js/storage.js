// Lifetime progress and settings, kept in this browser's localStorage.
// Everything degrades gracefully: if storage is blocked, the app still works for the session.

const KEY = 'turksmathstuff.trigfacts.v1';

export const DEFAULT_SETTINGS = { mode: 'values', length: 10, showCircle: true, input: 'wheel', theme: null };

export function emptyStats() {
  return { attempted: 0, correct: 0, streak: 0, bestStreak: 0, families: {}, facts: {} };
}

export function load(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(KEY)) || {};
    return {
      stats: { ...emptyStats(), ...saved.stats },
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    };
  } catch {
    return { stats: emptyStats(), settings: { ...DEFAULT_SETTINGS } };
  }
}

export function save(data, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private browsing or blocked storage: progress just won't persist.
  }
}

// Returns new stats with one answered question recorded. Per-fact counts are kept so a
// future adaptive mode can target weak facts.
export function recordResult(stats, question, correct) {
  const bump = (tally = { attempted: 0, correct: 0 }) => ({
    attempted: tally.attempted + 1,
    correct: tally.correct + (correct ? 1 : 0),
  });
  const streak = correct ? stats.streak + 1 : 0;
  return {
    attempted: stats.attempted + 1,
    correct: stats.correct + (correct ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    families: { ...stats.families, [question.family]: bump(stats.families[question.family]) },
    facts: { ...stats.facts, [question.id]: bump(stats.facts[question.id]) },
  };
}
