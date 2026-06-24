const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for kicking')
        .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "That user is not in this guild, sir.", ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: "I am unable to kick this member, sir. They may have elevated privileges.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
      await member.kick(`${reason} - Kicked by ${interaction.user.username}`);
      await interaction.editReply(`👢 **${targetUser.username}** has been kicked from the server.\n*Reason:* ${reason}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("Failed to execute kick command, sir.");
    }
  }
};
