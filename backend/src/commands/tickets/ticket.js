const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const prisma = require('../../db');
const { generateSummary } = require('../../services/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription("Private support ticket system.")
    .addSubcommand(sub =>
      sub.setName('open')
        .setDescription('Open a private support ticket.')
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for opening the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close this ticket and archive the AI summary.')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    try {
      if (subcommand === 'open') {
        const reason = interaction.options.getString('reason');

        // Check if user already has an open ticket in the guild
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

        const existingTicket = await prisma.ticket.findFirst({
          where: {
            userId: dbUser.id,
            status: 'OPEN'
          }
        });

        if (existingTicket) {
          // Double check if channel actually exists in Discord
          const chan = interaction.guild.channels.cache.get(existingTicket.ticketId);
          if (chan) {
            return interaction.editReply(`You already have an open ticket in <#${existingTicket.ticketId}>, sir.`);
          } else {
            // Delete dangling open ticket in DB
            await prisma.ticket.update({
              where: { id: existingTicket.id },
              data: { status: 'CLOSED' }
            });
          }
        }

        // Find the Staff/Admin role to allow them access
        const adminRoles = interaction.guild.roles.cache.filter(r => 
          r.permissions.has(PermissionFlagsBits.Administrator) || r.name.includes('Core Team') || r.name.includes('Staff')
        );

        // Find parent category "support" or "INSIDER CLUB"
        const category = interaction.guild.channels.cache.find(c => 
          (c.name.includes('SUPPORT') || c.name.includes('INSIDER CLUB')) && c.type === 4
        );

        // Define permission overwrites
        const permissionOverwrites = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: interaction.client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
          }
        ];

        adminRoles.forEach(role => {
          permissionOverwrites.push({
            id: role.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
        });

        // Create the channel
        const ticketChannel = await interaction.guild.channels.create({
          name: `🎫│ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: category ? category.id : null,
          permissionOverwrites: permissionOverwrites
        });

        // Create Ticket record in DB
        await prisma.ticket.create({
          data: {
            ticketId: ticketChannel.id,
            userId: dbUser.id,
            status: 'OPEN',
            aiSummary: `Opened ticket for reason: ${reason}`
          }
        });

        // Send opening message in ticket channel
        const embed = new EmbedBuilder()
          .setColor('#1abc9c')
          .setTitle(`🎫 Ticket Opened - ${interaction.user.username}`)
          .setDescription(`"Hello, sir. I have initialized a secure channel. A member of the Core Team will be with you shortly."\n\n**Topic:** ${reason}\n\n*Close this ticket at any time using* \`/ticket close\`.`)
          .setTimestamp();

        await ticketChannel.send({ content: `${interaction.user} & @here`, embeds: [embed] });

        return interaction.editReply(`Ticket initialized successfully in <#${ticketChannel.id}>, sir.`);
      }

      if (subcommand === 'close') {
        // Find ticket matching current channel ID
        const ticket = await prisma.ticket.findUnique({
          where: { ticketId: interaction.channelId }
        });

        if (!ticket || ticket.status === 'CLOSED') {
          return interaction.editReply("This channel is not an active support ticket, sir.");
        }

        // Fetch recent messages to summarize
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const chatLogs = Array.from(messages.values())
          .reverse()
          .filter(m => !m.author.bot)
          .map(m => `${m.author.username}: ${m.content}`)
          .join('\n');

        let summary = 'No discussion logged.';
        if (chatLogs) {
          summary = await generateSummary(`Ticket details:\n${chatLogs}`);
        }

        // Save closure summary in DB
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'CLOSED',
            aiSummary: summary
          }
        });

        await interaction.editReply("Archiving discussion logs and closing ticket...");
        
        // Notify inside channel and delete it after 5 seconds
        await interaction.channel.send(`*Jarvis summary compiled. Channel will self-destruct in 5 seconds...*\n\n**AI Log Summary:**\n${summary}`);
        
        setTimeout(async () => {
          await interaction.channel.delete().catch(console.error);
        }, 5000);
      }
    } catch (err) {
      console.error('[Ticket Command] Error:', err);
      await interaction.editReply("I failed to configure the ticket session, sir.");
    }
  }
};
