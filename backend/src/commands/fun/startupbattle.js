const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateChatResponse } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('startupbattle')
    .setDescription("Compare two startups or tech ideas in a battle to see who wins.")
    .addStringOption(option => 
      option.setName('competitor_a')
        .setDescription('First startup/tech concept')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('competitor_b')
        .setDescription('Second startup/tech concept')
        .setRequired(true)
    ),
  async execute(interaction) {
    const competitorA = interaction.options.getString('competitor_a');
    const competitorB = interaction.options.getString('competitor_b');
    
    await interaction.deferReply();

    try {
      const prompt = `Compare these two tech companies, products, or startup concepts in a hypothetical battle:
Competitor A: ${competitorA}
Competitor B: ${competitorB}

Write a funny, witty Jarvis-style analysis evaluating their strengths, weaknesses, and crowning a definitive winner. Present it in a highly engaging startup-ecosystem theme.`;

      const response = await generateChatResponse(prompt);

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle(`⚔️ Startup Battle: ${competitorA} vs ${competitorB}`)
        .setDescription(response)
        .setTimestamp()
        .setFooter({ text: 'Jarvis Battle Analytics' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[StartupBattle Command] Error:', err);
      await interaction.editReply("I was unable to load the battle simulator, sir.");
    }
  }
};
