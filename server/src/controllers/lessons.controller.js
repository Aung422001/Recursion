import { z } from 'zod';
import mongoose from 'mongoose';
import { XP, EXERCISE_TYPES, LANGUAGES } from 'shared/constants.js';
import Unit from '../models/Unit.js';
import Lesson from '../models/Lesson.js';
import Concept, { textFor } from '../models/Concept.js';
import LessonCompletion from '../models/LessonCompletion.js';
import { ApiError } from '../utils/ApiError.js';
import { gradeExercise } from '../services/grading.service.js';
import { recordConceptAttempt, awardActivity } from '../services/progress.service.js';
import { buildLessonExercises, toClientExercise } from '../services/exercise.service.js';
import { resolveCourse } from './courses.controller.js';

export const attemptSchema = z.object({
  exerciseIndex: z.number().int().min(0),
  answer: z.union([
    z.string(),
    z.array(z.object({ left: z.string(), right: z.string() })).max(12),
  ]),
  attempts: z.number().int().min(1).max(20).default(1),
  hintUsed: z.boolean().default(false),
});

export const completeSchema = z.object({
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(1),
  durationMs: z.number().int().min(0).optional(),
});

/**
 * The unit map for the active course: every unit with its lessons, the
 * learner's completion state in *this* course, and which are unlocked.
 */
export async function listUnits(req, res) {
  const course = resolveCourse(req);

  const [units, lessons, completions] = await Promise.all([
    Unit.find().sort({ order: 1 }).lean(),
    Lesson.find().sort({ order: 1 }).select('unitId slug title order conceptIds').lean(),
    LessonCompletion.find({ userId: req.user._id, courseSlug: course.slug })
      .select('lessonId score completedAt')
      .lean(),
  ]);

  // Best score per lesson, so replaying a lesson can only improve what's shown.
  const bestByLesson = new Map();
  for (const c of completions) {
    const key = c.lessonId.toString();
    const prev = bestByLesson.get(key);
    if (!prev || c.score > prev.score) bestByLesson.set(key, c);
  }

  const lessonsByUnit = new Map();
  for (const lesson of lessons) {
    const key = lesson.unitId.toString();
    if (!lessonsByUnit.has(key)) lessonsByUnit.set(key, []);
    lessonsByUnit.get(key).push(lesson);
  }

  let previousUnitComplete = true; // the first unit is always open
  const payload = units.map((unit) => {
    const unitLessons = lessonsByUnit.get(unit._id.toString()) ?? [];
    const unitUnlocked = previousUnitComplete;

    let previousLessonComplete = true;
    const shaped = unitLessons.map((lesson) => {
      const best = bestByLesson.get(lesson._id.toString());
      const unlocked = unitUnlocked && previousLessonComplete;
      previousLessonComplete = Boolean(best);
      return {
        id: lesson._id.toString(),
        slug: lesson.slug,
        title: lesson.title,
        order: lesson.order,
        conceptCount: lesson.conceptIds.length,
        completed: Boolean(best),
        bestScore: best?.score ?? null,
        lastCompletedAt: best?.completedAt ?? null,
        unlocked,
      };
    });

    const completedCount = shaped.filter((l) => l.completed).length;
    previousUnitComplete = shaped.length > 0 && completedCount === shaped.length;

    return {
      id: unit._id.toString(),
      slug: unit.slug,
      title: unit.title,
      description: unit.description,
      icon: unit.icon,
      color: unit.color,
      order: unit.order,
      unlocked: unitUnlocked,
      lessonCount: shaped.length,
      completedCount,
      lessons: shaped,
    };
  });

  res.json({ units: payload, course: describeCourse(course) });
}

const describeCourse = ({ source, target, slug }) => ({
  slug,
  source: { code: source, ...LANGUAGES[source] },
  target: { code: target, ...LANGUAGES[target] },
});

/** Look a lesson up by slug or id — the client routes on slug, tests use ids. */
async function findLesson(idOrSlug) {
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const lesson = await Lesson.findOne(query);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  return lesson;
}

/**
 * Regenerate a lesson's exercises for a course. Deterministic, so the set the
 * grader sees is identical to the set the learner was shown.
 */
async function exercisesFor(lesson, course) {
  const [concepts, unitConcepts] = await Promise.all([
    Concept.find({ _id: { $in: lesson.conceptIds } }),
    Concept.find({ unitId: lesson.unitId }),
  ]);

  // Preserve the lesson's authored order, which $in does not guarantee.
  const byId = new Map(concepts.map((c) => [c._id.toString(), c]));
  const ordered = lesson.conceptIds.map((id) => byId.get(id.toString())).filter(Boolean);

  const exercises = buildLessonExercises({
    lesson,
    concepts: ordered,
    unitConcepts,
    source: course.source,
    target: course.target,
  });

  if (exercises.length === 0) {
    throw ApiError.badRequest(
      `This lesson has no content for ${LANGUAGES[course.source].name} → ${LANGUAGES[course.target].name}`
    );
  }
  return exercises;
}

export async function getLesson(req, res) {
  const course = resolveCourse(req);
  const lesson = await findLesson(req.params.idOrSlug);
  const [unit, exercises] = await Promise.all([
    Unit.findById(lesson.unitId).lean(),
    exercisesFor(lesson, course),
  ]);

  res.json({
    lesson: {
      id: lesson._id.toString(),
      slug: lesson.slug,
      title: lesson.title,
      order: lesson.order,
      exercises: exercises.map(toClientExercise),
    },
    unit: unit && { id: unit._id.toString(), slug: unit.slug, title: unit.title, icon: unit.icon },
    course: describeCourse(course),
  });
}

/**
 * Grade a single exercise. Grading lives here rather than on the client so the
 * correct answer never ships with the question, and so every answer updates the
 * learner's spaced-repetition schedule for the language being learned.
 */
export async function submitAttempt(req, res) {
  const course = resolveCourse(req);
  const lesson = await findLesson(req.params.idOrSlug);
  const { exerciseIndex, answer, attempts, hintUsed } = req.body;

  const exercises = await exercisesFor(lesson, course);
  const exercise = exercises[exerciseIndex];
  if (!exercise) throw ApiError.badRequest(`No exercise at index ${exerciseIndex}`);

  const { correct, correctAnswer, detail } = gradeExercise(exercise, answer);

  // Progress is recorded against the language the answer was *in* — for the
  // reverse-direction questions that is the learner's own language, which they
  // are not studying, so those do not create a schedule.
  const conceptIds =
    exercise.type === EXERCISE_TYPES.MATCH_PAIRS
      ? (exercise.conceptIds ?? [])
      : [exercise.conceptId].filter(Boolean);

  if (exercise.answerLang === course.target || exercise.type === EXERCISE_TYPES.MATCH_PAIRS) {
    await Promise.all(
      conceptIds.map((conceptId) =>
        recordConceptAttempt({
          userId: req.user._id,
          conceptId,
          lang: course.target,
          correct,
          attempts,
          hintUsed,
        })
      )
    );
  }

  let xpAwarded = 0;
  if (correct) {
    xpAwarded = attempts <= 1 && !hintUsed ? XP.CORRECT_FIRST_TRY : XP.CORRECT_AFTER_RETRY;
    await awardActivity(req.user, { xp: xpAwarded });
  }

  res.json({
    correct,
    correctAnswer,
    correctRomanization: exercise.answerRomanization ?? null,
    xpAwarded,
    totalXp: req.user.xp,
    ...(detail ? { detail } : {}),
  });
}

/** Finalize a lesson: record the attempt, award the completion bonus, roll the streak. */
export async function completeLesson(req, res) {
  const course = resolveCourse(req);
  const lesson = await findLesson(req.params.idOrSlug);
  const exercises = await exercisesFor(lesson, course);

  const totalCount = Math.min(req.body.totalCount, exercises.length);
  const correctCount = Math.min(req.body.correctCount, totalCount);
  const score = totalCount === 0 ? 0 : correctCount / totalCount;

  const perfect = correctCount === exercises.length;
  const xpAwarded = XP.LESSON_COMPLETE + (perfect ? XP.PERFECT_LESSON_BONUS : 0);

  const completion = await LessonCompletion.create({
    userId: req.user._id,
    lessonId: lesson._id,
    unitId: lesson.unitId,
    courseSlug: course.slug,
    sourceLang: course.source,
    targetLang: course.target,
    correctCount,
    totalCount,
    score,
    xpAwarded,
    durationMs: req.body.durationMs ?? null,
  });

  await awardActivity(req.user, { xp: xpAwarded });

  res.status(201).json({
    completion: {
      id: completion._id.toString(),
      score,
      correctCount,
      totalCount,
      perfect,
      xpAwarded,
    },
    user: req.user.toPublicJSON(),
  });
}

export { textFor };
