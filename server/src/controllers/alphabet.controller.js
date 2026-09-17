import { z } from 'zod';
import { EXERCISE_TYPES, LANGUAGES, LANGUAGE_CODES, XP } from 'shared/constants.js';
import Alphabet from '../models/Alphabet.js';
import { ApiError } from '../utils/ApiError.js';
import { answersMatch } from '../services/grading.service.js';
import { awardActivity } from '../services/progress.service.js';
import { resolveCourse } from './courses.controller.js';

export const alphabetQuerySchema = z.object({
  lang: z.enum(LANGUAGE_CODES).optional(),
  source: z.string().optional(),
  target: z.string().optional(),
});

export const drillQuerySchema = alphabetQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  type: z.enum(['vowel', 'consonant', 'syllable', 'digraph', 'tone', 'all']).default('all'),
});

export const drillAttemptSchema = z.object({
  lang: z.enum(LANGUAGE_CODES),
  char: z.string().min(1),
  answer: z.string(),
  attempts: z.number().int().min(1).max(20).default(1),
});

/** Which language's script a request is about: an explicit ?lang, else the course target. */
function resolveLang(req) {
  if (req.query?.lang) return req.query.lang;
  return resolveCourse(req).target;
}

/** The whole writing system, grouped by letter type — a reference chart. */
export async function getAlphabet(req, res) {
  const lang = resolveLang(req);
  const alphabet = await Alphabet.findOne({ lang }).lean();

  if (!alphabet) {
    throw ApiError.notFound(`No alphabet recorded for ${LANGUAGES[lang]?.name ?? lang}`);
  }

  const groups = new Map();
  for (const letter of alphabet.letters) {
    if (!groups.has(letter.type)) groups.set(letter.type, []);
    groups.get(letter.type).push(letter);
  }

  res.json({
    lang: { code: lang, ...LANGUAGES[lang] },
    scriptName: alphabet.scriptName,
    note: alphabet.note,
    letterCount: alphabet.letters.length,
    groups: [...groups.entries()].map(([type, letters]) => ({
      type,
      label: GROUP_LABELS[type] ?? type,
      count: letters.length,
      letters,
    })),
  });
}

const GROUP_LABELS = {
  vowel: 'Vowels',
  consonant: 'Consonants',
  syllable: 'Syllables',
  digraph: 'Letter combinations',
  tone: 'Tone marks',
};

/**
 * A practice round over the script: see a letter, choose its sound.
 *
 * Unlike vocabulary this is not fed into spaced repetition. Learning a script
 * is a short one-off hurdle rather than an endless tail of words — once the
 * letters are known they are reinforced by every lesson that uses them.
 */
export async function getAlphabetDrill(req, res) {
  const lang = resolveLang(req);
  const { limit, type } = req.query;

  const alphabet = await Alphabet.findOne({ lang }).lean();
  if (!alphabet) throw ApiError.notFound(`No alphabet recorded for ${lang}`);

  const pool = alphabet.letters.filter((l) => type === 'all' || l.type === type);
  if (pool.length < 4) {
    throw ApiError.badRequest(`Not enough ${type} letters in ${lang} to build a drill`);
  }

  const chosen = shuffle(pool).slice(0, Math.min(limit, pool.length));

  const exercises = chosen.map((letter) => {
    const distractors = shuffle(
      [...new Set(pool.map((l) => l.romanization))].filter((r) => r !== letter.romanization)
    ).slice(0, 3);

    return {
      type: EXERCISE_TYPES.MULTIPLE_CHOICE,
      char: letter.char,
      letterType: letter.type,
      name: letter.name,
      prompt: letter.char,
      promptLang: lang,
      answerLang: 'en', // the sound is written in romanization, not in the script
      options: shuffle([letter.romanization, ...distractors]),
      exampleWord: letter.exampleWord,
      exampleMeaning: letter.exampleMeaning,
    };
  });

  res.json({ lang: { code: lang, ...LANGUAGES[lang] }, scriptName: alphabet.scriptName, exercises });
}

export async function submitDrillAttempt(req, res) {
  const { lang, char, answer, attempts } = req.body;

  const alphabet = await Alphabet.findOne({ lang }).lean();
  if (!alphabet) throw ApiError.notFound(`No alphabet recorded for ${lang}`);

  const letter = alphabet.letters.find((l) => l.char === char);
  if (!letter) throw ApiError.badRequest(`No letter "${char}" in the ${lang} alphabet`);

  const correct = answersMatch(answer, letter.romanization);

  let xpAwarded = 0;
  if (correct) {
    xpAwarded = attempts <= 1 ? XP.CORRECT_FIRST_TRY : XP.CORRECT_AFTER_RETRY;
    await awardActivity(req.user, { xp: xpAwarded });
  }

  res.json({
    correct,
    correctAnswer: letter.romanization,
    letterName: letter.name,
    exampleWord: letter.exampleWord,
    exampleMeaning: letter.exampleMeaning,
    xpAwarded,
    totalXp: req.user.xp,
  });
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
