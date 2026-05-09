import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_SCOPES = 'identify guilds';

// ── Auto-create the default admin on startup ─────────────────────
export async function ensureAdminExists() {
  const adminUsername = 'admin';
  const adminPassword = 'admin702';

  const existing = await User.findOne({ username: adminUsername });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log('🔧 تم تحديث صلاحية حساب admin');
    }
    return;
  }

  const admin = new User({
    username:    adminUsername,
    password:    adminPassword,
    displayName: 'مدير النظام',
    role:        'admin',
    plan:        'premium',
  });
  await admin.save();
  console.log('✅ تم إنشاء حساب الإدارة الافتراضي (admin / admin702)');
}

// ── Login ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة.' });
  }

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });

  const ok = await user.comparePassword(password);
  if (!ok) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });

  if (user.isBanned)   return res.status(403).json({ error: 'حسابك محظور.' });
  if (user.isDisabled) return res.status(403).json({ error: 'حسابك معطل. تواصل مع الدعم.' });

  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    message: '✅ تم تسجيل الدخول بنجاح.',
    token,
    user: {
      id:               user._id,
      username:         user.username,
      displayName:      user.displayName,
      role:             user.role,
      plan:             user.plan,
      hasPlan:          user.hasPlan(),
      isPremium:        user.isPremium(),
      isDiscordLinked:  user.isDiscordLinked(),
      discordUsername:  user.discordUsername,
      discordAvatar:    user.discordAvatar,
      discordId:        user.discordId,
    },
  });
});

// ── Get Current User ─────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id:               req.user._id,
      username:         req.user.username,
      displayName:      req.user.displayName,
      role:             req.user.role,
      plan:             req.user.plan,
      hasPlan:          req.user.hasPlan(),
      isPremium:        req.user.isPremium(),
      planExpiresAt:    req.user.planExpiresAt,
      isDiscordLinked:  req.user.isDiscordLinked(),
      discordUsername:  req.user.discordUsername,
      discordAvatar:    req.user.discordAvatar,
      discordId:        req.user.discordId,
    },
  });
});

// ── Change Own Password ──────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبة.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة 6 أحرف على الأقل.' });
  }

  const ok = await req.user.comparePassword(currentPassword);
  if (!ok) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة.' });

  req.user.password = newPassword;
  await req.user.save();
  res.json({ message: '✅ تم تغيير كلمة المرور.' });
});

// ── Logout ───────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  res.json({ message: 'تم تسجيل الخروج.' });
});

// ═════════════════════════════════════════════════════════════════
// Discord LINK FLOW — link an existing logged-in account to Discord
// ═════════════════════════════════════════════════════════════════

// Step 1: redirect to Discord with a state token (containing user ID)
router.get('/discord/link', authenticate, (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: 'لم يتم تكوين Discord OAuth في السيرفر.' });
  }

  // Encode user ID in state to verify on callback
  const state = jwt.sign(
    { userId: req.user._id.toString(), action: 'link' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope:         DISCORD_SCOPES,
    state,
    prompt:        'consent',
  });

  res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` });
});

// Step 2: callback from Discord
router.get('/discord/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const FRONTEND = process.env.FRONTEND_URL;

  if (oauthError) {
    return res.redirect(`${FRONTEND}/dashboard?discord_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return res.redirect(`${FRONTEND}/dashboard?discord_error=missing_params`);
  }

  let payload;
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return res.redirect(`${FRONTEND}/dashboard?discord_error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(`${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Fetch Discord user info
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const discordUser = userRes.data;

    // Check that this Discord ID isn't linked to another account
    const existing = await User.findOne({
      discordId: discordUser.id,
      _id: { $ne: payload.userId },
    });
    if (existing) {
      return res.redirect(`${FRONTEND}/dashboard?discord_error=already_linked`);
    }

    // Update user with Discord info
    const user = await User.findById(payload.userId);
    if (!user) return res.redirect(`${FRONTEND}/login?error=user_not_found`);

    user.discordId           = discordUser.id;
    user.discordUsername     = discordUser.username;
    user.discordAvatar       = discordUser.avatar;
    user.discordAccessToken  = access_token;
    user.discordRefreshToken = refresh_token;
    user.discordTokenExpires = new Date(Date.now() + expires_in * 1000);
    await user.save();

    res.redirect(`${FRONTEND}/dashboard?discord_linked=1`);
  } catch (err) {
    console.error('Discord OAuth error:', err.response?.data || err.message);
    res.redirect(`${FRONTEND}/dashboard?discord_error=oauth_failed`);
  }
});

// Step 3: unlink Discord
router.post('/discord/unlink', authenticate, async (req, res) => {
  req.user.discordId = undefined;
  req.user.discordUsername = undefined;
  req.user.discordAvatar = undefined;
  req.user.discordAccessToken = undefined;
  req.user.discordRefreshToken = undefined;
  req.user.discordTokenExpires = undefined;
  await req.user.save();
  res.json({ message: '✅ تم فصل حساب ديسكورد.' });
});

// Step 4: fetch user's manageable Discord guilds (admin/owner)
router.get('/discord/guilds', authenticate, async (req, res) => {
  if (!req.user.discordAccessToken) {
    return res.status(400).json({ error: 'الرجاء ربط حساب ديسكورد أولاً.' });
  }

  try {
    const guildsRes = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${req.user.discordAccessToken}` },
    });

    const MANAGE_GUILD = 0x20n;
    const adminGuilds = guildsRes.data.filter((g) => {
      try {
        const perms = BigInt(g.permissions || 0);
        return g.owner || (perms & MANAGE_GUILD) !== 0n;
      } catch { return g.owner; }
    });

    res.json({ guilds: adminGuilds });
  } catch (err) {
    console.error('Fetch guilds error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      // Token expired — clear it and return empty list (user will re-link)
      req.user.discordAccessToken  = undefined;
      req.user.discordRefreshToken = undefined;
      await req.user.save().catch(() => {});
      return res.json({ guilds: [], tokenExpired: true });
    }
    res.json({ guilds: [] });
  }
});

export default router;
