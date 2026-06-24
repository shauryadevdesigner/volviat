const cron = require('node-cron');
const prisma = require('../db');
const { sendMessage } = require('../bot/bot');

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
  } catch (error) {
    console.error('[Scheduler] Failed to initialize scheduler:', error);
  }
}

module.exports = {
  initScheduler,
  startSchedule,
  stopSchedule
};
