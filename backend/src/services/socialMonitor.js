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

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'application/json, text/html, */*',
};

// Try multiple methods to fetch a URL
async function smartFetch(url) {
  // 1. Direct
  try {
    const { data } = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 10000 });
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {}

  // 2. allorigins proxy
  try {
    const { data } = await axios.get(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      { timeout: 12000 }
    );
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {}

  // 3. corsproxy
  try {
    const { data } = await axios.get(
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      { headers: BROWSER_HEADERS, timeout: 12000 }
    );
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {}

  return null;
}

// ── KICK ──────────────────────────────────────────────────────────
async function fetchKick(channel) {
  try {
    const raw = await smartFetch(
      `https://kick.com/api/v2/channels/${channel.channelUsername.toLowerCase()}`
    );
    if (!raw) return null;

    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return null; }

    const ls   = parsed.livestream;
    const live = !!ls && (ls.is_live === true || ls.is_live === 1);

    return {
      type:        live ? 'live' : null,
      title:       ls?.session_title || '',
      viewers:     ls?.viewer_count  || 0,
      category:    ls?.categories?.[0]?.name || '',
      thumbnail:   ls?.thumbnail?.url || null,
      displayName: parsed.user?.username || channel.channelUsername,
      avatar:      parsed.user?.profile_pic || null,
      streamId:    live
        ? `kick_live_${ls?.id || channel.channelUsername}`
        : `kick_off_${channel.channelUsername}`,
      url: `https://kick.com/${channel.channelUsername}`,
    };
  } catch (err) {
    console.warn(`[kick] ${channel.channelUsername}: ${err.message}`);
    return null;
  }
}

// ── YOUTUBE RSS ───────────────────────────────────────────────────
async function fetchYouTube(channel) {
  try {
    const rssUrl = channel.channelId
      ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`
      : `https://www.youtube.com/feeds/videos.xml?user=${channel.channelUsername}`;

    const xml = await smartFetch(rssUrl);
    if (!xml) return null;

    const videoId = (xml.match(/<yt:videoId>([^<]+)/)             || [])[1];
    const title   = (xml.match(/<title>(?!YouTube)([^<]+)/)       || [])[1] || '';
    const pubStr  = (xml.match(/<published>([^<]+)/)              || [])[1] || '';

    if (!videoId) return null;

    const ageMin   = (Date.now() - new Date(pubStr).getTime()) / 60000;
    const isRecent = ageMin < 60;
    if (!isRecent) return { type: null };

    // Check if live via oEmbed
    let isLive = false;
    try {
      const oembed = await smartFetch(
        `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembed) isLive = oembed.includes('"isLive":true') || oembed.includes('[LIVE]');
    } catch {}

    return {
      type:        isLive ? 'live' : 'video',
      title:       decodeXML(title),
      streamId:    isLive ? `yt_live_${videoId}` : `yt_video_${videoId}`,
      url:         `https://youtube.com/watch?v=${videoId}`,
      thumbnail:   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      displayName: channel.channelDisplayName || channel.channelUsername,
    };
  } catch (err) {
    console.warn(`[youtube] ${channel.channelUsername}: ${err.message}`);
    return null;
  }
}

// ── TWITCH ────────────────────────────────────────────────────────
async function fetchTwitch(channel) {
  try {
    const html = await smartFetch(`https://twitch.tv/${channel.channelUsername}`);
    if (!html) return null;
    const isLive = html.includes('"isLiveBroadcast"') || html.includes('"type":"live"');
    return {
      type:        isLive ? 'live' : null,
      title:       '',
      displayName: channel.channelDisplayName || channel.channelUsername,
      streamId:    isLive ? `twitch_live_${channel.channelUsername}` : `twitch_off_${channel.channelUsername}`,
      url:         `https://twitch.tv/${channel.channelUsername}`,
    };
  } catch (err) {
    console.warn(`[twitch] ${channel.channelUsername}: ${err.message}`);
    return null;
  }
}

async function fetchTikTok() { return null; }

function decodeXML(str) {
  return (str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const FETCHERS = { kick: fetchKick, youtube: fetchYouTube, twitch: fetchTwitch, tiktok: fetchTikTok };

// ── LOOKUP ────────────────────────────────────────────────────────
export async function lookupChannel(platform, username) {
  try {
    const fakeChannel = { channelUsername: username, channelDisplayName: username, channelId: null };
    const data = await FETCHERS[platform]?.(fakeChannel);
    return {
      username,
      displayName: data?.displayName || username,
      avatar:      data?.avatar || null,
      isLive:      data?.type === 'live',
      platform,
      url:         data?.url || PLATFORMS[platform]?.urlTemplate?.replace('{username}', username),
      verified:    data !== null,
    };
  } catch {
    return {
      username, displayName: username, avatar: null, isLive: false, platform, verified: false,
      url: PLATFORMS[platform]?.urlTemplate?.replace('{username}', username),
    };
  }
}

// ── MONITOR ───────────────────────────────────────────────────────
async function tickMonitor() {
  try {
    const allAlerts = await SocialAlert.find({ 'channels.0': { $exists: true } });
    for (const alert of allAlerts) {
      try { await processAlert(alert); }
      catch (err) { console.error(`[social] ${alert.guildId}: ${err.message}`); }
    }
  } catch (err) { console.error('[social] Tick:', err.message); }
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
    const data = await FETCHERS[channel.platform]?.(channel);
    if (!data) continue;

    if (data.displayName && channel.channelDisplayName !== data.displayName) {
      channel.channelDisplayName = data.displayName;
      modified = true;
    }

    const { type, streamId } = data;
    if (type && streamId && streamId !== channel.lastStreamId) {
      await sendNotification(bot, channel, data);
      channel.isLive         = type === 'live';
      channel.lastNotifiedAt = new Date();
      channel.lastStreamId   = streamId;
      modified = true;
      console.log(`[social] ✅ ${channel.platform} ${type}: ${channel.channelUsername}`);
    } else if (!type && channel.isLive) {
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
    const render   = (tpl) => (tpl || '')
      .replace(/\{streamer\}/g, data.displayName || channel.channelUsername)
      .replace(/\{title\}/g,   data.title || '')
      .replace(/\{link\}/g,    data.url)
      .replace(/\{viewers\}/g, (data.viewers || 0).toString());

    let content = '';
    if (channel.mentionEveryone)    content = '@everyone ';
    else if (channel.mentionRoleId) content = `<@&${channel.mentionRoleId}> `;
    content += render(isVideo
      ? (channel.videoMessageTemplate || `🎬 {streamer} نشر فيديو جديد على ${platform.label}! {link}`)
      : (channel.messageTemplate      || `${platform.emoji} {streamer} الآن مباشر على ${platform.label}! {link}`));

    const embed = new EmbedBuilder()
      .setColor(channel.embedColor || platform.color)
      .setTitle(render(isVideo
        ? (channel.videoEmbedTitle || `🎬 فيديو جديد من {streamer}`)
        : (channel.embedTitle      || `${platform.emoji} [LIVE] {streamer}`)))
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
