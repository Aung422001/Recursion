import { z } from 'zod';
import { EXERCISE_TYPES, MAX_REVIEW_BATCH, XP, LANGUAGES } from 'shared/constants.js';
import UserProgress from '../models/UserProgress.js';
import Concept, { textFor, translationFor } from '../models/Concept.js';
import { ApiError } from '../utils/ApiError.js';
import { answersMatch } from '../services/grading.service.js';
import { recordConceptAttempt, awardActivity, countDue } from '../services/progress.service.js';
import { resolveCourse } from './courses.controller.js';

export const dueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_REVIEW_BATCH).default(10),
  source: z.string().optional(),
  target: z.string().optional(),
});

export const reviewAttemptSchema = z.object({
  conceptId: z.string().min(1),
  answer: z.string(),
  direction: z.enum(['to_target', 'to_source']),
  attempts: z.number().int().min(1).max(20).default(1),
});

/**
 * Review questions are generated rather than authored: the schedule decides
 * which word comes up, and the direction alternates so the learner practises
 * both recognition and production.
 */
export async function getDueReviews(req, res) {
  const course = resolveCourse(req);
  const now = new Date();
  const { limit } = req.query;

  const due = await UserProgress.find({
    userId: req.user._id,
    lang: course.target, // only words from the course being studied
    dueDate: { $lte: now },
  })
    .sort({ dueDate: 1 }) // most overdue first
    .limit(limit)
    .populate('conceptId')
    .lean();

  const rows = due.filter((row) => row.conceptId && textFor(row.conceptId, course.target));

  // One pool of distractors for the batch, preferring words from the same units
  // so the wrong answers are plausible rather than absurd.
  const unitIds = [...new Set(rows.map((row) => row.conceptId.unitId.toString()))];
  const pool = await Concept.find({ unitId: { $in: unitIds } })
    .select('translations')
    .limit(200)
    .lean();

  const exercises = rows.map((row, i) => {
    const concept = row.conceptId;
    const direction = i % 2 === 0 ? 'to_target' : 'to_source';
    const answerLang = direction === 'to_target' ? course.target : course.source;
    const promptLang = direction === 'to_target' ? course.source : course.target;

    const answer = textFor(concept, answerLang);
    const candidates = [...new Set(pool.map((c) => textFor(c, answerLang)))].filter(
      (t) => t && t !== answer
    );
    const distractors = candidates.sort(() => Math.random() - 0.5).slice(0, 3);

    return {
      type: EXERCISE_TYPES.MULTIPLE_CHOICE,
      conceptId: concept._id.toString(),
      direction,
      prompt: textFor(concept, promptLang),
      promptLang,
      answerLang,
      promptRomanization: translationFor(concept, promptLang)?.romanization ?? null,
      options: shuffle([answer, ...distractors]),
      dueDate: row.dueDate,
      repetitions: row.repetitions,
    };
  });

  res.json({
    exercises,
    dueCount: await countDue(req.user._id, course.target, now),
    course: {
      slug: course.slug,
      source: { code: course.source, ...LANGUAGES[course.source] },
      target: { code: course.target, ...LANGUAGES[course.target] },
    },
  });
}

export async function submitReviewAttempt(req, res) {
  const course = resolveCourse(req);
  const { conceptId, answer, direction, attempts } = req.body;

  const concept = await Concept.findById(conceptId).catch(() => null);
  if (!concept) throw ApiError.notFound('Word not found');

  const answerLang = direction === 'to_target' ? course.target : course.source;
  const expected = textFor(concept, answerLang);
  if (!expected) throw ApiError.badRequest(`This word has no ${answerLang} translation`);

  const correct = answersMatch(answer, expected);

  // The schedule always belongs to the language being learned, whichever way
  // round the question was asked.
  const progress = await recordConceptAttempt({
    userId: req.user._id,
    conceptId: concept._id,
    lang: course.target,
    correct,
    attempts,
  });

  let xpAwarded = 0;
  if (correct) {
    xpAwarded = XP.REVIEW_CORRECT;
    await awardActivity(req.user, { xp: xpAwarded });
  }

  res.json({
    correct,
    correctAnswer: expected,
    correctRomanization: translationFor(concept, answerLang)?.romanization ?? null,
    xpAwarded,
    totalXp: req.user.xp,
    nextDue: progress?.dueDate ?? null,
    intervalDays: progress?.interval ?? null,
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
