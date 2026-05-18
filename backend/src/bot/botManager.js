import { Client, GatewayIntentBits, Partials } from 'discord.js';
import User from '../models/User.js';
import Guild from '../models/Guild.js';
import { cacheInvites, handleMemberJoin } from '../handlers/welcomeHandler.js';

const botInstances = new Map();
let platformBot    = null;

const BOT_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildInvites,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.MessageContent,
];

const BOT_PARTIALS = [Partials.Channel, Partials.Message, Partials.User];

export async function startPlatformBot() {
  if (!process.env.PLATFORM_BOT_TOKEN) {
    console.warn('⚠️  لا يوجد توكن للبوت الرئيسي - السيرفر سيعمل بدون بوت');
    return;
  }

  platformBot = createBotClient();

  platformBot.once('ready', () => {
    console.log(`✅ البوت الرئيسي جاهز: ${platformBot.user.tag}`);
    platformBot.guilds.cache.forEach(g => cacheInvites(g));
  });

  try {
    await platformBot.login(process.env.PLATFORM_BOT_TOKEN);
    const classicGuilds = await Guild.find({ botMode: 'platform', enabled: true });
    for (const guild of classicGuilds) {
      botInstances.set(guild.guildId, platformBot);
    }
  } catch (err) {
    console.error('❌ فشل تسجيل دخول البوت الرئيسي:', err.message);
    console.warn('⚠️  السيرفر سيعمل بدون بوت.');
    platformBot = null;
  }
}

export async function connectCustomBot(guildId, token) {
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
      client.guilds.cache.forEach(g => cacheInvites(g));
      await Guild.findOneAndUpdate({ guildId }, { botMode: 'custom' });
      console.log(`✅ بوت مخصص متصل: ${client.user.tag} → ${guildId}`);
      resolve({ tag: client.user.tag, id: client.user.id });
    });

    client.once('error', (err) => { clearTimeout(timeout); reject(err); });
    client.login(token).catch(() => {
      clearTimeout(timeout);
      reject(new Error('توكن البوت غير صالح.'));
    });
  });
}

export async function disconnectCustomBot(guildId) {
  const client = botInstances.get(guildId);
  if (client && client !== platformBot) {
    try { client.destroy(); } catch {}
    botInstances.delete(guildId);
    if (platformBot) botInstances.set(guildId, platformBot);
    await Guild.findOneAndUpdate({ guildId }, { botMode: 'platform' });
  }
}

export async function stopBotsForUser(userId) {
  const guilds = await Guild.find({ ownerId: userId });
  for (const guild of guilds) {
    const client = botInstances.get(guild.guildId);
    if (client && client !== platformBot) {
      try { client.destroy(); } catch {}
      botInstances.delete(guild.guildId);
    }
    await Guild.findOneAndUpdate({ guildId: guild.guildId }, { enabled: false });
  }
}

export function getBotForGuild(guildId) {
  return botInstances.get(guildId) || platformBot;
}

export function getPlatformBot() {
  return platformBot;
}

function createBotClient() {
  const client = new Client({ intents: BOT_INTENTS, partials: BOT_PARTIALS });

  client.on('interactionCreate', async (interaction) => {
    const { handleInteraction } = await import('../handlers/interactionHandler.js');
    await handleInteraction(interaction);
  });

  // Welcome events
  client.on('guildCreate',    guild  => cacheInvites(guild));
  client.on('guildMemberAdd', member => handleMemberJoin(member));

  client.on('error', (err) => console.error('Bot error:', err.message));

  return client;
}

export async function restoreCustomBots() {
  const premiumGuilds = await Guild.find({ botMode: 'custom', enabled: true });
  for (const guild of premiumGuilds) {
    try {
      const user = await User.findById(guild.ownerId);
      if (!user || !user.isActive() || !user.isPremium()) continue;
      if (!user.botToken) continue;
      await connectCustomBot(guild.guildId, user.botToken);
    } catch (err) {
      console.error(`فشل استعادة البوت لـ ${guild.guildId}:`, err.message);
    }
  }
}