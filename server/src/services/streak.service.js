/**
 * Streaks are computed in the learner's local day, not UTC — someone studying at
 * 11pm in Yangon should not lose a streak because the server is on UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight-aligned day index for an instant, shifted by a UTC offset in minutes. */
export function localDayIndex(date, offsetMinutes = 0) {
  return Math.floor((date.getTime() + offsetMinutes * 60_000) / DAY_MS);
}

/**
 * @returns {{currentStreak: number, longestStreak: number, lastActivityDate: Date, incremented: boolean}}
 */
export function applyActivity(
  { currentStreak = 0, longestStreak = 0, lastActivityDate = null },
  { now = new Date(), offsetMinutes = 0 } = {}
) {
  const today = localDayIndex(now, offsetMinutes);
  const last = lastActivityDate ? localDayIndex(new Date(lastActivityDate), offsetMinutes) : null;

  let nextStreak;
  if (last === null) nextStreak = 1; // first ever activity
  else if (last === today) nextStreak = Math.max(currentStreak, 1); // already counted today
  else if (today - last === 1) nextStreak = currentStreak + 1; // consecutive day
  else nextStreak = 1; // streak broken — start over

  return {
    currentStreak: nextStreak,
    longestStreak: Math.max(longestStreak, nextStreak),
    lastActivityDate: now,
    incremented: last !== today,
  };
}

/**
 * A stored streak is stale once the learner misses a whole day: the value in the
 * database still says 7, but today it is really 0. Read paths use this so the
 * dashboard never shows a streak the user has already lost.
 */
export function effectiveStreak(
  { currentStreak = 0, lastActivityDate = null },
  { now = new Date(), offsetMinutes = 0 } = {}
) {
  if (!lastActivityDate) return 0;
  const gap = localDayIndex(now, offsetMinutes) - localDayIndex(new Date(lastActivityDate), offsetMinutes);
  return gap <= 1 ? currentStreak : 0;
}
