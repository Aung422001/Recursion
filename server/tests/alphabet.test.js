import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { LANGUAGE_CODES, LANGUAGES, XP } from 'shared/constants.js';
import {
  app,
  setupDb,
  teardownDb,
  clearAll,
  clearUserData,
  seedContent,
  seedScripts,
  createAuthedUser,
} from './helpers.js';
import Alphabet from '../src/models/Alphabet.js';

beforeAll(async () => {
  await setupDb();
  await clearAll();
  await seedContent();
  await seedScripts();
});
afterAll(teardownDb);
beforeEach(clearUserData);

describe('alphabet content', () => {
  it('has a writing system for every language', async () => {
    const langs = (await Alphabet.find().select('lang').lean()).map((a) => a.lang).sort();
    expect(langs).toEqual([...LANGUAGE_CODES].sort());
  });

  it('gives every letter a name and a sound', async () => {
    for (const alphabet of await Alphabet.find().lean()) {
      expect(alphabet.letters.length).toBeGreaterThan(0);
      for (const letter of alphabet.letters) {
        expect(letter.char, `${alphabet.lang} letter with no character`).toBeTruthy();
        expect(letter.name, `${alphabet.lang} ${letter.char} has no name`).toBeTruthy();
        expect(
          letter.romanization,
          `${alphabet.lang} ${letter.char} has no romanization`
        ).toBeTruthy();
      }
    }
  });

  it('matches the standard letter counts for each script', async () => {
    const counts = {};
    for (const alphabet of await Alphabet.find().lean()) {
      counts[alphabet.lang] = alphabet.letters.reduce(
        (acc, l) => ({ ...acc, [l.type]: (acc[l.type] ?? 0) + 1 }),
        {}
      );
    }

    expect(counts.th.consonant).toBe(44); // Thai has 44 consonants
    expect(counts.hi.consonant).toBe(33); // Devanagari has 33
    expect(counts.hi.vowel).toBe(11);
    expect(counts.ar.consonant).toBe(28); // Arabic has 28 letters
    expect(counts.my.consonant).toBe(33); // Burmese has 33
    expect(counts.en.vowel).toBe(5);
    expect(counts.en.consonant).toBe(21);
    expect(counts.ja.vowel + counts.ja.syllable).toBe(46); // basic hiragana
  });

  it('gives every language vowels, and consonants unless it is a syllabary', async () => {
    for (const alphabet of await Alphabet.find().lean()) {
      const types = new Set(alphabet.letters.map((l) => l.type));
      expect(types.has('vowel'), `${alphabet.lang} has no vowels`).toBe(true);

      // Japanese hiragana has no standalone consonants — it is a syllabary.
      if (alphabet.lang !== 'ja') {
        expect(types.has('consonant'), `${alphabet.lang} has no consonants`).toBe(true);
      } else {
        expect(types.has('syllable')).toBe(true);
      }
    }
  });

  it('re-seeding leaves the alphabets unchanged', async () => {
    const before = await Alphabet.findOne({ lang: 'th' }).lean();
    await seedScripts();
    const after = await Alphabet.findOne({ lang: 'th' }).lean();

    expect(await Alphabet.countDocuments()).toBe(LANGUAGE_CODES.length);
    expect(after._id.toString()).toBe(before._id.toString());
    expect(after.letters).toHaveLength(before.letters.length);
  });
});

describe('GET /api/alphabet', () => {
  it('returns the script of the course being studied', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    const res = await learner.get('/api/alphabet').expect(200);

    expect(res.body.lang.code).toBe('th');
    expect(res.body.scriptName).toBeTruthy();
    expect(res.body.note).toBeTruthy();
  });

  it('groups letters into vowels and consonants', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'hi' });
    const { groups } = (await learner.get('/api/alphabet')).body;

    const byType = Object.fromEntries(groups.map((g) => [g.type, g]));
    expect(byType.vowel.label).toBe('Vowels');
    expect(byType.consonant.label).toBe('Consonants');
    expect(byType.vowel.count).toBe(11);
    expect(byType.consonant.count).toBe(33);
    expect(byType.consonant.letters[0].char).toBeTruthy();
  });

  it('can be asked for any language, not just the active one', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    const res = await learner.get('/api/alphabet?lang=ko').expect(200);
    expect(res.body.lang.code).toBe('ko');
    expect(res.body.scriptName).toBe('Hangul');
  });

  it('serves every language', async () => {
    const learner = await createAuthedUser();
    for (const code of LANGUAGE_CODES) {
      const res = await learner.get(`/api/alphabet?lang=${code}`).expect(200);
      expect(res.body.letterCount, `${code} has no letters`).toBeGreaterThan(0);
    }
  });

  it('rejects an unknown language and requires auth', async () => {
    const learner = await createAuthedUser();
    await learner.get('/api/alphabet?lang=klingon').expect(400);
    await request(app).get('/api/alphabet').expect(401);
  });
});

describe('GET /api/alphabet/drill', () => {
  it('builds a drill over the script', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    const res = await learner.get('/api/alphabet/drill?limit=6').expect(200);

    expect(res.body.exercises).toHaveLength(6);
    for (const exercise of res.body.exercises) {
      expect(exercise.char).toBeTruthy();
      expect(exercise.options).toHaveLength(4);
      expect(new Set(exercise.options).size).toBe(4);
      expect(exercise.promptLang).toBe('th');
    }
  });

  it('never repeats a letter within one round', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'ja' });
    const { exercises } = (await learner.get('/api/alphabet/drill?limit=20')).body;
    expect(new Set(exercises.map((e) => e.char)).size).toBe(exercises.length);
  });

  it('can be narrowed to one letter type', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'hi' });
    const { exercises } = (await learner.get('/api/alphabet/drill?type=vowel&limit=8')).body;
    expect(exercises.every((e) => e.letterType === 'vowel')).toBe(true);
  });

  it('fails clearly when a script has too few letters of that type', async () => {
    const learner = await createAuthedUser({ sourceLang: 'my', targetLang: 'en' });
    const res = await learner.get('/api/alphabet/drill?type=tone').expect(400);
    expect(res.body.error).toMatch(/not enough/i);
  });
});

describe('POST /api/alphabet/attempt', () => {
  it('accepts the right sound and awards XP', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    const res = await learner
      .post('/api/alphabet/attempt')
      .send({ lang: 'th', char: 'ก', answer: 'k' })
      .expect(200);

    expect(res.body.correct).toBe(true);
    expect(res.body.letterName).toBe('ko kai');
    expect(res.body.xpAwarded).toBe(XP.CORRECT_FIRST_TRY);
  });

  it('rejects a wrong sound and teaches the right one', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    const res = await learner
      .post('/api/alphabet/attempt')
      .send({ lang: 'th', char: 'ก', answer: 'z' })
      .expect(200);

    expect(res.body.correct).toBe(false);
    expect(res.body.correctAnswer).toBe('k');
    expect(res.body.exampleWord).toBe('ไก่');
    expect(res.body.xpAwarded).toBe(0);
  });

  it('pays less for a retry', async () => {
    const learner = await createAuthedUser();
    const res = await learner
      .post('/api/alphabet/attempt')
      .send({ lang: 'ko', char: 'ㄴ', answer: 'n', attempts: 2 })
      .expect(200);
    expect(res.body.xpAwarded).toBe(XP.CORRECT_AFTER_RETRY);
  });

  it('counts towards the streak like any other study', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'ja' });
    await learner
      .post('/api/alphabet/attempt')
      .send({ lang: 'ja', char: 'あ', answer: 'a' })
      .expect(200);

    const me = await learner.get('/api/auth/me').expect(200);
    expect(me.body.user.currentStreak).toBe(1);
  });

  it('rejects a letter that is not in that alphabet', async () => {
    const learner = await createAuthedUser();
    await learner
      .post('/api/alphabet/attempt')
      .send({ lang: 'th', char: 'こ', answer: 'ko' })
      .expect(400);
  });

  it('does not schedule letters for spaced repetition', async () => {
    const learner = await createAuthedUser({ sourceLang: 'en', targetLang: 'th' });
    await learner.post('/api/alphabet/attempt').send({ lang: 'th', char: 'ก', answer: 'k' });

    // Script practice is a one-off hurdle, not a long tail of vocabulary.
    const summary = await learner.get('/api/progress/summary').expect(200);
    expect(summary.body.totals.wordsSeen).toBe(0);
  });

  it('names the language it could not find', async () => {
    const learner = await createAuthedUser();
    const res = await learner
      .post('/api/alphabet/attempt')
      .send({ lang: 'zz', char: 'a', answer: 'a' });
    expect(res.status).toBe(400);
  });
});

describe('script coverage for every course', () => {
  it('every language a learner can study has a chart to read', async () => {
    const learner = await createAuthedUser();

    for (const code of LANGUAGE_CODES) {
      const res = await learner.get(`/api/alphabet?lang=${code}`).expect(200);
      const vowels = res.body.groups.find((g) => g.type === 'vowel');
      expect(vowels, `${LANGUAGES[code].name} has no vowel group`).toBeTruthy();
      expect(vowels.count).toBeGreaterThan(0);
    }
  });
});
