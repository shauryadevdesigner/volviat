const prisma = require('./db');

async function main() {
  console.log('--- Starting Database Integration Test ---');
  try {
    // 1. Create a server
    console.log('1. Creating test server...');
    const server = await prisma.server.upsert({
      where: { guildId: 'test-guild-123' },
      update: {},
      create: {
        guildId: 'test-guild-123',
        name: 'Test Server',
        ownerId: 'test-owner-999'
      }
    });
    console.log('Success: Server created ->', server.name);

    // 2. Create a channel
    console.log('2. Creating test channel...');
    const channel = await prisma.channel.upsert({
      where: { channelId: 'test-channel-456' },
      update: {},
      create: {
        guildId: 'test-guild-123',
        channelId: 'test-channel-456',
        name: 'test-general',
        type: 'TEXT'
      }
    });
    console.log('Success: Channel created ->', channel.name);

    // 3. Create a schedule
    console.log('3. Creating test schedule...');
    const schedule = await prisma.schedule.create({
      data: {
        name: 'Test Announcement',
        type: 'interval',
        intervalMinutes: 10,
        guildId: 'test-guild-123',
        channelId: 'test-channel-456',
        messageContent: 'Hello world!',
        status: 'PAUSED'
      }
    });
    console.log('Success: Schedule created ->', schedule.name, `(${schedule.id})`);

    // 4. Create an execution log
    console.log('4. Creating test execution log...');
    const log = await prisma.log.create({
      data: {
        scheduleId: schedule.id,
        status: 'SUCCESS'
      }
    });
    console.log('Success: Execution log created with status ->', log.status);

    // 5. Clean up test data
    console.log('5. Cleaning up test data...');
    await prisma.log.deleteMany({ where: { scheduleId: schedule.id } });
    await prisma.schedule.delete({ where: { id: schedule.id } });
    await prisma.channel.delete({ where: { channelId: channel.channelId } });
    await prisma.server.delete({ where: { guildId: server.guildId } });
    console.log('Success: Cleanup completed.');
    
    console.log('=======================================');
    console.log('DATABASE INTEGRATION TEST PASSED SUCCESSFULLY!');
    console.log('=======================================');
  } catch (error) {
    console.error('DATABASE INTEGRATION TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
