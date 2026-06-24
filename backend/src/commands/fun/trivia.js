const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateChatResponse } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription("Test the server's knowledge with a tech, AI, or design trivia question."),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const prompt = `Generate a tech, AI, or design trivia question. Format the output with:
1. The question.
2. Four multiple choice options (A, B, C, D).
3. The correct answer hidden in a Discord spoiler block, e.g. "||Answer: B - Explanation...||".
Keep the formatting clean and presentable.`;

      const trivia = await generateChatResponse(prompt);
      
      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🧠 Jarvis Tech Trivia')
        .setDescription(trivia)
        .setTimestamp()
        .setFooter({ text: 'Antigravity AI Operating System' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Trivia Command] Error:', err);
      await interaction.editReply("My cognitive database is currently offline, sir. No trivia today.");
    }
  }
};
