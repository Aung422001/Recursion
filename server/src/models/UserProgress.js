import mongoose from 'mongoose';
import { SM2_DEFAULTS, LANGUAGE_CODES } from 'shared/constants.js';

/**
 * SM-2 state for one learner, one concept, in one language. The language is
 * part of the key because knowing "thank you" in Thai says nothing about
 * knowing it in Korean — each is scheduled on its own.
 */
const userProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Concept', required: true },
    lang: { type: String, enum: LANGUAGE_CODES, required: true }, // the language being learned

    // SM-2 algorithm state
    easeFactor: { type: Number, default: SM2_DEFAULTS.EASE_FACTOR }, // EF, min 1.3
    interval: { type: Number, default: 0 }, // days until next review
    repetitions: { type: Number, default: 0 }, // consecutive correct reviews
    dueDate: { type: Date, default: () => new Date() }, // next review date

    // stats
    timesReviewed: { type: Number, default: 0 },
    timesCorrect: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userProgressSchema.index({ userId: 1, conceptId: 1, lang: 1 }, { unique: true });
userProgressSchema.index({ userId: 1, lang: 1, dueDate: 1 }); // powers "due today in this course"

export default mongoose.model('UserProgress', userProgressSchema);
