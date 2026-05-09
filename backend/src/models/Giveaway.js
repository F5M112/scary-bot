import mongoose from 'mongoose';

const giveawaySchema = new mongoose.Schema({
  guildId:   { type: String, required: true, index: true },
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Discord info
  channelId: { type: String, required: true },
  messageId: { type: String },               // ID of the giveaway message

  // Content
  title:       { type: String, required: true },
  description: { type: String },
  prize:       { type: String, required: true },
  rules:       { type: String },

  // Settings
  winnersCount: { type: Number, default: 1, min: 1, max: 50 },
  endAt:        { type: Date, required: true },

  // Embed
  embedColor: { type: String, default: '#FFD700' },

  // Status
  status: {
    type: String,
    enum: ['active', 'ended', 'cancelled'],
    default: 'active',
  },

  // Participants (Discord user IDs)
  participants: [{ type: String }],

  // Winners
  winners: [{ type: String }],

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Giveaway', giveawaySchema);
