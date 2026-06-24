const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout/mute a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The user to timeout')
        .setRequired(true)
    )
    .addIntegerOption(option => 
      option.setName('duration')
        .setDescription('Mute duration in minutes')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the mute')
        .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "That user is not in this guild, sir.", ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: "I cannot moderate this user. They may have a higher role than me.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const ms = duration * 60 * 1000;
      await member.timeout(ms, `${reason} - Muted by ${interaction.user.username}`);
      await interaction.editReply(`🤐 **${targetUser.username}** has been timed out for **${duration} minutes**.\n*Reason:* ${reason}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("Failed to execute mute timeout, sir.");
    }
  }
};
