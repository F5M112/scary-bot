import { Client, GatewayIntentBits, Partials } from 'discord.js';
import User from '../models/User.js';
import Guild from '../models/Guild.js';

// Map of guildId → Discord.js Client
const botInstances = new Map();

// Platform bot (shared)
let platformBot = null;

const BOT_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.MessageContent,
];

const BOT_PARTIALS = [Partials.Channel, Partials.Message, Partials.User];

// ── Start Platform Bot ───────────────────────────────────────────
export async function startPlatformBot() {
  if (!process.env.PLATFORM_BOT_TOKEN) {
    console.warn('⚠️  لا يوجد توكن للبوت الرئيسي - السيرفر سيعمل بدون بوت');
    return;
  }

  platformBot = createBotClient();

  platformBot.once('ready', () => {
    console.log(`✅ البوت الرئيسي جاهز: ${platformBot.user.tag}`);
  });

  try {
    await platformBot.login(process.env.PLATFORM_BOT_TOKEN);

    // Register platform bot for all classic guilds
    const classicGuilds = await Guild.find({ botMode: 'platform', enabled: true });
    for (const guild of classicGuilds) {
      botInstances.set(guild.guildId, platformBot);
    }
  } catch (err) {
    console.error('❌ فشل تسجيل دخول البوت الرئيسي:', err.message);
    console.warn('⚠️  السيرفر سيعمل بدون بوت. تأكد من صحة PLATFORM_BOT_TOKEN في .env');
    platformBot = null;
  }
}

// ── Connect Custom Bot for Premium Guild ─────────────────────────
export async function connectCustomBot(guildId, token) {
  // Disconnect existing custom bot if any
  await disconnectCustomBot(guildId);

  const client = createBotClient();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error('انتهت مهلة الاتصال بالبوت.'));
    }, 15000);

    client.once('ready', async () => {
      clearTimeout(timeout);
      botInstances.set(guildId, client);

      await Guild.findOneAndUpdate({ guildId }, { botMode: 'custom' });

      console.log(`✅ بوت مخصص متصل: ${client.user.tag} → ${guildId}`);
      resolve({ tag: client.user.tag, id: client.user.id });
    });

    client.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    client.login(token).catch(err => {
      clearTimeout(timeout);
      reject(new Error('توكن البوت غير صالح.'));
    });
  });
}

// ── Disconnect Custom Bot ────────────────────────────────────────
export async function disconnectCustomBot(guildId) {
  const client = botInstances.get(guildId);
  if (client && client !== platformBot) {
    try { client.destroy(); } catch {}
    botInstances.delete(guildId);

    // Fall back to platform bot
    if (platformBot) {
      botInstances.set(guildId, platformBot);
    }

    await Guild.findOneAndUpdate({ guildId }, { botMode: 'platform' });
  }
}

// ── Stop Bot for Disabled User ───────────────────────────────────
export async function stopBotsForUser(userId) {
  const guilds = await Guild.find({ ownerId: userId });

  for (const guild of guilds) {
    const client = botInstances.get(guild.guildId);
    if (client && client !== platformBot) {
      try { client.destroy(); } catch {}
      botInstances.delete(guild.guildId);
    }
    // Even platform bot shouldn't respond — guild.enabled will be checked at runtime
    await Guild.findOneAndUpdate({ guildId: guild.guildId }, { enabled: false });
  }
}

// ── Get Bot for Guild ────────────────────────────────────────────
export function getBotForGuild(guildId) {
  return botInstances.get(guildId) || platformBot;
}

export function getPlatformBot() {
  return platformBot;
}

// ── Helper: Create Bot Client ────────────────────────────────────
function createBotClient() {
  const client = new Client({
    intents: BOT_INTENTS,
    partials: BOT_PARTIALS,
  });

  // Attach event handlers
  client.on('interactionCreate', async (interaction) => {
    const { handleInteraction } = await import('../handlers/interactionHandler.js');
    await handleInteraction(interaction);
  });

  client.on('error', (err) => {
    console.error('Bot error:', err.message);
  });

  return client;
}

// ── Restore All Custom Bots on Startup ──────────────────────────
export async function restoreCustomBots() {
  const premiumGuilds = await Guild.find({ botMode: 'custom', enabled: true });

  for (const guild of premiumGuilds) {
    try {
      const user = await User.findById(guild.ownerId);
      if (!user || !user.isActive() || !user.isPremium()) continue;

      const token = user.botToken;
      if (!token) continue;

      await connectCustomBot(guild.guildId, token);
    } catch (err) {
      console.error(`فشل استعادة البوت لـ ${guild.guildId}:`, err.message);
    }
  }
}
