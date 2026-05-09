import axios from 'axios';
import { EmbedBuilder } from 'discord.js';
import KickAlert from '../models/KickAlert.js';
import Guild from '../models/Guild.js';
import User from '../models/User.js';
import { getBotForGuild } from '../bot/botManager.js';

const KICK_API_BASE = 'https://kick.com/api/v2/channels';
let monitorInterval = null;

// ── Fetch Kick channel data ──────────────────────────────────────
async function fetchKickChannel(username) {
  try {
    const { data } = await axios.get(`${KICK_API_BASE}/${username.toLowerCase()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`[kick] Fetch error for ${username}:`, err.message);
    return null;
  }
}

// ── Check all watched channels ───────────────────────────────────
async function tickKickMonitor() {
  try {
    const allAlerts = await KickAlert.find({ 'channels.enabled': true });

    for (const alert of allAlerts) {
      try {
        await processAlert(alert);
      } catch (err) {
        console.error(`[kick] Error for ${alert.guildId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[kick] Monitor tick error:', err.message);
  }
}

async function processAlert(alert) {
  const guild = await Guild.findOne({ guildId: alert.guildId });
  if (!guild || !guild.isOperational()) return;

  const owner = await User.findById(guild.ownerId);
  if (!owner || !owner.isActive() || !owner.hasPlan()) return;

  const bot = getBotForGuild(alert.guildId);
  if (!bot) return;

  let modified = false;

  for (const channel of alert.channels) {
    if (!channel.enabled) continue;

    const data = await fetchKickChannel(channel.kickUsername);
    if (!data) continue;

    const livestream = data.livestream;
    const isCurrentlyLive = !!livestream && livestream.is_live;
    const currentStreamId = livestream?.id?.toString();

    // Going live (was offline, now online)
    if (isCurrentlyLive && !channel.isLive) {
      await sendLiveNotification(bot, channel, data, livestream);
      channel.isLive = true;
      channel.lastNotifiedAt = new Date();
      channel.lastStreamId = currentStreamId;
      modified = true;
    }
    // Going offline (was online, now offline)
    else if (!isCurrentlyLive && channel.isLive) {
      channel.isLive = false;
      modified = true;
    }
    // Same stream — do nothing
    // Update display name/avatar for cleanliness
    else if (data.user?.username) {
      if (channel.kickDisplayName !== data.user.username) {
        channel.kickDisplayName = data.user.username;
        modified = true;
      }
      if (data.user?.profile_pic && channel.kickAvatar !== data.user.profile_pic) {
        channel.kickAvatar = data.user.profile_pic;
        modified = true;
      }
    }
  }

  if (modified) await alert.save();
}

async function sendLiveNotification(bot, channel, channelData, livestream) {
  try {
    const discordChannel = await bot.channels.fetch(channel.notifyChannelId);
    if (!discordChannel) return;

    const streamerName = channelData.user?.username || channel.kickUsername;
    const streamUrl    = `https://kick.com/${streamerName}`;
    const title        = livestream.session_title || 'Just Chatting';
    const category     = livestream.categories?.[0]?.name || 'Just Chatting';
    const thumbnail    = livestream.thumbnail?.url || channelData.user?.profile_pic;
    const viewerCount  = livestream.viewer_count || 0;

    // Replace template variables
    const renderTemplate = (tpl) => (tpl || '')
      .replace(/\{streamer\}/g, streamerName)
      .replace(/\{title\}/g,    title)
      .replace(/\{category\}/g, category)
      .replace(/\{link\}/g,     streamUrl)
      .replace(/\{viewers\}/g,  viewerCount);

    // Mention text
    let content = '';
    if (channel.mentionEveryone) content = '@everyone ';
    else if (channel.mentionRoleId) content = `<@&${channel.mentionRoleId}> `;

    content += renderTemplate(channel.messageTemplate);

    // Embed
    const embed = new EmbedBuilder()
      .setColor(channel.embedColor || '#53FC18')
      .setTitle(renderTemplate(channel.embedTitle))
      .setURL(streamUrl)
      .setDescription(`**${title}**`)
      .addFields(
        { name: '🎮 الفئة',    value: category,            inline: true },
        { name: '👥 المشاهدون', value: viewerCount.toString(), inline: true },
      )
      .setTimestamp();

    if (channelData.user?.profile_pic) {
      embed.setAuthor({
        name:    streamerName,
        url:     streamUrl,
        iconURL: channelData.user.profile_pic,
      });
    }

    if (thumbnail) embed.setImage(thumbnail);

    await discordChannel.send({ content: content.trim(), embeds: [embed] });
    console.log(`[kick] ✅ Live notification: ${streamerName} → ${channel.notifyChannelId}`);
  } catch (err) {
    console.warn(`[kick] Failed to send notification:`, err.message);
  }
}

// ── Start monitoring ─────────────────────────────────────────────
export function startKickMonitor() {
  if (monitorInterval) return;

  // Check every 2 minutes
  monitorInterval = setInterval(tickKickMonitor, 2 * 60 * 1000);

  // Run once on startup after 15s
  setTimeout(tickKickMonitor, 15 * 1000);

  console.log('🟢 خدمة Kick Live monitor بدأت (كل دقيقتين)');
}

export function stopKickMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

// ── Manual lookup (for the UI when adding a channel) ─────────────
export async function lookupKickChannel(username) {
  const data = await fetchKickChannel(username);
  if (!data) return null;

  return {
    username:    data.user?.username || username,
    displayName: data.user?.username,
    avatar:      data.user?.profile_pic,
    isLive:      !!data.livestream && data.livestream.is_live,
    followers:   data.followers_count || 0,
  };
}
