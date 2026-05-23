import mongoose from 'mongoose';

const welcomeSchema = new mongoose.Schema({
  guildId:          { type: String, required: true, unique: true },
  ownerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  enabled:          { type: Boolean, default: true },
  channelId:        { type: String,  default: '' },
  sendAsDM:         { type: Boolean, default: false },
  message:          { type: String,  default: 'مرحباً {user}! 🎉' },
  embedEnabled:     { type: Boolean, default: false },
  embedColor:       { type: String,  default: '#dc2626' },
  embedTitle:       { type: String,  default: 'أهلاً وسهلاً! 👋' },
  embedDescription: { type: String,  default: '' },
  embedFooter:      { type: String,  default: '' },
  embedThumbnail:   { type: Boolean, default: false },
  embedImage:       { type: Boolean, default: false },
  contentImage:     { type: Boolean, default: false },
  trackInvites:     { type: Boolean, default: true },
  // Card
  cardEnabled:       { type: Boolean, default: false },
  cardBackground:    { type: String,  default: '' },
  cardShowAvatar:    { type: Boolean, default: true },
  cardShowUsername:  { type: Boolean, default: true },
  cardShowText:      { type: Boolean, default: true },
  cardShowServerName:{ type: Boolean, default: true },
  cardShowCount:     { type: Boolean, default: true },
  cardText:          { type: String,  default: 'welcome to' },
  cardTextColor:     { type: String,  default: '#ffffff' },
  cardTextSize:      { type: Number,  default: 24 },
  cardPosition:      { type: String,  default: 'before' },
  cardChannelId:     { type: String,  default: '' },
  // Card dimensions
  cardWidth:         { type: Number,  default: 700 },
  cardHeight:        { type: Number,  default: 250 },
  // Avatar position
  avatarX:           { type: Number,  default: 125 },
  avatarY:           { type: Number,  default: 125 },
  avatarRadius:      { type: Number,  default: 70 },
  avatarBorderColor: { type: String,  default: '#dc2626' },
  avatarBorderWidth: { type: Number,  default: 5 },
  // Text positions
  textX:             { type: Number,  default: 230 },
  cardTextY:         { type: Number,  default: 90 },
  serverNameY:       { type: Number,  default: 125 },
  serverNameColor:   { type: String,  default: '#dc2626' },
  serverNameSize:    { type: Number,  default: 28 },
  usernameY:         { type: Number,  default: 160 },
  usernameColor:     { type: String,  default: '#ffffff' },
  usernameSize:      { type: Number,  default: 22 },
  countY:            { type: Number,  default: 190 },
  countSize:         { type: Number,  default: 16 },
  createdAt:         { type: Date, default: Date.now },
  updatedAt:         { type: Date, default: Date.now },
});

welcomeSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });

export default mongoose.model('Welcome', welcomeSchema);
