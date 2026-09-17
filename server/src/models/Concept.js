import mongoose from 'mongoose';
import { LANGUAGE_CODES } from 'shared/constants.js';

const translationSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    romanization: { type: String, default: null }, // null for Latin-script languages
  },
  { _id: false }
);

/**
 * One meaning, expressed in every language the app knows. Content is authored
 * per concept rather than per language pair: with 10 languages there are 90
 * possible courses, and authoring those separately would mean writing the same
 * word 90 times. A course is just a projection of this collection through two
 * language codes.
 */
const conceptSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "thank_you"
    partOfSpeech: { type: String, default: null },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    translations: {
      type: Map,
      of: translationSchema,
      required: true,
      validate: {
        validator: (map) => map.size > 0,
        message: 'A concept needs at least one translation',
      },
    },
  },
  { timestamps: true }
);

conceptSchema.index({ unitId: 1 });

/** Languages this concept can actually be taught in. */
conceptSchema.methods.availableLanguages = function () {
  return LANGUAGE_CODES.filter((code) => this.translations.has(code));
};

export default mongoose.model('Concept', conceptSchema);

/**
 * Read one translation off a concept. Works whether the document came from a
 * normal query (Map) or from .lean() (plain object), which is easy to get wrong
 * and fails silently when you do.
 */
export function translationFor(concept, lang) {
  const translations = concept?.translations;
  if (!translations) return null;
  const entry = translations instanceof Map ? translations.get(lang) : translations[lang];
  return entry?.text ? entry : null;
}

/** The text alone, or null when this concept has no word in that language. */
export const textFor = (concept, lang) => translationFor(concept, lang)?.text ?? null;
