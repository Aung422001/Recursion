import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { LANGUAGE_CODES } from 'shared/constants.js';
import {
  app,
  setupDb,
  teardownDb,
  clearAll,
  clearUserData,
  seedContent,
  createAuthedUser,
} from './helpers.js';

beforeAll(async () => {
  await setupDb();
  await clearAll();
  await seedContent();
});
afterAll(teardownDb);
beforeEach(clearUserData);

describe('GET /api/languages', () => {
  it('lists every supported language with what the UI needs to render it', async () => {
    const res = await request(app).get('/api/languages').expect(200);

    expect(res.body.languages).toHaveLength(LANGUAGE_CODES.length);
    for (const lang of res.body.languages) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
      expect(lang.script).toBeTruthy();
      expect(['ltr', 'rtl']).toContain(lang.dir);
    }
  });

  it('marks Arabic as right-to-left and English as left-to-right', async () => {
    const { languages } = (await request(app).get('/api/languages')).body;
    const byCode = Object.fromEntries(languages.map((l) => [l.code, l]));

    expect(byCode.ar.dir).toBe('rtl');
    expect(byCode.en.dir).toBe('ltr');
    expect(byCode.ja.latin).toBe(false);
    expect(byCode.id.latin).toBe(true);
  });
});

describe('GET /api/courses', () => {
  it('offers every ordered pair of languages', async () => {
    const learner = await createAuthedUser();
    const res = await learner.get('/api/courses').expect(200);

    const n = LANGUAGE_CODES.length;
    expect(res.body.courses).toHaveLength(n * (n - 1));
  });

  it('offers each pair in both directions', async () => {
    const learner = await createAuthedUser();
    const slugs = new Set((await learner.get('/api/courses')).body.courses.map((c) => c.slug));

    expect(slugs.has('en-ja')).toBe(true);
    expect(slugs.has('ja-en')).toBe(true);
    expect(slugs.has('th-ko')).toBe(true);
  });

  it('never offers a course from a language to itself', async () => {
    const learner = await createAuthedUser();
    const { courses } = (await learner.get('/api/courses')).body;
    expect(courses.every((c) => c.source.code !== c.target.code)).toBe(true);
  });

  it('flags the active course and reports it separately', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'ko' });
    const res = await learner.get('/api/courses').expect(200);

    expect(res.body.activeCourse).toBe('en-ko');
    expect(res.body.courses.filter((c) => c.active)).toHaveLength(1);
    expect(res.body.courses.find((c) => c.active).slug).toBe('en-ko');
  });

  it('shows nothing as started for a new learner', async () => {
    const learner = await createAuthedUser();
    const { courses } = (await learner.get('/api/courses')).body;
    expect(courses.every((c) => !c.started)).toBe(true);
  });

  it('marks a course as started once it has been studied', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 3, totalCount: 5 })
      .expect(201);

    const { courses } = (await learner.get('/api/courses')).body;
    const started = courses.filter((c) => c.started);
    expect(started).toHaveLength(1);
    expect(started[0].slug).toBe('en-th');
    expect(started[0].lessonsCompleted).toBe(1);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/courses').expect(401);
  });
});

describe('PUT /api/courses/active', () => {
  it('switches the learner to another pair', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'my' });

    const res = await learner
      .put('/api/courses/active')
      .send({ sourceLang: 'en', targetLang: 'vi' })
      .expect(200);

    expect(res.body.user.targetLang).toBe('vi');
    expect(res.body.user.courseSlug).toBe('en-vi');
    expect(res.body.conceptCount).toBeGreaterThan(0);
  });

  it('persists the switch', async () => {
    const learner = await createAuthedUser();
    await learner.put('/api/courses/active').send({ sourceLang: 'hi', targetLang: 'ar' });

    const me = await learner.get('/api/auth/me').expect(200);
    expect(me.body.user.sourceLang).toBe('hi');
    expect(me.body.user.targetLang).toBe('ar');
  });

  it('refuses a course from a language to itself', async () => {
    const learner = await createAuthedUser();
    await learner
      .put('/api/courses/active')
      .send({ sourceLang: 'ja', targetLang: 'ja' })
      .expect(400);
  });

  it('refuses an unknown language', async () => {
    const learner = await createAuthedUser();
    await learner
      .put('/api/courses/active')
      .send({ sourceLang: 'en', targetLang: 'klingon' })
      .expect(400);
  });

  it('leaves progress in the old course untouched', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await learner.post('/api/lessons/greetings-1/complete').send({ correctCount: 4, totalCount: 5 });

    await learner.put('/api/courses/active').send({ sourceLang: 'en', targetLang: 'ko' });
    await learner.put('/api/courses/active').send({ sourceLang: 'en', targetLang: 'th' });

    const units = (await learner.get('/api/units')).body.units;
    expect(units[0].lessons[0].completed).toBe(true);
  });
});

describe('registration with a course', () => {
  it('accepts a chosen pair at signup', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'picker@example.com',
        password: 'correct-horse-battery',
        displayName: 'Picker',
        sourceLang: 'id',
        targetLang: 'ja',
      })
      .expect(201);

    expect(res.body.user.sourceLang).toBe('id');
    expect(res.body.user.targetLang).toBe('ja');
  });

  it('rejects signing up to learn the language you already speak', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'same@example.com',
        password: 'correct-horse-battery',
        displayName: 'Same',
        sourceLang: 'ko',
        targetLang: 'ko',
      })
      .expect(400);
  });

  it('defaults to English to Burmese when no pair is given', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'default@example.com',
        password: 'correct-horse-battery',
        displayName: 'Default',
      })
      .expect(201);

    expect(res.body.user.courseSlug).toBe('en-my');
  });
});

describe('course "started" state', () => {
  it('does not mark every course sharing a target language as started', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'ja' });

    // Study Japanese from English, which creates Japanese word progress.
    await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 5, totalCount: 5 })
      .expect(201);

    const { courses } = (await learner.get('/api/courses')).body;
    const started = courses.filter((c) => c.started).map((c) => c.slug);

    // Only the course actually studied — not ms-ja, hi-ja, ar-ja and the rest.
    expect(started).toEqual(['en-ja']);
    expect(started).not.toContain('ms-ja');
    expect(started).not.toContain('hi-ja');
  });

  it('still reports the shared word count on every course with that target', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'ja' });
    await learner
      .post('/api/lessons/greetings-1/complete')
      .send({ correctCount: 5, totalCount: 5 })
      .expect(201);

    const { courses } = (await learner.get('/api/courses')).body;
    const enJa = courses.find((c) => c.slug === 'en-ja');
    const msJa = courses.find((c) => c.slug === 'ms-ja');

    // Knowing a Japanese word counts wherever you approach Japanese from.
    expect(msJa.wordsSeen).toBe(enJa.wordsSeen);
    expect(msJa.started).toBe(false);
  });
});
