// Values shared by both client and server. Keep this file dependency-free —
// it is imported by Node (ESM) and bundled by Vite alike.

export const EXERCISE_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  FILL_BLANK: 'fill_blank',
  MATCH_PAIRS: 'match_pairs',
};

export const EXERCISE_TYPE_LIST = Object.values(EXERCISE_TYPES);

/**
 * Every language the app can teach or teach from. A course is any ordered pair
 * of these, so adding a language here (plus its translations in the content
 * files) adds a course in both directions against every existing language.
 *
 * - `script`      drives which webfont the client loads for this text
 * - `dir`         'rtl' for Arabic; everything else is left-to-right
 * - `latin`       true when the script needs no romanization crutch
 * - `typeable`    false when a learner is unlikely to have the keyboard, which
 *                 is what decides the direction typed answers are asked in
 */
export const LANGUAGES = {
  en: { name: 'English', nativeName: 'English', script: 'latin', dir: 'ltr', latin: true, typeable: true, flag: '🇬🇧' },
  my: { name: 'Burmese', nativeName: 'မြန်မာ', script: 'myanmar', dir: 'ltr', latin: false, typeable: false, flag: '🇲🇲' },
  th: { name: 'Thai', nativeName: 'ไทย', script: 'thai', dir: 'ltr', latin: false, typeable: false, flag: '🇹🇭' },
  ja: { name: 'Japanese', nativeName: '日本語', script: 'japanese', dir: 'ltr', latin: false, typeable: false, flag: '🇯🇵' },
  ko: { name: 'Korean', nativeName: '한국어', script: 'korean', dir: 'ltr', latin: false, typeable: false, flag: '🇰🇷' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', script: 'latin', dir: 'ltr', latin: true, typeable: true, flag: '🇻🇳' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', script: 'latin', dir: 'ltr', latin: true, typeable: true, flag: '🇮🇩' },
  ms: { name: 'Malay', nativeName: 'Bahasa Melayu', script: 'latin', dir: 'ltr', latin: true, typeable: true, flag: '🇲🇾' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', script: 'devanagari', dir: 'ltr', latin: false, typeable: false, flag: '🇮🇳' },
  ar: { name: 'Arabic', nativeName: 'العربية', script: 'arabic', dir: 'rtl', latin: false, typeable: false, flag: '🇸🇦' },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES);

export const isLanguage = (code) => Object.hasOwn(LANGUAGES, code);

/** A course slug is just its pair, e.g. "en-th". */
export const courseSlug = (source, target) => `${source}-${target}`;

export function parseCourseSlug(slug) {
  const [source, target] = String(slug ?? '').split('-');
  if (!isLanguage(source) || !isLanguage(target) || source === target) return null;
  return { source, target };
}

export const DEFAULT_COURSE = courseSlug('en', 'my');

/** Every ordered pair of distinct languages — the full set of possible courses. */
export function allCoursePairs() {
  const pairs = [];
  for (const source of LANGUAGE_CODES) {
    for (const target of LANGUAGE_CODES) {
      if (source !== target) pairs.push({ source, target, slug: courseSlug(source, target) });
    }
  }
  return pairs;
}

/**
 * SM-2 grades. The classic algorithm takes a 0–5 quality score; a four-button
 * UI maps onto the useful subset of that range.
 */
export const SM2_GRADES = {
  AGAIN: 0, // total blackout — reset the item
  HARD: 3, // recalled with serious difficulty
  GOOD: 4, // recalled after a hesitation
  EASY: 5, // perfect recall
};

export const SM2_GRADE_LIST = Object.values(SM2_GRADES);

export const SM2_DEFAULTS = {
  EASE_FACTOR: 2.5,
  MIN_EASE_FACTOR: 1.3,
  FIRST_INTERVAL: 1, // days
  SECOND_INTERVAL: 6, // days
  // A lapsed item comes back in the same sitting rather than tomorrow — getting
  // a word wrong and not seeing it again for 24h is how learners lose words.
  LAPSE_MINUTES: 10,
};

// XP economy — kept here so the client can show the same numbers it will be awarded.
export const XP = {
  CORRECT_FIRST_TRY: 10,
  CORRECT_AFTER_RETRY: 4,
  LESSON_COMPLETE: 20,
  PERFECT_LESSON_BONUS: 15,
  REVIEW_CORRECT: 6,
};

/** Level curve: level n requires 50 * n * (n - 1) cumulative XP. */
export const levelFromXp = (xp) => Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
export const xpForLevel = (level) => Math.round(50 * level * (level - 1));

export const MAX_REVIEW_BATCH = 20;
