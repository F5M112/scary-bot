import axios from 'axios';
import { EmbedBuilder } from 'discord.js';
import SocialAlert from '../models/SocialAlert.js';
import Guild from '../models/Guild.js';
import User from '../models/User.js';
import { getBotForGuild } from '../bot/botManager.js';

let monitorInterval = null;

export const PLATFORMS = {
  kick:    { label: 'Kick',    emoji: '🟢', color: '#53FC18', supportsLive: true,  supportsVideos: false, urlTemplate: 'https://kick.com/{username}' },
  youtube: { label: 'YouTube', emoji: '🔴', color: '#FF0000', supportsLive: true,  supportsVideos: true,  urlTemplate: 'https://youtube.com/@{username}' },
  twitch:  { label: 'Twitch',  emoji: '🟣', color: '#9146FF', supportsLive: true,  supportsVideos: false, urlTemplate: 'https://twitch.tv/{username}' },
  tiktok:  { label: 'TikTok',  emoji: '🎵', color: '#ff0050', supportsLive: false, supportsVideos: false, urlTemplate: 'https://tiktok.com/@{username}' },
};

// ── KICK (official API — works from servers) ──────────────────────
async function fetchKick(channel) {
  try {
    const { data } = await axios.get(
      `https://kick.com/api/v2/channels/${channel.channelUsername.toLowerCase()}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        timeout: 12000,
      }
    );
    const ls     = data.livestream;
    const isLive = !!ls && ls.is_live === true;
    return {
      type:        isLive ? 'live' : null,
      title:       ls?.session_title || '',
      viewers:     ls?.viewer_count  || 0,
      category:    ls?.categories?.[0]?.name || '',
      thumbnail:   ls?.thumbnail?.url || null,
      displayName: data.user?.username || channel.channelUsername,
      avatar:      data.user?.profile_pic || null,
      streamId:    isLive ? `kick_live_${channel.channelUsername}` : `kick_offline_${channel.channelUsername}`,
      url:         `https://kick.com/${channel.channelUsername}`,
    };
  } catch (err) {
    console.warn(`[kick] ${channel.channelUsername}: ${err.message}`);
    return null;
  }
}

// ── YOUTUBE (RSS feed — most reliable, works from all servers) ────
async function fetchYouTube(channel) {
  try {
    // Build RSS URL — use channelId if known, else try by username
    let rssUrl = channel.channelId
      ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`
      : `https://www.youtube.com/feeds/videos.xml?user=${channel.channelUsername}`;

    let xml;
    try {
      const { data } = await axios.get(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      xml = data;
    } catch {
      // If user-based RSS fails, try @handle based channel page to find ID
      if (!channel.channelId) {
        try {
          const { data: page } = await axios.get(
            `https://www.youtube.com/@${channel.channelUsername}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
          );
          const match = page.match(/channel_id=([^"&]+)/);
          if (match) {
            channel.channelId = match[1]; // save for next time
            const { data } = await axios.get(
              `https://www.youtube.com/feeds/videos.xml?channel_id=${match[1]}`,
              { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
            );
            xml = data;
          }
        } catch {}
      }
    }

    if (!xml) return null;

    // Parse first entry from RSS
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) return null;

    const entry      = entryMatch[1];
    const videoId    = (entry.match(/<yt:videoId>([^<]+)/) || [])[1];
    const title      = (entry.match(/<title>([^<]+)/)      || [])[1] || '';
    const published  = (entry.match(/<published>([^<]+)/)  || [])[1] || '';

    if (!videoId) return null;

    const ageMs     = Date.now() - new Date(published).getTime();
    const ageMin    = ageMs / 60000;
    const isRecent  = ageMin < 60; // published within last hour

    // Determine if it's live via the video's oEmbed (lightweight)
    let isLive = false;
    try {
      const { data: oembed } = await axios.get(
        `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }
      );
      // If oembed title contains [LIVE] or similar, it might be live
      isLive = oembed.title?.includes('[LIVE]') || oembed.title?.includes('🔴');
    } catch {}

    if (isLive) {
      return {
        type:        'live',
        title:       decodeXML(title),
        streamId:    `yt_live_${videoId}`,
        url:         `https://youtube.com/watch?v=${videoId}`,
        thumbnail:   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        displayName: channel.channelDisplayName || channel.channelUsername,
      };
    }

    if (isRecent) {
      return {
        type:        'video',
        title:       decodeXML(title),
        streamId:    `yt_video_${videoId}`,
        url:         `https://youtube.com/watch?v=${videoId}`,
        thumbnail:   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        displayName: channel.channelDisplayName || channel.channelUsername,
      };
    }

    return { type: null };
  } catch (err) {
    console.warn(`[youtube] ${channel.channelUsername}: ${err.message}`);
    return null;
  }
}

// ── TWITCH (HTML scraping fallback) ──────────────────────────────
async function fetchTwitch(channel) {
  try {
    const { data } = await axios.get(
      `https://twitch.tv/${channel.channelUsername}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'text/html' },
        timeout: 12000,
      }
    );
    const isLive = data.includes('"isLiveBroadcast"')   ||
                   data.includes('"type":"live"')         ||
                   data.includes('isLiveBroadcast":true');
    return {
      type:        isLive ? 'live' : null,
      title:       '',
      displayName: channel.channelDisplayName || channel.channelUsername,
      streamId:    isLive ? `twitch_live_${channel.channelUsername}` : `twitch_offline_${channel.channelUsername}`,
      url:         `https://twitch.tv/${channel.channelUsername}`,
    };
  } catch (err) {
    console.warn(`[twitch] ${channel.channelUsername}: ${err.message}`);
    return null;
  }
}

// ── TIKTOK (disabled — blocks server requests reliably) ───────────
async function fetchTikTok(channel) {
  // TikTok aggressively blocks server IPs — return null to skip silently
  return null;
}

function decodeXML(str) {
  return (str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

const FETCHERS = { kick: fetchKick, youtube: fetchYouTube, twitch: fetchTwitch, tiktok: fetchTikTok };

// ── LOOKUP (for UI) ───────────────────────────────────────────────
export async function lookupChannel(platform, username) {
  try {
    const fakeChannel = { channelUsername: username, channelDisplayName: username, channelId: null };
    const data = await FETCHERS[platform]?.(fakeChannel);
    return {
      username,
      displayName: data?.displayName || username,
      avatar:      data?.avatar      || null,
      isLive:      data?.type === 'live',
      platform,
      url:         data?.url || PLATFORMS[platform]?.urlTemplate?.replace('{username}', username),
      verified:    data !== null,
    };
  } catch {
    return {
      username, displayName: username, avatar: null,
      isLive: false, platform, verified: false,
      url: PLATFORMS[platform]?.urlTemplate?.replace('{username}', username),
    };
  }
}

// ── MONITOR TICK ──────────────────────────────────────────────────
async function tickMonitor() {
  try {
    const allAlerts = await SocialAlert.find({ 'channels.0': { $exists: true } });
    for (const alert of allAlerts) {
      try { await processAlert(alert); }
      catch (err) { console.error(`[social] Error for ${alert.guildId}:`, err.message); }
    }
  } catch (err) { console.error('[social] Tick error:', err.message); }
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

    const fetcher = FETCHERS[channel.platform];
    if (!fetcher) continue;

    const data = await fetcher(channel);
    if (!data) continue;

    // Save YouTube channel ID if discovered
    if (data.channelId && !channel.channelId) {
      channel.channelId = data.channelId;
      modified = true;
    }
    if (data.displayName && channel.channelDisplayName !== data.displayName) {
      channel.channelDisplayName = data.displayName;
      modified = true;
    }

    const eventType = data.type;
    const currentId = data.streamId;

    if (eventType && currentId && currentId !== channel.lastStreamId) {
      // New event — send notification
      await sendNotification(bot, channel, data);
      channel.isLive         = eventType === 'live';
      channel.lastNotifiedAt = new Date();
      channel.lastStreamId   = currentId;
      modified = true;
      console.log(`[social] ✅ Sent ${eventType} alert: ${channel.platform}/${channel.channelUsername}`);
    } else if (!eventType && channel.isLive) {
      channel.isLive = false;
      modified = true;
    }
  }

  if (modified) await alert.save();
}

// ── SEND NOTIFICATION ─────────────────────────────────────────────
async function sendNotification(bot, channel, data) {
  try {
    const discordCh = await bot.channels.fetch(channel.notifyChannelId);
    if (!discordCh) return;

    const platform = PLATFORMS[channel.platform] || PLATFORMS.kick;
    const isVideo  = data.type === 'video';

    const render = (tpl) => (tpl || '')
      .replace(/\{streamer\}/g, data.displayName || channel.channelUsername)
      .replace(/\{title\}/g,    data.title || '')
      .replace(/\{link\}/g,     data.url)
      .replace(/\{viewers\}/g,  (data.viewers || 0).toString());

    let content = '';
    if (channel.mentionEveryone)    content = '@everyone ';
    else if (channel.mentionRoleId) content = `<@&${channel.mentionRoleId}> `;

    const msgTpl = isVideo
      ? (channel.videoMessageTemplate || `🎬 {streamer} نشر فيديو جديد على ${platform.label}! {link}`)
      : (channel.messageTemplate      || `${platform.emoji} {streamer} الآن مباشر على ${platform.label}! {link}`);

    content += render(msgTpl);

    const titleTpl = isVideo
      ? (channel.videoEmbedTitle || `🎬 فيديو جديد من {streamer}`)
      : (channel.embedTitle      || `${platform.emoji} [LIVE] {streamer}`);

    const embed = new EmbedBuilder()
      .setColor(channel.embedColor || platform.color)
      .setTitle(render(titleTpl))
      .setURL(data.url)
      .setAuthor({
        name:    `${platform.emoji} ${data.displayName || channel.channelUsername}`,
        url:     data.url,
        iconURL: channel.channelAvatar || undefined,
      })
      .setFooter({ text: isVideo ? `فيديو جديد على ${platform.label}` : `بث مباشر على ${platform.label}` })
      .setTimestamp();

    if (data.title)     embed.setDescription(`**${decodeXML(data.title)}**`);
    if (data.category)  embed.addFields({ name: '🎮 الفئة',     value: data.category,          inline: true });
    if (data.viewers)   embed.addFields({ name: '👥 المشاهدون', value: data.viewers.toString(), inline: true });
    if (data.thumbnail) embed.setImage(data.thumbnail);

    await discordCh.send({ content: content.trim(), embeds: [embed] });
  } catch (err) {
    console.warn(`[social] Send failed: ${err.message}`);
  }
}

// ── START / STOP ──────────────────────────────────────────────────
export function startSocialMonitor() {
  if (monitorInterval) return;
  monitorInterval = setInterval(tickMonitor, 3 * 60 * 1000);
  setTimeout(tickMonitor, 30 * 1000);
  console.log('📡 خدمة Social Media Monitor بدأت (كل 3 دقائق)');
}

export function stopSocialMonitor() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
}
