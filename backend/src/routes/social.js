import express from 'express';
import { authenticate, requirePlan } from '../middleware/auth.js';
import SocialAlert from '../models/SocialAlert.js';
import Guild from '../models/Guild.js';
import { PLATFORMS, lookupChannel } from '../services/socialMonitor.js';

const router = express.Router();

// Plan limits
const PLAN_LIMITS = {
  none:    { maxChannels: 0,  allowedPlatforms: [] },
  classic: { maxChannels: 1,  allowedPlatforms: ['kick'] },                          // Classic: 1 kick only
  premium: { maxChannels: 20, allowedPlatforms: ['kick', 'youtube', 'twitch', 'tiktok'] }, // Premium: all
};

function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.none;
}

// ── Get platform list ─────────────────────────────────────────────
router.get('/platforms', authenticate, (req, res) => {
  const limits = getLimits(req.user.plan);
  const platforms = Object.entries(PLATFORMS).map(([id, p]) => ({
    id,
    label:    p.label,
    emoji:    p.emoji,
    color:    p.color,
    locked:   !limits.allowedPlatforms.includes(id),
  }));
  res.json({ platforms, limits });
});

// ── Lookup channel ────────────────────────────────────────────────
router.get('/lookup/:platform/:username', authenticate, async (req, res) => {
  const { platform, username } = req.params;
  if (!PLATFORMS[platform]) return res.status(400).json({ error: 'منصة غير صالحة.' });
  if (!/^[a-zA-Z0-9_.@-]{1,50}$/.test(username)) {
    return res.status(400).json({ error: 'اسم القناة غير صالح.' });
  }

  // Check plan access
  const limits = getLimits(req.user.plan);
  if (!limits.allowedPlatforms.includes(platform)) {
    return res.status(403).json({ error: `منصة ${PLATFORMS[platform].label} متاحة للباقة المميزة فقط.` });
  }

  const data = await lookupChannel(platform, username);

  // Always return data — even if API is blocked we return basic info
  // The monitor will verify live status later
  res.json({
    channel: {
      ...data,
      warning: data?.verified === false
        ? 'تم إضافة القناة. سيتحقق البوت من حالة البث تلقائياً.'
        : null,
    },
  });
});

// ── Get all watched channels ──────────────────────────────────────
router.get('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const alert = await SocialAlert.findOne({ guildId: req.params.guildId });
  const limits = getLimits(req.user.plan);

  res.json({ channels: alert?.channels || [], limits });
});

// ── Add a channel ─────────────────────────────────────────────────
router.post('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const { platform, channelUsername, notifyChannelId, mentionRoleId, mentionEveryone, messageTemplate, embedColor, embedTitle } = req.body;

  if (!platform || !channelUsername || !notifyChannelId) {
    return res.status(400).json({ error: 'المنصة، اسم القناة، وقناة التنبيه مطلوبة.' });
  }

  // Plan limits
  const limits = getLimits(req.user.plan);
  if (!limits.allowedPlatforms.includes(platform)) {
    return res.status(403).json({ error: `منصة ${PLATFORMS[platform]?.label} متاحة للباقة المميزة فقط.` });
  }

  let alert = await SocialAlert.findOne({ guildId: req.params.guildId });
  const currentCount = alert?.channels?.length || 0;

  if (currentCount >= limits.maxChannels) {
    return res.status(403).json({
      error: `باقتك تسمح بـ ${limits.maxChannels} قناة فقط. قم بالترقية للمميزة لإضافة المزيد.`,
    });
  }

  // Get channel info (won't fail if API blocked)
  const channelData = await lookupChannel(platform, channelUsername);

  if (!alert) {
    alert = new SocialAlert({ guildId: req.params.guildId, ownerId: req.user._id, channels: [] });
  }

  // Check duplicate
  const dup = alert.channels.find((c) => c.platform === platform && c.channelUsername === channelUsername.toLowerCase());
  if (dup) return res.status(400).json({ error: 'هذه القناة مضافة مسبقاً.' });

  const platformConfig = PLATFORMS[platform] || {};

  alert.channels.push({
    platform,
    channelUsername:    channelUsername.toLowerCase(),
    channelDisplayName: channelData.displayName,
    channelAvatar:      channelData.avatar,
    notifyChannelId,
    mentionRoleId:      mentionRoleId || undefined,
    mentionEveryone:    !!mentionEveryone,
    messageTemplate:    messageTemplate || `${platformConfig.emoji || '🔴'} {streamer} الآن مباشر! {link}`,
    embedColor:         embedColor || platformConfig.color || '#FF0000',
    embedTitle:         embedTitle || `${platformConfig.emoji || '🔴'} [LIVE] {streamer}`,
    isLive:             channelData.isLive,
    enabled:            true,
  });

  await alert.save();
  res.status(201).json({ channel: alert.channels[alert.channels.length - 1], message: '✅ تم إضافة القناة.' });
});

// ── Update channel ────────────────────────────────────────────────
router.put('/:guildId/:channelId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const alert = await SocialAlert.findOne({ guildId: req.params.guildId });
  if (!alert) return res.status(404).json({ error: 'لا يوجد إعداد.' });

  const ch = alert.channels.id(req.params.channelId);
  if (!ch) return res.status(404).json({ error: 'القناة غير موجودة.' });

  const allowed = ['notifyChannelId', 'mentionRoleId', 'mentionEveryone', 'messageTemplate', 'embedColor', 'embedTitle', 'enabled'];
  for (const f of allowed) {
    if (req.body[f] !== undefined) ch[f] = req.body[f];
  }

  await alert.save();
  res.json({ channel: ch, message: '✅ تم التحديث.' });
});

// ── Delete channel ────────────────────────────────────────────────
router.delete('/:guildId/:channelId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const alert = await SocialAlert.findOne({ guildId: req.params.guildId });
  if (!alert) return res.status(404).json({ error: 'لا يوجد إعداد.' });

  alert.channels.pull({ _id: req.params.channelId });
  await alert.save();
  res.json({ message: '✅ تم الحذف.' });
});

export default router;
