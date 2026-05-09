import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import CryptoJS from 'crypto-js';

const userSchema = new mongoose.Schema({
  // Login credentials
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  password: { type: String, required: true },

  displayName: { type: String },

  role: { type: String, enum: ['admin', 'user'], default: 'user' },

  plan: {
    type: String,
    enum: ['none', 'classic', 'premium'],
    default: 'none',
  },
  planExpiresAt: { type: Date },

  // ── Discord linking (NEW) ──────────────────────────────────────
  discordId:           { type: String, sparse: true },
  discordUsername:     { type: String },
  discordAvatar:       { type: String },
  discordAccessToken:  { type: String },
  discordRefreshToken: { type: String },
  discordTokenExpires: { type: Date },

  isBanned:   { type: Boolean, default: false },
  isDisabled: { type: Boolean, default: false },
  banReason:  { type: String },

  _botToken: { type: String },

  lastLoginAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  this.updatedAt = new Date();
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isPremium = function () {
  return this.plan === 'premium' && (!this.planExpiresAt || this.planExpiresAt > new Date());
};

userSchema.methods.hasPlan = function () {
  if (this.role === 'admin') return true;
  return ['classic', 'premium'].includes(this.plan)
      && (!this.planExpiresAt || this.planExpiresAt > new Date());
};

userSchema.methods.isActive = function () {
  return !this.isBanned && !this.isDisabled;
};

userSchema.methods.isDiscordLinked = function () {
  return !!this.discordId;
};

// Bot token encryption
userSchema.virtual('botToken').set(function (token) {
  if (!token) { this._botToken = undefined; return; }
  this._botToken = CryptoJS.AES.encrypt(token, process.env.ENCRYPTION_KEY).toString();
});

userSchema.virtual('botToken').get(function () {
  if (!this._botToken) return null;
  const bytes = CryptoJS.AES.decrypt(this._botToken, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
});

userSchema.set('toJSON', {
  virtuals: false,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret._botToken;
    delete ret.discordAccessToken;
    delete ret.discordRefreshToken;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
