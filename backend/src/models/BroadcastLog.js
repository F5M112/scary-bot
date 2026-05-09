import mongoose from 'mongoose';

const broadcastLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Mongo user ID

  message: { type: String, required: true },
  templateMessage: { type: String }, // Original template before variable replacement

  mode: {
    type: String,
    enum: ['global', 'targeted'],
    required: true,
  },

  recipients: [{
    discordId: { type: String, required: true },
    displayName: { type: String }, // Custom name override
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'dm_closed'],
      default: 'pending',
    },
    errorMessage: { type: String },
    sentAt: { type: Date },
  }],

  totalRecipients: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
  },

  startedAt: { type: Date },
  completedAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('BroadcastLog', broadcastLogSchema);
