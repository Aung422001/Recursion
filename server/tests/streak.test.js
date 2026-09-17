import { describe, it, expect } from 'vitest';
import { applyActivity, effectiveStreak, localDayIndex } from '../src/services/streak.service.js';

const at = (iso) => new Date(iso);

describe('applyActivity', () => {
  it('starts a streak at 1 on first activity', () => {
    const next = applyActivity({}, { now: at('2026-03-10T10:00:00Z') });
    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(1);
    expect(next.incremented).toBe(true);
  });

  it('extends the streak on a consecutive day', () => {
    const next = applyActivity(
      { currentStreak: 4, longestStreak: 9, lastActivityDate: at('2026-03-10T22:00:00Z') },
      { now: at('2026-03-11T07:00:00Z') }
    );
    expect(next.currentStreak).toBe(5);
    expect(next.longestStreak).toBe(9); // personal best untouched
  });

  it('does not double-count two sessions on the same day', () => {
    const next = applyActivity(
      { currentStreak: 3, longestStreak: 3, lastActivityDate: at('2026-03-10T08:00:00Z') },
      { now: at('2026-03-10T20:00:00Z') }
    );
    expect(next.currentStreak).toBe(3);
    expect(next.incremented).toBe(false);
  });

  it('resets to 1 after a missed day', () => {
    const next = applyActivity(
      { currentStreak: 12, longestStreak: 12, lastActivityDate: at('2026-03-10T12:00:00Z') },
      { now: at('2026-03-13T12:00:00Z') }
    );
    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(12); // the record survives the reset
  });

  it('raises the personal best when the current streak passes it', () => {
    const next = applyActivity(
      { currentStreak: 7, longestStreak: 7, lastActivityDate: at('2026-03-10T12:00:00Z') },
      { now: at('2026-03-11T12:00:00Z') }
    );
    expect(next.longestStreak).toBe(8);
  });

  it('rolls the streak over at local midnight, not UTC midnight', () => {
    // Yangon is UTC+6:30. 10:00 UTC on the 11th and 18:00 UTC on the 11th are
    // the same UTC day, but 18:00 UTC is already 00:30 on the 12th in Yangon.
    const yangon = 390;
    const lateNight = applyActivity(
      { currentStreak: 2, longestStreak: 2, lastActivityDate: at('2026-03-11T10:00:00Z') },
      { now: at('2026-03-11T18:00:00Z'), offsetMinutes: yangon }
    );
    expect(lateNight.currentStreak).toBe(3);

    // The same two instants counted in UTC would not have crossed a day boundary.
    const utc = applyActivity(
      { currentStreak: 2, longestStreak: 2, lastActivityDate: at('2026-03-11T10:00:00Z') },
      { now: at('2026-03-11T18:00:00Z'), offsetMinutes: 0 }
    );
    expect(utc.currentStreak).toBe(2);
  });
});

describe('effectiveStreak', () => {
  it('still counts a streak on the day after the last session', () => {
    expect(
      effectiveStreak(
        { currentStreak: 6, lastActivityDate: at('2026-03-10T12:00:00Z') },
        { now: at('2026-03-11T09:00:00Z') }
      )
    ).toBe(6);
  });

  it('reports zero once a whole day has been missed', () => {
    expect(
      effectiveStreak(
        { currentStreak: 6, lastActivityDate: at('2026-03-10T12:00:00Z') },
        { now: at('2026-03-12T09:00:00Z') }
      )
    ).toBe(0);
  });

  it('is zero for a learner who has never studied', () => {
    expect(effectiveStreak({ currentStreak: 0, lastActivityDate: null })).toBe(0);
  });
});

describe('localDayIndex', () => {
  it('advances by one per calendar day', () => {
    const a = localDayIndex(at('2026-03-10T00:00:00Z'));
    const b = localDayIndex(at('2026-03-11T00:00:00Z'));
    expect(b - a).toBe(1);
  });
});
