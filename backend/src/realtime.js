import { Server } from 'socket.io';

import { config } from './config.js';
import { verifyToken } from './middleware/auth.js';
import { DeviceState } from './models/device-state.js';
import { Patient } from './models/patient.js';
import { getCalibration } from './services/ingest.js';

let io = null;

const roomFor = (patientId) => `patient:${patientId}`;

/**
 * Live updates for the app. A client connects with `auth: { token }`, joins its patient's room,
 * immediately gets the latest reading (or, before the first one, the calibration status), then
 * receives `reading`, `alert` and `calibration` events as they happen.
 */
export function attachRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',') },
  });

  io.use((socket, next) => {
    try {
      socket.data.patientId = verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { patientId } = socket.data;
    socket.join(roomFor(patientId));
    try {
      const patient = await Patient.findOne({ patientId });
      const state = patient && (await DeviceState.findOne({ deviceId: patient.deviceId }));
      if (state?.receivedAt) {
        socket.emit('reading', state.toSnapshot());
      } else if (patient) {
        socket.emit('calibration', await getCalibration(patient.deviceId));
      }
    } catch (error) {
      console.error('Could not send the latest reading to a new connection:', error);
    }
  });

  return io;
}

export function publish(patientId, event, payload) {
  io?.to(roomFor(patientId)).emit(event, payload);
}

export function closeRealtime() {
  return new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => resolve());
    io = null;
  });
}
