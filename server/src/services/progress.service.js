import UserProgress from '../models/UserProgress.js';
import { sm2, qualityFromAttempt } from './sm2.service.js';
import { applyActivity } from './streak.service.js';

/**
 * Record one graded answer against a concept in a given language: update its
 * SM-2 schedule and its lifetime counters, creating the progress row on first
 * contact. The language is part of the key — the same word in Thai and in
 * Korean are scheduled independently.
 */
export async function recordConceptAttempt({
  userId,
  conceptId,
  lang,
  correct,
  attempts = 1,
  hintUsed = false,
  now = new Date(),
}) {
  if (!conceptId || !lang) return null;

  const existing = await UserProgress.findOne({ userId, conceptId, lang });
  const quality = qualityFromAttempt({ correct, attempts, hintUsed });
  const next = sm2(existing ?? {}, quality, now);

  return UserProgress.findOneAndUpdate(
    { userId, conceptId, lang },
    {
      $set: {
        easeFactor: next.easeFactor,
        interval: next.interval,
        repetitions: next.repetitions,
        dueDate: next.dueDate,
        lastReviewedAt: now,
      },
      $inc: { timesReviewed: 1, timesCorrect: correct ? 1 : 0 },
      $setOnInsert: { userId, conceptId, lang },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** Award XP and roll the streak forward in one save. Returns the updated user. */
export async function awardActivity(user, { xp = 0, now = new Date() } = {}) {
  const streak = applyActivity(user, { now, offsetMinutes: user.timezoneOffsetMinutes ?? 0 });

  user.xp += xp;
  user.currentStreak = streak.currentStreak;
  user.longestStreak = streak.longestStreak;
  user.lastActivityDate = streak.lastActivityDate;

  await user.save();
  return user;
}

/** Count of words the learner owes a review on right now, in one language. */
export function countDue(userId, lang, now = new Date()) {
  return UserProgress.countDocuments({ userId, lang, dueDate: { $lte: now } });
}
