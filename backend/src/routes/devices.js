import express from 'express';
import { z } from 'zod';

import { requireDevice } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { ingestReading } from '../services/ingest.js';

const readingSchema = z.object({
  /** FSR402 pressure estimate. */
  pressure: z.number({ error: 'pressure must be a number.' }).min(0).max(1000),
  /** SHTC3 temperature in °C (the sensor's range is −40 to 125). */
  temperature: z.number({ error: 'temperature must be a number.' }).min(-40).max(125),
  /** SHTC3 relative humidity in %. */
  humidity: z.number({ error: 'humidity must be a number.' }).min(0).max(100),
});

export const deviceRouter = express.Router();

/**
 * Called by each ESP32 about once a second:
 *
 *   POST /api/devices/SP-ESP32-001/readings
 *   X-Device-Key: <DEVICE_API_KEY>
 *   { "pressure": 33.4, "temperature": 36.7, "humidity": 34.2 }
 *
 * The reply includes the risk, so the device can sound a local buzzer on `risk.immediateAlert`.
 */
deviceRouter.post('/:deviceId/readings', requireDevice, async (req, res) => {
  const reading = validate(readingSchema, req.body);
  const snapshot = await ingestReading(req.params.deviceId, reading);
  res.status(201).json(snapshot);
});
