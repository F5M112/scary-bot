import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, EmbedBuilder,
} from 'discord.js';
import Guild from '../models/Guild.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';

export async function handleInteraction(interaction) {
  try {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    const reply = { content: '❌ حدث خطأ. حاول مجدداً.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
}

// ── Button Interactions ──────────────────────────────────────────
async function handleButtonInteraction(interaction) {
  const [action, ...args] = interaction.customId.split(':');

  switch (action) {
    case 'ticket_open':
      // args = [panelId, optionId]
      await openTicket(interaction, args[0], args[1]);
      break;
    case 'close_ticket':
      await closeTicket(interaction, args[0]);
      break;
    case 'delete_ticket':
      await deleteTicket(interaction, args[0]);
      break;
    case 'transcript_ticket':
      await exportTranscript(interaction, args[0]);
      break;
    case 'giveaway_enter':
      await handleGiveawayEnter(interaction, args[0]);
      break;
  }
}

// ── Select Menu Interactions ─────────────────────────────────────
async function handleSelectMenuInteraction(interaction) {
  const [action, panelId] = interaction.customId.split(':');
  if (action === 'ticket_select') {
    const optionId = interaction.values[0];
    await openTicket(interaction, panelId, optionId);
  }
}

// ── Open Ticket ──────────────────────────────────────────────────
async function openTicket(interaction, panelId, optionId) {
  await interaction.deferReply({ ephemeral: true });

  const guildDoc = await Guild.findOne({ guildId: interaction.guildId });
  if (!guildDoc || !guildDoc.isOperational()) {
    return interaction.editReply({ content: '❌ البوت معطل لهذا السيرفر.' });
  }

  // Verify owner has active plan
  const owner = await User.findById(guildDoc.ownerId);
  if (!owner || !owner.isActive() || !owner.hasPlan()) {
    return interaction.editReply({ content: '❌ الخدمة غير متاحة حالياً.' });
  }

  const panel = guildDoc.ticketPanels.id(panelId);
  if (!panel) return interaction.editReply({ content: '❌ اللوحة غير موجودة.' });

  const option = panel.options.id(optionId);
  if (!option) return interaction.editReply({ content: '❌ الخيار غير موجود.' });

  // Check for existing open ticket
  const existingTicket = await Ticket.findOne({
    guildId: interaction.guildId,
    'createdBy.discordId': interaction.user.id,
    status: 'open',
  });
  if (existingTicket) {
    return interaction.editReply({
      content: `❌ لديك تذكرة مفتوحة بالفعل: <#${existingTicket.channelId}>`,
    });
  }

  // Increment ticket counter
  guildDoc.ticketCount++;
  await guildDoc.save();

  const channelName = (option.channelFormat || 'ticket-{user}')
    .replace('{user}', interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .replace('{number}', guildDoc.ticketCount);

  const staffRoles = option.staffRoles?.length ? option.staffRoles : (guildDoc.staffRoles || []);

  // Use option's category, or fall back to panel's default category
  const ticketCategory = option.ticketCategoryId || panel.defaultCategoryId || null;

  // Create ticket channel
  const channel = await interaction.guild.channels.create({
    name: channelName.slice(0, 100),
    type: ChannelType.GuildText,
    parent: ticketCategory,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
      ...staffRoles.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ],
  });

  // Save ticket
  await Ticket.create({
    guildId: interaction.guildId,
    channelId: channel.id,
    ticketNumber: guildDoc.ticketCount,
    createdBy: { discordId: interaction.user.id, username: interaction.user.username },
    category: option.label,
    status: 'open',
  });

  // Welcome message (option override → panel default)
  const welcomeTemplate = option.welcomeMessage || panel.welcomeMessage;
  const welcomeMsg = welcomeTemplate.replace('{user}', `<@${interaction.user.id}>`);

  const embed = new EmbedBuilder()
    .setColor(panel.embedColor || 0xDC2626)
    .setTitle(`🎫 تذكرة #${guildDoc.ticketCount}`)
    .setDescription(welcomeMsg)
    .addFields(
      { name: 'المستخدم',  value: `<@${interaction.user.id}>`, inline: true },
      { name: 'التصنيف',   value: option.label,                inline: true },
    )
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`close_ticket:${channel.id}`)
      .setLabel('إغلاق')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId(`transcript_ticket:${channel.id}`)
      .setLabel('تصدير المحادثة')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📄'),
  );

  // Mention staff roles
  const mentions = staffRoles.map((r) => `<@&${r}>`).join(' ');
  await channel.send({
    content: `<@${interaction.user.id}> ${mentions}`,
    embeds: [embed],
    components: [actionRow],
  });

  await interaction.editReply({ content: `✅ تم فتح تذكرتك: ${channel}` });
}

// ── Close Ticket ─────────────────────────────────────────────────
async function closeTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
  if (!ticket) return interaction.editReply({ content: '❌ التذكرة غير موجودة أو مغلقة.' });

  ticket.status = 'closed';
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = new Date();
  await ticket.save();

  try {
    await interaction.channel.permissionOverwrites.edit(ticket.createdBy.discordId, {
      SendMessages: false,
    });
  } catch {}

  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setDescription(`🔒 تم إغلاق التذكرة بواسطة <@${interaction.user.id}>`)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_ticket:${interaction.channelId}`)
      .setLabel('حذف نهائياً')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setCustomId(`transcript_ticket:${interaction.channelId}`)
      .setLabel('تصدير المحادثة')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📄'),
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.editReply({ content: '✅ تم إغلاق التذكرة.' });
}

// ── Delete Ticket ────────────────────────────────────────────────
async function deleteTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = await Ticket.findOne({ channelId: interaction.channelId });
  if (!ticket) return interaction.editReply({ content: '❌ التذكرة غير موجودة.' });

  ticket.status = 'deleted';
  await ticket.save();

  await interaction.editReply({ content: '✅ سيتم حذف القناة خلال 5 ثوانٍ...' });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

// ── Export Transcript ────────────────────────────────────────────
async function exportTranscript(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = await Ticket.findOne({ channelId: interaction.channelId });
  if (!ticket) return interaction.editReply({ content: '❌ التذكرة غير موجودة.' });

  const messages = await interaction.channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();

  const transcript = sorted.map((m) =>
    `[${new Date(m.createdTimestamp).toLocaleString('ar')}] ${m.author.username}: ${m.content}`
  ).join('\n');

  ticket.transcript = sorted.map((m) => ({
    author:    m.author.username,
    authorId:  m.author.id,
    content:   m.content,
    timestamp: m.createdAt,
  }));
  await ticket.save();

  const buffer = Buffer.from(transcript, 'utf-8');
  await interaction.editReply({
    content: '📄 تفريغ المحادثة:',
    files: [{ attachment: buffer, name: `ticket-${ticket.ticketNumber}.txt` }],
  });
}

// ── Giveaway Enter ────────────────────────────────────────────────
async function handleGiveawayEnter(interaction, giveawayId) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const Giveaway = (await import('../models/Giveaway.js')).default;
    const { buildGiveawayEmbed } = await import('../services/giveawayScheduler.js');

    const giveaway = await Giveaway.findById(giveawayId);

    if (!giveaway || giveaway.status !== 'active') {
      return interaction.editReply({ content: '❌ هذه المسابقة غير نشطة أو انتهت.' });
    }

    if (giveaway.endAt <= new Date()) {
      return interaction.editReply({ content: '❌ انتهت هذه المسابقة.' });
    }

    const userId = interaction.user.id;

    if (giveaway.participants.includes(userId)) {
      // Toggle: unregister
      giveaway.participants = giveaway.participants.filter((p) => p !== userId);
      await giveaway.save();

      // Update embed with new count
      try {
        const embed = buildGiveawayEmbed(giveaway);
        await interaction.message.edit({ embeds: [embed] });
      } catch {}

      return interaction.editReply({ content: '✅ تم إلغاء اشتراكك في المسابقة.' });
    }

    // Register
    giveaway.participants.push(userId);
    await giveaway.save();

    // Update embed with new participant count
    try {
      const embed = buildGiveawayEmbed(giveaway);
      await interaction.message.edit({ embeds: [embed] });
    } catch {}

    return interaction.editReply({
      content: `🎉 تم تسجيل اشتراكك في **${giveaway.prize}**! حظ سعيد!\n⏰ تنتهي: <t:${Math.floor(giveaway.endAt.getTime() / 1000)}:R>`,
    });
  } catch (err) {
    console.error('[giveaway enter] Error:', err.message);
    return interaction.editReply({ content: '❌ حدث خطأ. حاول مرة ثانية.' });
  }
}
