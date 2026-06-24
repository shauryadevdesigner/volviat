const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const prisma = require('../db');

// Create Discord Client with necessary intents for AI, Welcome, Leveling, and Reactions
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

// 1. Sync guilds and channels to DB
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

// 2. Load Events Dynamically
function loadEvents() {
  const eventsPath = path.join(__dirname, '../events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  console.log(`[Bot] Found ${eventFiles.length} event(s) to load.`);

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

// 3. Load Commands Dynamically
function loadCommands() {
  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) return;

  const folders = fs.readdirSync(commandsPath).filter(f => fs.lstatSync(path.join(commandsPath, f)).isDirectory());
  let loadedCount = 0;

  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        loadedCount++;
      }
    }
  }
  console.log(`[Bot] Loaded ${loadedCount} command(s) in Collection.`);
}

// 4. Register Slash Commands with Discord
async function registerSlashCommands() {
  if (client.commands.size === 0) return;
  
  const commandsJson = [];
  client.commands.forEach(cmd => commandsJson.push(cmd.data.toJSON()));

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log(`[Bot] Deploying ${commandsJson.length} slash commands to Discord...`);
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commandsJson }
    );
    console.log('[Bot] Slash commands successfully registered.');
  } catch (error) {
    console.error('[Bot] Failed to deploy slash commands:', error);
  }
}

// 5. Send message helper
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

// Default legacy events (in case dynamic events folder is still being populated)
client.on('ready', () => {
  console.log(`[Legacy ready] Logged in as ${client.user.tag}`);
  syncGuildsAndChannels();
});

client.on('guildCreate', (guild) => {
  console.log(`Joined new guild: ${guild.name}`);
  syncGuildsAndChannels();
});

// Initialize dynamic loaders
loadEvents();
loadCommands();

// Register commands if token is present
if (process.env.DISCORD_TOKEN && process.env.DISCORD_CLIENT_ID) {
  registerSlashCommands();
}

module.exports = {
  client,
  sendMessage,
  syncGuildsAndChannels
};
