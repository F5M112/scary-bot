import mongoose from 'mongoose';

const adhkarSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  enabled: { type: Boolean, default: false },

  // Discord channel where adhkar will be sent
  channelId: { type: String },

  // How often to send (in minutes)
  intervalMinutes: { type: Number, default: 60, min: 5, max: 1440 },

  // Categories to include
  categories: {
    type: [String],
    enum: ['morning', 'evening', 'general', 'quran', 'duaa', 'prophet'],
    default: ['general', 'duaa'],
  },

  // Embed customization
  embedColor: { type: String, default: '#1a8754' },        // Islamic green
  embedTitle: { type: String, default: '📿 ذكر' },

  // Tracking
  lastSentAt:    { type: Date },
  lastSentIndex: { type: String, default: '' },   // e.g. "quran-4", "duaa-7"
  totalSent:     { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

adhkarSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Adhkar', adhkarSchema);
