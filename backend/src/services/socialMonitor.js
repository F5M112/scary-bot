import axios from 'axios';
import { EmbedBuilder } from 'discord.js';
import SocialAlert from '../models/SocialAlert.js';
import Guild from '../models/Guild.js';
import User from '../models/User.js';
import { getBotForGuild } from '../bot/botManager.js';

let monitorInterval = null;

// ── Platform configs ──────────────────────────────────────────────
export const PLATFORMS = {
  kick: {
    label:       'Kick',
    emoji:       '🟢',
    color:       '#53FC18',
    supportsLive:  true,
    supportsVideos: false,
    urlTemplate: 'https://kick.com/{username}',
  },
  youtube: {
    label:       'YouTube',
    emoji:       '🔴',
    color:       '#FF0000',
    supportsLive:   true,
    supportsVideos: true,
    urlTemplate: 'https://youtube.com/@{username}',
  },
  twitch: {
    label:       'Twitch',
    emoji:       '🟣',
    color:       '#9146FF',
    supportsLive:   true,
    supportsVideos: false,
    urlTemplate: 'https://twitch.tv/{username}',
  },
  tiktok: {
    label:       'TikTok',
    emoji:       '🎵',
    color:       '#ff0050',
    supportsLive:   true,
    supportsVideos: true,
    urlTemplate: 'https://tiktok.com/@{username}',
  },
};

// ── Fetch Kick ────────────────────────────────────────────────────
async function fetchKick(channel) {
  try {
    const { data } = await axios.get(
      `https://kick.com/api/v2/channels/${channel.channelUsername.toLowerCase()}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, timeout: 10000 }
    );
    return {
      type:        data.livestream?.is_live ? 'live' : null,
      title:       data.livestream?.session_title || '',
      viewers:     data.livestream?.viewer_count || 0,
      category:    data.livestream?.categories?.[0]?.name || '',
      thumbnail:   data.livestream?.thumbnail?.url || data.user?.profile_pic,
      displayName: data.user?.username || channel.channelUsername,
      avatar:      data.user?.profile_pic,
      streamId:    data.livestream?.id?.toString(),
      url:         `https://kick.com/${channel.channelUsername}`,
    };
  } catch { return null; }
}

// ── Fetch YouTube (live + latest video) ──────────────────────────
async function fetchYouTube(channel) {
  try {
    // Check latest video via RSS feed (no API key)
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${channel.channelUsername}`;
    let rssData = null;
    try {
      const { data } = await axios.get(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000,
      });
      rssData = data;
    } catch {}

    // Fallback: search by channel name
    if (!rssData && channel.channelId) {
      try {
        const { data } = await axios.get(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
        );
        rssData = data;
      } catch {}
    }

    if (rssData) {
      // Extract latest video from RSS
      const videoIdMatch  = rssData.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch    = rssData.match(/<title>([^<]+)<\/title>/g);
      const publishedMatch = rssData.match(/<published>([^<]+)<\/published>/g);

      if (videoIdMatch) {
        const videoId   = videoIdMatch[1];
        const title     = titleMatch?.[1]?.replace(/<\/?title>/g, '') || '';
        const published = publishedMatch?.[1]?.replace(/<\/?published>/g, '') || '';
        const publishedDate = new Date(published);
        const isRecent  = Date.now() - publishedDate.getTime() < 30 * 60 * 1000; // within 30min

        // Check if it's a live stream
        const liveUrl = `https://youtube.com/@${channel.channelUsername}/live`;
        let isLive = false;
        try {
          const { data: pageData } = await axios.get(liveUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000,
          });
          isLive = pageData.includes('"isLiveNow":true') || pageData.includes('"LIVE"');
        } catch {}

        return {
          type:        isLive ? 'live' : (isRecent ? 'video' : null),
          title,
          videoId,
          streamId:    isLive ? `live_${channel.channelUsername}` : videoId,
          url:         isLive ? liveUrl : `https://youtube.com/watch?v=${videoId}`,
          thumbnail:   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          displayName: channel.channelDisplayName || channel.channelUsername,
        };
      }
    }
    return null;
  } catch { return null; }
}

// ── Fetch Twitch ──────────────────────────────────────────────────
async function fetchTwitch(channel) {
  try {
    const { data } = await axios.get(`https://twitch.tv/${channel.channelUsername}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000,
    });
    const isLive = data.includes('"isLiveBroadcast"') || data.includes('"type":"live"');
    const titleMatch = data.match(/"title":"([^"]+)"/);
    return {
      type:        isLive ? 'live' : null,
      title:       titleMatch?.[1] || '',
      displayName: channel.channelDisplayName || channel.channelUsername,
      url:         `https://twitch.tv/${channel.channelUsername}`,
      streamId:    isLive ? `live_${channel.channelUsername}` : null,
    };
  } catch { return null; }
}

// ── Fetch TikTok (live + latest video) ───────────────────────────
async function fetchTikTok(channel) {
  try {
    const { data } = await axios.get(
      `https://www.tiktok.com/@${channel.channelUsername}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
    );

    const isLive = data.includes('"isLiveStreaming":true') ||
                   data.includes('"roomStatus":2') ||
                   data.includes('/live');

    // Try to extract latest video
    const videoMatch   = data.match(/"id":"(\d{15,20})"/);
    const titleMatch   = data.match(/"desc":"([^"]+)"/);
    const coverMatch   = data.match(/"cover":\{"uri":"([^"]+)"/);
    const timeMatch    = data.match(/"createTime":(\d+)/);

    const isRecentVideo = timeMatch && (Date.now() / 1000 - parseInt(timeMatch[1]) < 30 * 60);

    if (isLive) {
      return {
        type:        'live',
        title:       '',
        displayName: channel.channelDisplayName || channel.channelUsername,
        url:         `https://tiktok.com/@${channel.channelUsername}/live`,
        streamId:    `live_${channel.channelUsername}`,
      };
    }

    if (videoMatch && isRecentVideo) {
      const videoId = videoMatch[1];
      return {
        type:        'video',
        title:       titleMatch?.[1] || '',
        displayName: channel.channelDisplayName || channel.channelUsername,
        url:         `https://tiktok.com/@${channel.channelUsername}/video/${videoId}`,
        streamId:    videoId,
        thumbnail:   coverMatch?.[1],
      };
    }

    return { type: null };
  } catch { return null; }
}

const FETCHERS = { kick: fetchKick, youtube: fetchYouTube, twitch: fetchTwitch, tiktok: fetchTikTok };

// ── Lookup (for UI) ───────────────────────────────────────────────
export async function lookupChannel(platform, username) {
  const fetcher = FETCHERS[platform];
  if (!fetcher) return null;

  const fakeChannel = {
    channelUsername:    username,
    channelDisplayName: username,
    channelId:          null,
  };

  try {
    const data = await fetcher(fakeChannel);

    // Even if fetch fails or returns null, we still return basic info
    // so the user can add the channel (it will be monitored later)
    return {
      username,
      displayName: data?.displayName || username,
      avatar:      data?.avatar || null,
      isLive:      data?.type === 'live',
      platform,
      url:         data?.url || `${PLATFORMS[platform]?.urlTemplate?.replace('{username}', username) || '#'}`,
      verified:    data !== null,   // false = could not verify but channel was added anyway
    };
  } catch {
    // Return basic info even on error — let the monitor handle it
    return {
      username,
      displayName: username,
      avatar:      null,
      isLive:      false,
      platform,
      url:         PLATFORMS[platform]?.urlTemplate?.replace('{username}', username) || '#',
      verified:    false,
    };
  }
}

// ── Monitor tick ──────────────────────────────────────────────────
async function tickMonitor() {
  try {
    const allAlerts = await SocialAlert.find({ 'channels.enabled': true });
    for (const alert of allAlerts) {
      try { await processAlert(alert); } catch (err) {
        console.error(`[social] Error for ${alert.guildId}:`, err.message);
      }
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

    const eventType = data.type; // 'live' | 'video' | null
    const currentId = data.streamId;

    // New live or new video (different ID from last)
    if (eventType && currentId && currentId !== channel.lastStreamId) {
      await sendNotification(bot, channel, data);
      channel.isLive         = eventType === 'live';
      channel.lastNotifiedAt = new Date();
      channel.lastStreamId   = currentId;
      modified = true;
    } else if (!eventType && channel.isLive) {
      channel.isLive = false;
      modified = true;
    }

    // Update display name
    if (data.displayName && channel.channelDisplayName !== data.displayName) {
      channel.channelDisplayName = data.displayName;
      modified = true;
    }
  }

  if (modified) await alert.save();
}

async function sendNotification(bot, channel, data) {
  try {
    const discordCh = await bot.channels.fetch(channel.notifyChannelId);
    if (!discordCh) return;

    const platform = PLATFORMS[channel.platform] || PLATFORMS.kick;
    const isVideo = data.type === 'video';
    const platform = PLATFORMS[channel.platform] || PLATFORMS.kick;

    const render = (tpl) => (tpl || '')
      .replace(/\{streamer\}/g, data.displayName || channel.channelUsername)
      .replace(/\{title\}/g,    data.title || '')
      .replace(/\{link\}/g,     data.url)
      .replace(/\{viewers\}/g,  (data.viewers || 0).toString())
      .replace(/\{type\}/g,     isVideo ? 'فيديو جديد' : 'بث مباشر');

    let content = '';
    if (channel.mentionEveryone)    content = '@everyone ';
    else if (channel.mentionRoleId) content = `<@&${channel.mentionRoleId}> `;

    // Use video template or live template based on type
    const msgTemplate = isVideo
      ? (channel.videoMessageTemplate || `${platform.emoji} {streamer} نشر فيديو جديد! {link}`)
      : (channel.messageTemplate      || `${platform.emoji} {streamer} الآن مباشر! {link}`);

    content += render(msgTemplate);

    const titleTemplate = isVideo
      ? (channel.videoEmbedTitle || `🎬 فيديو جديد من {streamer}`)
      : (channel.embedTitle       || `${platform.emoji} [LIVE] {streamer}`);

    const embed = new EmbedBuilder()
      .setColor(channel.embedColor || platform.color)
      .setTitle(render(titleTemplate))
      .setURL(data.url)
      .setAuthor({
        name:    `${platform.emoji} ${data.displayName || channel.channelUsername}`,
        url:     data.url,
        iconURL: channel.channelAvatar || undefined,
      })
      .setTimestamp();

    if (data.title)     embed.setDescription(`**${data.title}**`);
    if (data.category)  embed.addFields({ name: '🎮 الفئة', value: data.category, inline: true });
    if (data.viewers)   embed.addFields({ name: '👥 المشاهدون', value: data.viewers.toString(), inline: true });
    if (data.thumbnail) embed.setImage(data.thumbnail);
    embed.setFooter({ text: isVideo ? `فيديو جديد على ${platform.label}` : `بث مباشر على ${platform.label}` });

    await discordCh.send({ content: content.trim(), embeds: [embed] });
    console.log(`[social] ✅ ${channel.platform} ${data.type}: ${channel.channelUsername}`);
  } catch (err) {
    console.warn(`[social] Send failed: ${err.message}`);
  }
}

// ── Start/stop ────────────────────────────────────────────────────
export function startSocialMonitor() {
  if (monitorInterval) return;
  monitorInterval = setInterval(tickMonitor, 3 * 60 * 1000);
  setTimeout(tickMonitor, 15 * 1000);
  console.log('📡 خدمة Social Media Monitor بدأت (كل 3 دقائق)');
}

export function stopSocialMonitor() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
}
