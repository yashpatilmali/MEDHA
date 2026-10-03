import mongoose from 'mongoose';

import { config } from './config.js';

let memoryServer = null;

export async function connectDatabase(uri = config.mongoUri) {
  if (!uri) {
    if (config.isProduction) {
      throw new Error('MONGODB_URI must be set in production.');
    }
    // Development without a database: run a throwaway MongoDB in memory.
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    console.warn(
      'MONGODB_URI is not set: using a temporary in-memory database. ' +
        'Accounts and readings are lost when the server stops.'
    );
  }

  await mongoose.connect(uri);
  // Build unique and TTL indexes before the first request relies on them.
  await mongoose.connection.syncIndexes();
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  await memoryServer?.stop();
  memoryServer = null;
}
