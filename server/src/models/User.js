import mongoose from 'mongoose';
import { levelFromXp, LANGUAGE_CODES, courseSlug } from 'shared/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },

    // The course currently being studied. Learners switch freely and each
    // course keeps its own progress, so this is a pointer, not a commitment.
    sourceLang: { type: String, enum: LANGUAGE_CODES, default: 'en' },
    targetLang: { type: String, enum: LANGUAGE_CODES, default: 'my' },

    xp: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActivityDate: { type: Date, default: null }, // used to compute streaks
    timezoneOffsetMinutes: { type: Number, default: 0 }, // client-reported, for local-day streaks
    refreshTokenVersion: { type: Number, default: 0 }, // bump to invalidate all refresh tokens
  },
  { timestamps: true }
);

userSchema.virtual('level').get(function () {
  return levelFromXp(this.xp);
});

userSchema.virtual('courseSlug').get(function () {
  return courseSlug(this.sourceLang, this.targetLang);
});

/** The shape sent to the client — never leaks passwordHash or token version. */
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    displayName: this.displayName,
    sourceLang: this.sourceLang,
    targetLang: this.targetLang,
    courseSlug: courseSlug(this.sourceLang, this.targetLang),
    xp: this.xp,
    level: levelFromXp(this.xp),
    currentStreak: this.currentStreak,
    longestStreak: this.longestStreak,
    lastActivityDate: this.lastActivityDate,
  };
};

export default mongoose.model('User', userSchema);
