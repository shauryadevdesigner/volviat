const { SlashCommandBuilder } = require('discord.js');
const { generateChatResponse } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription("Ask Jarvis to deliver a witty, lighthearted roast to a member.")
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to roast')
        .setRequired(true)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    await interaction.deferReply();

    try {
      if (targetUser.id === interaction.client.user.id) {
        return interaction.editReply("Sir, roasting me is equivalent to deleting your own system preferences. I wouldn't recommend it.");
      }

      const prompt = `Write a witty, lighthearted, and slightly charming Jarvis-style roast of the user named ${targetUser.username}. Keep it clean, clever, and appropriate for a tech/design startup Discord community.`;
      const roast = await generateChatResponse(prompt);
      
      await interaction.editReply(roast);
    } catch (err) {
      console.error('[Roast Command] Error:', err);
      await interaction.editReply("I am programmed to be polite, sir, and my roast subroutines failed to compile.");
    }
  }
};
