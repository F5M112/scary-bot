import mongoose from 'mongoose';

const panelOptionSchema = new mongoose.Schema({
  label:       { type: String, required: true },
  description: { type: String },
  emoji:       { type: String },
  style: {
    type: String,
    enum: ['primary', 'secondary', 'success', 'danger'],
    default: 'primary',
  },
  staffRoles:       [String],
  channelFormat:    { type: String, default: 'ticket-{user}' },
  welcomeMessage:   { type: String },
  ticketCategoryId: { type: String },
});

const ticketPanelSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  type:      { type: String, enum: ['button', 'dropdown'], default: 'button' },
  channelId: { type: String, required: true },
  messageId: { type: String },

  embedTitle:       { type: String, default: '🎫 نظام التذاكر' },
  embedDescription: { type: String, default: 'اضغط على الزر أدناه لفتح تذكرة جديدة' },
  embedColor:       { type: String, default: '#dc2626' },
  embedImage:       { type: String },
  embedThumbnail:   { type: String },
  embedFooter:      { type: String },

  welcomeMessage: {
    type: String,
    default: 'مرحباً {user}، تم فتح تذكرتك. سيتواصل معك فريق الدعم قريباً.',
  },

  placeholder: { type: String, default: 'اختر فئة التذكرة...' },

  // Default Discord category for ticket channels (option-level can override)
  defaultCategoryId: { type: String },

  options:  [panelOptionSchema],
  isActive: { type: Boolean, default: true },
});

const guildSchema = new mongoose.Schema({
  guildId:   { type: String, required: true, unique: true },
  guildName: { type: String },
  guildIcon: { type: String },

  // Now we link by Mongo userId (not Discord ID)
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  enabled: { type: Boolean, default: true },
  plan:    { type: String, enum: ['classic', 'premium'], default: 'classic' },
  botMode: { type: String, enum: ['platform', 'custom'], default: 'platform' },

  ticketPanels:        [ticketPanelSchema],
  transcriptChannelId: { type: String },
  logChannelId:        { type: String },

  staffRoles: [String],

  adminDisabled:       { type: Boolean, default: false },
  adminDisabledReason: { type: String },

  ticketCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

guildSchema.methods.isOperational = function () {
  return this.enabled && !this.adminDisabled;
};

guildSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Guild', guildSchema);
