import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Guild from '../models/Guild.js';

const router = express.Router();

// ── Get Available Plans ──────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'classic',
        name: 'كلاسيك',
        nameEn: 'Classic',
        price: 5,
        currency: 'USD',
        features: [
          '🎫 نظام تذاكر متكامل',
          '🎉 مسابقة واحدة نشطة',
          '📡 قناة Kick واحدة فقط',
          '📿 الأذكار التلقائية',
          '📢 الإذاعة الشاملة (لكل الأعضاء)',
          '🤖 البوت الرئيسي',
        ],
        notIncluded: [
          'مسابقات متعددة',
          'YouTube / Twitch / TikTok',
          'الإذاعة المستهدفة',
          'البوت المخصص',
        ],
      },
      {
        id: 'premium',
        name: 'بريميوم',
        nameEn: 'Premium',
        price: 15,
        currency: 'USD',
        popular: true,
        features: [
          '✅ كل مميزات الكلاسيك',
          '🎉 مسابقات لا محدودة',
          '📡 إضافة أكثر من قناة',
          '📡 YouTube / Twitch / TikTok / Kick',
          '📢 الإذاعة المستهدفة بمعرفات',
          '🤖 بوت مخصص (توكن خاص)',
          '📊 سجلات تفصيلية',
        ],
      },
    ],
  });
});

// ── Get Current Subscription ─────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const guildCount = await Guild.countDocuments({ ownerId: req.user._id });

  res.json({
    plan:       req.user.plan,
    hasPlan:    req.user.hasPlan(),
    isPremium:  req.user.isPremium(),
    expiresAt:  req.user.planExpiresAt,
    guildCount,
    daysRemaining: req.user.planExpiresAt
      ? Math.max(0, Math.ceil((req.user.planExpiresAt - new Date()) / (1000 * 60 * 60 * 24)))
      : null,
  });
});

// ── Request Plan Activation (placeholder for payment) ────────────
router.post('/upgrade', authenticate, async (req, res) => {
  res.json({
    message: 'يرجى التواصل مع الإدارة لتفعيل الباقة. سيتم إضافة بوابة الدفع قريباً.',
    contact: 'admin@example.com',
  });
});

export default router;
