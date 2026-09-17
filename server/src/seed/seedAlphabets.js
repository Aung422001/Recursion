import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { LANGUAGE_CODES } from 'shared/constants.js';
import Alphabet from '../models/Alphabet.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'alphabets');

/** Upserted on the language code, so re-running leaves the database unchanged. */
export async function seedAlphabets({ log = console.log } = {}) {
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json')).sort();
  const summary = { alphabets: 0, letters: 0 };

  for (const file of files) {
    const data = JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));

    if (!LANGUAGE_CODES.includes(data.lang)) {
      throw new Error(`${file}: unknown language "${data.lang}"`);
    }

    const letters = data.letters.map((letter, index) => ({
      type: letter.type,
      char: letter.char,
      name: letter.name,
      romanization: letter.romanization,
      exampleWord: letter.exampleWord ?? null,
      exampleMeaning: letter.exampleMeaning ?? null,
      audioUrl: letter.audioUrl ?? null,
      order: index,
    }));

    await Alphabet.findOneAndUpdate(
      { lang: data.lang },
      { $set: { lang: data.lang, scriptName: data.scriptName, note: data.note ?? '', letters } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    summary.alphabets += 1;
    summary.letters += letters.length;

    const counts = letters.reduce((acc, l) => ({ ...acc, [l.type]: (acc[l.type] ?? 0) + 1 }), {});
    log(
      `  ${data.lang.padEnd(3)} ${data.scriptName.padEnd(22)} ${String(letters.length).padStart(3)} letters  ` +
        Object.entries(counts)
          .map(([k, v]) => `${k}:${v}`)
          .join(' ')
    );
  }

  return summary;
}
