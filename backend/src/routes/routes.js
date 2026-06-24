const express = require('express');
const router = express.Router();
const prisma = require('../db');
const scheduler = require('../scheduler/scheduler');
const { syncGuildsAndChannels, client } = require('../bot/bot');

// Helper to handle async route errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 1. Get all active servers/guilds
router.get('/servers', asyncHandler(async (req, res) => {
  const servers = await prisma.server.findMany({
    orderBy: { name: 'asc' }
  });
  res.json(servers);
}));

// 2. Get text channels for a specific guild
router.get('/channels/:guildId', asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  const channels = await prisma.channel.findMany({
    where: { guildId },
    orderBy: { name: 'asc' }
  });
  res.json(channels);
}));

// 3. Force trigger a guilds/channels sync
router.post('/sync', asyncHandler(async (req, res) => {
  await syncGuildsAndChannels();
  res.json({ success: true, message: 'Synchronization triggered' });
}));

// 4. Get all schedules
router.get('/schedules', asyncHandler(async (req, res) => {
  const schedules = await prisma.schedule.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      logs: {
        orderBy: { timestamp: 'desc' },
        take: 5
      }
    }
  });
  res.json(schedules);
}));

// 5. Create a new schedule
router.post('/schedule/create', asyncHandler(async (req, res) => {
  const {
    name,
    type, // 'cron' or 'interval'
    cronExpression,
    intervalMinutes,
    guildId,
    channelId,
    messageContent,
    status // 'ACTIVE' or 'PAUSED'
  } = req.body;

  // Simple validation
  if (!name || !type || !guildId || !channelId || !messageContent) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (type === 'cron' && !cronExpression) {
    return res.status(400).json({ error: 'Cron expression is required for cron type schedule' });
  }

  if (type === 'interval' && (!intervalMinutes || intervalMinutes <= 0)) {
    return res.status(400).json({ error: 'Valid interval minutes are required for interval type schedule' });
  }

  const newSchedule = await prisma.schedule.create({
    data: {
      name,
      type,
      cronExpression: type === 'cron' ? cronExpression : null,
      intervalMinutes: type === 'interval' ? parseInt(intervalMinutes, 10) : null,
      guildId,
      channelId,
      messageContent,
      status: status || 'ACTIVE'
    }
  });

  // Start schedule in scheduler if ACTIVE
  if (newSchedule.status === 'ACTIVE') {
    scheduler.startSchedule(newSchedule);
  }

  res.status(201).json(newSchedule);
}));

// 6. Update an existing schedule
router.post('/schedule/update', asyncHandler(async (req, res) => {
  const {
    id,
    name,
    type,
    cronExpression,
    intervalMinutes,
    guildId,
    channelId,
    messageContent,
    status
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Schedule ID is required' });
  }

  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  const updatedSchedule = await prisma.schedule.update({
    where: { id },
    data: {
      name: name !== undefined ? name : existing.name,
      type: type !== undefined ? type : existing.type,
      cronExpression: type === 'cron' ? cronExpression : (type === undefined && existing.type === 'cron' ? cronExpression : null),
      intervalMinutes: type === 'interval' ? parseInt(intervalMinutes, 10) : (type === undefined && existing.type === 'interval' ? parseInt(intervalMinutes, 10) : null),
      guildId: guildId !== undefined ? guildId : existing.guildId,
      channelId: channelId !== undefined ? channelId : existing.channelId,
      messageContent: messageContent !== undefined ? messageContent : existing.messageContent,
      status: status !== undefined ? status : existing.status
    }
  });

  // Update schedule job state
  if (updatedSchedule.status === 'ACTIVE') {
    scheduler.startSchedule(updatedSchedule);
  } else {
    scheduler.stopSchedule(updatedSchedule.id);
  }

  res.json(updatedSchedule);
}));

// 7. Delete a schedule
router.post('/schedule/delete', asyncHandler(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Schedule ID is required' });
  }

  // Stop running job
  scheduler.stopSchedule(id);

  // Delete from DB
  await prisma.schedule.delete({ where: { id } });

  res.json({ success: true, message: 'Schedule deleted successfully' });
}));

// 8. Get logs for a specific schedule
router.get('/logs/:scheduleId', asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const logs = await prisma.log.findMany({
    where: { scheduleId },
    orderBy: { timestamp: 'desc' }
  });
  res.json(logs);
}));

// 9. Get all logs (for audit log page)
router.get('/logs', asyncHandler(async (req, res) => {
  const logs = await prisma.log.findMany({
    orderBy: { timestamp: 'desc' },
    include: {
      schedule: {
        select: { name: true }
      }
    },
    take: 50
  });
  res.json(logs);
}));

// 10. Auto setup a beautiful server layout
router.post('/setup-server', asyncHandler(async (req, res) => {
  const { guildId } = req.body;
  if (!guildId) {
    return res.status(400).json({ error: 'Guild ID is required' });
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return res.status(404).json({ error: 'Bot is not in this server or server is inaccessible.' });
  }

  console.log(`[Setup Server] Commencing server setup for Guild: ${guild.name} (${guild.id})`);

  // Delete all existing channels to make a completely fresh server
  const existingChannels = await guild.channels.fetch();
  for (const [id, channel] of existingChannels) {
    if (channel) {
      await channel.delete().catch(err => console.log(`[Setup Server] Error deleting channel: ${err.message}`));
    }
  }

  // Create roles
  const rolesToCreate = [
    { name: '👑 Founder', color: '#ff4757' },
    { name: '🚀 Co-Founder', color: '#ff6b81' },
    { name: '🧠 Core Team', color: '#ffa502' },
    { name: '🌟 Creator', color: '#2ed573' },
    { name: '🎬 YouTuber', color: '#ff4757' },
    { name: '🎙️ Podcaster', color: '#1e90ff' },
    { name: '✍️ Writer', color: '#70a1ff' },
    { name: '🎨 Designer', color: '#eccc68' },
    { name: '💻 Developer', color: '#747d8c' },
    { name: '💎 Premium', color: '#f1c40f' },
    { name: '🧪 Beta Tester', color: '#2ecc71' },
    { name: '🛰️ Early Access', color: '#3498db' },
    { name: '🏆 Top Creator', color: '#9b59b6' },
    { name: '🔥 Community Star', color: '#e67e22' },
    { name: '❤️ OG Member', color: '#1abc9c' }
  ];
  for (const r of rolesToCreate) {
    const exists = guild.roles.cache.find(role => role.name === r.name);
    if (!exists) {
      await guild.roles.create({
        name: r.name,
        color: r.color,
        reason: 'Antigravity AI server setup'
      }).catch(err => console.log(`[Setup Server] Error creating role ${r.name}: ${err.message}`));
    }
  }

  // Categories and channels structure
  const categories = [
    {
      name: '🌌 INFORMATION',
      channels: [
        { name: '📌│start-here', type: 0 },
        { name: '👋│welcome', type: 0 },
        { name: '📋│rules', type: 0 },
        { name: '📢│announcements', type: 0 },
        { name: '🗺️│roadmap', type: 0 },
        { name: '🔄│changelog', type: 0 },
        { name: '❓│faq', type: 0 }
      ]
    },
    {
      name: '🚀 ONBOARDING',
      channels: [
        { name: '✨│get-started', type: 0 },
        { name: '🙋│introduce-yourself', type: 0 },
        { name: '🎭│choose-roles', type: 0 },
        { name: '✅│verify', type: 0 },
        { name: '🎯│creator-goals', type: 0 }
      ]
    },
    {
      name: '🌍 COMMUNITY HUB',
      channels: [
        { name: '💬│general-chat', type: 0 },
        { name: '🎲│random', type: 0 },
        { name: '🐸│memes', type: 0 },
        { name: '💻│show-your-setup', type: 0 },
        { name: '🏆│wins-and-milestones', type: 0 },
        { name: '🍹│creator-lounge', type: 0 },
        { name: '🔊│General VC', type: 2 },
        { name: '🎙️│Creator Hangout', type: 2 }
      ]
    },
    {
      name: '🎬 CREATOR ZONE',
      channels: [
        { name: '📝│share-your-work', type: 0 },
        { name: '💬│feedback-zone', type: 0 },
        { name: '✨│creator-showcase', type: 0 },
        { name: '💡│content-ideas', type: 0 },
        { name: '🖼️│thumbnail-reviews', type: 0 },
        { name: '✂️│editing-tips', type: 0 },
        { name: '🎥│Co-working VC', type: 2 },
        { name: '✂️│Editing Room', type: 2 }
      ]
    },
    {
      name: '🪐 AI PLATFORM',
      channels: [
        { name: '🤖│ai-updates', type: 0 },
        { name: '💡│feature-requests', type: 0 },
        { name: '🐛│bug-reports', type: 0 },
        { name: '🎫│support', type: 0 },
        { name: '💬│model-discussions', type: 0 },
        { name: '🧩│prompt-sharing', type: 0 },
        { name: '🛒│prompt-marketplace', type: 0 }
      ]
    },
    {
      name: '🔬 EXPERIMENTS',
      channels: [
        { name: '📰│ai-news', type: 0 },
        { name: '🔄│workflow-sharing', type: 0 },
        { name: '⚡│automation-builds', type: 0 },
        { name: '🛠️│tool-recommendations', type: 0 },
        { name: '⚙️│n8n-workflows', type: 0 },
        { name: '🧠│advanced-prompts', type: 0 }
      ]
    },
    {
      name: '📈 GROWTH HUB',
      channels: [
        { name: '🎥│youtube-growth', type: 0 },
        { name: '📱│short-form-strategies', type: 0 },
        { name: '💰│monetization', type: 0 },
        { name: '🤝│brand-deals', type: 0 },
        { name: '🔍│seo-discussion', type: 0 },
        { name: '📈│analytics-help', type: 0 }
      ]
    },
    {
      name: '💎 INSIDER CLUB',
      channels: [
        { name: '👑│exclusive-announcements', type: 0 },
        { name: '💎│premium-prompts', type: 0 },
        { name: '🔒│private-support', type: 0 },
        { name: '⏰│office-hours', type: 0 },
        { name: '🚀│early-access', type: 0 }
      ]
    },
    {
      name: '🎪 EVENTS',
      channels: [
        { name: '📢│event-announcements', type: 0 },
        { name: '🏆│weekly-challenges', type: 0 },
        { name: '⚔️│community-contests', type: 0 },
        { name: '❓│ama-questions', type: 0 },
        { name: '🎤│Stage Events', type: 2 }, 
        { name: '🔥│Live Workshops', type: 2 }
      ]
    },
    {
      name: '⚙️ BOTS',
      channels: [
        { name: '🤖│bot-commands', type: 0 },
        { name: '🎟️│create-ticket', type: 0 },
        { name: '🧠│ai-generate', type: 0 },
        { name: '🏆│leaderboard', type: 0 }
      ]
    },
    {
      name: '🛡️ STAFF ONLY',
      channels: [
        { name: '💬│staff-chat', type: 0 },
        { name: '🪵│mod-logs', type: 0 },
        { name: '🚨│report-center', type: 0 },
        { name: '📋│staff-tasks', type: 0 },
        { name: '📥│appeals', type: 0 },
        { name: '👥│Staff VC', type: 2 }
      ]
    }
  ];

  for (const cat of categories) {
    try {
      const category = await guild.channels.create({
        name: cat.name,
        type: 4 // GuildCategory
      });
      for (const chan of cat.channels) {
        await guild.channels.create({
          name: chan.name,
          type: chan.type,
          parent: category.id
        }).catch(err => console.log(`[Setup Server] Error creating channel ${chan.name}: ${err.message}`));
      }
    } catch (err) {
      console.log(`[Setup Server] Error creating category ${cat.name}: ${err.message}`);
    }
  }

  // Force trigger channels & guilds sync to DB
  await syncGuildsAndChannels();

  res.json({ success: true, message: 'Server layout setup completed successfully' });
}));

// 11. Get Analytics for a guild
router.get('/analytics/:guildId', asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  const analytics = await prisma.analytic.findMany({
    where: { guildId },
    orderBy: { date: 'desc' },
    take: 30
  });
  res.json(analytics);
}));

// 12. Get Leaderboard for a guild
router.get('/leaderboard/:guildId', asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  const users = await prisma.user.findMany({
    where: { guildId },
    orderBy: { xp: 'desc' },
    take: 50
  });
  res.json(users);
}));

// 13. Get Tickets for a guild
router.get('/tickets/:guildId', asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  const tickets = await prisma.ticket.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { username: true }
      }
    }
  });
  res.json(tickets);
}));

// 14. Get Challenges for a guild
router.get('/challenges/:guildId', asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  // Challenges are global, but we can query them with their submissions
  const challenges = await prisma.challenge.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      submissions: {
        include: {
          user: {
            select: { username: true }
          }
        }
      }
    },
    take: 10
  });
  res.json(challenges);
}));

// 15. Get Memories for a guild
router.get('/memories/:guildId', asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  const memories = await prisma.memory.findMany({
    where: { guildId },
    orderBy: { timestamp: 'desc' }
  });
  res.json(memories);
}));

module.exports = router;

