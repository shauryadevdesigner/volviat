const { SlashCommandBuilder } = require('discord.js');
const { generateSummary } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription("Summarizes the recent conversation in this channel."),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      // Fetch the last 50 messages from the channel
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      const messageList = Array.from(messages.values())
        .reverse()
        .filter(m => !m.author.bot && m.content.trim().length > 0)
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

      if (!messageList) {
        return interaction.editReply("There are no recent user messages in this channel to summarize, sir.");
      }

      const summary = await generateSummary(messageList);
      
      // Ensure the reply is within Discord's 2000 character limit
      const cleanSummary = summary.length > 2000 ? summary.substring(0, 1997) + "..." : summary;
      await interaction.editReply(cleanSummary);
    } catch (err) {
      console.error('[Summarize Command] Error:', err);
      await interaction.editReply("I encountered an issue compiling the channel logs, sir.");
    }
  }
};
