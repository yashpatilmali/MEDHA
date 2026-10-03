import express from 'express';
import { z } from 'zod';

import { requirePatient } from '../middleware/auth.js';
import { HttpError, validate } from '../middleware/errors.js';
import { Alert } from '../models/alert.js';
import { DeviceState } from '../models/device-state.js';
import { POSITIONS } from '../models/device-state.js';
import { Reading } from '../models/reading.js';
import {
  activate,
  deactivate,
  getDeviceStatus,
  NOT_ACTIVE,
  setPosition,
  startCalibration,
} from '../services/device-session.js';
import { ingestReading, readingSchema } from '../services/ingest.js';

export const monitoringRouter = express.Router();
monitoringRouter.use(requirePatient);

/** The latest reading from the patient's device, or null if it has never sent one. */
monitoringRouter.get('/latest', async (req, res) => {
  const state = await DeviceState.findOne({ deviceId: req.patient.deviceId });
  res.json({ snapshot: state?.receivedAt ? state.toSnapshot() : null });
});

/**
 * Saves a reading the app collected for the logged-in patient's own device:
 *
 *   POST /api/monitoring/readings
 *   Authorization: Bearer <token>
 *   { "pressure": 33.4, "temperature": 36.7, "humidity": 34.2 }
 *
 * Scored, stored and alerted exactly like an ESP32 upload; the reply is the scored reading.
 */
monitoringRouter.post('/readings', async (req, res) => {
  const reading = validate(readingSchema, req.body);
  const snapshot = await ingestReading(req.patient.deviceId, reading);
  if (!snapshot) {
    throw new HttpError(409, NOT_ACTIVE);
  }
  res.status(201).json(snapshot);
});

/** Whether the patch is activated and checking in, wear time, and calibration progress. */
monitoringRouter.get('/device', async (req, res) => {
  res.json(await getDeviceStatus(req.patient.deviceId));
});

/** Switches the patch's sensors on; it confirms within a few seconds. */
monitoringRouter.post('/device/activate', async (req, res) => {
  const { deviceId, patientId } = req.patient;
  res.json(await activate(deviceId, patientId));
});

const positionSchema = z.object({
  /** The patient's usual position, which decides where the patch goes. */
  position: z.enum(POSITIONS, { error: "Choose the patient's current position." }),
});

/** The patient's position, asked once the sensors are on: says where the patch was placed. */
monitoringRouter.post('/device/position', async (req, res) => {
  const { position } = validate(positionSchema, req.body);
  const { deviceId, patientId } = req.patient;
  res.json(await setPosition(deviceId, patientId, position));
});

/** Switches the patch's sensors off and ends the wear session. */
monitoringRouter.post('/device/deactivate', async (req, res) => {
  const { deviceId, patientId } = req.patient;
  res.json(await deactivate(deviceId, patientId));
});

/** Scans the initial readings: the device's next minute of readings becomes the baseline. */
monitoringRouter.post('/calibration', async (req, res) => {
  const { deviceId, patientId } = req.patient;
  res.status(201).json(await startCalibration(deviceId, patientId));
});

const historyQuery = z.object({
  minutes: z.coerce.number().int().min(1).max(7 * 24 * 60).default(60),
});

/** Reading history for trend charts, oldest first. */
monitoringRouter.get('/history', async (req, res) => {
  const { minutes } = validate(historyQuery, req.query);
  const readings = await Reading.find({
    patientId: req.patient.patientId,
    at: { $gte: new Date(Date.now() - minutes * 60 * 1000) },
  })
    .sort({ at: 1 })
    .limit(5000)
    .lean();

  res.json({
    readings: readings.map(({ at, pressure, temperature, humidity, riskScore, riskLevel }) => ({
      at: at.toISOString(),
      pressure,
      temperature,
      humidity,
      riskScore,
      riskLevel,
    })),
  });
});

const alertsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** The patient's immediate alerts, newest first, with the total count. */
monitoringRouter.get('/alerts', async (req, res) => {
  const { limit } = validate(alertsQuery, req.query);
  const filter = { patientId: req.patient.patientId };
  const [alerts, total] = await Promise.all([
    Alert.find(filter).sort({ at: -1 }).limit(limit),
    Alert.countDocuments(filter),
  ]);
  res.json({ total, alerts: alerts.map((alert) => alert.toJSONForApp()) });
});
