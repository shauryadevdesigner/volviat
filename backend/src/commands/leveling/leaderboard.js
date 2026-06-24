const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const prisma = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription("Display the top active members on the server."),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Fetch top 10 users by XP
      const topUsers = await prisma.user.findMany({
        where: { guildId: interaction.guildId },
        orderBy: { xp: 'desc' },
        take: 10
      });

      if (topUsers.length === 0) {
        return interaction.editReply("No active member data found on this server, sir.");
      }

      const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle(`🏆 Active Creator Leaderboard`)
        .setDescription("Jarvis compiles the most active minds on the server:")
        .setTimestamp()
        .setFooter({ text: 'Antigravity AI Operating System' });

      let listText = '';
      topUsers.forEach((user, index) => {
        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';
        else medal = `\`#${index + 1}\` `;

        listText += `${medal}**${user.username}** — Level ${user.level} (${user.xp} XP)\n`;
      });

      embed.addFields({ name: 'Rankings', value: listText });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Leaderboard Command] Error:', err);
      await interaction.editReply("Failed to fetch the leaderboard records, sir.");
    }
  }
};
