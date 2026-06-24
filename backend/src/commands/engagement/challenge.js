const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../db');
const { generateChallenge } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription("Daily/Weekly Creator Challenges.")
    .addSubcommand(sub =>
      sub.setName('current')
        .setDescription('View the currently active server challenge.')
    )
    .addSubcommand(sub =>
      sub.setName('submit')
        .setDescription('Submit your project link or description to complete the challenge.')
        .addStringOption(opt =>
          opt.setName('content')
            .setDescription('Your submission (URL, Google Drive link, or text details)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('admin-generate')
        .setDescription('Force generate a new challenge (Admins only).')
        .addStringOption(opt =>
          opt.setName('category')
            .setDescription('Challenge Category')
            .setRequired(true)
            .addChoices(
              { name: 'Coding', value: 'Coding' },
              { name: 'Design', value: 'Design' },
              { name: 'AI', value: 'AI' },
              { name: 'Startup', value: 'Startup' },
              { name: 'Marketing', value: 'Marketing' },
              { name: 'Motion Graphics', value: 'Motion Graphics' }
            )
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply();

    try {
      if (subcommand === 'current') {
        // Fetch latest active challenge
        const currentChallenge = await prisma.challenge.findFirst({
          orderBy: { startDate: 'desc' },
          include: { submissions: true }
        });

        if (!currentChallenge || new Date() > currentChallenge.endDate) {
          return interaction.editReply("There is no active challenge running right now, sir. An admin can create one using `/challenge admin-generate`.");
        }

        const embed = new EmbedBuilder()
          .setColor('#9b59b6')
          .setTitle(`🏆 Active Challenge: ${currentChallenge.title}`)
          .setDescription(`**Category:** ${currentChallenge.category}\n**Reward:** 🌟 ${currentChallenge.xpReward} XP\n\n${currentChallenge.description}`)
          .addFields(
            { name: 'Ends At', value: `<t:${Math.floor(currentChallenge.endDate.getTime() / 1000)}:R>`, inline: true },
            { name: 'Submissions', value: `👥 ${currentChallenge.submissions.length} users completed`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'submit') {
        const content = interaction.options.getString('content');
        
        // Find current challenge
        const currentChallenge = await prisma.challenge.findFirst({
          orderBy: { startDate: 'desc' }
        });

        if (!currentChallenge || new Date() > currentChallenge.endDate) {
          return interaction.editReply("No active challenge found to submit to, sir.");
        }

        // Get user from DB
        let dbUser = await prisma.user.findUnique({
          where: { discordId: interaction.user.id }
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              discordId: interaction.user.id,
              username: interaction.user.username,
              guildId: interaction.guildId
            }
          });
        }

        // Check if already submitted
        const existingSubmission = await prisma.submission.findFirst({
          where: {
            challengeId: currentChallenge.id,
            userId: dbUser.id
          }
        });

        if (existingSubmission) {
          return interaction.editReply("You have already submitted an entry for this challenge, sir.");
        }

        // Save submission
        await prisma.submission.create({
          data: {
            challengeId: currentChallenge.id,
            userId: dbUser.id,
            content: content
          }
        });

        // Award XP
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { xp: { increment: currentChallenge.xpReward } }
        });

        const embed = new EmbedBuilder()
          .setColor('#2ed573')
          .setTitle('✅ Challenge Submission Received')
          .setDescription(`Excellent work, **${interaction.user.username}**! Your entry has been logged successfully.\n\n*Reward Granted:* **+${currentChallenge.xpReward} XP**! Keep building, sir.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'admin-generate') {
        // Verify permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.editReply("Apologies, sir. This directive requires Administrator permissions.");
        }

        const category = interaction.options.getString('category');
        const challengeData = await generateChallenge(category);

        // Save challenge
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours duration

        const newChallenge = await prisma.challenge.create({
          data: {
            title: challengeData.title,
            category: category,
            description: challengeData.description,
            xpReward: challengeData.xpReward || 150,
            startDate: startDate,
            endDate: endDate
          }
        });

        const embed = new EmbedBuilder()
          .setColor('#ffa502')
          .setTitle(`🚀 New Server Challenge Generated!`)
          .setDescription(`**${newChallenge.title}**\n\n**Category:** ${category}\n**XP Reward:** 🌟 ${newChallenge.xpReward} XP\n\n${newChallenge.description}`)
          .addFields(
            { name: 'Ends At', value: `<t:${Math.floor(endDate.getTime() / 1000)}:f> (<t:${Math.floor(endDate.getTime() / 1000)}:R>)` }
          )
          .setTimestamp();

        // Try to post it to challenges/announcements channel if exists
        const channel = interaction.guild.channels.cache.find(c => c.name.includes('weekly-challenges') || c.name.includes('contests'));
        if (channel && channel.isTextBased()) {
          await channel.send({ content: '@everyone A new challenge awaits!', embeds: [embed] });
        }

        return interaction.editReply({ content: 'Challenge generated and published, sir.', embeds: [embed] });
      }
    } catch (err) {
      console.error('[Challenge Command] Error:', err);
      await interaction.editReply("I was unable to complete the challenge request, sir.");
    }
  }
};
