import express from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Guild from '../models/Guild.js';

const router = express.Router();

const MF_BASE = process.env.MYFATOORAH_BASE_URL || 'https://api.myfatoorah.com';
const MF_KEY  = process.env.MYFATOORAH_API_KEY;

const mf = axios.create({
  baseURL: MF_BASE,
  headers: {
    Authorization: `Bearer ${MF_KEY}`,
    'Content-Type': 'application/json',
  },
});

const PLANS = {
  classic: {
    id:       'classic',
    name:     'كلاسيك',
    nameEn:   'Classic',
    price:    37.52,
    currency: 'SAR',
    days:     30,
    features: [
      'نظام تذاكر متكامل',
      'مسابقة واحدة نشطة',
      'الأذكار التلقائية',
      'نظام الترحيب',
      'الإذاعة الشاملة',
      'البوت الرئيسي',
    ],
    notIncluded: [
      'مسابقات متعددة',
      'الإذاعة المستهدفة',
      'البوت المخصص',
    ],
  },
  premium: {
    id:       'premium',
    name:     'بريميوم',
    nameEn:   'Premium',
    price:    93.81,
    currency: 'SAR',
    days:     30,
    popular:  true,
    features: [
      'كل مميزات الكلاسيك',
      'مسابقات لا محدودة',
      'الإذاعة المستهدفة بمعرفات',
      'بوت مخصص (توكن خاص)',
      'سجلات تفصيلية',
    ],
  },
};

// ── Get Plans ─────────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

// ── Get Current Subscription ──────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const guildCount = await Guild.countDocuments({ ownerId: req.user._id });
  res.json({
    plan:          req.user.plan,
    hasPlan:       req.user.hasPlan(),
    isPremium:     req.user.isPremium(),
    expiresAt:     req.user.planExpiresAt,
    guildCount,
    daysRemaining: req.user.planExpiresAt
      ? Math.max(0, Math.ceil((req.user.planExpiresAt - new Date()) / (1000 * 60 * 60 * 24)))
      : null,
  });
});

// ── Create Payment (MyFatoorah) ───────────────────────────────────
router.post('/checkout', authenticate, async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: 'الباقة غير موجودة.' });

  const FRONTEND = process.env.FRONTEND_URL;

  try {
    const { data } = await mf.post('/v2/SendPayment', {
      CustomerName:           req.user.username || 'ST Bot User',
      NotificationOption:     'LNK',
      InvoiceValue:           plan.price,
      DisplayCurrencyIso:     plan.currency,
      CallBackUrl:            `${FRONTEND}/dashboard/subscription?payment=success&plan=${planId}`,
      ErrorUrl:               `${FRONTEND}/dashboard/subscription?payment=failed`,
      Language:               'ar',
      CustomerReference:      `${req.user._id}_${planId}_${Date.now()}`,
      InvoiceItems: [{
        ItemName:   `${plan.nameEn} Plan - ST Bot`,
        Quantity:   1,
        UnitPrice:  plan.price,
      }],
    });

    res.json({
      paymentUrl: data.Data.InvoiceURL,
      invoiceId:  data.Data.InvoiceId,
    });
  } catch (err) {
    console.error('[MyFatoorah]', err.response?.data || err.message);
    res.status(500).json({ error: 'فشل إنشاء رابط الدفع. حاول لاحقاً.' });
  }
});

// ── Verify Payment (webhook / callback) ──────────────────────────
router.post('/verify', authenticate, async (req, res) => {
  const { paymentId, planId } = req.body;
  if (!paymentId || !planId) return res.status(400).json({ error: 'بيانات ناقصة.' });

  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: 'الباقة غير موجودة.' });

  try {
    const { data } = await mf.post('/v2/GetPaymentStatus', {
      Key:     paymentId,
      KeyType: 'PaymentId',
    });

    const status = data.Data.InvoiceStatus;
    if (status !== 'Paid') {
      return res.status(400).json({ error: 'لم يتم الدفع بعد.', status });
    }

    // Activate plan
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.days);

    await User.findByIdAndUpdate(req.user._id, {
      plan:          planId,
      planExpiresAt: expiresAt,
    });

    console.log(`[Payment] ✅ ${req.user.username} → ${planId} حتى ${expiresAt.toLocaleDateString()}`);

    res.json({
      success:   true,
      plan:      planId,
      expiresAt,
      message:   `✅ تم تفعيل باقة ${plan.name} حتى ${expiresAt.toLocaleDateString('ar-SA')}`,
    });
  } catch (err) {
    console.error('[MyFatoorah verify]', err.response?.data || err.message);
    res.status(500).json({ error: 'فشل التحقق من الدفع.' });
  }
});

// ── MyFatoorah Webhook ────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    const { id } = req.query; // MyFatoorah sends ?id=paymentId
    if (!id) return res.status(400).send('No ID');

    const { data } = await mf.post('/v2/GetPaymentStatus', {
      Key:     id,
      KeyType: 'PaymentId',
    });

    if (data.Data.InvoiceStatus !== 'Paid') return res.status(200).send('Not paid');

    const ref = data.Data.CustomerReference || '';
    const [userId, planId] = ref.split('_');
    if (!userId || !planId || !PLANS[planId]) return res.status(200).send('Invalid ref');

    const plan = PLANS[planId];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.days);

    await User.findByIdAndUpdate(userId, {
      plan:          planId,
      planExpiresAt: expiresAt,
    });

    console.log(`[Webhook] ✅ User ${userId} → ${planId}`);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Webhook]', err.message);
    res.status(500).send('Error');
  }
});

export default router;
