import http from 'node:http';
import os from 'node:os';

import { createApp } from './app.js';
import { config } from './config.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { attachRealtime, closeRealtime } from './realtime.js';

await connectDatabase();

const server = http.createServer(createApp());
attachRealtime(server);

server.listen(config.port, () => {
  console.log(`Sparsh API listening on http://localhost:${config.port}`);
  if (!config.isProduction) {
    // Phones on the same Wi-Fi reach this computer by its network address, not "localhost".
    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family === 'IPv4' && !address.internal) {
          console.log(`  on your network: http://${address.address}:${config.port}`);
        }
      }
    }
  }
  if (!config.deviceApiKey) {
    console.warn('DEVICE_API_KEY is not set: ESP32 uploads will be refused.');
  }
});

async function shutdown() {
  // Closing Socket.IO also closes the HTTP server.
  await closeRealtime();
  await disconnectDatabase();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
