import { EmbedBuilder } from 'discord.js';
import Adhkar from '../models/Adhkar.js';
import Guild from '../models/Guild.js';
import User from '../models/User.js';
import { getBotForGuild } from '../bot/botManager.js';
import { getRandomAdhkar, CATEGORY_LABELS } from '../data/adhkar.js';

let schedulerInterval = null;

// ── Check & send adhkar to all eligible guilds ───────────────────
async function tickAdhkar() {
  try {
    const settings = await Adhkar.find({ enabled: true, channelId: { $ne: null } });

    for (const setting of settings) {
      try {
        await processSettings(setting);
      } catch (err) {
        console.error(`[adhkar] Error for guild ${setting.guildId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[adhkar] Scheduler tick error:', err.message);
  }
}

async function processSettings(setting) {
  // Check if it's time to send
  const now = Date.now();
  const lastSent = setting.lastSentAt ? new Date(setting.lastSentAt).getTime() : 0;
  const intervalMs = setting.intervalMinutes * 60 * 1000;

  if (lastSent && (now - lastSent) < intervalMs) return;

  // Verify guild + owner status
  const guild = await Guild.findOne({ guildId: setting.guildId });
  if (!guild || !guild.isOperational()) return;

  const owner = await User.findById(guild.ownerId);
  if (!owner || !owner.isActive() || !owner.hasPlan()) return;

  const bot = getBotForGuild(setting.guildId);
  if (!bot) return;

  // Get random adhkar
  const adhkar = getRandomAdhkar(setting.categories, setting.lastSentIndex);
  if (!adhkar) return;

  try {
    const channel = await bot.channels.fetch(setting.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(setting.embedColor || '#1a8754')
      .setTitle(setting.embedTitle || '📿 ذكر')
      .setDescription(`**${adhkar.text}**`)
      .setFooter({ text: `${CATEGORY_LABELS[adhkar.category] || ''} • ${adhkar.source}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    setting.lastSentAt = new Date();
    setting.lastSentIndex = adhkar.globalIndex;
    setting.totalSent = (setting.totalSent || 0) + 1;
    await setting.save();

    console.log(`[adhkar] ✅ Sent to ${setting.guildId} (${adhkar.category})`);
  } catch (err) {
    console.warn(`[adhkar] ⚠️  Failed to send for ${setting.guildId}: ${err.message}`);
  }
}

// ── Start the scheduler ──────────────────────────────────────────
export function startAdhkarScheduler() {
  if (schedulerInterval) return;

  // Check every minute
  schedulerInterval = setInterval(tickAdhkar, 60 * 1000);

  // Run once on startup (after 10s delay so bot is ready)
  setTimeout(tickAdhkar, 10 * 1000);

  console.log('🕌 خدمة الأذكار التلقائية بدأت');
}

export function stopAdhkarScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
