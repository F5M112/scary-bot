import express from 'express';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { authenticate } from '../middleware/auth.js';
import Guild from '../models/Guild.js';
import Ticket from '../models/Ticket.js';
import { getBotForGuild } from '../bot/botManager.js';

const router = express.Router();

// Map UI style names → Discord.js ButtonStyle
const STYLE_MAP = {
  primary:   ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success:   ButtonStyle.Success,
  danger:    ButtonStyle.Danger,
};

// Parse emoji string: native (📩) or custom (<:name:id> or name:id)
function parseEmoji(emojiStr) {
  if (!emojiStr) return undefined;
  const customMatch = emojiStr.match(/<?a?:?(\w+):(\d+)>?/);
  if (customMatch) {
    return { name: customMatch[1], id: customMatch[2], animated: emojiStr.startsWith('<a:') };
  }
  return { name: emojiStr };
}

// Build Discord components from panel options
function buildPanelComponents(panel) {
  const opts = panel.options || [];
  if (opts.length === 0) return [];

  if (panel.type === 'dropdown') {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`ticket_select:${panel._id}`)
      .setPlaceholder(panel.placeholder || 'اختر فئة التذكرة...')
      .setMinValues(1)
      .setMaxValues(1);

    opts.forEach((opt) => {
      const o = new StringSelectMenuOptionBuilder()
        .setLabel(opt.label.slice(0, 100))
        .setValue(opt._id.toString());
      if (opt.description) o.setDescription(opt.description.slice(0, 100));
      const e = parseEmoji(opt.emoji);
      if (e) o.setEmoji(e);
      select.addOptions(o);
    });

    return [new ActionRowBuilder().addComponents(select)];
  }

  // Button mode — chunk into rows of 5 (Discord limit)
  const rows = [];
  for (let i = 0; i < opts.length; i += 5) {
    const row = new ActionRowBuilder();
    opts.slice(i, i + 5).forEach((opt) => {
      const btn = new ButtonBuilder()
        .setCustomId(`ticket_open:${panel._id}:${opt._id}`)
        .setLabel(opt.label.slice(0, 80))
        .setStyle(STYLE_MAP[opt.style] || ButtonStyle.Primary);
      const e = parseEmoji(opt.emoji);
      if (e) btn.setEmoji(e);
      row.addComponents(btn);
    });
    rows.push(row);
  }
  return rows;
}

// Build Discord embed from panel data
function buildPanelEmbed(panel) {
  const embed = new EmbedBuilder();
  if (panel.embedTitle)       embed.setTitle(panel.embedTitle);
  if (panel.embedDescription) embed.setDescription(panel.embedDescription);
  if (panel.embedColor) {
    try { embed.setColor(panel.embedColor); } catch {}
  }
  if (panel.embedImage)     embed.setImage(panel.embedImage);
  if (panel.embedThumbnail) embed.setThumbnail(panel.embedThumbnail);
  if (panel.embedFooter)    embed.setFooter({ text: panel.embedFooter });
  return embed;
}

// ── Create Panel ────────────────────────────────────────────────
router.post('/panel/:guildId', authenticate, async (req, res) => {
  const data = req.body;
  if (!data.name || !data.channelId) {
    return res.status(400).json({ error: 'الاسم والقناة مطلوبان.' });
  }
  if (!data.options || data.options.length === 0) {
    return res.status(400).json({ error: 'يجب إضافة خيار واحد على الأقل.' });
  }
  if (data.type === 'button' && data.options.length > 25) {
    return res.status(400).json({ error: 'الحد الأقصى للأزرار 25 (5 صفوف × 5).' });
  }
  if (data.type === 'dropdown' && data.options.length > 25) {
    return res.status(400).json({ error: 'الحد الأقصى لخيارات القائمة 25.' });
  }

  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  if (!guild.isOperational()) return res.status(403).json({ error: 'البوت معطل.' });

  const bot = getBotForGuild(req.params.guildId);
  if (!bot) return res.status(400).json({ error: 'البوت غير متصل.' });

  guild.ticketPanels.push(data);
  await guild.save();
  const panel = guild.ticketPanels[guild.ticketPanels.length - 1];

  try {
    const channel = await bot.channels.fetch(data.channelId);
    const embed = buildPanelEmbed(panel);
    const components = buildPanelComponents(panel);

    const message = await channel.send({ embeds: [embed], components });
    panel.messageId = message.id;
    await guild.save();

    res.status(201).json({ panel, message: 'تم إنشاء اللوحة.' });
  } catch (err) {
    return res.status(400).json({ error: 'فشل في إرسال اللوحة. تحقق من صلاحيات البوت في القناة.' });
  }
});

// ── Update Panel ────────────────────────────────────────────────
router.put('/panel/:guildId/:panelId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const panel = guild.ticketPanels.id(req.params.panelId);
  if (!panel) return res.status(404).json({ error: 'اللوحة غير موجودة.' });

  // Update allowed fields
  const updatable = [
    'name', 'type', 'embedTitle', 'embedDescription', 'embedColor',
    'embedImage', 'embedThumbnail', 'embedFooter', 'welcomeMessage',
    'placeholder', 'defaultCategoryId', 'options',
  ];
  updatable.forEach((k) => {
    if (req.body[k] !== undefined) panel[k] = req.body[k];
  });
  await guild.save();

  // Re-send / edit panel message
  try {
    const bot = getBotForGuild(req.params.guildId);
    const channel = await bot.channels.fetch(panel.channelId);
    const embed = buildPanelEmbed(panel);
    const components = buildPanelComponents(panel);

    if (panel.messageId) {
      const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed], components });
      } else {
        const newMsg = await channel.send({ embeds: [embed], components });
        panel.messageId = newMsg.id;
        await guild.save();
      }
    } else {
      const newMsg = await channel.send({ embeds: [embed], components });
      panel.messageId = newMsg.id;
      await guild.save();
    }
  } catch (err) {
    console.error('Panel edit error:', err.message);
  }

  res.json({ panel, message: 'تم تحديث اللوحة.' });
});

// ── List Panels ─────────────────────────────────────────────────
router.get('/panels/:guildId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });
  res.json({ panels: guild.ticketPanels });
});

// ── Get Single Panel ────────────────────────────────────────────
router.get('/panel/:guildId/:panelId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const panel = guild.ticketPanels.id(req.params.panelId);
  if (!panel) return res.status(404).json({ error: 'اللوحة غير موجودة.' });
  res.json({ panel });
});

// ── List Tickets ────────────────────────────────────────────────
router.get('/:guildId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const status = req.query.status;
  const filter = { guildId: req.params.guildId };
  if (status) filter.status = status;

  const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ tickets });
});

// ── Fetch Discord Channels (for dropdown in UI) ─────────────────
router.get('/discord-channels/:guildId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const bot = getBotForGuild(req.params.guildId);
  if (!bot) return res.status(400).json({ error: 'البوت غير متصل.' });

  try {
    const discordGuild = await bot.guilds.fetch(req.params.guildId);
    const channels = discordGuild.channels.cache
      .filter((c) => c.type === 0 || c.type === 4)        // Text & Category
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type === 4 ? 'category' : 'text',
        parentId: c.parentId,
      }));
    res.json({ channels });
  } catch {
    res.status(400).json({ error: 'فشل في جلب القنوات.' });
  }
});

// ── Fetch Discord Roles (for staff role selector) ───────────────
router.get('/discord-roles/:guildId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const bot = getBotForGuild(req.params.guildId);
  if (!bot) return res.status(400).json({ error: 'البوت غير متصل.' });

  try {
    const discordGuild = await bot.guilds.fetch(req.params.guildId);
    const roles = discordGuild.roles.cache
      .filter((r) => r.name !== '@everyone' && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id:    r.id,
        name:  r.name,
        color: r.hexColor,
      }));
    res.json({ roles });
  } catch {
    res.status(400).json({ error: 'فشل في جلب الأدوار.' });
  }
});

// ── Delete Panel ────────────────────────────────────────────────
router.delete('/panel/:guildId/:panelId', authenticate, async (req, res) => {
  const guild = await Guild.findOne({
    guildId: req.params.guildId,
    ownerId: req.user._id,
  });
  if (!guild) return res.status(404).json({ error: 'السيرفر غير موجود.' });

  const panel = guild.ticketPanels.id(req.params.panelId);
  if (!panel) return res.status(404).json({ error: 'اللوحة غير موجودة.' });

  // Try to delete the message in Discord
  try {
    const bot = getBotForGuild(req.params.guildId);
    if (bot && panel.messageId) {
      const channel = await bot.channels.fetch(panel.channelId);
      const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (msg) await msg.delete().catch(() => {});
    }
  } catch {}

  guild.ticketPanels.pull({ _id: req.params.panelId });
  await guild.save();
  res.json({ message: 'تم حذف اللوحة.' });
});

export default router;
