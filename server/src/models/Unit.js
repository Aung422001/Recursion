import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true }, // "greetings"
    title: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, required: true }, // display/unlock order
    icon: { type: String, default: null }, // emoji shown on the unit map
    color: { type: String, default: 'emerald' },
  },
  { timestamps: true }
);

unitSchema.index({ order: 1 });

export default mongoose.model('Unit', unitSchema);
