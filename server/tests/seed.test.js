import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LANGUAGE_CODES, LANGUAGES } from 'shared/constants.js';
import { setupDb, teardownDb, clearAll, seedContent } from './helpers.js';
import Unit from '../src/models/Unit.js';
import Lesson from '../src/models/Lesson.js';
import Concept, { textFor } from '../src/models/Concept.js';

beforeAll(async () => {
  await setupDb();
  await clearAll();
});
afterAll(teardownDb);

describe('seed', () => {
  it('loads the whole course', async () => {
    const summary = await seedContent();

    expect(summary.units).toBe(8);
    expect(summary.concepts).toBe(80);
    expect(summary.lessons).toBe(16);
    expect(await Unit.countDocuments()).toBe(8);
    expect(await Concept.countDocuments()).toBe(80);
    expect(await Lesson.countDocuments()).toBe(16);
  });

  it('is idempotent — re-running changes nothing', async () => {
    const before = await Lesson.findOne({ slug: 'greetings-1' }).lean();

    await seedContent();

    expect(await Unit.countDocuments()).toBe(8);
    expect(await Concept.countDocuments()).toBe(80);
    expect(await Lesson.countDocuments()).toBe(16);

    const after = await Lesson.findOne({ slug: 'greetings-1' }).lean();
    expect(after._id.toString()).toBe(before._id.toString());
    expect(after.conceptIds.map(String)).toEqual(before.conceptIds.map(String));
  });

  it('translates every concept into every supported language', async () => {
    const concepts = await Concept.find();

    for (const concept of concepts) {
      for (const code of LANGUAGE_CODES) {
        const text = textFor(concept, code);
        expect(text, `${concept.key} is missing a ${code} translation`).toBeTruthy();
      }
    }
  });

  it('gives every non-Latin script a romanization to read from', async () => {
    const concepts = await Concept.find();
    const needsReading = LANGUAGE_CODES.filter((code) => !LANGUAGES[code].latin);

    for (const concept of concepts) {
      for (const code of needsReading) {
        const entry = concept.translations.get(code);
        expect(entry.romanization, `${concept.key} (${code}) has no romanization`).toBeTruthy();
      }
    }
  });

  it('gives each concept a unique key and a real unit', async () => {
    const concepts = await Concept.find().lean();
    const unitIds = new Set((await Unit.find().lean()).map((u) => u._id.toString()));

    expect(new Set(concepts.map((c) => c.key)).size).toBe(concepts.length);
    for (const concept of concepts) {
      expect(unitIds.has(concept.unitId.toString())).toBe(true);
    }
  });

  it('points every lesson at concepts that exist', async () => {
    const lessons = await Lesson.find().lean();
    const conceptIds = new Set((await Concept.find().lean()).map((c) => c._id.toString()));

    for (const lesson of lessons) {
      expect(lesson.conceptIds.length).toBeGreaterThan(0);
      for (const id of lesson.conceptIds) {
        expect(conceptIds.has(id.toString())).toBe(true);
      }
    }
  });

  it('numbers units and lessons in a consistent order', async () => {
    const units = await Unit.find().sort({ order: 1 }).lean();
    expect(units.map((u) => u.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    for (const unit of units) {
      const lessons = await Lesson.find({ unitId: unit._id }).sort({ order: 1 }).lean();
      expect(lessons.map((l) => l.order)).toEqual(lessons.map((_, i) => i + 1));
    }
  });
});
