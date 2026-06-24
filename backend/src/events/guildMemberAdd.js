const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    console.log(`[New Member Join] ${member.user.tag} has joined the guild.`);

    // 1. Find a welcome channel
    const welcomeChannel = member.guild.channels.cache.find(ch => 
      ch.name.includes('welcome') && ch.isTextBased()
    );

    if (welcomeChannel) {
      try {
        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle(`🌌 Welcome to Antigravity AI, ${member.user.username}!`)
          .setDescription(`"Ah, a new arrival. Pleased to meet you, sir/madam. I am Jarvis, the autonomous AI system running this community. Under the directive of our founders, I have prepared your terminal."\n\n📌 **Please check the following areas:**\n- Read the rules in <#${member.guild.channels.cache.find(c => c.name.includes('rules'))?.id || 'rules'}>\n- Select your professional roles in <#${member.guild.channels.cache.find(c => c.name.includes('choose-roles'))?.id || 'roles'}>\n- Introduce yourself in <#${member.guild.channels.cache.find(c => c.name.includes('introduce-yourself'))?.id || 'general'}>\n\nI have auto-assigned you the **🌟 Creator** role to begin your onboarding. Feel free to ping me if you need assistance!`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: 'Antigravity AI Operating System', iconURL: member.guild.iconURL() });

        await welcomeChannel.send({ content: `Welcome, ${member}!`, embeds: [embed] });
      } catch (err) {
        console.error('[Welcome System] Failed to send welcome message:', err);
      }
    }

    // 2. Assign default "Creator" role if it exists
    const defaultRole = member.guild.roles.cache.find(r => r.name.includes('Creator'));
    if (defaultRole) {
      try {
        await member.roles.add(defaultRole);
        console.log(`[Welcome System] Auto-assigned default role to ${member.user.tag}`);
      } catch (err) {
        console.error('[Welcome System] Failed to add default role:', err);
      }
    }
  }
};
