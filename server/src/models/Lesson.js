import mongoose from 'mongoose';

/**
 * A lesson is a language-neutral template: an ordered list of concepts. The
 * actual exercises are generated per course when the lesson is requested, so
 * one lesson serves all 90 language pairs instead of being stored 90 times.
 */
const lessonSchema = new mongoose.Schema(
  {
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    conceptIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Concept' }],
      required: true,
      validate: { validator: (list) => list.length > 0, message: 'A lesson needs concepts' },
    },
  },
  { timestamps: true }
);

lessonSchema.index({ unitId: 1, order: 1 });

export default mongoose.model('Lesson', lessonSchema);
