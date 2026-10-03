import express from 'express';

import { requireDevice } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { ingestReading, readingSchema } from '../services/ingest.js';

export const deviceRouter = express.Router();

/**
 * Called by each ESP32 about once a second:
 *
 *   POST /api/devices/SP-ESP32-001/readings
 *   X-Device-Key: <DEVICE_API_KEY>
 *   { "pressure": 33.4, "temperature": 36.7, "humidity": 34.2 }
 *
 * The reply includes the risk (null while calibrating the baseline), so the device can sound a
 * local buzzer on `risk.immediateAlert`, and the calibration status.
 */
deviceRouter.post('/:deviceId/readings', requireDevice, async (req, res) => {
  const reading = validate(readingSchema, req.body);
  const snapshot = await ingestReading(req.params.deviceId, reading);
  res.status(201).json(snapshot);
});
