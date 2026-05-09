import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requirePlan } from '../middleware/auth.js';
import Guild from '../models/Guild.js';
import BroadcastLog from '../models/BroadcastLog.js';
import { getBotForGuild } from '../bot/botManager.js';

const router = express.Router();

// Strict rate limit for broadcast
const broadcastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'تجاوزت الحد المسموح به للإرسال. حاول بعد ساعة.' },
  keyGenerator: (req) => req.user?._id || req.ip,
});

// ── Send Broadcast ───────────────────────────────────────────────
router.post('/send', authenticate, requirePlan, broadcastLimiter, async (req, res) => {
  const { guildId, message, mode, recipients } = req.body;

  if (!guildId || !message || !mode) {
    return res.status(400).json({ error: 'guildId والرسالة والنوع مطلوبة.' });
  }
  if (message.length > 1500) {
    return res.status(400).json({ error: 'الرسالة طويلة جداً. الحد الأقصى 1500 حرف.' });
  }

  const guild = await Guild.findOne({ guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  if (!guild.isOperational()) return res.status(403).json({ error: 'البوت معطل لهذا السيرفر.' });

  const bot = getBotForGuild(guildId);
  if (!bot) return res.status(400).json({ error: 'البوت غير متصل بهذا السيرفر.' });

  let recipientList = [];

  if (mode === 'global') {
    // Global = classic + premium
    try {
      const discordGuild = await bot.guilds.fetch(guildId);
      const members = await discordGuild.members.fetch();
      recipientList = members
        .filter(m => !m.user.bot)
        .map(m => ({
          discordId: m.user.id,
          displayName: m.user.username,
          status: 'pending',
        }));
    } catch {
      return res.status(400).json({ error: 'فشل في جلب أعضاء السيرفر.' });
    }
  } else if (mode === 'targeted') {
    // Targeted by Discord ID = premium only
    if (!req.user.isPremium()) {
      return res.status(403).json({
        error: 'الإرسال المستهدف بمعرفات ديسكورد متاح للباقة المميزة فقط. يمكنك استخدام الإرسال الشامل في الكلاسيك.',
        upgradeRequired: true,
      });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'قائمة المستلمين مطلوبة في وضع الإرسال المستهدف.' });
    }
    if (recipients.length > 500) {
      return res.status(400).json({ error: 'الحد الأقصى 500 مستلم في المرة الواحدة.' });
    }
    recipientList = recipients.map(r => ({
      discordId: r.id,
      displayName: r.name || null,
      status: 'pending',
    }));
  } else {
    return res.status(400).json({ error: 'نوع الإرسال يجب أن يكون global أو targeted.' });
  }

  // Create log entry
  const broadcastLog = await BroadcastLog.create({
    guildId,
    sentBy: req.user._id,
    message,
    templateMessage: message,
    mode,
    recipients: recipientList,
    totalRecipients: recipientList.length,
    status: 'pending',
  });

  // Start broadcast in background (non-blocking)
  processBroadcast(broadcastLog._id, bot, message).catch(console.error);

  res.json({
    message: 'تم بدء عملية الإرسال.',
    broadcastId: broadcastLog._id,
    totalRecipients: recipientList.length,
  });
});

// ── Background broadcast processor ──────────────────────────────
async function processBroadcast(logId, bot, templateMessage) {
  const log = await BroadcastLog.findById(logId);
  if (!log) return;

  log.status = 'in_progress';
  log.startedAt = new Date();
  await log.save();

  const DELAY_MS = 1200; // Rate limit protection: ~50 DMs/min

  for (let i = 0; i < log.recipients.length; i++) {
    const recipient = log.recipients[i];

    // Replace {username} with custom name or Discord username
    const personalizedMsg = templateMessage.replace(
      /\{username\}/g,
      recipient.displayName || 'عضو'
    );

    try {
      const user = await bot.users.fetch(recipient.discordId);
      await user.send(personalizedMsg);

      log.recipients[i].status = 'sent';
      log.recipients[i].sentAt = new Date();
      log.sentCount++;
    } catch (err) {
      const code = err.code;
      log.recipients[i].status = code === 50007 ? 'dm_closed' : 'failed';
      log.recipients[i].errorMessage = err.message;
      log.failedCount++;
    }

    // Save progress every 10 messages
    if (i % 10 === 0) await log.save();

    // Rate limit delay
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  log.status = 'completed';
  log.completedAt = new Date();
  await log.save();
}

// ── Get Broadcast Logs for Guild ─────────────────────────────────
router.get('/logs/:guildId', authenticate, requirePlan, async (req, res) => {
  const { guildId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  const guild = await Guild.findOne({ guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const logs = await BroadcastLog
    .find({ guildId })
    .select('-recipients')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await BroadcastLog.countDocuments({ guildId });

  res.json({ logs, total, page, pages: Math.ceil(total / limit) });
});

// ── Get Single Broadcast Details ─────────────────────────────────
router.get('/logs/:guildId/:logId', authenticate, requirePlan, async (req, res) => {
  const { guildId, logId } = req.params;

  const guild = await Guild.findOne({ guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const log = await BroadcastLog.findOne({ _id: logId, guildId });
  if (!log) return res.status(404).json({ error: 'السجل غير موجود.' });

  res.json({ log });
});

export default router;
