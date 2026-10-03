import express from 'express';
import { z } from 'zod';

import { requirePatient } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { Alert } from '../models/alert.js';
import { DeviceState } from '../models/device-state.js';
import { Reading } from '../models/reading.js';
import {
  getCalibration,
  ingestReading,
  readingSchema,
  startCalibration,
} from '../services/ingest.js';

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
  res.status(201).json(snapshot);
});

/** Calibration progress and the baseline readings are scored against. */
monitoringRouter.get('/calibration', async (req, res) => {
  res.json({ calibration: await getCalibration(req.patient.deviceId) });
});

/** Starts a new 1-minute baseline calibration from the device's next reading. */
monitoringRouter.post('/calibration', async (req, res) => {
  const { deviceId, patientId } = req.patient;
  res.status(201).json({ calibration: await startCalibration(deviceId, patientId) });
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
