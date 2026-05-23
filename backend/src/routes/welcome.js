import express from 'express';
import { authenticate, requirePlan } from '../middleware/auth.js';
import Welcome from '../models/Welcome.js';
import Guild from '../models/Guild.js';
import { getBotForGuild } from '../bot/botManager.js';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const router = express.Router();

// ── Generate card ─────────────────────────────────────────────────
async function generateCard(welcome, guildName, memberCount, avatarURL) {
  const W = welcome.cardWidth  || 700;
  const H = welcome.cardHeight || 250;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Background
  if (welcome.cardBackground) {
    try {
      const bg = await loadImage(welcome.cardBackground);
      ctx.drawImage(bg, 0, 0, W, H);
    } catch { drawBg(ctx, W, H); }
  } else { drawBg(ctx, W, H); }

  // Overlay
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  const ax = welcome.avatarX      || 125;
  const ay = welcome.avatarY      || 125;
  const ar = welcome.avatarRadius || 70;
  const bw = welcome.avatarBorderWidth || 5;

  // Avatar
  if (welcome.cardShowAvatar && avatarURL) {
    try {
      const avatar = await loadImage(avatarURL);
      ctx.save();
      ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI*2);
      ctx.closePath(); ctx.clip();
      ctx.drawImage(avatar, ax-ar, ay-ar, ar*2, ar*2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(ax, ay, ar+bw, 0, Math.PI*2);
      ctx.strokeStyle = welcome.avatarBorderColor || '#dc2626';
      ctx.lineWidth = bw; ctx.stroke();
    } catch {}
  }

  const tx = welcome.textX || 230;

  if (welcome.cardShowText && welcome.cardText) {
    ctx.font = `${welcome.cardTextSize||24}px Arial`;
    ctx.fillStyle = welcome.cardTextColor || '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(welcome.cardText, tx, welcome.cardTextY || 90);
  }
  if (welcome.cardShowServerName !== false) {
    ctx.font = `bold ${welcome.serverNameSize||28}px Arial`;
    ctx.fillStyle = welcome.serverNameColor || '#dc2626';
    ctx.textAlign = 'left';
    ctx.fillText(guildName, tx, welcome.serverNameY || 125);
  }
  if (welcome.cardShowUsername) {
    ctx.font = `${welcome.usernameSize||22}px Arial`;
    ctx.fillStyle = welcome.usernameColor || '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(avatarURL === 'https://cdn.discordapp.com/embed/avatars/0.png' ? 'TestUser#0000' : 'Username#0000', tx, welcome.usernameY || 160);
  }
  if (welcome.cardShowCount !== false) {
    ctx.font = `${welcome.countSize||16}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(`Member #${memberCount}`, tx, welcome.countY || 190);
  }

  return canvas.toBuffer('image/png');
}

function drawBg(ctx, W, H) {
  const g = ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#1a0505'); g.addColorStop(1,'#2d0a0a');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}

// ── Get ───────────────────────────────────────────────────────────
router.get('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  const welcome = await Welcome.findOne({ guildId: req.params.guildId });
  res.json({ welcome: welcome || null });
});

// ── Save ──────────────────────────────────────────────────────────
router.post('/:guildId', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const b = req.body;
  if (!b.channelId && !b.sendAsDM) return res.status(400).json({ error: 'قناة الترحيب مطلوبة أو فعّل DM.' });

  const welcome = await Welcome.findOneAndUpdate(
    { guildId: req.params.guildId },
    {
      guildId: req.params.guildId, ownerId: req.user._id,
      enabled:           b.enabled !== false,
      channelId:         b.channelId         || '',
      sendAsDM:          !!b.sendAsDM,
      message:           b.message           || 'مرحباً {user}! 🎉',
      embedEnabled:      !!b.embedEnabled,
      embedColor:        b.embedColor         || '#dc2626',
      embedTitle:        b.embedTitle         || 'أهلاً! 👋',
      embedDescription:  b.embedDescription   || '',
      embedFooter:       b.embedFooter        || '',
      embedThumbnail:    !!b.embedThumbnail,
      embedImage:        !!b.embedImage,
      contentImage:      !!b.contentImage,
      trackInvites:      b.trackInvites !== false,
      cardEnabled:       !!b.cardEnabled,
      cardBackground:    b.cardBackground     || '',
      cardShowAvatar:    b.cardShowAvatar    !== false,
      cardShowUsername:  b.cardShowUsername  !== false,
      cardShowText:      b.cardShowText      !== false,
      cardShowServerName:b.cardShowServerName !== false,
      cardShowCount:     b.cardShowCount     !== false,
      cardText:          b.cardText           || 'welcome to',
      cardTextColor:     b.cardTextColor      || '#ffffff',
      cardTextSize:      b.cardTextSize       || 24,
      cardPosition:      b.cardPosition       || 'before',
      cardChannelId:     b.cardChannelId      || '',
      cardWidth:         b.cardWidth          || 700,
      cardHeight:        b.cardHeight         || 250,
      avatarX:           b.avatarX            || 125,
      avatarY:           b.avatarY            || 125,
      avatarRadius:      b.avatarRadius        || 70,
      avatarBorderColor: b.avatarBorderColor  || '#dc2626',
      avatarBorderWidth: b.avatarBorderWidth  || 5,
      textX:             b.textX              || 230,
      cardTextY:         b.cardTextY          || 90,
      serverNameY:       b.serverNameY        || 125,
      serverNameColor:   b.serverNameColor    || '#dc2626',
      serverNameSize:    b.serverNameSize     || 28,
      usernameY:         b.usernameY          || 160,
      usernameColor:     b.usernameColor      || '#ffffff',
      usernameSize:      b.usernameSize       || 22,
      countY:            b.countY             || 190,
      countSize:         b.countSize          || 16,
    },
    { upsert: true, new: true }
  );

  res.json({ welcome, message: '✅ تم حفظ إعدادات الترحيب.' });
});

// ── Test ──────────────────────────────────────────────────────────
router.post('/:guildId/test', authenticate, requirePlan, async (req, res) => {
  const guild = await Guild.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  const welcome = await Welcome.findOne({ guildId: req.params.guildId });
  if (!welcome) return res.status(404).json({ error: 'لم يتم إعداد الترحيب بعد.' });
  const bot = getBotForGuild(req.params.guildId);
  if (!bot) return res.status(400).json({ error: 'البوت غير متصل.' });

  try {
    const discordGuild = await bot.guilds.fetch(req.params.guildId);
    const memberCount  = discordGuild.memberCount;
    const DEMO_AVATAR  = 'https://cdn.discordapp.com/embed/avatars/0.png';

    const render = (t) => (t||'')
      .replace(/\{user\}/g,    '<@123456789>')
      .replace(/\{username\}/g,'TestUser')
      .replace(/\{server\}/g,  discordGuild.name)
      .replace(/\{count\}/g,   memberCount.toString())
      .replace(/\{inviter\}/g, 'شخص ما')
      .replace(/\{invite\}/g,  'discord.gg/test');

    const files = [];

    if (welcome.cardEnabled) {
      try {
        const buf = await generateCard(welcome, discordGuild.name, memberCount, DEMO_AVATAR);
        files.push(new AttachmentBuilder(buf, { name: 'welcome.png' }));
      } catch (err) { console.warn('[welcome test] card error:', err.message); }
    } else if (welcome.contentImage) {
      files.push({ attachment: DEMO_AVATAR, name: 'avatar.png' });
    }

    let embed = null;
    if (welcome.embedEnabled) {
      embed = new EmbedBuilder().setColor(welcome.embedColor).setTimestamp();
      if (welcome.embedTitle)       embed.setTitle(render(welcome.embedTitle));
      if (welcome.embedDescription) embed.setDescription(render(welcome.embedDescription));
      if (welcome.embedFooter)      embed.setFooter({ text: render(welcome.embedFooter) });
      if (welcome.embedThumbnail)   embed.setThumbnail(DEMO_AVATAR);
      if (welcome.embedImage)       embed.setImage(DEMO_AVATAR);
    }

    if (welcome.sendAsDM) return res.json({ message: '✅ سيتم إرسال DM عند انضمام العضو.' });

    const channel = await bot.channels.fetch(welcome.channelId);

    if (welcome.cardEnabled && welcome.cardPosition === 'before' && files.length > 0) {
      await channel.send({ files });
      await channel.send({ content: render(welcome.message)||undefined, embeds: embed?[embed]:[] });
    } else {
      await channel.send({ content: render(welcome.message)||undefined, embeds: embed?[embed]:[], files });
    }

    res.json({ message: '✅ تم إرسال رسالة تجريبية.' });
  } catch (err) {
    res.status(400).json({ error: 'فشل الإرسال: ' + err.message });
  }
});

// ── Delete ────────────────────────────────────────────────────────
router.delete('/:guildId', authenticate, requirePlan, async (req, res) => {
  await Welcome.deleteOne({ guildId: req.params.guildId });
  res.json({ message: '✅ تم حذف إعدادات الترحيب.' });
});

export default router;
