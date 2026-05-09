import mongoose from 'mongoose';

const watchedChannelSchema = new mongoose.Schema({
  // Kick channel info
  kickUsername:    { type: String, required: true, lowercase: true, trim: true },
  kickDisplayName: { type: String },
  kickAvatar:      { type: String },

  // Notification settings
  notifyChannelId:   { type: String, required: true },     // Discord channel ID
  mentionRoleId:     { type: String },                     // Optional role to ping
  mentionEveryone:   { type: Boolean, default: false },

  // Customization
  messageTemplate:   { type: String, default: '🔴 {streamer} الآن مباشر على Kick! {link}' },
  embedColor:        { type: String, default: '#53FC18' },  // Kick green
  embedTitle:        { type: String, default: '🔴 [LIVE] {streamer}' },

  // State tracking
  isLive:            { type: Boolean, default: false },
  lastNotifiedAt:    { type: Date },
  lastStreamId:      { type: String },                     // To avoid double notifications

  enabled:           { type: Boolean, default: true },

  addedAt:           { type: Date, default: Date.now },
});

const kickAlertSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  channels: [watchedChannelSchema],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

kickAlertSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('KickAlert', kickAlertSchema);
