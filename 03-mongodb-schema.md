# Recursion — MongoDB Schema (Mongoose)

Five collections: `User`, `Unit`, `Lesson`, `VocabItem`, `UserProgress`. Content (`Unit`/`Lesson`/`VocabItem`) is seeded from JSON files; `User`/`UserProgress` are runtime data.

## `User`

```js
// server/src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    nativeLanguage: { type: String, enum: ['en', 'my'], default: 'en' },
    xp: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActivityDate: { type: Date, default: null }, // used to compute streaks
    refreshTokenVersion: { type: Number, default: 0 }, // bump to invalidate all refresh tokens
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
```

`refreshTokenVersion` is the standard trick for "log out everywhere" / token revocation without a token blocklist — see the auth doc.

## `Unit`

A unit is a themed group of lessons (e.g. "Greetings", "Food", "Family").

```js
// server/src/models/Unit.js
import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true }, // "greetings"
  title: { type: String, required: true },
  titleMy: { type: String, required: true }, // Myanmar title
  order: { type: Number, required: true },   // display/unlock order
  icon: { type: String, default: null },
});

export default mongoose.model('Unit', unitSchema);
```

## `Lesson`

A lesson belongs to a unit and holds an ordered list of exercises.

```js
// server/src/models/Lesson.js
import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['multiple_choice', 'fill_blank', 'match_pairs'], required: true },
    prompt: { type: String, required: true },       // e.g. "Translate: hello"
    promptLang: { type: String, enum: ['en', 'my'], required: true },
    correctAnswer: { type: String, required: true }, // for multiple_choice/fill_blank
    options: [{ type: String }],                     // multiple_choice distractors (includes correct)
    pairs: [{ left: String, right: String }],         // match_pairs only
    vocabItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'VocabItem', default: null },
  },
  { _id: false }
);

const lessonSchema = new mongoose.Schema({
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  order: { type: Number, required: true },
  exercises: { type: [exerciseSchema], required: true },
});

lessonSchema.index({ unitId: 1, order: 1 });

export default mongoose.model('Lesson', lessonSchema);
```

## `VocabItem`

The atomic word/phrase pairs that exercises are generated from and that spaced repetition tracks individually (separate from whole lessons, since review happens at the word level, not the lesson level).

```js
// server/src/models/VocabItem.js
import mongoose from 'mongoose';

const vocabItemSchema = new mongoose.Schema({
  english: { type: String, required: true },
  myanmar: { type: String, required: true },
  partOfSpeech: { type: String, default: null },
  audioUrl: { type: String, default: null }, // stretch goal
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
});

export default mongoose.model('VocabItem', vocabItemSchema);
```

## `UserProgress`

One document per `(user, vocabItem)` pair, holding SM-2 spaced-repetition state. This is the collection Week 4 builds on.

```js
// server/src/models/UserProgress.js
import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vocabItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'VocabItem', required: true },

    // SM-2 algorithm state
    easeFactor: { type: Number, default: 2.5 },   // EF, min 1.3
    interval: { type: Number, default: 0 },        // days until next review
    repetitions: { type: Number, default: 0 },     // consecutive correct reviews
    dueDate: { type: Date, default: () => new Date() }, // next review date

    // stats
    timesReviewed: { type: Number, default: 0 },
    timesCorrect: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userProgressSchema.index({ userId: 1, vocabItemId: 1 }, { unique: true });
userProgressSchema.index({ userId: 1, dueDate: 1 }); // powers the "due today" query

export default mongoose.model('UserProgress', userProgressSchema);
```

Also record lesson-level completion somewhere lightweight — either a `completedLessons: [ObjectId]` array on `User`, or a tiny separate `LessonCompletion { userId, lessonId, completedAt, score }` collection if you want per-attempt history. Recommend the separate collection; it's one more file but keeps `User` from growing unbounded and gives you accuracy-over-time for the Week 5 dashboard for free.

## Seed data shape

Seed content as JSON under `server/src/seed/data/`, one file per unit, e.g. `greetings.json`:

```json
{
  "unit": { "slug": "greetings", "title": "Greetings", "titleMy": "နှုတ်ဆက်စကား", "order": 1 },
  "vocab": [
    { "english": "hello", "myanmar": "မင်္ဂလာပါ" },
    { "english": "thank you", "myanmar": "ကျေးဇူးတင်ပါတယ်" }
  ],
  "lessons": [
    {
      "slug": "greetings-1",
      "title": "Basic Greetings",
      "order": 1,
      "exercises": [
        { "type": "multiple_choice", "prompt": "hello", "promptLang": "en", "correctAnswer": "မင်္ဂလာပါ", "options": ["မင်္ဂလာပါ", "ကျေးဇူးတင်ပါတယ်", "ဟုတ်ကဲ့"] }
      ]
    }
  ]
}
```

`server/src/seed/seed.js` reads every file in `data/`, upserts `Unit`/`VocabItem`/`Lesson` documents by their `slug`/natural key (so re-running the seed is idempotent), and logs a summary. This matches the "seed/placeholder data now, real content later" decision — swapping in real content later means editing these JSON files, not touching code.

## Indexes summary

| Collection | Index | Purpose |
|---|---|---|
| `User` | `email` (unique) | login lookup, prevent duplicate accounts |
| `Unit` | `slug` (unique) | seed upserts, routing |
| `Lesson` | `slug` (unique), `{unitId, order}` | seed upserts, ordered lesson lists |
| `UserProgress` | `{userId, vocabItemId}` (unique) | one progress record per word per user |
| `UserProgress` | `{userId, dueDate}` | fast "what's due today" query |
