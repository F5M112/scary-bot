import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ── Standard JWT Auth ────────────────────────────────────────────
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'غير مصرح. يرجى تسجيل الدخول.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود.' });
    if (user.isBanned) return res.status(403).json({ error: 'حسابك محظور.' });
    if (user.isDisabled) return res.status(403).json({ error: 'حسابك معطل. تواصل مع الدعم.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.' });
    }
    return res.status(401).json({ error: 'توكن غير صالح.' });
  }
};

// ── Require Active Plan ──────────────────────────────────────────
export const requirePlan = (req, res, next) => {
  if (!req.user.hasPlan()) {
    return res.status(403).json({
      error: 'لا توجد لديك باقة نشطة. تواصل مع الإدارة لتفعيل حسابك.',
      planRequired: true,
      currentPlan: req.user.plan,
    });
  }
  next();
};

// ── Require Premium Plan ─────────────────────────────────────────
export const requirePremium = (req, res, next) => {
  if (req.user.role !== 'admin' && !req.user.isPremium()) {
    return res.status(403).json({
      error: 'هذه الميزة متاحة لمشتركي الباقة المميزة فقط.',
      upgradeRequired: true,
      currentPlan: req.user.plan,
    });
  }
  next();
};

// ── Require Admin Role ───────────────────────────────────────────
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'وصول مرفوض. هذه الصفحة للإدارة فقط.' });
  }
  next();
};
