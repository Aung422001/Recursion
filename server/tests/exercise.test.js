import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LANGUAGES } from 'shared/constants.js';
import { setupDb, teardownDb, clearAll, seedContent } from './helpers.js';
import Lesson from '../src/models/Lesson.js';
import Concept, { textFor } from '../src/models/Concept.js';
import { buildLessonExercises } from '../src/services/exercise.service.js';

let lesson;
let concepts;
let unitConcepts;

beforeAll(async () => {
  await setupDb();
  await clearAll();
  await seedContent();

  lesson = await Lesson.findOne({ slug: 'greetings-1' });
  const found = await Concept.find({ _id: { $in: lesson.conceptIds } });
  const byId = new Map(found.map((c) => [c._id.toString(), c]));
  concepts = lesson.conceptIds.map((id) => byId.get(id.toString()));
  unitConcepts = await Concept.find({ unitId: lesson.unitId });
});
afterAll(teardownDb);

const build = (source, target) =>
  buildLessonExercises({ lesson, concepts, unitConcepts, source, target });

describe('buildLessonExercises', () => {
  it('builds a playable lesson for every pair it is asked for', () => {
    for (const [source, target] of [
      ['en', 'th'],
      ['en', 'ja'],
      ['en', 'ar'],
      ['my', 'ko'],
      ['hi', 'vi'],
      ['ja', 'en'],
    ]) {
      const exercises = build(source, target);
      expect(exercises.length, `${source}->${target} produced nothing`).toBeGreaterThan(0);

      for (const exercise of exercises) {
        expect(exercise.prompt).toBeTruthy();
        if (exercise.type === 'multiple_choice') {
          expect(exercise.options).toHaveLength(4);
          expect(exercise.options).toContain(exercise.correctAnswer);
          expect(new Set(exercise.options).size).toBe(4); // no duplicate choices
        }
        if (exercise.type === 'match_pairs') {
          for (const pair of exercise.pairs) {
            expect(pair.left).toBeTruthy();
            expect(pair.right).toBeTruthy();
          }
        }
      }
    }
  });

  it('is deterministic for a given lesson and course', () => {
    expect(JSON.stringify(build('en', 'th'))).toBe(JSON.stringify(build('en', 'th')));
  });

  it('produces different content for different courses', () => {
    expect(JSON.stringify(build('en', 'th'))).not.toBe(JSON.stringify(build('en', 'ko')));
  });

  it('asks the question in the source language and answers in the target', () => {
    const [first] = build('en', 'th');
    expect(first.promptLang).toBe('en');
    expect(first.answerLang).toBe('th');
    expect(first.prompt).toBe(textFor(concepts[0], 'en'));
    expect(first.correctAnswer).toBe(textFor(concepts[0], 'th'));
  });

  it('reverses cleanly when the course is flipped', () => {
    const [first] = build('th', 'en');
    expect(first.promptLang).toBe('th');
    expect(first.answerLang).toBe('en');
    expect(first.prompt).toBe(textFor(concepts[0], 'th'));
  });

  it('only asks for typed answers in a language the learner can type', () => {
    // Thai target, English source: typing is asked into English.
    const typedEnThai = build('en', 'th').filter((e) => e.type === 'fill_blank');
    expect(typedEnThai.length).toBeGreaterThan(0);
    for (const e of typedEnThai) expect(LANGUAGES[e.answerLang].typeable).toBe(true);

    // Vietnamese target is Latin-script, so typing goes into Vietnamese.
    const typedVi = build('en', 'vi').filter((e) => e.type === 'fill_blank');
    expect(typedVi.every((e) => e.answerLang === 'vi')).toBe(true);
  });

  it('skips typing entirely when neither side uses a Latin keyboard', () => {
    for (const [source, target] of [
      ['my', 'th'],
      ['ja', 'ko'],
      ['ar', 'hi'],
    ]) {
      const typed = build(source, target).filter((e) => e.type === 'fill_blank');
      expect(typed, `${source}->${target} asked the learner to type`).toHaveLength(0);
    }
  });

  it('draws distractors from the same unit, never repeating the answer', () => {
    const unitTexts = new Set(unitConcepts.map((c) => textFor(c, 'th')));
    for (const exercise of build('en', 'th')) {
      if (exercise.type !== 'multiple_choice' || exercise.answerLang !== 'th') continue;
      for (const option of exercise.options) expect(unitTexts.has(option)).toBe(true);
    }
  });

  it('carries a romanization for scripts that need one', () => {
    const [first] = build('en', 'ja');
    expect(first.answerRomanization).toBeTruthy();

    const [latin] = build('en', 'id');
    expect(latin.answerRomanization).toBeNull(); // Indonesian needs no reading
  });

  it('tags every exercise with the concept it drills', () => {
    for (const exercise of build('en', 'th')) {
      if (exercise.type === 'match_pairs') expect(exercise.conceptIds.length).toBeGreaterThan(0);
      else expect(exercise.conceptId).toBeTruthy();
    }
  });
});
