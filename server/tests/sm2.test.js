import { describe, it, expect } from 'vitest';
import { sm2, qualityFromAttempt, DAY_MS } from '../src/services/sm2.service.js';
import { SM2_GRADES, SM2_DEFAULTS } from 'shared/constants.js';

const NOW = new Date('2026-01-01T09:00:00Z');
const daysUntil = (date) => Math.round((date - NOW) / DAY_MS);

describe('sm2', () => {
  it('schedules a brand new item one day out', () => {
    const next = sm2({}, SM2_GRADES.GOOD, NOW);
    expect(next.repetitions).toBe(1);
    expect(next.interval).toBe(1);
    expect(daysUntil(next.dueDate)).toBe(1);
  });

  it('uses the classic 1 / 6 / EF ladder for consecutive successes', () => {
    let state = {};
    state = sm2(state, SM2_GRADES.GOOD, NOW);
    expect(state.interval).toBe(1);

    state = sm2(state, SM2_GRADES.GOOD, NOW);
    expect(state.interval).toBe(6);

    state = sm2(state, SM2_GRADES.GOOD, NOW);
    // Third success multiplies the previous interval by the ease factor.
    expect(state.interval).toBe(Math.round(6 * state.easeFactor));
    expect(state.repetitions).toBe(3);
  });

  it('raises the ease factor for easy recalls and lowers it for hard ones', () => {
    expect(sm2({}, SM2_GRADES.EASY, NOW).easeFactor).toBeGreaterThan(SM2_DEFAULTS.EASE_FACTOR);
    expect(sm2({}, SM2_GRADES.HARD, NOW).easeFactor).toBeLessThan(SM2_DEFAULTS.EASE_FACTOR);
    expect(sm2({}, SM2_GRADES.GOOD, NOW).easeFactor).toBe(SM2_DEFAULTS.EASE_FACTOR);
  });

  it('never lets the ease factor fall below 1.3', () => {
    let state = { easeFactor: 1.4, interval: 10, repetitions: 5 };
    for (let i = 0; i < 10; i++) state = sm2(state, SM2_GRADES.HARD, NOW);
    expect(state.easeFactor).toBe(SM2_DEFAULTS.MIN_EASE_FACTOR);
  });

  it('resets the repetition count on a failure', () => {
    const learned = { easeFactor: 2.6, interval: 30, repetitions: 5 };
    const lapsed = sm2(learned, SM2_GRADES.AGAIN, NOW);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.interval).toBe(0);
    expect(lapsed.easeFactor).toBeLessThan(learned.easeFactor);
  });

  it('brings a failed item back within the same session, not tomorrow', () => {
    const lapsed = sm2({ repetitions: 4, interval: 30 }, SM2_GRADES.AGAIN, NOW);
    const minutesAway = (lapsed.dueDate - NOW) / 60000;
    expect(minutesAway).toBe(SM2_DEFAULTS.LAPSE_MINUTES);
    expect(minutesAway).toBeLessThan(60);
  });

  it('rebuilds the ladder from scratch after a lapse', () => {
    let state = sm2({ repetitions: 5, interval: 30 }, SM2_GRADES.AGAIN, NOW);
    state = sm2(state, SM2_GRADES.GOOD, NOW);
    expect(state.repetitions).toBe(1);
    expect(state.interval).toBe(1);
  });

  it('rejects a quality score outside the 0 to 5 range', () => {
    expect(() => sm2({}, 6, NOW)).toThrow(RangeError);
    expect(() => sm2({}, -1, NOW)).toThrow(RangeError);
    expect(() => sm2({}, undefined, NOW)).toThrow(RangeError);
  });

  it('treats a partially-populated state as a new item', () => {
    const next = sm2({ easeFactor: undefined, interval: null }, SM2_GRADES.GOOD, NOW);
    expect(next.easeFactor).toBe(SM2_DEFAULTS.EASE_FACTOR);
    expect(next.interval).toBe(1);
  });

  it('grows intervals monotonically across a long correct streak', () => {
    let state = {};
    const intervals = [];
    for (let i = 0; i < 8; i++) {
      state = sm2(state, SM2_GRADES.GOOD, NOW);
      intervals.push(state.interval);
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
    expect(intervals.at(-1)).toBeGreaterThan(180); // months out after eight successes
  });
});

describe('qualityFromAttempt', () => {
  it('rewards first-try recall above a retry', () => {
    expect(qualityFromAttempt({ correct: true, attempts: 1 })).toBe(SM2_GRADES.EASY);
    expect(qualityFromAttempt({ correct: true, attempts: 2 })).toBe(SM2_GRADES.GOOD);
    expect(qualityFromAttempt({ correct: true, attempts: 5 })).toBe(SM2_GRADES.HARD);
  });

  it('treats any wrong answer as a total lapse', () => {
    expect(qualityFromAttempt({ correct: false, attempts: 1 })).toBe(SM2_GRADES.AGAIN);
  });

  it('discounts an answer that needed a hint', () => {
    expect(qualityFromAttempt({ correct: true, attempts: 1, hintUsed: true })).toBe(SM2_GRADES.HARD);
  });
});
