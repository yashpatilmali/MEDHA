import { Server } from 'socket.io';

import { config } from './config.js';
import { verifyToken } from './middleware/auth.js';
import { DeviceState } from './models/device-state.js';
import { Patient } from './models/patient.js';
import { getDeviceStatus } from './services/device-session.js';

let io = null;

const roomFor = (patientId) => `patient:${patientId}`;

/**
 * Live updates for the app. A client connects with `auth: { token }`, joins its patient's room,
 * immediately gets the device status and the latest reading, then receives `status` (activation,
 * wear time, calibration), `reading` and `alert` events as they happen.
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
      if (patient) {
        socket.emit('status', await getDeviceStatus(patient.deviceId));
      }
      if (state?.receivedAt) {
        socket.emit('reading', state.toSnapshot());
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
