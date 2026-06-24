const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const prisma = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription("View your current level, XP, and rank in the server.")
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The user to view rank of')
        .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    await interaction.deferReply();

    try {
      // Find user in DB
      let dbUser = await prisma.user.findUnique({
        where: { discordId: targetUser.id }
      });

      if (!dbUser) {
        // If not in DB, create user with 0 XP
        dbUser = await prisma.user.create({
          data: {
            discordId: targetUser.id,
            username: targetUser.username,
            guildId: interaction.guildId
          }
        });
      }

      // Calculate rank position
      const usersWithMoreXp = await prisma.user.count({
        where: {
          guildId: interaction.guildId,
          xp: { gt: dbUser.xp }
        }
      });
      const rank = usersWithMoreXp + 1;

      // Calculate progress to next level
      // Level Curve: Level = floor(sqrt(XP / 100)) + 1 -> XP = (Level - 1)^2 * 100
      const currentLevel = dbUser.level;
      const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
      const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
      
      const xpInCurrentLevel = dbUser.xp - xpForCurrentLevel;
      const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
      
      // Calculate progress percentage
      const percent = Math.min(Math.max((xpInCurrentLevel / xpNeededForNextLevel) * 100, 0), 100);
      
      // Make a text-based progress bar
      const barSize = 10;
      const progressChars = Math.round((percent / 100) * barSize);
      const emptyChars = barSize - progressChars;
      const progressBar = '█'.repeat(progressChars) + '░'.repeat(emptyChars);

      const embed = new EmbedBuilder()
        .setColor('#1abc9c')
        .setTitle(`📈 ${targetUser.username}'s Server Rank`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Level', value: `✨ ${currentLevel}`, inline: true },
          { name: 'Server Rank', value: `🏆 #${rank}`, inline: true },
          { name: 'Total XP', value: `⭐ ${dbUser.xp} XP`, inline: true },
          { name: `Progress to Level ${currentLevel + 1} (${Math.round(percent)}%)`, value: `\`${progressBar}\` (${dbUser.xp}/${xpForNextLevel} XP)` }
        )
        .setTimestamp()
        .setFooter({ text: 'Antigravity AI XP Engine' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Rank Command] Error:', err);
      await interaction.editReply("Failed to fetch rank details, sir.");
    }
  }
};
