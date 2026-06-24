const cron = require('node-cron');
const prisma = require('../db');
const { sendMessage } = require('../bot/bot');

const { EmbedBuilder } = require('discord.js');
const { generateChallenge } = require('../services/ai');

// Store active jobs by schedule ID
// Format: { scheduleId: { type: 'cron'|'interval', job: CronJob|Timeout } }
const activeJobs = new Map();

/**
 * Executes a schedule task
 * @param {string} scheduleId 
 */
async function executeSchedule(scheduleId) {
  console.log(`[Scheduler] Executing schedule: ${scheduleId}`);
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId }
  });

  if (!schedule) {
    console.log(`[Scheduler] Schedule ${scheduleId} not found, stopping job.`);
    stopSchedule(scheduleId);
    return;
  }

  if (schedule.status !== 'ACTIVE') {
    console.log(`[Scheduler] Schedule ${scheduleId} is paused/inactive, stopping job.`);
    stopSchedule(scheduleId);
    return;
  }

  try {
    await sendMessage(schedule.channelId, schedule.messageContent);
    
    // Log success
    await prisma.log.create({
      data: {
        scheduleId: schedule.id,
        status: 'SUCCESS'
      }
    });
    console.log(`[Scheduler] Successfully broadcasted message for schedule ${scheduleId}`);
  } catch (error) {
    // Log failure
    await prisma.log.create({
      data: {
        scheduleId: schedule.id,
        status: 'FAILED',
        error: error.message || 'Unknown error'
      }
    });
    console.error(`[Scheduler] Failed to broadcast message for schedule ${scheduleId}:`, error);
  }
}

/**
 * Starts a job for a schedule
 * @param {object} schedule 
 */
function startSchedule(schedule) {
  // Ensure any existing running job for this schedule is stopped first
  stopSchedule(schedule.id);

  if (schedule.status !== 'ACTIVE') {
    return;
  }

  console.log(`[Scheduler] Starting schedule: ${schedule.name} (${schedule.id}) [Type: ${schedule.type}]`);

  const task = () => executeSchedule(schedule.id);

  if (schedule.type === 'cron') {
    if (!schedule.cronExpression) {
      console.error(`[Scheduler] Missing cron expression for schedule ${schedule.id}`);
      return;
    }
    
    // Verify cron expression is valid
    if (!cron.validate(schedule.cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression "${schedule.cronExpression}" for schedule ${schedule.id}`);
      return;
    }

    const job = cron.schedule(schedule.cronExpression, task);
    activeJobs.set(schedule.id, { type: 'cron', job });
  } else if (schedule.type === 'interval') {
    if (!schedule.intervalMinutes || schedule.intervalMinutes <= 0) {
      console.error(`[Scheduler] Invalid interval minutes for schedule ${schedule.id}`);
      return;
    }

    const intervalMs = schedule.intervalMinutes * 60 * 1000;
    const job = setInterval(task, intervalMs);
    activeJobs.set(schedule.id, { type: 'interval', job });
  }
}

/**
 * Stops and removes a schedule job
 * @param {string} scheduleId 
 */
function stopSchedule(scheduleId) {
  const activeJob = activeJobs.get(scheduleId);
  if (!activeJob) return;

  console.log(`[Scheduler] Stopping schedule: ${scheduleId}`);

  if (activeJob.type === 'cron') {
    activeJob.job.stop();
  } else if (activeJob.type === 'interval') {
    clearInterval(activeJob.job);
  }

  activeJobs.delete(scheduleId);
}

/**
 * Starts autonomous engagement loop cron jobs
 */
function startAutomatedCronJobs() {
  // 1. Daily Challenge Generation (runs daily at 9 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler] Running Daily Challenge cron job...');
    const { client } = require('../bot/bot');
    const guilds = client.guilds.cache;

    for (const [guildId, guild] of guilds) {
      try {
        const categories = ['Coding', 'Design', 'AI', 'Startup', 'Marketing', 'Motion Graphics'];
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        const challengeData = await generateChallenge(randomCat);

        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

        const challenge = await prisma.challenge.create({
          data: {
            title: challengeData.title,
            category: randomCat,
            description: challengeData.description,
            xpReward: challengeData.xpReward || 150,
            startDate: startDate,
            endDate: endDate
          }
        });

        const targetChannel = guild.channels.cache.find(c => 
          c.name.includes('weekly-challenges') || c.name.includes('contests')
        );

        if (targetChannel && targetChannel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor('#ffa502')
            .setTitle(`🏆 Daily challenge: ${challenge.title}`)
            .setDescription(`**Category:** ${randomCat}\n**Reward:** 🌟 ${challenge.xpReward} XP\n\n${challenge.description}`)
            .addFields({ name: 'Ends At', value: `<t:${Math.floor(endDate.getTime() / 1000)}:R>` })
            .setTimestamp();
          await targetChannel.send({ content: '@everyone A new daily challenge has begun!', embeds: [embed] });
        }
      } catch (err) {
        console.error(`[Scheduler] Failed to generate challenge for guild ${guildId}:`, err);
      }
    }
  });

  // 2. Showcase Friday (runs Friday at 10 AM)
  cron.schedule('0 10 * * 5', async () => {
    console.log('[Scheduler] Running Showcase Friday cron job...');
    const { client } = require('../bot/bot');
    const guilds = client.guilds.cache;

    for (const [guildId, guild] of guilds) {
      try {
        const targetChannel = guild.channels.cache.find(c => 
          c.name.includes('creator-showcase') || c.name.includes('share-your-work')
        );

        if (targetChannel && targetChannel.isTextBased()) {
          await targetChannel.send({
            content: `✨ **Happy Showcase Friday, creators!** \n\n"Today is the day to display your inventions, sir/madam. Please share links, screenshots, or code of what you have built this week. I will award **Double XP** for all showcase posts today!"`
          });
        }
      } catch (err) {
        console.error(`[Scheduler] Failed to run Showcase Friday for guild ${guildId}:`, err);
      }
    }
  });

  // 3. Daily Analytics Aggregation (runs daily at 11:59 PM)
  cron.schedule('59 23 * * *', async () => {
    console.log('[Scheduler] Running Daily Analytics Aggregator...');
    const { client } = require('../bot/bot');
    const guilds = client.guilds.cache;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const [guildId, guild] of guilds) {
      try {
        // Active Users count
        const activeUsersCount = await prisma.user.count({
          where: {
            guildId: guildId,
            lastActive: { gte: todayStart }
          }
        });

        // Message count
        const dbChannels = await prisma.channel.findMany({
          where: { guildId: guildId }
        });
        const channelIds = dbChannels.map(c => c.channelId);

        const messageCount = await prisma.message.count({
          where: {
            channelId: { in: channelIds },
            createdAt: { gte: todayStart }
          }
        });

        // Top Channel
        const channelGroups = await prisma.message.groupBy({
          by: ['channelId'],
          where: {
            channelId: { in: channelIds },
            createdAt: { gte: todayStart }
          },
          _count: {
            id: true
          }
        });

        let topChannelId = null;
        let maxMessages = 0;
        channelGroups.forEach(group => {
          if (group._count.id > maxMessages) {
            maxMessages = group._count.id;
            topChannelId = group.channelId;
          }
        });

        let topChannelName = 'N/A';
        if (topChannelId) {
          const discordChan = guild.channels.cache.get(topChannelId);
          topChannelName = discordChan ? `#${discordChan.name}` : 'Unknown';
        }

        // Save Analytic record
        await prisma.analytic.create({
          data: {
            guildId: guildId,
            date: new Date(),
            activeUsers: activeUsersCount,
            messageCount: messageCount,
            topChannel: topChannelName
          }
        });
        console.log(`[Scheduler] Saved daily analytics for guild ${guildId}: Users=${activeUsersCount}, Messages=${messageCount}, TopChannel=${topChannelName}`);
      } catch (err) {
        console.error(`[Scheduler] Failed to compile analytics for guild ${guildId}:`, err);
      }
    }
  });
}


/**
 * Initializes the scheduler on startup, fetching and starting all active schedules.
 */
async function initScheduler() {
  try {
    const activeSchedules = await prisma.schedule.findMany({
      where: { status: 'ACTIVE' }
    });
    
    console.log(`[Scheduler] Initializing: Found ${activeSchedules.length} active schedule(s).`);
    for (const schedule of activeSchedules) {
      startSchedule(schedule);
    }

    // Start automated challenge/showcase loops
    startAutomatedCronJobs();
  } catch (error) {
    console.error('[Scheduler] Failed to initialize scheduler:', error);
  }
}

module.exports = {
  initScheduler,
  startSchedule,
  stopSchedule
};

