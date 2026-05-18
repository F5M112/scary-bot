import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import Welcome from '../models/Welcome.js';

const inviteCache = new Map();

// ── Cache invites ─────────────────────────────────────────────────
export async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
  } catch {}
}

// ── Generate welcome card image ───────────────────────────────────
async function generateWelcomeCard(member, welcome) {
  const width = 700, height = 250;
  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext('2d');

  // Background
  if (welcome.cardBackground) {
    try {
      const bg = await loadImage(welcome.cardBackground);
      ctx.drawImage(bg, 0, 0, width, height);
    } catch {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#1a0505');
      grad.addColorStop(1, '#2d0a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1a0505');
    grad.addColorStop(1, '#2d0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, width, height);

  // Avatar position - controllable
  const avatarX = welcome.avatarX || 125;
  const avatarY = welcome.avatarY || 125;
  const avatarR = welcome.avatarRadius || 70;

  // Avatar circle
  if (welcome.cardShowAvatar) {
    try {
      const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
      const avatar    = await loadImage(avatarURL);

      // Circle clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();

      // Circle border
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR + 3, 0, Math.PI * 2);
      ctx.strokeStyle = welcome.avatarBorderColor || '#dc2626';
      ctx.lineWidth = 5;
      ctx.stroke();
    } catch {}
  }

  // Text area starts after avatar
  const textX = welcome.textX || (avatarX + avatarR + 30);

  // Welcome text
  if (welcome.cardShowText && welcome.cardText) {
    ctx.font = `${welcome.cardTextSize || 24}px Arial`;
    ctx.fillStyle = welcome.cardTextColor || '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(welcome.cardText, textX, welcome.cardTextY || 90);
  }

  // Server name
  if (welcome.cardShowServerName !== false) {
    ctx.font = `bold ${welcome.serverNameSize || 28}px Arial`;
    ctx.fillStyle = welcome.serverNameColor || '#dc2626';
    ctx.textAlign = 'left';
    ctx.fillText(member.guild.name, textX, welcome.serverNameY || 125);
  }

  // Username
  if (welcome.cardShowUsername) {
    const displayName = member.user.displayName || member.user.username;
    ctx.font = `${welcome.usernameSize || 22}px Arial`;
    ctx.fillStyle = welcome.usernameColor || '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(displayName, textX, welcome.usernameY || 160);
  }

  // Member count
  if (welcome.cardShowCount !== false) {
    ctx.font = `${welcome.countSize || 16}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(`Member #${member.guild.memberCount}`, textX, welcome.countY || 190);
  }

  return canvas.toBuffer('image/png');
}

// ── Handle new member ─────────────────────────────────────────────
export async function handleMemberJoin(member) {
  try {
    const welcome = await Welcome.findOne({ guildId: member.guild.id });
    if (!welcome || !welcome.enabled) return;

    const memberCount = member.guild.memberCount;
    let inviterName = 'غير معروف';
    let inviteCode  = '';

    // Invite tracking
    if (welcome.trackInvites) {
      try {
        const newInvites  = await member.guild.invites.fetch();
        const cachedCodes = inviteCache.get(member.guild.id) || new Map();
        const usedInvite  = newInvites.find(inv => (cachedCodes.get(inv.code) || 0) < inv.uses);
        if (usedInvite) {
          inviterName = usedInvite.inviter?.username || 'غير معروف';
          inviteCode  = usedInvite.url || '';
        }
        inviteCache.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
      } catch {}
    }

    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const render = (t) => (t || '')
      .replace(/\{user\}/g,     `<@${member.user.id}>`)
      .replace(/\{username\}/g,  member.user.username)
      .replace(/\{server\}/g,    member.guild.name)
      .replace(/\{count\}/g,     memberCount.toString())
      .replace(/\{inviter\}/g,   inviterName)
      .replace(/\{invite\}/g,    inviteCode);

    const msgContent = render(welcome.message) || undefined;
    const files = [];

    // Generate welcome card
    if (welcome.cardEnabled) {
      try {
        const cardBuffer = await generateWelcomeCard(member, welcome);
        files.push(new AttachmentBuilder(cardBuffer, { name: 'welcome.png' }));
      } catch (err) {
        console.warn('[welcome] Card generation failed:', err.message);
      }
    }

    // Content image (avatar as attachment)
    if (welcome.contentImage && !welcome.cardEnabled) {
      files.push({ attachment: avatarURL, name: 'avatar.png' });
    }

    // Build embed
    let embed = null;
    if (welcome.embedEnabled) {
      embed = new EmbedBuilder()
        .setColor(welcome.embedColor || '#dc2626')
        .setTimestamp();
      if (welcome.embedTitle)       embed.setTitle(render(welcome.embedTitle));
      if (welcome.embedDescription) embed.setDescription(render(welcome.embedDescription));
      if (welcome.embedFooter)      embed.setFooter({ text: render(welcome.embedFooter) });
      if (welcome.embedThumbnail)   embed.setThumbnail(avatarURL);
      if (welcome.embedImage)       embed.setImage(avatarURL);
    }

    // Send DM
    if (welcome.sendAsDM) {
      try {
        const dm = await member.user.createDM();
        await dm.send({
          content: msgContent,
          embeds:  embed ? [embed] : [],
          files,
        });
      } catch {}
    }

    // Send to channel
    if (welcome.channelId) {
      const channel = await member.guild.channels.fetch(welcome.channelId).catch(() => null);
      if (channel) {
        // Card position: before or with message
        if (welcome.cardEnabled && welcome.cardPosition === 'before' && files.length > 0) {
          await channel.send({ files });
          await channel.send({
            content: msgContent,
            embeds:  embed ? [embed] : [],
          });
        } else {
          await channel.send({
            content: msgContent,
            embeds:  embed ? [embed] : [],
            files,
          });
        }
      }
    }

    // Send card to separate channel
    if (welcome.cardEnabled && welcome.cardPosition === 'channel' && welcome.cardChannelId) {
      const cardCh = await member.guild.channels.fetch(welcome.cardChannelId).catch(() => null);
      if (cardCh && files.length > 0) await cardCh.send({ files });
    }

    console.log(`[welcome] ✅ ${member.user.username} → ${member.guild.name}`);
  } catch (err) {
    console.warn(`[welcome] Error: ${err.message}`);
  }
}
