import { describe, it, expect } from 'vitest';
import { normalizeAnswer, answersMatch, gradeExercise } from '../src/services/grading.service.js';
import { EXERCISE_TYPES } from 'shared/constants.js';

describe('normalizeAnswer', () => {
  it('ignores case, padding and repeated spaces', () => {
    expect(normalizeAnswer('  Thank   You  ')).toBe('thank you');
  });

  it('ignores ASCII punctuation', () => {
    expect(normalizeAnswer('Hello!')).toBe('hello');
    expect(normalizeAnswer("it's okay.")).toBe('its okay');
  });

  it('ignores Myanmar sentence marks', () => {
    expect(normalizeAnswer('မင်္ဂလာပါ။')).toBe('မင်္ဂလာပါ');
  });

  it('survives null and undefined', () => {
    expect(normalizeAnswer(null)).toBe('');
    expect(normalizeAnswer(undefined)).toBe('');
  });
});

describe('answersMatch', () => {
  it('accepts a sloppily typed but correct answer', () => {
    expect(answersMatch('  THANK you ', 'thank you')).toBe(true);
  });

  it('rejects a genuinely different answer', () => {
    expect(answersMatch('goodbye', 'hello')).toBe(false);
  });

  it('does not accept an empty answer for a non-empty one', () => {
    expect(answersMatch('', 'hello')).toBe(false);
  });
});

describe('gradeExercise', () => {
  const mc = {
    type: EXERCISE_TYPES.MULTIPLE_CHOICE,
    correctAnswer: 'မင်္ဂလာပါ',
    options: ['မင်္ဂလာပါ', 'ဟုတ်ကဲ့'],
  };

  it('grades multiple choice and always returns the answer', () => {
    expect(gradeExercise(mc, 'မင်္ဂလာပါ')).toMatchObject({ correct: true });
    expect(gradeExercise(mc, 'ဟုတ်ကဲ့')).toMatchObject({
      correct: false,
      correctAnswer: 'မင်္ဂလာပါ',
    });
  });

  const pairs = {
    type: EXERCISE_TYPES.MATCH_PAIRS,
    pairs: [
      { left: 'hello', right: 'မင်္ဂလာပါ' },
      { left: 'yes', right: 'ဟုတ်ကဲ့' },
    ],
  };

  it('accepts correctly matched pairs in any order', () => {
    const reversed = [
      { left: 'yes', right: 'ဟုတ်ကဲ့' },
      { left: 'hello', right: 'မင်္ဂလာပါ' },
    ];
    expect(gradeExercise(pairs, reversed).correct).toBe(true);
  });

  it('fails the whole exercise when one pair is crossed over', () => {
    const crossed = [
      { left: 'hello', right: 'ဟုတ်ကဲ့' },
      { left: 'yes', right: 'မင်္ဂလာပါ' },
    ];
    const result = gradeExercise(pairs, crossed);
    expect(result.correct).toBe(false);
    expect(result.detail.wrongLefts).toEqual(['hello', 'yes']);
  });

  it('fails an incomplete set of pairs', () => {
    expect(gradeExercise(pairs, [{ left: 'hello', right: 'မင်္ဂလာပါ' }]).correct).toBe(false);
  });

  it('fails rather than throwing on a malformed answer', () => {
    expect(gradeExercise(pairs, 'not an array').correct).toBe(false);
    expect(gradeExercise(pairs, [{ nonsense: true }]).correct).toBe(false);
  });
});
