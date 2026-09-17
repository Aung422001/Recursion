import { EXERCISE_TYPES, LANGUAGES } from 'shared/constants.js';
import { textFor, translationFor } from '../models/Concept.js';

/**
 * Build the exercises for one lesson in one course.
 *
 * Nothing is stored: with 10 languages there are 90 courses, and persisting
 * 16 lessons × 90 courses would mean 1,440 near-identical lesson documents that
 * all have to be regenerated whenever a word changes. Generating on demand from
 * a seeded PRNG gives the same exercises every time for a given
 * (lesson, source, target), so the server can regenerate them to grade an
 * answer without having to remember what it sent.
 */
export function buildLessonExercises({ lesson, concepts, unitConcepts, source, target }) {
  const rand = mulberry32(hashString(`${lesson.slug}:${source}:${target}`));
  const exercises = [];

  // Only concepts that exist in both languages can be taught in this course.
  const usable = concepts.filter((c) => textFor(c, source) && textFor(c, target));
  const pool = unitConcepts.filter((c) => textFor(c, source) && textFor(c, target));

  // 1. Recognition: see the source word, choose the target word.
  for (const concept of usable) {
    exercises.push(multipleChoice({ concept, pool, from: source, to: target, rand }));
  }

  // 2. The reverse direction, for every second concept.
  for (const concept of usable.filter((_, i) => i % 2 === 0)) {
    exercises.push(multipleChoice({ concept, pool, from: target, to: source, rand }));
  }

  // 3. Production: type the answer. Only asked in a language the learner can
  //    realistically type — nobody has a Burmese keyboard on a laptop — so the
  //    typed direction flips to whichever side uses a Latin script. If neither
  //    does (Thai → Japanese, say), typing is skipped entirely.
  const typedInto = LANGUAGES[target]?.typeable ? target : LANGUAGES[source]?.typeable ? source : null;
  if (typedInto) {
    const typedFrom = typedInto === target ? source : target;
    for (const concept of usable.filter((_, i) => i % 2 === 1)) {
      exercises.push({
        type: EXERCISE_TYPES.FILL_BLANK,
        conceptId: concept._id,
        prompt: textFor(concept, typedFrom),
        promptLang: typedFrom,
        answerLang: typedInto,
        correctAnswer: textFor(concept, typedInto),
        promptRomanization: translationFor(concept, typedFrom)?.romanization ?? null,
        sentence: `${textFor(concept, typedFrom)}  =  ___`,
      });
    }
  }

  // 4. A matching round over the first four concepts, as a recap.
  const pairConcepts = usable.slice(0, 4);
  if (pairConcepts.length >= 3) {
    exercises.push({
      type: EXERCISE_TYPES.MATCH_PAIRS,
      conceptIds: pairConcepts.map((c) => c._id),
      prompt: 'Match each word to its translation',
      promptLang: source,
      answerLang: target,
      pairs: pairConcepts.map((c) => ({
        left: textFor(c, source),
        right: textFor(c, target),
      })),
    });
  }

  return exercises;
}

function multipleChoice({ concept, pool, from, to, rand }) {
  const answer = textFor(concept, to);

  // Distractors come from the same unit so the wrong options are plausible,
  // and are de-duplicated because different concepts can share a word.
  const candidates = [...new Set(pool.map((c) => textFor(c, to)))].filter((t) => t && t !== answer);
  const distractors = shuffle(candidates, rand).slice(0, 3);

  return {
    type: EXERCISE_TYPES.MULTIPLE_CHOICE,
    conceptId: concept._id,
    prompt: textFor(concept, from),
    promptLang: from,
    answerLang: to,
    correctAnswer: answer,
    promptRomanization: translationFor(concept, from)?.romanization ?? null,
    answerRomanization: translationFor(concept, to)?.romanization ?? null,
    options: shuffle([answer, ...distractors], rand),
  };
}

/** Strip the answer before an exercise goes to the browser. */
export function toClientExercise(exercise, index) {
  return {
    index,
    type: exercise.type,
    prompt: exercise.prompt,
    promptLang: exercise.promptLang,
    answerLang: exercise.answerLang,
    promptRomanization: exercise.promptRomanization ?? null,
    options: exercise.options,
    sentence: exercise.sentence,
    pairs: exercise.pairs,
  };
}

function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministic PRNG — same lesson and course, same exercises, every time. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
