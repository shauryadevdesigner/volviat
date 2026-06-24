const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../db');
const scheduler = require('../../scheduler/scheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription("Schedule and list community events & AMAs.")
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new event (Admins only).')
        .addStringOption(opt => opt.setName('title').setDescription('Event title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Event description').setRequired(true))
        .addStringOption(opt => opt.setName('time').setDescription('Time details (e.g. Tomorrow at 5 PM UTC)').setRequired(true))
        .addStringOption(opt => opt.setName('cron').setDescription('Cron expression for reminder (e.g. "0 17 * * *")').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all scheduled events.')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply();

    try {
      if (subcommand === 'create') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.editReply("Apologies, sir. This action requires Administrator credentials.");
        }

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const time = interaction.options.getString('time');
        const cronExpr = interaction.options.getString('cron');

        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle(`📅 Upcoming Event: ${title}`)
          .setDescription(`${description}\n\n🕒 **Scheduled Time:** ${time}`)
          .setTimestamp()
          .setFooter({ text: 'Antigravity AI Event System' });

        // Post to event announcements channel
        const announceChannel = interaction.guild.channels.cache.find(c => 
          c.name.includes('event-announcements')
        );

        if (announceChannel && announceChannel.isTextBased()) {
          await announceChannel.send({ content: '@everyone A new event has been scheduled!', embeds: [embed] });
        }

        // If cron is supplied, create a schedule for the reminder broadcast
        if (cronExpr) {
          const reminderContent = `🔔 **Reminder:** The event **${title}** is starting soon! \n*Details:* ${description}\n*Time:* ${time}`;
          const targetChannelId = announceChannel ? announceChannel.id : interaction.channelId;

          const newSchedule = await prisma.schedule.create({
            data: {
              name: `[EVENT] ${title}`,
              type: 'cron',
              cronExpression: cronExpr,
              channelId: targetChannelId,
              guildId: interaction.guildId,
              messageContent: reminderContent,
              status: 'ACTIVE'
            }
          });

          scheduler.startSchedule(newSchedule);
        }

        return interaction.editReply({ content: 'Event created and announced successfully, sir.', embeds: [embed] });
      }

      if (subcommand === 'list') {
        // Query schedules that are events
        const eventSchedules = await prisma.schedule.findMany({
          where: {
            guildId: interaction.guildId,
            name: { startsWith: '[EVENT]' },
            status: 'ACTIVE'
          }
        });

        if (eventSchedules.length === 0) {
          return interaction.editReply("There are no upcoming scheduled events logged in my sub-routines, sir.");
        }

        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('📅 Active Server Events')
          .setDescription('Here is a list of events currently active in my schedule matrix:')
          .setTimestamp();

        eventSchedules.forEach((sch, idx) => {
          const cleanName = sch.name.replace('[EVENT] ', '');
          embed.addFields({
            name: `${idx + 1}. ${cleanName}`,
            value: `*Reminder Schedule (Cron):* \`${sch.cronExpression}\`\n*Target Channel:* <#${sch.channelId}>`
          });
        });

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[Event Command] Error:', err);
      await interaction.editReply("I encountered an issue setting up the event, sir.");
    }
  }
};
