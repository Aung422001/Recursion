import { levelFromXp, xpForLevel, LANGUAGES } from 'shared/constants.js';
import Unit from '../models/Unit.js';
import Lesson from '../models/Lesson.js';
import Concept, { textFor, translationFor } from '../models/Concept.js';
import UserProgress from '../models/UserProgress.js';
import LessonCompletion from '../models/LessonCompletion.js';
import { effectiveStreak } from '../services/streak.service.js';
import { countDue } from '../services/progress.service.js';
import { resolveCourse } from './courses.controller.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Everything the dashboard needs for the active course, in one round trip. */
export async function getSummary(req, res) {
  const user = req.user;
  const course = resolveCourse(req);
  const now = new Date();
  const offsetMinutes = user.timezoneOffsetMinutes ?? 0;
  const since = new Date(now.getTime() - 13 * DAY_MS); // a two-week window

  const [completions, recent, dueCount, wordsSeen, wordsLearned, totalLessons, units, allProgress] =
    await Promise.all([
      LessonCompletion.find({ userId: user._id, courseSlug: course.slug })
        .select('lessonId unitId score')
        .lean(),
      LessonCompletion.find({
        userId: user._id,
        courseSlug: course.slug,
        completedAt: { $gte: since },
      })
        .select('score correctCount totalCount completedAt')
        .sort({ completedAt: 1 })
        .lean(),
      countDue(user._id, course.target, now),
      UserProgress.countDocuments({ userId: user._id, lang: course.target }),
      // "Learned" = survived at least two successful reviews, i.e. off the daily ladder.
      UserProgress.countDocuments({
        userId: user._id,
        lang: course.target,
        repetitions: { $gte: 2 },
      }),
      Lesson.countDocuments(),
      Unit.find().select('slug title order').sort({ order: 1 }).lean(),
      UserProgress.find({ userId: user._id }).select('lang').lean(),
    ]);

  const lessonsCompleted = new Set(completions.map((c) => c.lessonId.toString())).size;

  const lessonsPerUnit = await Lesson.aggregate([
    { $group: { _id: '$unitId', count: { $sum: 1 } } },
  ]);
  const perUnitTotal = new Map(lessonsPerUnit.map((r) => [r._id.toString(), r.count]));
  const perUnitDone = new Map();
  for (const c of completions) {
    const key = c.unitId.toString();
    if (!perUnitDone.has(key)) perUnitDone.set(key, new Set());
    perUnitDone.get(key).add(c.lessonId.toString());
  }
  const unitsCompleted = units.filter((u) => {
    const total = perUnitTotal.get(u._id.toString()) ?? 0;
    return total > 0 && (perUnitDone.get(u._id.toString())?.size ?? 0) === total;
  }).length;

  // Words tracked across every language, not just this course — this is the
  // number that makes a multi-language learner feel their whole effort counted.
  const perLanguage = new Map();
  for (const row of allProgress) perLanguage.set(row.lang, (perLanguage.get(row.lang) ?? 0) + 1);

  const level = levelFromXp(user.xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);

  res.json({
    user: { ...user.toPublicJSON(), currentStreak: effectiveStreak(user, { offsetMinutes }) },
    course: {
      slug: course.slug,
      source: { code: course.source, ...LANGUAGES[course.source] },
      target: { code: course.target, ...LANGUAGES[course.target] },
    },
    level: {
      level,
      xp: user.xp,
      currentLevelXp,
      nextLevelXp,
      progress: (user.xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp),
    },
    totals: {
      lessonsCompleted,
      totalLessons,
      unitsCompleted,
      totalUnits: units.length,
      wordsSeen,
      wordsLearned,
      dueCount,
      attempts: completions.length,
    },
    languages: [...perLanguage.entries()]
      .map(([code, words]) => ({ code, name: LANGUAGES[code]?.name ?? code, words }))
      .sort((a, b) => b.words - a.words),
    accuracy: {
      overall: completions.length
        ? completions.reduce((sum, c) => sum + c.score, 0) / completions.length
        : null,
      daily: bucketByDay(recent, offsetMinutes),
    },
  });
}

/** Daily accuracy + volume for the dashboard chart, oldest day first. */
function bucketByDay(completions, offsetMinutes) {
  const buckets = new Map();
  for (const c of completions) {
    const key = new Date(new Date(c.completedAt).getTime() + offsetMinutes * 60_000)
      .toISOString()
      .slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, { date: key, correct: 0, total: 0, lessons: 0 });
    const bucket = buckets.get(key);
    bucket.correct += c.correctCount;
    bucket.total += c.totalCount;
    bucket.lessons += 1;
  }
  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({ ...b, accuracy: b.total ? b.correct / b.total : null }));
}

/** The learner's word list for this course, with its scheduling state. */
export async function getVocabProgress(req, res) {
  const course = resolveCourse(req);

  const rows = await UserProgress.find({ userId: req.user._id, lang: course.target })
    .sort({ dueDate: 1 })
    .limit(500)
    .populate('conceptId')
    .lean();

  res.json({
    course: { slug: course.slug, source: course.source, target: course.target },
    items: rows
      .filter((r) => r.conceptId)
      .map((r) => ({
        conceptId: r.conceptId._id.toString(),
        key: r.conceptId.key,
        source: textFor(r.conceptId, course.source),
        target: textFor(r.conceptId, course.target),
        romanization: translationFor(r.conceptId, course.target)?.romanization ?? null,
        easeFactor: r.easeFactor,
        interval: r.interval,
        repetitions: r.repetitions,
        dueDate: r.dueDate,
        timesReviewed: r.timesReviewed,
        timesCorrect: r.timesCorrect,
        accuracy: r.timesReviewed ? r.timesCorrect / r.timesReviewed : null,
      })),
  });
}

export { Concept };
