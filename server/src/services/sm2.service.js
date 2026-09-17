import { SM2_DEFAULTS } from 'shared/constants.js';

const { MIN_EASE_FACTOR, EASE_FACTOR, FIRST_INTERVAL, SECOND_INTERVAL, LAPSE_MINUTES } =
  SM2_DEFAULTS;

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SuperMemo-2. Pure function: given the current scheduling state of an item and
 * the quality of this recall (0–5), return the next state. No dates are read
 * from the clock unless `now` is omitted, which keeps it trivially testable.
 *
 * @param {{easeFactor?: number, interval?: number, repetitions?: number}} state
 * @param {number} quality 0–5 (see SM2_GRADES)
 * @param {Date} [now]
 * @returns {{easeFactor: number, interval: number, repetitions: number, dueDate: Date}}
 */
export function sm2(state = {}, quality, now = new Date()) {
  if (!Number.isFinite(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`SM-2 quality must be between 0 and 5, received: ${quality}`);
  }

  const previousEase = Number.isFinite(state.easeFactor) ? state.easeFactor : EASE_FACTOR;
  const previousReps = Number.isFinite(state.repetitions) ? state.repetitions : 0;
  const previousInterval = Number.isFinite(state.interval) ? state.interval : 0;

  // The ease factor moves on every review, including failures.
  const easeFactor = Math.max(
    MIN_EASE_FACTOR,
    round2(previousEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  );

  let repetitions;
  let interval;

  if (quality < 3) {
    // Failed recall: back to the start of the ladder, and due again within the
    // same sitting (interval 0 means "not yet on the day-scale schedule").
    repetitions = 0;
    interval = 0;
  } else {
    repetitions = previousReps + 1;
    if (repetitions === 1) interval = FIRST_INTERVAL;
    else if (repetitions === 2) interval = SECOND_INTERVAL;
    else interval = Math.round(previousInterval * easeFactor);
  }

  const dueDate =
    quality < 3
      ? new Date(now.getTime() + LAPSE_MINUTES * 60_000)
      : new Date(now.getTime() + interval * DAY_MS);

  return { easeFactor, interval, repetitions, dueDate };
}

/**
 * Map a graded answer onto an SM-2 quality score. The lesson player does not
 * ask the learner how hard it felt, so difficulty is inferred from whether they
 * got it right and how many tries it took.
 */
export function qualityFromAttempt({ correct, attempts = 1, hintUsed = false }) {
  if (!correct) return 0;
  if (hintUsed) return 3;
  if (attempts <= 1) return 5;
  if (attempts === 2) return 4;
  return 3;
}

const round2 = (n) => Math.round(n * 100) / 100;
