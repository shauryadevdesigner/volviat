const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    
    await interaction.deferReply();

    try {
      if (member && !member.bannable) {
        return interaction.editReply("I am unable to ban this member, sir. They may have elevated privileges.");
      }

      await interaction.guild.members.ban(targetUser.id, { reason: `${reason} - Banned by ${interaction.user.username}` });
      await interaction.editReply(`🔨 **${targetUser.username}** has been banned from the server.\n*Reason:* ${reason}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("Failed to execute ban command, sir.");
    }
  }
};
