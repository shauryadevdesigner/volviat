const { SlashCommandBuilder } = require('discord.js');
const { generateChatResponse } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription("Get a fresh, AI-generated startup or programming meme."),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const prompt = `Create a short, witty startup or software engineering meme in text form. It could be formatted like a funny dialogue, a "when you..." scenario, or a Jarvis-level observation. Keep it highly relatable and humorous.`;
      const meme = await generateChatResponse(prompt);
      await interaction.editReply(meme);
    } catch (err) {
      console.error('[Meme Command] Error:', err);
      await interaction.editReply("My humor databases are currently undergoing system updates, sir.");
    }
  }
};
