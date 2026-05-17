import express from 'express';
import { authenticate, requirePlan } from '../middleware/auth.js';
import Welcome from '../models/Welcome.js';
import Guild from '../models/Guild.js';
import { getBotForGuild } from '../bot/botManager.js';
import { EmbedBuilder } from 'discord.js';

const router = express.Router();

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

  const {
    enabled, channelId, sendAsDM, message,
    embedEnabled, embedColor, embedTitle, embedDescription, embedFooter,
    embedThumbnail, embedImage, contentImage, trackInvites,
    cardEnabled, cardBackground, cardShowAvatar, cardShowUsername,
    cardShowText, cardText, cardTextColor, cardPosition, cardChannelId,
  } = req.body;

  if (!channelId && !sendAsDM) return res.status(400).json({ error: 'قناة الترحيب مطلوبة أو فعّل الإرسال كـ DM.' });

  const welcome = await Welcome.findOneAndUpdate(
    { guildId: req.params.guildId },
    {
      guildId: req.params.guildId,
      ownerId: req.user._id,
      enabled:          enabled !== false,
      channelId:        channelId || '',
      sendAsDM:         !!sendAsDM,
      message:          message || 'مرحباً {user}! 🎉',
      embedEnabled:     !!embedEnabled,
      embedColor:       embedColor || '#dc2626',
      embedTitle:       embedTitle || 'أهلاً وسهلاً! 👋',
      embedDescription: embedDescription || 'مرحباً {user} في **{server}**!\nأنت العضو رقم **{count}**',
      embedFooter:      embedFooter || '',
      embedThumbnail:   !!embedThumbnail,
      embedImage:       !!embedImage,
      contentImage:     !!contentImage,
      trackInvites:     trackInvites !== false,
      cardEnabled:      !!cardEnabled,
      cardBackground:   cardBackground || '',
      cardShowAvatar:   cardShowAvatar !== false,
      cardShowUsername: cardShowUsername !== false,
      cardShowText:     cardShowText !== false,
      cardText:         cardText || 'welcome to',
      cardTextColor:    cardTextColor || '#ffffff',
      cardPosition:     cardPosition || 'before',
      cardChannelId:    cardChannelId || '',
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

    const render = (t) => (t || '')
      .replace(/\{user\}/g,     '<@123456789>')
      .replace(/\{username\}/g, 'TestUser')
      .replace(/\{server\}/g,   discordGuild.name)
      .replace(/\{count\}/g,    memberCount.toString())
      .replace(/\{inviter\}/g,  'شخص ما')
      .replace(/\{invite\}/g,   'discord.gg/test');

    const sendMessage = async (channel) => {
      const files = welcome.contentImage ? [{ attachment: DEMO_AVATAR, name: 'avatar.png' }] : [];

      if (welcome.embedEnabled) {
        const embed = new EmbedBuilder()
          .setColor(welcome.embedColor)
          .setTimestamp();
        if (welcome.embedTitle)       embed.setTitle(render(welcome.embedTitle));
        if (welcome.embedDescription) embed.setDescription(render(welcome.embedDescription));
        if (welcome.embedFooter)      embed.setFooter({ text: render(welcome.embedFooter) });
        if (welcome.embedThumbnail)   embed.setThumbnail(DEMO_AVATAR);
        if (welcome.embedImage)       embed.setImage(DEMO_AVATAR);
        await channel.send({ content: render(welcome.message) || undefined, embeds: [embed], files });
      } else {
        await channel.send({ content: render(welcome.message), files });
      }
    };

    if (welcome.sendAsDM) {
      // Send DM to bot owner as test
      const owner = await bot.users.fetch('123456789').catch(() => null);
      return res.json({ message: '✅ سيتم إرسال DM للعضو عند انضمامه.' });
    }

    const channel = await bot.channels.fetch(welcome.channelId);
    await sendMessage(channel);
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
