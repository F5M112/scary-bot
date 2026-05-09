import express from 'express';
import { authenticate, requirePlan } from '../middleware/auth.js';
import Adhkar from '../models/Adhkar.js';
import Guild from '../models/Guild.js';
import { ADHKAR_CONTENT, CATEGORY_LABELS, getCategoryStats } from '../data/adhkar.js';

const router = express.Router();

// ── Get available categories with counts ─────────────────────────
router.get('/categories', authenticate, (req, res) => {
  const stats = getCategoryStats();
  const categories = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
    id,
    label,
    count: stats[id] || 0,
  }));
  res.json({ categories });
});

// ── Get settings for a guild ─────────────────────────────────────
router.get('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  let settings = await Adhkar.findOne({ guildId: req.params.guildId });
  if (!settings) {
    settings = {
      guildId: req.params.guildId,
      enabled: false,
      channelId: null,
      intervalMinutes: 60,
      categories: ['general', 'duaa'],
      embedColor: '#1a8754',
      embedTitle: '📿 ذكر',
      totalSent: 0,
    };
  }

  res.json({ settings });
});

// ── Save / update settings ───────────────────────────────────────
router.put('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const { enabled, channelId, intervalMinutes, categories, embedColor, embedTitle } = req.body;

  // Validation
  if (enabled && !channelId) {
    return res.status(400).json({ error: 'يجب اختيار قناة لإرسال الأذكار.' });
  }
  if (intervalMinutes && (intervalMinutes < 5 || intervalMinutes > 1440)) {
    return res.status(400).json({ error: 'الفترة الزمنية بين 5 دقائق و 24 ساعة.' });
  }
  if (categories && (!Array.isArray(categories) || categories.length === 0)) {
    return res.status(400).json({ error: 'اختر فئة واحدة على الأقل.' });
  }

  let settings = await Adhkar.findOne({ guildId: req.params.guildId });
  if (!settings) {
    settings = new Adhkar({ guildId: req.params.guildId, ownerId: req.user._id });
  }

  if (enabled !== undefined)         settings.enabled = enabled;
  if (channelId !== undefined)       settings.channelId = channelId;
  if (intervalMinutes !== undefined) settings.intervalMinutes = intervalMinutes;
  if (categories !== undefined)      settings.categories = categories;
  if (embedColor !== undefined)      settings.embedColor = embedColor;
  if (embedTitle !== undefined)      settings.embedTitle = embedTitle;

  await settings.save();
  res.json({ settings, message: '✅ تم الحفظ.' });
});

// ── Send test message immediately ────────────────────────────────
router.post('/:guildId/test', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const settings = await Adhkar.findOne({ guildId: req.params.guildId });
  if (!settings || !settings.channelId) {
    return res.status(400).json({ error: 'يجب حفظ الإعدادات أولاً.' });
  }

  // Force send immediately
  settings.lastSentAt = null;
  await settings.save();

  // Trigger send via the scheduler logic
  try {
    const { default: bot } = await import('../bot/botManager.js');
    const { EmbedBuilder } = await import('discord.js');
    const { getRandomAdhkar, CATEGORY_LABELS } = await import('../data/adhkar.js');
    const { getBotForGuild } = await import('../bot/botManager.js');

    const botClient = getBotForGuild(req.params.guildId);
    if (!botClient) return res.status(400).json({ error: 'البوت غير متصل.' });

    const adhkar = getRandomAdhkar(settings.categories, settings.lastSentIndex);
    if (!adhkar) return res.status(400).json({ error: 'لا يوجد محتوى متاح.' });

    const channel = await botClient.channels.fetch(settings.channelId);
    const embed = new EmbedBuilder()
      .setColor(settings.embedColor || '#1a8754')
      .setTitle(settings.embedTitle || '📿 ذكر')
      .setDescription(`**${adhkar.text}**`)
      .setFooter({ text: `${CATEGORY_LABELS[adhkar.category] || ''} • ${adhkar.source}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    settings.lastSentAt = new Date();
    settings.lastSentIndex = adhkar.globalIndex;
    settings.totalSent = (settings.totalSent || 0) + 1;
    await settings.save();

    res.json({ message: '✅ تم إرسال رسالة تجريبية.' });
  } catch (err) {
    res.status(500).json({ error: 'فشل الإرسال: ' + err.message });
  }
});

export default router;
