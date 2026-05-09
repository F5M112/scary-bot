import express from 'express';
import { authenticate, requirePlan } from '../middleware/auth.js';
import KickAlert from '../models/KickAlert.js';
import Guild from '../models/Guild.js';
import { lookupKickChannel } from '../services/kickMonitor.js';

const router = express.Router();

// ── Lookup a Kick channel (autocomplete/preview) ─────────────────
router.get('/lookup/:username', authenticate, async (req, res) => {
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(req.params.username)) {
    return res.status(400).json({ error: 'اسم القناة غير صالح.' });
  }
  const data = await lookupKickChannel(req.params.username);
  if (!data) return res.status(404).json({ error: 'القناة غير موجودة على Kick.' });
  res.json({ channel: data });
});

// ── Get all watched channels for a guild ─────────────────────────
router.get('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const alert = await KickAlert.findOne({ guildId: req.params.guildId });
  res.json({
    channels: alert?.channels || [],
  });
});

// ── Add a Kick channel ───────────────────────────────────────────
router.post('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const {
    kickUsername, notifyChannelId, mentionRoleId, mentionEveryone,
    messageTemplate, embedColor, embedTitle,
  } = req.body;

  if (!kickUsername || !notifyChannelId) {
    return res.status(400).json({ error: 'اسم قناة Kick وقناة ديسكورد مطلوبان.' });
  }
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(kickUsername)) {
    return res.status(400).json({ error: 'اسم قناة Kick غير صالح.' });
  }

  // Verify channel exists on Kick
  const kickData = await lookupKickChannel(kickUsername);
  if (!kickData) return res.status(404).json({ error: 'القناة غير موجودة على Kick.' });

  let alert = await KickAlert.findOne({ guildId: req.params.guildId });
  if (!alert) {
    alert = new KickAlert({ guildId: req.params.guildId, ownerId: req.user._id, channels: [] });
  }

  // Limit
  const maxChannels = 10;
  if (alert.channels.length >= maxChannels) {
    return res.status(403).json({ error: `الحد الأقصى ${maxChannels} قنوات لكل سيرفر.` });
  }

  // Check duplicate
  const exists = alert.channels.find((c) => c.kickUsername === kickUsername.toLowerCase());
  if (exists) return res.status(400).json({ error: 'هذه القناة مضافة مسبقاً.' });

  alert.channels.push({
    kickUsername:    kickUsername.toLowerCase(),
    kickDisplayName: kickData.displayName,
    kickAvatar:      kickData.avatar,
    notifyChannelId,
    mentionRoleId:   mentionRoleId || undefined,
    mentionEveryone: !!mentionEveryone,
    messageTemplate: messageTemplate || '🔴 {streamer} الآن مباشر على Kick! {link}',
    embedColor:      embedColor || '#53FC18',
    embedTitle:      embedTitle || '🔴 [LIVE] {streamer}',
    isLive:          kickData.isLive,
    enabled:         true,
  });

  await alert.save();
  res.status(201).json({
    channel: alert.channels[alert.channels.length - 1],
    message: '✅ تم إضافة القناة.',
  });
});

// ── Update a watched channel ─────────────────────────────────────
router.put('/:guildId/:channelId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const alert = await KickAlert.findOne({ guildId: req.params.guildId });
  if (!alert) return res.status(404).json({ error: 'الإعدادات غير موجودة.' });

  const channel = alert.channels.id(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'القناة غير موجودة.' });

  const {
    notifyChannelId, mentionRoleId, mentionEveryone,
    messageTemplate, embedColor, embedTitle, enabled,
  } = req.body;

  if (notifyChannelId !== undefined) channel.notifyChannelId = notifyChannelId;
  if (mentionRoleId !== undefined)   channel.mentionRoleId = mentionRoleId || undefined;
  if (mentionEveryone !== undefined) channel.mentionEveryone = mentionEveryone;
  if (messageTemplate !== undefined) channel.messageTemplate = messageTemplate;
  if (embedColor !== undefined)      channel.embedColor = embedColor;
  if (embedTitle !== undefined)      channel.embedTitle = embedTitle;
  if (enabled !== undefined)         channel.enabled = enabled;

  await alert.save();
  res.json({ channel, message: '✅ تم التحديث.' });
});

// ── Remove a watched channel ─────────────────────────────────────
router.delete('/:guildId/:channelId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const alert = await KickAlert.findOne({ guildId: req.params.guildId });
  if (!alert) return res.status(404).json({ error: 'الإعدادات غير موجودة.' });

  alert.channels.pull({ _id: req.params.channelId });
  await alert.save();
  res.json({ message: '✅ تم الحذف.' });
});

export default router;
