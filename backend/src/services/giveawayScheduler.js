import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Giveaway from '../models/Giveaway.js';
import Guild from '../models/Guild.js';
import User from '../models/User.js';
import { getBotForGuild } from '../bot/botManager.js';

let schedulerInterval = null;

// ── Build active giveaway embed ───────────────────────────────────
export function buildGiveawayEmbed(giveaway) {
  const timeLeft = giveaway.endAt - Date.now();
  const ended    = timeLeft <= 0 || giveaway.status !== 'active';

  const embed = new EmbedBuilder()
    .setColor(giveaway.embedColor || '#FFD700')
    .setTitle(`🎉 ${giveaway.title}`)
    .setTimestamp(giveaway.endAt);

  let desc = '';
  if (giveaway.description) desc += `${giveaway.description}\n\n`;
  desc += `🏆 **الجائزة:** ${giveaway.prize}\n`;
  desc += `👥 **عدد الفائزين:** ${giveaway.winnersCount}\n`;
  desc += `👤 **المشتركون:** ${giveaway.participants.length}\n`;
  if (giveaway.rules) desc += `\n📋 **القوانين:**\n${giveaway.rules}\n`;

  if (ended) {
    desc += `\n🔴 **انتهت المسابقة**`;
    if (giveaway.winners.length > 0) {
      desc += `\n🎊 **الفائزون:** ${giveaway.winners.map((w) => `<@${w}>`).join(', ')}`;
    } else {
      desc += `\n😔 لم يكن هناك مشتركون`;
    }
  } else {
    desc += `\n⏰ **تنتهي:** <t:${Math.floor(giveaway.endAt.getTime() / 1000)}:R>`;
  }

  embed.setDescription(desc);
  embed.setFooter({ text: ended ? 'انتهت المسابقة' : 'اضغط الزر للاشتراك' });

  return embed;
}

// ── Build entry button ────────────────────────────────────────────
export function buildGiveawayButton(giveawayId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_enter:${giveawayId}`)
      .setLabel('🎉 اشترك في المسابقة')
      .setStyle(ButtonStyle.Success),
  );
}

// ── Check ended giveaways ─────────────────────────────────────────
async function tickGiveaways() {
  try {
    const now = new Date();
    const expired = await Giveaway.find({
      status: 'active',
      endAt:  { $lte: now },
    });

    for (const giveaway of expired) {
      await endGiveaway(giveaway);
    }
  } catch (err) {
    console.error('[giveaway] Scheduler error:', err.message);
  }
}

// ── End a giveaway and pick winners ──────────────────────────────
export async function endGiveaway(giveaway) {
  try {
    giveaway.status = 'ended';

    // Pick random winners
    if (giveaway.participants.length > 0) {
      const shuffled = [...giveaway.participants].sort(() => Math.random() - 0.5);
      giveaway.winners = shuffled.slice(0, Math.min(giveaway.winnersCount, shuffled.length));
    }

    await giveaway.save();

    const bot = getBotForGuild(giveaway.guildId);
    if (!bot) return;

    // Edit original message to show results and REMOVE button
    try {
      const channel = await bot.channels.fetch(giveaway.channelId);
      if (giveaway.messageId) {
        const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (msg) {
          const updatedEmbed = buildGiveawayEmbed(giveaway);
          // Pass empty components array to REMOVE button
          await msg.edit({ embeds: [updatedEmbed], components: [] });
        }
      }

      // Send winner announcement in same channel
      if (giveaway.winners.length > 0) {
        const winnerMentions = giveaway.winners.map((w) => `<@${w}>`).join(' ');
        await channel.send({
          content: `🎊 **تهانينا للفائزين في "${giveaway.prize}"!**\n${winnerMentions}\nيرجى التواصل مع الإدارة للحصول على جائزتكم!`,
        });
      } else {
        await channel.send({
          content: `😔 انتهت مسابقة **${giveaway.prize}** دون مشتركين.`,
        });
      }

      console.log(`[giveaway] ✅ Ended: "${giveaway.prize}" | winners: ${giveaway.winners.length}`);
    } catch (err) {
      console.warn(`[giveaway] ⚠️  Channel error: ${err.message}`);
    }
  } catch (err) {
    console.error(`[giveaway] Error ending giveaway:`, err.message);
  }
}

// ── Start scheduler ───────────────────────────────────────────────
export function startGiveawayScheduler() {
  if (schedulerInterval) return;

  // Check every 30 seconds for ended giveaways
  schedulerInterval = setInterval(tickGiveaways, 30 * 1000);

  // Run once on startup after 5s
  setTimeout(tickGiveaways, 5000);

  console.log('🎉 خدمة Giveaway بدأت (كل 30 ثانية)');
}

export function stopGiveawayScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
