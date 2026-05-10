import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import authRoutes, { ensureAdminExists } from './routes/auth.js';
import guildRoutes from './routes/guilds.js';
import ticketRoutes from './routes/tickets.js';
import broadcastRoutes from './routes/broadcast.js';
import botRoutes from './routes/bot.js';
import adminRoutes from './routes/admin.js';
import subscriptionRoutes from './routes/subscription.js';
import socialRoutes from './routes/social.js';
import adhkarRoutes from './routes/adhkar.js';
import giveawayRoutes from './routes/giveaway.js';

import { startPlatformBot } from './bot/platformBot.js';
import { startSocialMonitor } from './services/socialMonitor.js';
import { startAdhkarScheduler } from './services/adhkarScheduler.js';
import { startGiveawayScheduler } from './services/giveawayScheduler.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const isDev = process.env.NODE_ENV !== 'production';

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// Trust Render's proxy (required for rate limiting and real IPs)
app.set('trust proxy', 1);

app.use(express.json({ limit: '10kb' }));

// ── Rate Limit (relaxed in development) ─────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 300,                // 5000 reqs/15min in dev, 300 in prod
  message: { error: 'طلبات كثيرة جداً، حاول لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for some safe endpoints
  skip: (req) => {
    if (isDev) return false;              // Dev: apply to all
    return req.path === '/health' || req.path === '/auth/me';
  },
});

// Stricter limit for login (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  message: { error: 'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة.' },
});

app.use(globalLimiter);
app.use('/auth/login', loginLimiter);

// ── Routes ───────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/guilds', guildRoutes);
app.use('/tickets', ticketRoutes);
app.use('/broadcast', broadcastRoutes);
app.use('/bot', botRoutes);
app.use('/admin', adminRoutes);
app.use('/subscription', subscriptionRoutes);
app.use('/social', socialRoutes);
app.use('/adhkar', adhkarRoutes);
app.use('/giveaway', giveawayRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use(errorHandler);

// ── Database & Start ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ تم الاتصال بقاعدة البيانات');
    await ensureAdminExists();
    await startPlatformBot();
    startSocialMonitor();
    startAdhkarScheduler();
    startGiveawayScheduler();
    app.listen(PORT, () => {
      console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
      if (isDev) console.log(`💡 Dev mode: rate limiting relaxed (5000 req / 15 min)`);
    });
  })
  .catch(err => {
    console.error('❌ خطأ في الاتصال:', err.message);
    process.exit(1);
  });

export default app;
