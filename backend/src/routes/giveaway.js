import express from 'express';
import { authenticate, requirePlan } from '../middleware/auth.js';
import Giveaway from '../models/Giveaway.js';
import Guild from '../models/Guild.js';
import { getBotForGuild } from '../bot/botManager.js';
import { buildGiveawayEmbed, buildGiveawayButton, endGiveaway } from '../services/giveawayScheduler.js';

const router = express.Router();

// ── Create Giveaway ───────────────────────────────────────────────
router.post('/:guildId', authenticate, requirePlan, async (req, res) => {
  const { title, description, prize, rules, winnersCount, endAt, channelId, embedColor } = req.body;

  if (!title || !prize || !endAt || !channelId) {
    return res.status(400).json({ error: 'العنوان، الجائزة، القناة، وتاريخ الانتهاء مطلوبة.' });
  }

  const endDate = new Date(endAt);
  if (endDate <= new Date()) {
    return res.status(400).json({ error: 'تاريخ الانتهاء يجب أن يكون في المستقبل.' });
  }

  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  if (!guild.isOperational()) return res.status(403).json({ error: 'البوت معطل.' });

  // Plan limits: classic = 1 giveaway TOTAL ever, premium = unlimited
  if (req.user.plan === 'classic' || req.user.plan === 'none') {
    const totalCount = await Giveaway.countDocuments({
      guildId: req.params.guildId,
    });
    if (totalCount >= 1) {
      return res.status(403).json({
        error: 'باقة الكلاسيك تسمح بتجربة مسابقة واحدة فقط. قم بترقية باقتك للمميزة لإنشاء مسابقات غير محدودة.',
        upgradeRequired: true,
      });
    }
  }

  const bot = getBotForGuild(req.params.guildId);
  if (!bot) return res.status(400).json({ error: 'البوت غير متصل.' });

  // Create DB entry first to get ID
  const giveaway = await Giveaway.create({
    guildId:      req.params.guildId,
    ownerId:      req.user._id,
    channelId,
    title,
    description:  description || '',
    prize,
    rules:        rules || '',
    winnersCount: parseInt(winnersCount) || 1,
    endAt:        endDate,
    embedColor:   embedColor || '#FFD700',
    status:       'active',
    participants: [],
    winners:      [],
  });

  // Send to Discord
  try {
    const channel = await bot.channels.fetch(channelId);
    const embed   = buildGiveawayEmbed(giveaway);
    const button  = buildGiveawayButton(giveaway._id.toString());

    const msg = await channel.send({ embeds: [embed], components: [button] });

    giveaway.messageId = msg.id;
    await giveaway.save();

    res.status(201).json({ giveaway, message: '✅ تم إنشاء المسابقة.' });
  } catch (err) {
    await giveaway.deleteOne();
    res.status(400).json({ error: 'فشل في إرسال الرسالة: ' + err.message });
  }
});

// ── List Giveaways for Guild ──────────────────────────────────────
router.get('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const status = req.query.status || 'all';
  const filter = { guildId: req.params.guildId };
  if (status !== 'all') filter.status = status;

  const giveaways = await Giveaway.find(filter).sort({ createdAt: -1 }).limit(20);
  res.json({ giveaways });
});

// ── End Giveaway Manually ─────────────────────────────────────────
router.post('/:guildId/:giveawayId/end', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const giveaway = await Giveaway.findOne({ _id: req.params.giveawayId, guildId: req.params.guildId });
  if (!giveaway) return res.status(404).json({ error: 'المسابقة غير موجودة.' });
  if (giveaway.status === 'ended') return res.status(400).json({ error: 'المسابقة انتهت مسبقاً.' });

  await endGiveaway(giveaway);
  res.json({ giveaway, message: '✅ تم إنهاء المسابقة واختيار الفائزين.' });
});

// ── Reroll (pick new winners) ─────────────────────────────────────
router.post('/:guildId/:giveawayId/reroll', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const giveaway = await Giveaway.findOne({ _id: req.params.giveawayId, guildId: req.params.guildId });
  if (!giveaway) return res.status(404).json({ error: 'المسابقة غير موجودة.' });
  if (giveaway.status !== 'ended') return res.status(400).json({ error: 'أنهِ المسابقة أولاً.' });
  if (giveaway.participants.length === 0) return res.status(400).json({ error: 'لا يوجد مشتركون.' });

  const shuffled = [...giveaway.participants].sort(() => Math.random() - 0.5);
  giveaway.winners = shuffled.slice(0, Math.min(giveaway.winnersCount, shuffled.length));
  await giveaway.save();

  // Announce new winners
  const bot = getBotForGuild(req.params.guildId);
  if (bot) {
    try {
      const channel = await bot.channels.fetch(giveaway.channelId);
      const winnerMentions = giveaway.winners.map((w) => `<@${w}>`).join(' ');
      await channel.send({
        content: `🔄 **إعادة السحب!**\nالفائزون الجدد في **${giveaway.prize}**:\n${winnerMentions}`,
      });
    } catch {}
  }

  res.json({ giveaway, message: '✅ تم إعادة السحب.' });
});

// ── Delete Giveaway ───────────────────────────────────────────────
router.delete('/:guildId/:giveawayId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const giveaway = await Giveaway.findOne({ _id: req.params.giveawayId, guildId: req.params.guildId });
  if (!giveaway) return res.status(404).json({ error: 'المسابقة غير موجودة.' });

  // Try to delete Discord message
  const bot = getBotForGuild(req.params.guildId);
  if (bot && giveaway.messageId) {
    try {
      const channel = await bot.channels.fetch(giveaway.channelId);
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) await msg.delete();
    } catch {}
  }

  await giveaway.deleteOne();
  res.json({ message: '✅ تم حذف المسابقة.' });
});

export default router;
