const { SlashCommandBuilder } = require('discord.js');
const { explainTopic } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('explain')
    .setDescription("Ask Jarvis to explain a concept or topic.")
    .addStringOption(option => 
      option.setName('query')
        .setDescription('The topic or question you want explained')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query');
    try {
      const explanation = await explainTopic(query);
      const cleanExplanation = explanation.length > 2000 ? explanation.substring(0, 1997) + "..." : explanation;
      await interaction.editReply(cleanExplanation);
    } catch (err) {
      console.error('[Explain Command] Error:', err);
      await interaction.editReply("Apologies, sir. I was unable to process that topic.");
    }
  }
};
