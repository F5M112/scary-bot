import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import Guild from '../models/Guild.js';
import BroadcastLog from '../models/BroadcastLog.js';
import Ticket from '../models/Ticket.js';
import { stopBotsForUser, disconnectCustomBot } from '../bot/botManager.js';

const router = express.Router();

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// ── Dashboard Stats ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const [totalUsers, premiumUsers, classicUsers, bannedUsers, totalGuilds, activeGuilds, totalBroadcasts, totalTickets] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ plan: 'premium', role: 'user' }),
    User.countDocuments({ plan: 'classic', role: 'user' }),
    User.countDocuments({ isBanned: true }),
    Guild.countDocuments(),
    Guild.countDocuments({ enabled: true, adminDisabled: false }),
    BroadcastLog.countDocuments(),
    Ticket.countDocuments(),
  ]);

  res.json({
    users:      { total: totalUsers, premium: premiumUsers, classic: classicUsers, banned: bannedUsers },
    guilds:     { total: totalGuilds, active: activeGuilds },
    broadcasts: totalBroadcasts,
    tickets:    totalTickets,
  });
});

// ── Create New User Account ──────────────────────────────────────
router.post('/users', async (req, res) => {
  const { username, password, displayName, plan, planDuration } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان.' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'اسم المستخدم بين 3 و 30 حرف.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل.' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'اسم المستخدم يحتوي حروف لاتينية وأرقام وشرطات فقط.' });
  }

  const exists = await User.findOne({ username: username.toLowerCase() });
  if (exists) return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل.' });

  const user = new User({
    username:    username.toLowerCase().trim(),
    password,
    displayName: displayName || username,
    role:        'user',
    plan:        plan || 'none',
  });

  if (plan && plan !== 'none' && planDuration) {
    user.planExpiresAt = new Date(Date.now() + planDuration * 24 * 60 * 60 * 1000);
  }

  await user.save();
  res.status(201).json({ message: '✅ تم إنشاء الحساب.', user });
});

// ── List Users ───────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const page   = parseInt(req.query.page) || 1;
  const limit  = 20;
  const search = req.query.search || '';

  const filter = { role: 'user' };
  if (search) {
    filter.$or = [
      { username:        new RegExp(search, 'i') },
      { displayName:     new RegExp(search, 'i') },
      { discordUsername: new RegExp(search, 'i') },
    ];
  }

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const total = await User.countDocuments(filter);

  res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

// ── Get Single User ──────────────────────────────────────────────
router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  res.json({ user });
});

// ── Reset User Password ──────────────────────────────────────────
router.post('/users/:id/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل.' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  user.password = newPassword;
  await user.save();
  res.json({ message: '✅ تم تغيير كلمة المرور.' });
});

// ── Set User Plan (none / classic / premium) ─────────────────────
router.post('/users/:id/plan', async (req, res) => {
  const { plan, duration = 30 } = req.body;
  if (!['none', 'classic', 'premium'].includes(plan)) {
    return res.status(400).json({ error: 'الخطة يجب أن تكون none أو classic أو premium.' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  const previousPlan = user.plan;
  user.plan = plan;

  if (plan === 'none') {
    user.planExpiresAt = undefined;
    user._botToken = undefined;
  } else {
    user.planExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  }
  await user.save();

  // If demoted from premium → disconnect custom bots
  if (previousPlan === 'premium' && plan !== 'premium') {
    const customGuilds = await Guild.find({ ownerId: user._id, botMode: 'custom' });
    for (const g of customGuilds) {
      await disconnectCustomBot(g.guildId);
    }
  }

  if (plan === 'none') {
    await stopBotsForUser(user._id);
  }

  res.json({ message: `✅ تم تغيير الخطة إلى: ${plan}`, user });
});

// ── Update User (display name) ───────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  const { displayName } = req.body;
  if (displayName !== undefined) user.displayName = displayName;

  await user.save();
  res.json({ message: '✅ تم التحديث.', user });
});

// ── Ban / Unban User ─────────────────────────────────────────────
router.post('/users/:id/ban', async (req, res) => {
  const { reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  if (user.role === 'admin') return res.status(403).json({ error: 'لا يمكن حظر حساب الإدارة.' });

  user.isBanned = true;
  user.banReason = reason || 'بدون سبب';
  await user.save();
  await stopBotsForUser(user._id);

  res.json({ message: '✅ تم حظر المستخدم.', user });
});

router.post('/users/:id/unban', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  user.isBanned = false;
  user.banReason = undefined;
  await user.save();
  res.json({ message: '✅ تم إلغاء الحظر.', user });
});

// ── Disable / Enable User Account ────────────────────────────────
router.post('/users/:id/disable', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  if (user.role === 'admin') return res.status(403).json({ error: 'لا يمكن تعطيل حساب الإدارة.' });

  user.isDisabled = true;
  await user.save();
  await stopBotsForUser(user._id);

  res.json({ message: '✅ تم تعطيل الحساب.', user });
});

router.post('/users/:id/enable', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  user.isDisabled = false;
  await user.save();
  res.json({ message: '✅ تم تفعيل الحساب.', user });
});

// ── Delete User ──────────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  if (user.role === 'admin') return res.status(403).json({ error: 'لا يمكن حذف حساب الإدارة.' });

  await stopBotsForUser(user._id);
  await Guild.deleteMany({ ownerId: user._id });
  await user.deleteOne();

  res.json({ message: '✅ تم حذف الحساب.' });
});

// ── Force Enable/Disable Guild ───────────────────────────────────
router.post('/guilds/:guildId/force-disable', async (req, res) => {
  const { reason } = req.body;
  const guild = await Guild.findOne({ guildId: req.params.guildId });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  guild.adminDisabled = true;
  guild.adminDisabledReason = reason;
  guild.enabled = false;
  await guild.save();

  if (guild.botMode === 'custom') {
    await disconnectCustomBot(guild.guildId);
  }

  res.json({ message: '✅ تم إيقاف السيرفر بالقوة.', guild });
});

router.post('/guilds/:guildId/force-enable', async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  guild.adminDisabled = false;
  guild.adminDisabledReason = undefined;
  guild.enabled = true;
  await guild.save();

  res.json({ message: '✅ تم تفعيل السيرفر.', guild });
});

// ── List All Guilds ──────────────────────────────────────────────
router.get('/guilds', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const guilds = await Guild.find()
    .populate('ownerId', 'username displayName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const total = await Guild.countDocuments();
  res.json({ guilds, total, page, pages: Math.ceil(total / limit) });
});

// ── Monitor All Broadcast Logs ───────────────────────────────────
router.get('/broadcasts', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const logs = await BroadcastLog.find()
    .select('-recipients')
    .populate('sentBy', 'username displayName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const total = await BroadcastLog.countDocuments();
  res.json({ logs, total, page, pages: Math.ceil(total / limit) });
});

router.get('/broadcasts/:logId', async (req, res) => {
  const log = await BroadcastLog.findById(req.params.logId);
  if (!log) return res.status(404).json({ error: 'السجل غير موجود.' });
  res.json({ log });
});

export default router;
