import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { XP } from 'shared/constants.js';
import {
  setupDb,
  teardownDb,
  clearAll,
  clearUserData,
  seedContent,
  createAuthedUser,
} from './helpers.js';
import Lesson from '../src/models/Lesson.js';
import Concept, { textFor } from '../src/models/Concept.js';
import UserProgress from '../src/models/UserProgress.js';
import { buildLessonExercises } from '../src/services/exercise.service.js';

beforeAll(async () => {
  await setupDb();
  await clearAll();
  await seedContent();
});
afterAll(teardownDb);
beforeEach(clearUserData);

/** Regenerate a lesson exactly as the server does, to know the real answers. */
async function exercisesFor(slug, source, target) {
  const lesson = await Lesson.findOne({ slug });
  const found = await Concept.find({ _id: { $in: lesson.conceptIds } });
  const byId = new Map(found.map((c) => [c._id.toString(), c]));
  const concepts = lesson.conceptIds.map((id) => byId.get(id.toString()));
  const unitConcepts = await Concept.find({ unitId: lesson.unitId });
  return buildLessonExercises({ lesson, concepts, unitConcepts, source, target });
}

async function answerCorrectly(learner, slug, index, { source = 'en', target = 'my', ...extra } = {}) {
  const exercises = await exercisesFor(slug, source, target);
  const exercise = exercises[index];
  const answer =
    exercise.type === 'match_pairs'
      ? exercise.pairs.map((p) => ({ left: p.left, right: p.right }))
      : exercise.correctAnswer;

  return learner
    .post(`/api/lessons/${slug}/attempt`)
    .send({ exerciseIndex: index, answer, ...extra })
    .expect(200);
}

describe('GET /api/units', () => {
  it('returns the seeded course', async () => {
    const learner = await createAuthedUser();
    const res = await learner.get('/api/units').expect(200);

    expect(res.body.units).toHaveLength(8);
    expect(res.body.units[0]).toMatchObject({ slug: 'greetings', order: 1, unlocked: true });
    expect(res.body.course.slug).toBe('en-my');
  });

  it('locks every unit after the first for a new learner', async () => {
    const learner = await createAuthedUser();
    const { units } = (await learner.get('/api/units')).body;
    expect(units.filter((u) => u.unlocked)).toHaveLength(1);
    expect(units[0].lessons[0].unlocked).toBe(true);
    expect(units[0].lessons[1].unlocked).toBe(false);
  });

  it('unlocks the next lesson once the previous one is completed', async () => {
    const learner = await createAuthedUser();
    const first = (await learner.get('/api/units')).body.units[0];

    await learner
      .post(`/api/lessons/${first.lessons[0].slug}/complete`)
      .send({ correctCount: 5, totalCount: 5 })
      .expect(201);

    const after = (await learner.get('/api/units')).body.units[0];
    expect(after.lessons[0].completed).toBe(true);
    expect(after.lessons[1].unlocked).toBe(true);
  });

  it('requires authentication', async () => {
    const { default: request } = await import('supertest');
    const { app } = await import('./helpers.js');
    await request(app).get('/api/units').expect(401);
  });
});

describe('GET /api/lessons/:idOrSlug', () => {
  it('returns a lesson without leaking the answers', async () => {
    const learner = await createAuthedUser();
    const res = await learner.get('/api/lessons/greetings-1').expect(200);

    expect(res.body.lesson.exercises.length).toBeGreaterThan(0);
    for (const exercise of res.body.lesson.exercises) {
      expect(exercise.correctAnswer).toBeUndefined();
    }
  });

  it('renders the lesson in whatever course is active', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'ja' });
    const { lesson, course } = (await learner.get('/api/lessons/greetings-1')).body;

    expect(course.target.code).toBe('ja');
    const mc = lesson.exercises.find((e) => e.type === 'multiple_choice');
    expect(mc.answerLang).toBe('ja');
    expect(mc.options).toContain('こんにちは');
  });

  it('previews another course without switching to it', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'my' });
    const res = await learner.get('/api/lessons/greetings-1?source=en&target=th').expect(200);

    expect(res.body.course.target.code).toBe('th');
    const me = await learner.get('/api/auth/me');
    expect(me.body.user.targetLang).toBe('my'); // unchanged
  });

  it('404s for an unknown lesson', async () => {
    const learner = await createAuthedUser();
    await learner.get('/api/lessons/does-not-exist').expect(404);
  });
});

describe('POST /api/lessons/:slug/attempt', () => {
  it('marks a correct answer and awards first-try XP', async () => {
    const learner = await createAuthedUser();
    const res = await answerCorrectly(learner, 'greetings-1', 0);

    expect(res.body.correct).toBe(true);
    expect(res.body.xpAwarded).toBe(XP.CORRECT_FIRST_TRY);
  });

  it('grades every exercise in the lesson, in several languages', async () => {
    for (const target of ['th', 'ja', 'ko', 'ar', 'hi', 'vi']) {
      const learner = await createAuthedUser({ sourceLang: 'en', targetLang: target });
      const exercises = await exercisesFor('greetings-1', 'en', target);

      for (let i = 0; i < exercises.length; i++) {
        const res = await answerCorrectly(learner, 'greetings-1', i, { source: 'en', target });
        expect(res.body.correct, `${target} exercise ${i} was not graded correct`).toBe(true);
      }
    }
  });

  it('marks a wrong answer, reveals the answer, and awards nothing', async () => {
    const learner = await createAuthedUser();
    const res = await learner
      .post('/api/lessons/greetings-1/attempt')
      .send({ exerciseIndex: 0, answer: 'definitely wrong' })
      .expect(200);

    expect(res.body.correct).toBe(false);
    expect(res.body.correctAnswer).toBeTruthy();
    expect(res.body.xpAwarded).toBe(0);
  });

  it('pays less for an answer that took more than one try', async () => {
    const learner = await createAuthedUser();
    const res = await answerCorrectly(learner, 'greetings-1', 0, { attempts: 2 });
    expect(res.body.xpAwarded).toBe(XP.CORRECT_AFTER_RETRY);
  });

  it('schedules the word in the language being studied', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'th' });

    const progress = await UserProgress.findOne({});
    expect(progress.lang).toBe('th');
    expect(progress.repetitions).toBe(1);
    expect(progress.dueDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('keeps a schedule per language for the same word', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'th' });

    await learner.put('/api/courses/active').send({ sourceLang: 'en', targetLang: 'ko' }).expect(200);
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'ko' });

    const rows = await UserProgress.find({}).lean();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.lang).sort()).toEqual(['ko', 'th']);
    // The same concept, two independent schedules.
    expect(rows[0].conceptId.toString()).toBe(rows[1].conceptId.toString());
  });

  it('schedules a missed word to come back within the hour', async () => {
    const learner = await createAuthedUser();
    await learner
      .post('/api/lessons/greetings-1/attempt')
      .send({ exerciseIndex: 0, answer: 'wrong' })
      .expect(200);

    const progress = await UserProgress.findOne({});
    expect(progress.repetitions).toBe(0);
    expect(progress.dueDate.getTime() - Date.now()).toBeLessThan(60 * 60 * 1000);
  });

  it('tracks every word in a match-pairs exercise, not just one', async () => {
    const learner = await createAuthedUser();
    const exercises = await exercisesFor('greetings-1', 'en', 'my');
    const index = exercises.findIndex((e) => e.type === 'match_pairs');

    await answerCorrectly(learner, 'greetings-1', index);
    expect(await UserProgress.countDocuments({})).toBe(exercises[index].pairs.length);
  });

  it('rejects an out-of-range exercise index and a malformed body', async () => {
    const learner = await createAuthedUser();
    await learner
      .post('/api/lessons/greetings-1/attempt')
      .send({ exerciseIndex: 999, answer: 'x' })
      .expect(400);
    await learner.post('/api/lessons/greetings-1/attempt').send({ answer: 'x' }).expect(400);
  });
});

describe('POST /api/lessons/:slug/complete', () => {
  it('records the completion and awards the perfect-lesson bonus', async () => {
    const learner = await createAuthedUser();
    const exercises = await exercisesFor('greetings-1', 'en', 'my');

    const res = await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: exercises.length, totalCount: exercises.length })
      .expect(201);

    expect(res.body.completion.perfect).toBe(true);
    expect(res.body.completion.xpAwarded).toBe(XP.LESSON_COMPLETE + XP.PERFECT_LESSON_BONUS);
  });

  it('withholds the bonus for an imperfect run', async () => {
    const learner = await createAuthedUser();
    const res = await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 1, totalCount: 5 })
      .expect(201);

    expect(res.body.completion.perfect).toBe(false);
    expect(res.body.completion.xpAwarded).toBe(XP.LESSON_COMPLETE);
  });

  it('clamps a score the client inflated beyond the lesson length', async () => {
    const learner = await createAuthedUser();
    const exercises = await exercisesFor('greetings-1', 'en', 'my');

    const res = await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 9999, totalCount: 9999 })
      .expect(201);

    expect(res.body.completion.totalCount).toBe(exercises.length);
    expect(res.body.completion.score).toBeLessThanOrEqual(1);
  });

  it('counts a completion only for the course it was taken in', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 5, totalCount: 5 })
      .expect(201);

    const thai = (await learner.get('/api/units?source=en&target=th')).body.units[0];
    const korean = (await learner.get('/api/units?source=en&target=ko')).body.units[0];

    expect(thai.lessons[0].completed).toBe(true);
    expect(korean.lessons[0].completed).toBe(false);
    expect(korean.lessons[1].unlocked).toBe(false);
  });

  it('starts the streak, and does not increment it twice in a day', async () => {
    const learner = await createAuthedUser();
    let res = await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 3, totalCount: 5 });
    expect(res.body.user.currentStreak).toBe(1);

    res = await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 4, totalCount: 5 });
    expect(res.body.user.currentStreak).toBe(1);
  });
});

describe('GET /api/progress/summary', () => {
  it('describes a learner who has not started', async () => {
    const learner = await createAuthedUser();
    const res = await learner.get('/api/progress/summary').expect(200);

    expect(res.body.totals).toMatchObject({ lessonsCompleted: 0, wordsSeen: 0, dueCount: 0 });
    expect(res.body.accuracy.overall).toBeNull();
    expect(res.body.level.level).toBe(1);
    expect(res.body.languages).toEqual([]);
  });

  it('reports per-course totals and an all-language breakdown', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'th' });

    await learner.put('/api/courses/active').send({ sourceLang: 'en', targetLang: 'ja' });
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'ja' });
    await answerCorrectly(learner, 'greetings-1', 1, { source: 'en', target: 'ja' });

    const res = await learner.get('/api/progress/summary').expect(200);
    expect(res.body.course.target.code).toBe('ja');
    expect(res.body.totals.wordsSeen).toBe(2); // Japanese only

    const byCode = Object.fromEntries(res.body.languages.map((l) => [l.code, l.words]));
    expect(byCode).toEqual({ ja: 2, th: 1 });
  });

  it('keeps one learner progress out of another account', async () => {
    const first = await createAuthedUser();
    const second = await createAuthedUser();
    await answerCorrectly(first, 'greetings-1', 0);

    const res = await second.get('/api/progress/summary').expect(200);
    expect(res.body.totals.wordsSeen).toBe(0);
  });
});

describe('review queue', () => {
  it('is empty immediately after studying, because nothing is due yet', async () => {
    const learner = await createAuthedUser();
    await answerCorrectly(learner, 'greetings-1', 0);

    const res = await learner.get('/api/review/due').expect(200);
    expect(res.body.exercises).toHaveLength(0);
  });

  it('serves a generated question once a word falls due', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'th' });
    await UserProgress.updateMany({}, { $set: { dueDate: new Date(Date.now() - 86400000) } });

    const res = await learner.get('/api/review/due').expect(200);
    expect(res.body.exercises).toHaveLength(1);
    expect(res.body.exercises[0].options).toHaveLength(4);
    expect(new Set(res.body.exercises[0].options).size).toBe(4);
    expect(res.body.course.target.code).toBe('th');
  });

  it('only offers words from the course being studied', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'th' });
    await UserProgress.updateMany({}, { $set: { dueDate: new Date(Date.now() - 86400000) } });

    // Switching course should empty the queue — the Thai word is not a Korean one.
    await learner.put('/api/courses/active').send({ sourceLang: 'en', targetLang: 'ko' });
    const res = await learner.get('/api/review/due').expect(200);
    expect(res.body.exercises).toHaveLength(0);
    expect(res.body.dueCount).toBe(0);
  });

  it('pushes a correct review out and a wrong one back to the front', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await answerCorrectly(learner, 'greetings-1', 0, { source: 'en', target: 'th' });
    await UserProgress.updateMany({}, { $set: { dueDate: new Date(Date.now() - 86400000) } });

    const [exercise] = (await learner.get('/api/review/due')).body.exercises;
    const concept = await Concept.findById(exercise.conceptId);
    const expected = textFor(concept, exercise.answerLang);

    const right = await learner
      .post('/api/review/attempt')
      .send({ conceptId: exercise.conceptId, answer: expected, direction: exercise.direction })
      .expect(200);
    expect(right.body.correct).toBe(true);
    expect(right.body.intervalDays).toBeGreaterThan(0);

    const wrong = await learner
      .post('/api/review/attempt')
      .send({ conceptId: exercise.conceptId, answer: 'nonsense', direction: exercise.direction })
      .expect(200);
    expect(wrong.body.correct).toBe(false);
    expect(new Date(wrong.body.nextDue) - Date.now()).toBeLessThan(60 * 60 * 1000);
  });

  it('404s for a word that does not exist, and caps the batch size', async () => {
    const learner = await createAuthedUser();
    await learner
      .post('/api/review/attempt')
      .send({ conceptId: '507f1f77bcf86cd799439011', answer: 'x', direction: 'to_target' })
      .expect(404);
    await learner.get('/api/review/due?limit=500').expect(400);
  });
});
