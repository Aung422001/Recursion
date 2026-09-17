import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { LANGUAGE_CODES } from 'shared/constants.js';
import { connectDb, disconnectDb } from '../config/db.js';
import Unit from '../models/Unit.js';
import Lesson from '../models/Lesson.js';
import Concept from '../models/Concept.js';
import User from '../models/User.js';
import UserProgress from '../models/UserProgress.js';
import LessonCompletion from '../models/LessonCompletion.js';
import Alphabet from '../models/Alphabet.js';
import { seedAlphabets } from './seedAlphabets.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

/**
 * Idempotent by design: everything is upserted on its natural key (unit slug,
 * lesson slug, concept key), so running the seed twice leaves the database —
 * and any learner progress pointing into it — unchanged.
 */
export async function seed({ log = console.log } = {}) {
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json')).sort();
  const summary = { units: 0, concepts: 0, lessons: 0, translations: 0, languages: new Set() };

  for (const file of files) {
    const data = JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));

    const unit = await Unit.findOneAndUpdate(
      { slug: data.unit.slug },
      { $set: data.unit },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    summary.units += 1;

    const conceptsByKey = new Map();
    for (const entry of data.concepts) {
      const translations = {};
      for (const [lang, value] of Object.entries(entry.translations)) {
        if (!LANGUAGE_CODES.includes(lang)) {
          throw new Error(`${file}: concept "${entry.key}" has unknown language "${lang}"`);
        }
        translations[lang] = { text: value.text, romanization: value.romanization ?? null };
        summary.translations += 1;
        summary.languages.add(lang);
      }

      const doc = await Concept.findOneAndUpdate(
        { key: entry.key },
        {
          $set: {
            key: entry.key,
            partOfSpeech: entry.partOfSpeech ?? null,
            unitId: unit._id,
            translations,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      conceptsByKey.set(entry.key, doc);
      summary.concepts += 1;
    }

    for (const lessonSpec of data.lessons) {
      const conceptIds = lessonSpec.concepts.map((key) => {
        const concept = conceptsByKey.get(key);
        if (!concept) {
          throw new Error(
            `${file}: lesson "${lessonSpec.slug}" references unknown concept "${key}"`
          );
        }
        return concept._id;
      });

      await Lesson.findOneAndUpdate(
        { slug: lessonSpec.slug },
        {
          $set: {
            unitId: unit._id,
            slug: lessonSpec.slug,
            title: lessonSpec.title,
            order: lessonSpec.order,
            conceptIds,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      summary.lessons += 1;
    }

    log(
      `  ${unit.icon ?? '•'} ${unit.title.padEnd(18)} ${data.concepts.length} concepts, ${data.lessons.length} lessons`
    );
  }

  summary.languages = [...summary.languages].sort();
  return summary;
}

/**
 * Bring the database's indexes back in line with the schemas.
 *
 * Mongoose creates missing indexes but never removes ones it no longer
 * declares, so a renamed key leaves its old unique index in place. That is not
 * a harmless leftover: after `vocabItemId` became `conceptId`, the stale unique
 * index on {userId, vocabItemId} saw every new row as {userId, null} and
 * rejected the second word any learner studied with a duplicate-key error.
 */
export async function syncIndexes(log = console.log) {
  for (const model of [Unit, Lesson, Concept, User, UserProgress, LessonCompletion, Alphabet]) {
    const dropped = await model.syncIndexes();
    if (dropped?.length) {
      log(`  dropped stale index on ${model.collection.name}: ${dropped.join(', ')}`);
    }
  }
}

/**
 * Content written before languages were generalised used a different shape
 * (a `vocabitems` collection, language-specific fields on units/lessons).
 * Leaving it behind would show up as duplicate or empty lessons, so clear it.
 */
export async function dropLegacyContent(log = console.log) {
  const mongoose = (await import('mongoose')).default;
  const names = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name);

  if (names.includes('vocabitems')) {
    await mongoose.connection.db.collection('vocabitems').drop();
    log('  removed legacy "vocabitems" collection');
  }

  // Lessons that still carry embedded per-language exercises, and progress rows
  // keyed on the old vocabItemId, cannot be migrated — the language they were
  // recorded in was never stored.
  const staleLessons = await mongoose.connection.db
    .collection('lessons')
    .deleteMany({ conceptIds: { $exists: false } });
  if (staleLessons.deletedCount) log(`  removed ${staleLessons.deletedCount} legacy lessons`);

  const staleProgress = await mongoose.connection.db
    .collection('userprogresses')
    .deleteMany({ lang: { $exists: false } });
  if (staleProgress.deletedCount) {
    log(`  removed ${staleProgress.deletedCount} legacy progress rows (no language recorded)`);
  }

  const staleCompletions = await mongoose.connection.db
    .collection('lessoncompletions')
    .deleteMany({ courseSlug: { $exists: false } });
  if (staleCompletions.deletedCount) {
    log(`  removed ${staleCompletions.deletedCount} legacy lesson completions`);
  }
}

// Only run when invoked directly (`npm run seed`), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Seeding Recursion content...\n');
  try {
    await connectDb();
    await dropLegacyContent();
    await syncIndexes();
    const summary = await seed();

    console.log('\nWriting systems:');
    const scripts = await seedAlphabets();
    const pairs = summary.languages.length * (summary.languages.length - 1);
    console.log(
      `\nDone: ${summary.units} units, ${summary.concepts} concepts, ${summary.lessons} lessons,` +
        ` ${summary.translations} translations across ${summary.languages.length} languages` +
        ` (${summary.languages.join(', ')}).`
    );
    console.log(
      `Alphabets: ${scripts.alphabets} writing systems, ${scripts.letters} letters.`
    );
    console.log(`That is ${pairs} courses available in both directions.`);
    await disconnectDb();
    process.exit(0);
  } catch (err) {
    console.error('\nSeed failed:', err.message);
    await disconnectDb().catch(() => {});
    process.exit(1);
  }
}
