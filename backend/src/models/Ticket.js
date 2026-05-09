import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  ticketNumber: { type: Number, required: true },

  createdBy: {
    discordId: String,
    username: String,
  },

  category: { type: String },
  status: {
    type: String,
    enum: ['open', 'closed', 'deleted'],
    default: 'open',
  },

  claimedBy: { type: String }, // Staff Discord ID
  closedBy: { type: String },
  closedAt: { type: Date },

  transcript: [{
    author: String,
    authorId: String,
    content: String,
    timestamp: Date,
    attachments: [String],
  }],

  transcriptUrl: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ticketSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Ticket', ticketSchema);
