'use strict';
const mongoose = require('mongoose');
const config = require('./config/env');
const { connectDb } = require('./config/db');
const createApp = require('./app');

async function main() {
  try {
    await connectDb(config.mongoUri);
    console.log('[db] connected');
  } catch (err) {
    console.error(`[db] could not connect to MongoDB: ${err.message}`);
    console.error('[db] check MONGO_URI in server/.env and that MongoDB is reachable.');
    process.exit(1);
  }

  const server = createApp(config).listen(config.port, () => {
    console.log(`[server] LeadPilot API listening on port ${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled promise rejection:', reason);
  process.exit(1);
});

main();
