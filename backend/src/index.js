require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { client } = require('./bot/bot');
const { initScheduler } = require('./scheduler/scheduler');
const apiRoutes = require('./routes/routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    botOnline: client.isReady(),
    uptime: process.uptime()
  });
});

// General Error Handler
app.use((err, req, res, next) => {
  console.error('[API Error]:', err.stack || err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Express Server
const server = app.listen(PORT, async () => {
  console.log(`[Server] Backend API running on port ${PORT}`);
  
  // Start Discord Bot
  if (process.env.DISCORD_TOKEN) {
    try {
      console.log('[Bot] Logging in Discord bot...');
      await client.login(process.env.DISCORD_TOKEN);
      
      // Initialize schedules from database
      await initScheduler();
    } catch (error) {
      console.error('[Bot] Failed to login Discord bot or initialize scheduler:', error);
    }
  } else {
    console.warn('[Warning] DISCORD_TOKEN is not defined in the environment. Bot broadcasts will not work.');
    // Initialize scheduler anyway for status checks
    await initScheduler();
  }
});
