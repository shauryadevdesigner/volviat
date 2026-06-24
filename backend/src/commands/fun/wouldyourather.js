const { SlashCommandBuilder } = require('discord.js');
const { generateChatResponse } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wouldyourather')
    .setDescription("Ask Jarvis for a tech, design, or startup themed 'Would You Rather' question."),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const prompt = `Generate a challenging and funny "Would You Rather" question specifically tailored for tech founders, software developers, designers, or content creators. Make both options equally torturous or hilarious.`;
      const question = await generateChatResponse(prompt);
      await interaction.editReply(question);
    } catch (err) {
      console.error('[WouldYouRather Command] Error:', err);
      await interaction.editReply("I am unable to generate a dilemma for you at this moment, sir.");
    }
  }
};
