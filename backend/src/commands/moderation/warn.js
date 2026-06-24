const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning } = require('../../services/moderation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user for breaking rules.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    if (targetUser.bot) {
      return interaction.reply({ content: "You cannot warn a bot, sir.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const result = await addWarning(
        interaction.guild,
        targetUser.id,
        targetUser.username,
        reason,
        interaction.user.id
      );

      let msg = `⚠️ **${targetUser.username}** has been warned by **${interaction.user.username}**.\n*Reason:* ${reason}\n*Warnings Count:* ${result.warningCount}/5`;

      if (result.autoAction === 'MUTE') {
        msg += `\n🤐 *Automatic Action:* User has been timed out for 10 minutes (3+ warnings).`;
      } else if (result.autoAction === 'BAN') {
        msg += `\n🔨 *Automatic Action:* User has been banned from the server (5 warnings).`;
      }

      await interaction.editReply(msg);
    } catch (err) {
      console.error(err);
      await interaction.editReply("Failed to record warning in database, sir.");
    }
  }
};
