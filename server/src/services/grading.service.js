import { EXERCISE_TYPES } from 'shared/constants.js';

/**
 * Answers are compared leniently: case, surrounding whitespace, ASCII
 * punctuation and Myanmar sentence marks (၊ ။) are all ignored, so "Hello!" and
 * "hello" both count. Anything stricter punishes typing, not knowledge.
 */
export function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'`]/g, '')
    .replace(/[\u104A\u104B]/g, '') // ၊ ။
    .replace(/\s+/g, ' ');
}

export function answersMatch(given, expected) {
  return normalizeAnswer(given) === normalizeAnswer(expected);
}

/**
 * Grade one submitted answer against an exercise document.
 * @returns {{correct: boolean, correctAnswer: string|null, detail?: object}}
 */
export function gradeExercise(exercise, answer) {
  if (exercise.type === EXERCISE_TYPES.MATCH_PAIRS) {
    return gradeMatchPairs(exercise, answer);
  }

  return {
    correct: answersMatch(answer, exercise.correctAnswer),
    correctAnswer: exercise.correctAnswer,
  };
}

/**
 * match_pairs answers arrive as [{left, right}, ...]. Every pair must be present
 * and correctly matched — order does not matter.
 */
function gradeMatchPairs(exercise, answer) {
  const expected = new Map(
    exercise.pairs.map((p) => [normalizeAnswer(p.left), normalizeAnswer(p.right)])
  );
  const submitted = Array.isArray(answer) ? answer : [];

  const wrong = [];
  for (const pair of submitted) {
    const left = normalizeAnswer(pair?.left);
    if (expected.get(left) !== normalizeAnswer(pair?.right)) wrong.push(pair?.left);
  }

  const correct = wrong.length === 0 && submitted.length === expected.size;
  return {
    correct,
    correctAnswer: exercise.pairs.map((p) => `${p.left} = ${p.right}`).join(', '),
    detail: { wrongLefts: wrong, expectedCount: expected.size, submittedCount: submitted.length },
  };
}
