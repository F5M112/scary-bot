import express from 'express';
import { authenticate, requirePremium } from '../middleware/auth.js';
import Guild from '../models/Guild.js';
import { connectCustomBot, disconnectCustomBot, getBotForGuild } from '../bot/botManager.js';

const router = express.Router();

// ── Set Custom Bot Token (Premium Only) ──────────────────────────
router.post('/token', authenticate, requirePremium, async (req, res) => {
  const { guildId, token } = req.body;

  if (!guildId || !token) {
    return res.status(400).json({ error: 'guildId والتوكن مطلوبان.' });
  }

  // Validate token format (basic check)
  if (!/^[A-Za-z0-9_.-]{50,100}$/.test(token)) {
    return res.status(400).json({ error: 'تنسيق التوكن غير صالح.' });
  }

  const guild = await Guild.findOne({ guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  try {
    // Try connecting with the new token
    const botInfo = await connectCustomBot(guildId, token);

    // Encrypt and save token to user
    req.user.botToken = token;
    await req.user.save();

    guild.botMode = 'custom';
    await guild.save();

    res.json({
      message: '✅ تم ربط البوت المخصص بنجاح.',
      bot: botInfo,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'فشل الاتصال بالبوت.' });
  }
});

// ── Remove Custom Bot Token ──────────────────────────────────────
router.delete('/token/:guildId', authenticate, requirePremium, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  await disconnectCustomBot(req.params.guildId);

  req.user.botToken = null;
  await req.user.save();

  res.json({ message: 'تم إزالة البوت المخصص. سيتم استخدام البوت الرئيسي.' });
});

// ── Get Bot Status ───────────────────────────────────────────────
router.get('/status/:guildId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const bot = getBotForGuild(req.params.guildId);
  res.json({
    online: !!bot && bot.isReady?.(),
    mode: guild.botMode,
    enabled: guild.isOperational(),
    botUser: bot?.user ? { tag: bot.user.tag, id: bot.user.id } : null,
  });
});

export default router;
