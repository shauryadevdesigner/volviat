const { generateChatResponse } = require('../services/ai');
const { getMemoriesForContext, saveMemory } = require('../services/memory');
const { checkSpam, addWarning } = require('../services/moderation');
const { addXP } = require('../services/leveling');
const prisma = require('../db');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // 1. Ignore bot messages
    if (message.author.bot) return;

    // 2. Ignore messages not in guilds
    if (!message.guild) return;

    const content = message.content.trim();

    // Log message to DB for analytics
    await prisma.message.create({
      data: {
        content: content.substring(0, 1000),
        channelId: message.channel.id
      }
    }).catch(err => console.error('[Message Log] DB Error:', err));


    // 3. Moderation: Anti-Spam Check
    if (checkSpam(message.author.id)) {
      try {
        await message.delete().catch(() => null);
        const result = await addWarning(
          message.guild,
          message.author.id,
          message.author.username,
          "Sending messages too quickly (Spamming)",
          message.client.user.id
        );
        let warnMsg = `⚠️ **${message.author.username}**, please refrain from spamming. I have deleted your message and logged a warning. (${result.warningCount}/5)`;
        if (result.autoAction === 'MUTE') {
          warnMsg += `\n🤐 *Automatic Action:* User has been timed out for 10 minutes (3+ warnings).`;
        } else if (result.autoAction === 'BAN') {
          warnMsg += `\n🔨 *Automatic Action:* User has been banned from the server (5 warnings).`;
        }
        const reply = await message.channel.send(warnMsg);
        setTimeout(() => reply.delete().catch(() => null), 10000);
        return;
      } catch (err) {
        console.error('[Spam Handler] Error:', err);
      }
    }

    // 4. Leveling System: XP Gain
    const xpResult = await addXP(message.guild, message.author.id, message.author.username);
    if (xpResult.leveledUp) {
      await message.channel.send(`🎉 *Level Up!* Congratulations, **${message.author.username}**. You have achieved **Level ${xpResult.level}**. Fantastic progress, sir!`);
    }

    // 5. Proactive Autonomous Memory Extraction
    // If a user says "I am building X" or "My project is X", Jarvis remembers it automatically!
    const buildMatch = content.match(/i am building\s+(.+)/i) || content.match(/my project is\s+(.+)/i);
    if (buildMatch) {
      const projectDetails = buildMatch[1].trim();
      const memoryValue = `${message.author.username} is building ${projectDetails}`;
      await saveMemory(message.guild.id, message.author.id, 'project', memoryValue);
      
      // Playfully reply acknowledging it (Jarvis style)
      return message.reply(`*Jarvis note:* "I've noted that down, sir. You're building **${projectDetails}**. I shall remember this."`);
    }

    // 6. Handle Mention-Based Interaction (Jarvis Chat)
    const botMention = `<@${message.client.user.id}>`;
    const botNickMention = `<@!${message.client.user.id}>`;

    if (content.startsWith(botMention) || content.startsWith(botNickMention)) {
      message.channel.sendTyping();

      // Clean the prompt
      let cleanPrompt = content
        .replace(botMention, '')
        .replace(botNickMention, '')
        .trim();

      if (!cleanPrompt) {
        return message.reply('"At your service, sir. How may I assist you today?"');
      }

      // Retrieve RAG Context
      const context = await getMemoriesForContext(message.guild.id, message.author.id, cleanPrompt);
      const fullPrompt = context ? `${context}\nQuery: ${cleanPrompt}` : cleanPrompt;

      // Get response from Gemini
      const response = await generateChatResponse(fullPrompt);
      
      // Reply to message
      return message.reply(response);
    }
  },
};
