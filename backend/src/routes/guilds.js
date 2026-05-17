import express from 'express';
import { authenticate, requirePlan } from '../middleware/auth.js';
import Guild from '../models/Guild.js';

const router = express.Router();

// ── Get All User's Registered Guilds ─────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const guilds = await Guild.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ guilds });
  } catch (err) {
    console.error('[guilds list] Error:', err.message);
    res.status(500).json({ error: 'فشل في جلب السيرفرات.' });
  }
});

// ── Register a Discord Guild (user picks from their list) ────────
router.post('/register', authenticate, requirePlan, async (req, res) => {
  try {
    const { guildId, guildName, guildIcon } = req.body;

    if (!guildId || !/^\d{17,20}$/.test(guildId)) {
      return res.status(400).json({ error: 'معرف السيرفر غير صالح.' });
    }
    if (!req.user.isDiscordLinked()) {
      return res.status(403).json({ error: 'الرجاء ربط حساب ديسكورد أولاً.' });
    }

    // Check if already registered
    const existing = await Guild.findOne({ guildId });
    if (existing) {
      // SAFE check: handle null/undefined ownerId from old data
      const sameOwner = existing.ownerId &&
                        existing.ownerId.toString() === req.user._id.toString();

      if (sameOwner) {
        return res.json({ guild: existing, message: 'السيرفر مسجل مسبقاً.' });
      }

      // If owner is missing/null OR a different user, claim it for current user
      // (This auto-fixes orphan records from old data)
      if (!existing.ownerId) {
        existing.ownerId = req.user._id;
        existing.guildName = guildName || existing.guildName;
        existing.guildIcon = guildIcon || existing.guildIcon;
        existing.plan = req.user.plan === 'premium' ? 'premium' : 'classic';
        existing.enabled = true;
        await existing.save();
        return res.json({ guild: existing, message: '✅ تم تسجيل السيرفر.' });
      }

      return res.status(403).json({ error: 'هذا السيرفر مسجل لمستخدم آخر.' });
    }

    // Plan limits
    const userGuildCount = await Guild.countDocuments({ ownerId: req.user._id });
    const maxGuilds = req.user.plan === 'premium' ? 5 : 1;
    if (userGuildCount >= maxGuilds) {
      return res.status(403).json({
        error: `الحد الأقصى لباقتك ${maxGuilds} سيرفر.`,
      });
    }

    const guild = await Guild.create({
      guildId,
      guildName: guildName || `Server ${guildId.slice(-6)}`,
      guildIcon,
      ownerId:   req.user._id,
      plan:      req.user.plan === 'premium' ? 'premium' : 'classic',
      enabled:   true,
    });

    res.status(201).json({ guild, message: '✅ تم تسجيل السيرفر.' });
  } catch (err) {
    console.error('[guilds register] Error:', err.message);
    res.status(500).json({ error: 'فشل التسجيل: ' + err.message });
  }
});

// ── Get Single Guild ─────────────────────────────────────────────
router.get('/:guildId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  res.json({ guild });
});

// ── Toggle Guild On/Off ──────────────────────────────────────────
router.post('/:guildId/toggle', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  if (guild.adminDisabled) {
    return res.status(403).json({ error: 'هذا السيرفر معطل من قبل الإدارة.' });
  }

  guild.enabled = !guild.enabled;
  await guild.save();

  res.json({
    enabled: guild.enabled,
    message: guild.enabled ? '✅ تم تفعيل البوت.' : '🛑 تم إيقاف البوت.',
  });
});

// ── Update Guild Settings ────────────────────────────────────────
router.patch('/:guildId/settings', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const allowed = ['transcriptChannelId', 'logChannelId', 'staffRoles'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) guild[field] = req.body[field];
  }
  await guild.save();
  res.json({ guild, message: 'تم تحديث الإعدادات.' });
});

// ── Unregister Guild ─────────────────────────────────────────────
router.delete('/:guildId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  await guild.deleteOne();
  res.json({ message: '✅ تم إزالة السيرفر من حسابك.' });
});

// ── Get Discord Channels ──────────────────────────────────────────
router.get('/:guildId/channels', authenticate, requirePlan, async (req, res) => {
  try {
    const { getBotForGuild } = await import('../bot/botManager.js');
    const bot = getBotForGuild(req.params.guildId);
    if (!bot) return res.json({ channels: [] });
    const discordGuild = await bot.guilds.fetch(req.params.guildId).catch(() => null);
    if (!discordGuild) return res.json({ channels: [] });
    await discordGuild.channels.fetch();
    const channels = discordGuild.channels.cache
      .filter(c => c.type === 0)
      .map(c => ({ id: c.id, name: c.name, type: 'text' }));
    res.json({ channels });
  } catch { res.json({ channels: [] }); }
});

// ── Get Discord Roles ─────────────────────────────────────────────
router.get('/:guildId/roles', authenticate, requirePlan, async (req, res) => {
  try {
    const { getBotForGuild } = await import('../bot/botManager.js');
    const bot = getBotForGuild(req.params.guildId);
    if (!bot) return res.json({ roles: [] });
    const discordGuild = await bot.guilds.fetch(req.params.guildId).catch(() => null);
    if (!discordGuild) return res.json({ roles: [] });
    await discordGuild.roles.fetch();
    const roles = discordGuild.roles.cache
      .filter(r => r.id !== discordGuild.id)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
    res.json({ roles });
  } catch { res.json({ roles: [] }); }
});

export default router;
