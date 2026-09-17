import { z } from 'zod';
import {
  LANGUAGES,
  LANGUAGE_CODES,
  courseSlug,
  allCoursePairs,
  isLanguage,
} from 'shared/constants.js';
import Concept from '../models/Concept.js';
import LessonCompletion from '../models/LessonCompletion.js';
import UserProgress from '../models/UserProgress.js';
import { ApiError } from '../utils/ApiError.js';

export const switchCourseSchema = z
  .object({
    sourceLang: z.enum(LANGUAGE_CODES),
    targetLang: z.enum(LANGUAGE_CODES),
  })
  .refine((v) => v.sourceLang !== v.targetLang, {
    message: 'A course must be between two different languages',
  });

/** The language catalogue, for building a course picker. */
export function listLanguages(_req, res) {
  res.json({
    languages: LANGUAGE_CODES.map((code) => ({ code, ...LANGUAGES[code] })),
  });
}

/**
 * Every course the content supports, with the learner's progress in each.
 * A pair is offered when at least one concept exists in both languages, which
 * with the current content set means all of them.
 */
export async function listCourses(req, res) {
  const concepts = await Concept.find().select('translations').lean();

  // How many concepts each language actually covers — a language with partial
  // content should not advertise courses it cannot teach.
  const coverage = new Map(LANGUAGE_CODES.map((code) => [code, 0]));
  for (const concept of concepts) {
    for (const code of LANGUAGE_CODES) {
      if (concept.translations?.[code]?.text) coverage.set(code, coverage.get(code) + 1);
    }
  }

  const [completions, progress] = await Promise.all([
    LessonCompletion.find({ userId: req.user._id }).select('courseSlug lessonId').lean(),
    UserProgress.find({ userId: req.user._id }).select('lang').lean(),
  ]);

  const lessonsByCourse = new Map();
  for (const c of completions) {
    if (!lessonsByCourse.has(c.courseSlug)) lessonsByCourse.set(c.courseSlug, new Set());
    lessonsByCourse.get(c.courseSlug).add(c.lessonId.toString());
  }
  const wordsByLang = new Map();
  for (const p of progress) wordsByLang.set(p.lang, (wordsByLang.get(p.lang) ?? 0) + 1);

  const active = courseSlug(req.user.sourceLang, req.user.targetLang);

  const courses = allCoursePairs()
    .filter(({ source, target }) => coverage.get(source) > 0 && coverage.get(target) > 0)
    .map(({ source, target, slug }) => ({
      slug,
      source: { code: source, ...LANGUAGES[source] },
      target: { code: target, ...LANGUAGES[target] },
      title: `${LANGUAGES[source].name} → ${LANGUAGES[target].name}`,
      conceptCount: Math.min(coverage.get(source), coverage.get(target)),
      lessonsCompleted: lessonsByCourse.get(slug)?.size ?? 0,
      // Word counts are per language, not per pair: the Japanese you know is
      // the same Japanese whether you came to it from English or from Malay.
      wordsSeen: wordsByLang.get(target) ?? 0,
      active: slug === active,
      // "Started" must be per pair, and must mean real work in *this* pair.
      // Keying it off the word count marked all nine courses ending in Japanese
      // as started the moment the learner met their first Japanese word in any
      // one of them; keying it off the active course would list a pair the
      // learner has merely selected and not yet studied.
      started: (lessonsByCourse.get(slug)?.size ?? 0) > 0,
    }));

  res.json({ courses, activeCourse: active });
}

/** Switch the learner to another pair. Progress in the old course is untouched. */
export async function switchCourse(req, res) {
  const { sourceLang, targetLang } = req.body;

  const covered = await Concept.countDocuments({
    [`translations.${sourceLang}.text`]: { $exists: true },
    [`translations.${targetLang}.text`]: { $exists: true },
  });
  if (covered === 0) {
    throw ApiError.badRequest(
      `No content yet for ${LANGUAGES[sourceLang].name} → ${LANGUAGES[targetLang].name}`
    );
  }

  req.user.sourceLang = sourceLang;
  req.user.targetLang = targetLang;
  await req.user.save();

  res.json({ user: req.user.toPublicJSON(), conceptCount: covered });
}

/**
 * The course a request applies to: the learner's active pair, unless a
 * ?source=/&target= override is supplied (used for previewing a course before
 * switching to it).
 */
export function resolveCourse(req) {
  const source = req.query?.source ?? req.user.sourceLang;
  const target = req.query?.target ?? req.user.targetLang;

  if (!isLanguage(source) || !isLanguage(target)) {
    throw ApiError.badRequest(`Unknown language in course ${source}-${target}`);
  }
  if (source === target) {
    throw ApiError.badRequest('A course must be between two different languages');
  }
  return { source, target, slug: courseSlug(source, target) };
}
