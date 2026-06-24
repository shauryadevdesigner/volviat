const { Client, GatewayIntentBits } = require('discord.js');
const prisma = require('../db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Sync guilds and channels to DB
async function syncGuildsAndChannels() {
  try {
    const guilds = await client.guilds.fetch();
    console.log(`Syncing ${guilds.size} guild(s)...`);

    for (const [guildId, partialGuild] of guilds) {
      const guild = await partialGuild.fetch();
      
      // Upsert server in database
      await prisma.server.upsert({
        where: { guildId: guild.id },
        update: { name: guild.name, ownerId: guild.ownerId },
        create: { guildId: guild.id, name: guild.name, ownerId: guild.ownerId }
      });

      // Get all channels
      const channels = await guild.channels.fetch();
      
      for (const [channelId, channel] of channels) {
        // Channel type 0 is GuildText in discord.js
        if (channel && (channel.type === 0 || channel.isTextBased())) {
          await prisma.channel.upsert({
            where: { channelId: channel.id },
            update: { name: channel.name, guildId: guild.id },
            create: { channelId: channel.id, name: channel.name, guildId: guild.id, type: 'TEXT' }
          });
        }
      }
    }
    console.log("Guilds and channels sync completed successfully.");
  } catch (error) {
    console.error("Failed to sync guilds and channels:", error);
  }
}

client.on('ready', () => {
  console.log(`Discord bot logged in as ${client.user.tag}!`);
  syncGuildsAndChannels();
});

client.on('guildCreate', (guild) => {
  console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  syncGuildsAndChannels();
});

/**
 * Sends a message to a specific Discord channel
 * @param {string} channelId 
 * @param {string} content 
 */
async function sendMessage(channelId, content) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found or inaccessible.`);
    }
    const message = await channel.send(content);
    return message;
  } catch (error) {
    console.error(`Error sending message to channel ${channelId}:`, error);
    throw error;
  }
}

module.exports = {
  client,
  sendMessage,
  syncGuildsAndChannels
};
