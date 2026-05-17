import mongoose from 'mongoose';

const welcomeSchema = new mongoose.Schema({
  guildId:          { type: String, required: true, unique: true, index: true },
  ownerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  enabled:          { type: Boolean, default: true },
  channelId:        { type: String, default: '' },
  sendAsDM:         { type: Boolean, default: false },
  message:          { type: String, default: 'مرحباً {user}! 🎉' },
  embedEnabled:     { type: Boolean, default: false },
  embedColor:       { type: String,  default: '#dc2626' },
  embedTitle:       { type: String,  default: 'أهلاً وسهلاً! 👋' },
  embedDescription: { type: String,  default: 'مرحباً {user} في **{server}**!\nأنت العضو رقم **{count}**' },
  embedFooter:      { type: String,  default: 'انضم عبر: {inviter}' },
  embedThumbnail:   { type: Boolean, default: false },
  embedImage:       { type: Boolean, default: false },
  contentImage:     { type: Boolean, default: false },
  trackInvites:     { type: Boolean, default: true },
  cardEnabled:      { type: Boolean, default: false },
  cardBackground:   { type: String,  default: '' },
  cardShowAvatar:   { type: Boolean, default: true },
  cardShowUsername: { type: Boolean, default: true },
  cardShowText:     { type: Boolean, default: true },
  cardText:         { type: String,  default: 'welcome to' },
  cardTextColor:    { type: String,  default: '#ffffff' },
  cardPosition:     { type: String,  default: 'before' },
  cardChannelId:    { type: String,  default: '' },
  createdAt:        { type: Date, default: Date.now },
  updatedAt:        { type: Date, default: Date.now },
});

welcomeSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });

export default mongoose.model('Welcome', welcomeSchema);
