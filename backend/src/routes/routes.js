const express = require('express');
const router = express.Router();
const prisma = require('../db');
const scheduler = require('../scheduler/scheduler');
const { syncGuildsAndChannels } = require('../bot/bot');

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

module.exports = router;
