const prisma = require('../db');

/**
 * Saves or updates a user/server memory
 * @param {string} guildId 
 * @param {string|null} userId 
 * @param {string} key e.g. "project", "interest", "role"
 * @param {string} value e.g. "Shaurya is building Volviq AI"
 */
async function saveMemory(guildId, userId, key, value) {
  try {
    // Check if memory already exists
    const existing = await prisma.memory.findFirst({
      where: {
        guildId,
        userId,
        key
      }
    });

    if (existing) {
      await prisma.memory.update({
        where: { id: existing.id },
        data: { value, timestamp: new Date() }
      });
    } else {
      await prisma.memory.create({
        data: {
          guildId,
          userId,
          key,
          value
        }
      });
    }
    console.log(`[Memory Service] Saved memory: [${key}] -> "${value}"`);
  } catch (error) {
    console.error('[Memory Service] Error saving memory:', error);
  }
}

/**
 * Retrieves memories relevant to the query to inject as RAG context
 * @param {string} guildId 
 * @param {string} userId 
 * @param {string} query The user message or prompt
 */
async function getMemoriesForContext(guildId, userId, query) {
  try {
    // 1. Fetch all memories for the user & server
    const memories = await prisma.memory.findMany({
      where: {
        guildId,
        OR: [
          { userId: null }, // Server-wide facts
          { userId }       // User-specific facts
        ]
      }
    });

    if (memories.length === 0) return '';

    // 2. Perform simple keyword-matching RAG (semantic search fallback)
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchedMemories = [];

    for (const mem of memories) {
      const content = `${mem.key} ${mem.value}`.toLowerCase();
      // Calculate match score
      let score = 0;
      for (const word of keywords) {
        if (content.includes(word)) {
          score++;
        }
      }
      // If there's a match, or if it is an essential general memory, include it
      if (score > 0 || mem.key === 'essential') {
        matchedMemories.push({ mem, score });
      }
    }

    // Sort by match score descending
    matchedMemories.sort((a, b) => b.score - a.score);

    // Take top 5 matching memories
    const topMemories = matchedMemories.slice(0, 5).map(item => item.mem);

    if (topMemories.length === 0) return '';

    // 3. Format into a context block
    let contextBlock = '\n=== Context Memory (RAG) ===\n';
    contextBlock += 'Use the following known facts to customize your response if relevant:\n';
    for (const mem of topMemories) {
      contextBlock += `- ${mem.value}\n`;
    }
    contextBlock += '============================\n';
    return contextBlock;
  } catch (error) {
    console.error('[Memory Service] Error getting memories:', error);
    return '';
  }
}

module.exports = {
  saveMemory,
  getMemoriesForContext
};
