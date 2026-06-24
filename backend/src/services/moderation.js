const prisma = require('../db');

// Cache to track message timestamps for spam check
// Format: { userId: [timestamp1, timestamp2, ...] }
const messageCache = new Map();

/**
 * Checks if a message counts as spam (e.g. more than 5 messages in 4 seconds)
 * @param {string} userId 
 */
function checkSpam(userId) {
  const now = Date.now();
  if (!messageCache.has(userId)) {
    messageCache.set(userId, [now]);
    return false;
  }

  const timestamps = messageCache.get(userId);
  // Keep only timestamps from the last 4 seconds
  const recent = timestamps.filter(t => now - t < 4000);
  recent.push(now);
  messageCache.set(userId, recent);

  return recent.length > 5;
}

/**
 * Warns a user, saves to DB, and checks if warning threshold is reached (e.g. 5 warnings = auto mute)
 * @param {object} guild Discord guild object
 * @param {string} userId Discord user ID
 * @param {string} username Username
 * @param {string} reason Warning reason
 * @param {string} moderatorId Moderator user ID
 */
async function addWarning(guild, userId, username, reason, moderatorId) {
  try {
    // Ensure user exists in our DB
    const dbUser = await prisma.user.upsert({
      where: { discordId: userId },
      update: { lastActive: new Date() },
      create: {
        discordId: userId,
        username: username,
        guildId: guild.id,
      }
    });

    // Create Warning
    const warning = await prisma.warning.create({
      data: {
        userId: dbUser.id,
        guildId: guild.id,
        reason: reason,
        moderatorId: moderatorId,
        points: 1
      }
    });

    // Count warning points
    const userWarningsCount = await prisma.warning.count({
      where: {
        userId: dbUser.id,
        guildId: guild.id
      }
    });

    let autoAction = null;
    // Auto-actions based on warnings
    if (userWarningsCount >= 5) {
      autoAction = 'BAN';
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        await member.ban({ reason: `Automatic ban: exceeded warning limit (${userWarningsCount} warnings).` });
      }
    } else if (userWarningsCount >= 3) {
      autoAction = 'MUTE';
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        // Mute user for 10 minutes (timeout in discord.js v14)
        await member.timeout(10 * 60 * 1000, `Automatic timeout: reached ${userWarningsCount} warnings.`).catch(console.error);
      }
    }

    return { warning, warningCount: userWarningsCount, autoAction };
  } catch (error) {
    console.error('[Moderation Service] Error adding warning:', error);
    throw error;
  }
}

module.exports = {
  checkSpam,
  addWarning
};
