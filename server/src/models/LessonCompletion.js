import mongoose from 'mongoose';
import { LANGUAGE_CODES } from 'shared/constants.js';

/**
 * One row per lesson attempt (not per lesson), scoped to the course it was
 * taken in — the same lesson completed in Thai and in Korean are separate
 * achievements.
 */
const lessonCompletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    courseSlug: { type: String, required: true }, // "en-th"
    sourceLang: { type: String, enum: LANGUAGE_CODES, required: true },
    targetLang: { type: String, enum: LANGUAGE_CODES, required: true },
    correctCount: { type: Number, required: true },
    totalCount: { type: Number, required: true },
    score: { type: Number, required: true }, // 0–1
    xpAwarded: { type: Number, default: 0 },
    durationMs: { type: Number, default: null },
    completedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

lessonCompletionSchema.index({ userId: 1, courseSlug: 1, completedAt: -1 });
lessonCompletionSchema.index({ userId: 1, courseSlug: 1, lessonId: 1 });

export default mongoose.model('LessonCompletion', lessonCompletionSchema);
