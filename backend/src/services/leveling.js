const prisma = require('../db');

// Cooldown map to prevent spamming messages for XP
// Format: { userId: lastXpGainTime }
const xpCooldowns = new Map();
const COOLDOWN_TIME = 60 * 1000; // 60 seconds

/**
 * Adds XP to a user and check for level-ups
 * @param {object} guild Discord guild object
 * @param {string} userId Discord user ID
 * @param {string} username Username
 */
async function addXP(guild, userId, username) {
  const now = Date.now();
  const lastGain = xpCooldowns.get(userId) || 0;
  
  if (now - lastGain < COOLDOWN_TIME) {
    return { leveledUp: false, level: 0 };
  }

  // Set cooldown
  xpCooldowns.set(userId, now);

  const xpToAdd = Math.floor(Math.random() * 11) + 15; // 15-25 XP

  try {
    const dbUser = await prisma.user.upsert({
      where: { discordId: userId },
      update: {
        xp: { increment: xpToAdd },
        lastActive: new Date()
      },
      create: {
        discordId: userId,
        username: username,
        guildId: guild.id,
        xp: xpToAdd,
        level: 1
      }
    });

    // Level curve: Level = floor(sqrt(XP / 100)) + 1
    const currentLevel = dbUser.level;
    const calculatedLevel = Math.floor(Math.sqrt(dbUser.xp / 100)) + 1;

    let leveledUp = false;
    if (calculatedLevel > currentLevel) {
      leveledUp = true;
      
      // Update level in DB
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { level: calculatedLevel }
      });

      // Role rewards
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        let rewardRoleName = null;
        if (calculatedLevel >= 15) rewardRoleName = '🏆 Top Creator';
        else if (calculatedLevel >= 10) rewardRoleName = '🔥 Community Star';
        else if (calculatedLevel >= 5) rewardRoleName = '❤️ OG Member';

        if (rewardRoleName) {
          const role = guild.roles.cache.find(r => r.name === rewardRoleName);
          if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role).catch(console.error);
          }
        }
      }
    }

    return { leveledUp, level: calculatedLevel, xp: dbUser.xp + xpToAdd };
  } catch (error) {
    console.error('[Leveling Service] Error adding XP:', error);
    return { leveledUp: false, level: 0 };
  }
}

module.exports = {
  addXP
};
