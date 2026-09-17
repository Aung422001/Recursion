import mongoose from 'mongoose';
import { LANGUAGE_CODES } from 'shared/constants.js';

const letterSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['vowel', 'consonant', 'syllable', 'digraph', 'tone'],
      required: true,
    },
    char: { type: String, required: true },
    name: { type: String, required: true }, // what the letter is called
    romanization: { type: String, required: true }, // the sound it makes
    exampleWord: { type: String, default: null },
    exampleMeaning: { type: String, default: null },
    audioUrl: { type: String, default: null }, // for real recordings later
    order: { type: Number, required: true },
  },
  { _id: false }
);

/**
 * One document per language holding its whole writing system. Kept as a single
 * document rather than 398 letter rows because it is always read whole — a
 * chart of the script — and never queried letter by letter.
 */
const alphabetSchema = new mongoose.Schema(
  {
    lang: { type: String, enum: LANGUAGE_CODES, required: true, unique: true },
    scriptName: { type: String, required: true },
    note: { type: String, default: '' },
    letters: { type: [letterSchema], required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Alphabet', alphabetSchema);
