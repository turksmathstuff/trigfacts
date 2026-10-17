// The copy-and-paste results summary shown at the end of a session.

export function formatTime(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function bestRun(results) {
  let best = 0;
  let run = 0;
  for (const r of results) {
    run = r.correct ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// e.g.
//   Trig Facts · Trig Values
//   9/10 in 1:42 ⏱️
//   🟩🟩🟩🟥🟩
//   🟩🟩🟩🟩🟩
//   🔥 Best streak: 6
//   turksmathstuff.com/trigfacts
export function shareText({ modeLabel, results, elapsedMs, url = 'turksmathstuff.com/trigfacts' }) {
  const correct = results.filter((r) => r.correct).length;
  const squares = results.map((r) => (r.correct ? '🟩' : '🟥'));
  const rows = [];
  for (let i = 0; i < squares.length; i += 5) rows.push(squares.slice(i, i + 5).join(''));
  const lines = [
    `Trig Facts · ${modeLabel}`,
    `${correct}/${results.length} in ${formatTime(elapsedMs)} ⏱️${correct === results.length ? ' 🏆' : ''}`,
    ...rows,
  ];
  const streak = bestRun(results);
  if (streak >= 3) lines.push(`🔥 Best streak: ${streak}`);
  lines.push(url);
  return lines.join('\n');
}
