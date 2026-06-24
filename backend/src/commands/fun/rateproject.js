const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateChatResponse } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rateproject')
    .setDescription("Get constructive, witty Jarvis feedback on your project or startup idea.")
    .addStringOption(option => 
      option.setName('description')
        .setDescription('Briefly describe your project/idea')
        .setRequired(true)
    ),
  async execute(interaction) {
    const description = interaction.options.getString('description');
    await interaction.deferReply();

    try {
      const prompt = `Critique this project/startup idea: "${description}". 
Provide a score out of 10, key strengths, potential challenges/risks, and a Jarvis-style recommendation on next steps. Keep the tone helpful, professional, but slightly witty.`;

      const ratingDetails = await generateChatResponse(prompt);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📊 Jarvis Project Evaluation')
        .setDescription(ratingDetails)
        .setTimestamp()
        .setFooter({ text: 'Antigravity AI Operating System' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[RateProject Command] Error:', err);
      await interaction.editReply("My analysis sensors are offline, sir. Please try again later.");
    }
  }
};
