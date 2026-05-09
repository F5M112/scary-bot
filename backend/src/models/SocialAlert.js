import mongoose from 'mongoose';

const watchedChannelSchema = new mongoose.Schema({
  // Platform type
  platform: {
    type: String,
    enum: ['kick', 'youtube', 'twitch', 'tiktok'],
    required: true,
  },

  // Channel info (varies by platform)
  channelUsername:    { type: String, required: true, lowercase: true, trim: true },
  channelDisplayName: { type: String },
  channelAvatar:      { type: String },
  channelId:          { type: String },   // platform-specific ID

  // Discord notification settings
  notifyChannelId: { type: String, required: true },
  mentionRoleId:   { type: String },
  mentionEveryone: { type: Boolean, default: false },

  // Message customization
  messageTemplate: { type: String, default: '🔴 {streamer} الآن مباشر! {link}' },
  embedColor:      { type: String, default: '#FF0000' },
  embedTitle:      { type: String, default: '🔴 [LIVE] {streamer}' },

  // State tracking
  isLive:        { type: Boolean, default: false },
  lastNotifiedAt:{ type: Date },
  lastStreamId:  { type: String },

  enabled: { type: Boolean, default: true },
  addedAt: { type: Date, default: Date.now },
});

const socialAlertSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channels: [watchedChannelSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

socialAlertSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('SocialAlert', socialAlertSchema);
