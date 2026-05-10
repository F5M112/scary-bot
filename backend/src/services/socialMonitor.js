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
    label:          'Kick',
    emoji:          '🟢',
    color:          '#53FC18',
    supportsLive:   true,
    supportsVideos: false,
    urlTemplate:    'https://kick.com/{username}',
  },
  youtube: {
    label:          'YouTube',
    emoji:          '🔴',
    color:          '#FF0000',
    supportsLive:   true,
    supportsVideos: true,
    urlTemplate:    'https://youtube.com/@{username}',
  },
  twitch: {
    label:          'Twitch',
    emoji:          '🟣',
    color:          '#9146FF',
    supportsLive:   true,
    supportsVideos: false,
    urlTemplate:    'https://twitch.tv/{username}',
  },
  tiktok: {
    label:          'TikTok',
    emoji:          '🎵',
    color:          '#ff0050',
    supportsLive:   true,
    supportsVideos: true,
    urlTemplate:    'https://tiktok.com/@{username}',
  },
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ══════════════════════════════════════════════════════════════════
// KICK
// ══════════════════════════════════════════════════════════════════
async function fetchKick(channel) {
  try {
    const { data } = await axios.get(
      `https://kick.com/api/v2/channels/${channel.channelUsername.toLowerCase()}`,
      { headers: { ...HEADERS, Accept: 'application/json' }, timeout: 12000 }
    );
    const ls = data.livestream;
    const isLive = !!ls && ls.is_live === true;
    return {
      type:        isLive ? 'live' : null,
      title:       ls?.session_title || '',
      viewers:     ls?.viewer_count  || 0,
      category:    ls?.categories?.[0]?.name || '',
      thumbnail:   ls?.thumbnail?.url || data.user?.profile_pic || null,
      displayName: data.user?.username || channel.channelUsername,
      avatar:      data.user?.profile_pic || null,
      streamId:    isLive ? `kick_live_${channel.channelUsername}` : null,
      url:         `https://kick.com/${channel.channelUsername}`,
    };
  } catch (err) {
    console.warn(`[kick] fetch error for ${channel.channelUsername}:`, err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// YOUTUBE — RSS feed (no API key needed, reliable)
// ══════════════════════════════════════════════════════════════════
async function fetchYouTube(channel) {
  try {
    // Try RSS by channel ID first (most reliable)
    let rssUrl = channel.channelId
      ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`
      : `https://www.youtube.com/feeds/videos.xml?user=${channel.channelUsername}`;

    let rssText = null;

    try {
      const { data } = await axios.get(rssUrl, { headers: HEADERS, timeout: 10000 });
      rssText = data;
    } catch {
      // If user RSS fails, try searching for channel ID
      if (!channel.channelId) {
        try {
          const { data: page } = await axios.get(
            `https://www.youtube.com/@${channel.channelUsername}`,
            { headers: HEADERS, timeout: 10000 }
          );
          const idMatch = page.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
          if (idMatch) {
            const { data } = await axios.get(
              `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`,
              { headers: HEADERS, timeout: 10000 }
            );
            rssText = data;
            // Save channel ID for future use
            channel.channelId = idMatch[1];
          }
        } catch {}
      }
    }

    if (!rssText) return null;

    // Parse latest video from RSS
    const entries = rssText.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    if (entries.length === 0) return null;

    const latest   = entries[0];
    const videoId  = (latest.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title    = (latest.match(/<title>([^<]+)<\/title>/)            || [])[1] || '';
    const pubStr   = (latest.match(/<published>([^<]+)<\/published>/)    || [])[1] || '';

    if (!videoId) return null;

    const publishedAt = new Date(pubStr);
    const ageMinutes  = (Date.now() - publishedAt.getTime()) / 60000;
    const isRecent    = ageMinutes < 60; // within 1 hour

    // Check if it's a live stream
    let isLive = false;
    let liveTitle = title;
    try {
      const { data: watchPage } = await axios.get(
        `https://www.youtube.com/watch?v=${videoId}`,
        { headers: HEADERS, timeout: 8000 }
      );
      isLive = watchPage.includes('"isLiveNow":true') ||
               watchPage.includes('"liveBroadcastDetails"') ||
               watchPage.includes('"LIVE_STREAM"');

      if (isLive) {
        const liveMatch = watchPage.match(/"videoDetails":\{"videoId":"[^"]+","title":"([^"]+)"/);
        if (liveMatch) liveTitle = liveMatch[1];
      }
    } catch {}

    if (isLive) {
      return {
        type:        'live',
        title:       liveTitle,
        videoId,
        streamId:    `yt_live_${videoId}`,
        url:         `https://youtube.com/watch?v=${videoId}`,
        thumbnail:   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        displayName: channel.channelDisplayName || channel.channelUsername,
      };
    }

    if (isRecent) {
      return {
        type:        'video',
        title:       decodeHTMLEntities(title),
        videoId,
        streamId:    `yt_video_${videoId}`,
        url:         `https://youtube.com/watch?v=${videoId}`,
        thumbnail:   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        displayName: channel.channelDisplayName || channel.channelUsername,
      };
    }

    return { type: null };
  } catch (err) {
    console.warn(`[youtube] fetch error for ${channel.channelUsername}:`, err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// TWITCH — HTML scraping
// ══════════════════════════════════════════════════════════════════
async function fetchTwitch(channel) {
  try {
    const { data } = await axios.get(
      `https://twitch.tv/${channel.channelUsername}`,
      { headers: HEADERS, timeout: 12000 }
    );

    const isLive = data.includes('"isLiveBroadcast"')  ||
                   data.includes('"type":"live"')        ||
                   data.includes('isLiveBroadcast":true');

    let title = '';
    try {
      const m = data.match(/"title":"([^"]{1,200})"/);
      if (m) title = m[1];
    } catch {}

    return {
      type:        isLive ? 'live' : null,
      title,
      displayName: channel.channelDisplayName || channel.channelUsername,
      streamId:    isLive ? `twitch_live_${channel.channelUsername}` : null,
      url:         `https://twitch.tv/${channel.channelUsername}`,
    };
  } catch (err) {
    console.warn(`[twitch] fetch error for ${channel.channelUsername}:`, err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// TIKTOK — HTML scraping (limited but best effort)
// ══════════════════════════════════════════════════════════════════
async function fetchTikTok(channel) {
  try {
    // Try live page first
    const { data: livePage } = await axios.get(
      `https://www.tiktok.com/@${channel.channelUsername}/live`,
      { headers: { ...HEADERS, 'Cookie': '' }, timeout: 12000 }
    );

    const isLive = livePage.includes('"roomStatus":2')          ||
                   livePage.includes('"liveRoomUserInfo"')       ||
                   livePage.includes('"isLiveStreaming":true')   ||
                   (livePage.includes('/live') && livePage.includes('"status":2'));

    if (isLive) {
      return {
        type:        'live',
        title:       '',
        displayName: channel.channelDisplayName || channel.channelUsername,
        streamId:    `tiktok_live_${channel.channelUsername}`,
        url:         `https://tiktok.com/@${channel.channelUsername}/live`,
      };
    }

    // Try profile page for recent videos
    const { data: profilePage } = await axios.get(
      `https://www.tiktok.com/@${channel.channelUsername}`,
      { headers: HEADERS, timeout: 12000 }
    );

    // Look for video data in the page
    const videoMatches = profilePage.match(/"id":"(\d{15,20})"/g) || [];
    const timeMatches  = profilePage.match(/"createTime":(\d{10})/g) || [];
    const titleMatch   = profilePage.match(/"desc":"([^"]{1,200})"/);

    if (videoMatches.length > 0 && timeMatches.length > 0) {
      const latestId   = videoMatches[0].match(/"id":"(\d+)"/)?.[1];
      const latestTime = parseInt(timeMatches[0].match(/:(\d+)/)?.[1] || '0');
      const ageMinutes = (Date.now() / 1000 - latestTime) / 60;
      const isRecent   = ageMinutes < 60;

      if (latestId && isRecent) {
        return {
          type:        'video',
          title:       titleMatch?.[1] || '',
          displayName: channel.channelDisplayName || channel.channelUsername,
          streamId:    `tiktok_video_${latestId}`,
          url:         `https://tiktok.com/@${channel.channelUsername}/video/${latestId}`,
        };
      }
    }

    return { type: null };
  } catch (err) {
    console.warn(`[tiktok] fetch error for ${channel.channelUsername}:`, err.message);
    return null;
  }
}

function decodeHTMLEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const FETCHERS = { kick: fetchKick, youtube: fetchYouTube, twitch: fetchTwitch, tiktok: fetchTikTok };

// ══════════════════════════════════════════════════════════════════
// LOOKUP (for UI when adding channel)
// ══════════════════════════════════════════════════════════════════
export async function lookupChannel(platform, username) {
  const fetcher = FETCHERS[platform];
  if (!fetcher) return null;

  try {
    const fakeChannel = { channelUsername: username, channelDisplayName: username, channelId: null };
    const data = await fetcher(fakeChannel);
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
      username,
      displayName: username,
      avatar:      null,
      isLive:      false,
      platform,
      url:         PLATFORMS[platform]?.urlTemplate?.replace('{username}', username),
      verified:    false,
    };
  }
}

// ══════════════════════════════════════════════════════════════════
// MONITOR TICK
// ══════════════════════════════════════════════════════════════════
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

    const eventType = data.type;     // 'live' | 'video' | null
    const currentId = data.streamId; // unique ID for this event

    // Save channelId if we got it (YouTube)
    if (data.channelId && !channel.channelId) {
      channel.channelId = data.channelId;
      modified = true;
    }

    // Update display name if changed
    if (data.displayName && channel.channelDisplayName !== data.displayName) {
      channel.channelDisplayName = data.displayName;
      modified = true;
    }

    if (eventType && currentId) {
      // New event (different ID from last sent)
      if (currentId !== channel.lastStreamId) {
        await sendNotification(bot, channel, data);
        channel.isLive         = eventType === 'live';
        channel.lastNotifiedAt = new Date();
        channel.lastStreamId   = currentId;
        modified = true;
        console.log(`[social] ✅ ${channel.platform} ${eventType}: ${channel.channelUsername}`);
      }
    } else if (!eventType && channel.isLive) {
      // Went offline
      channel.isLive = false;
      modified = true;
    }
  }

  if (modified) await alert.save();
}

// ══════════════════════════════════════════════════════════════════
// SEND NOTIFICATION
// ══════════════════════════════════════════════════════════════════
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

    // Build content
    let content = '';
    if (channel.mentionEveryone)    content = '@everyone ';
    else if (channel.mentionRoleId) content = `<@&${channel.mentionRoleId}> `;

    const msgTpl = isVideo
      ? (channel.videoMessageTemplate || `🎬 {streamer} نشر فيديو جديد على ${platform.label}! {link}`)
      : (channel.messageTemplate      || `${platform.emoji} {streamer} الآن مباشر على ${platform.label}! {link}`);

    content += render(msgTpl);

    // Build embed
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

    if (data.title)     embed.setDescription(`**${decodeHTMLEntities(data.title)}**`);
    if (data.category)  embed.addFields({ name: '🎮 الفئة',       value: data.category,            inline: true });
    if (data.viewers)   embed.addFields({ name: '👥 المشاهدون',   value: data.viewers.toString(),   inline: true });
    if (data.thumbnail) embed.setImage(data.thumbnail);

    await discordCh.send({ content: content.trim(), embeds: [embed] });
  } catch (err) {
    console.warn(`[social] Send failed for ${channel.channelUsername}:`, err.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// START / STOP
// ══════════════════════════════════════════════════════════════════
export function startSocialMonitor() {
  if (monitorInterval) return;
  monitorInterval = setInterval(tickMonitor, 3 * 60 * 1000); // every 3 minutes
  setTimeout(tickMonitor, 20 * 1000);                        // first check after 20s
  console.log('📡 خدمة Social Media Monitor بدأت (كل 3 دقائق)');
}

export function stopSocialMonitor() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
}
