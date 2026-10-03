import express from 'express';
import { z } from 'zod';

import { requireDevice } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { NOT_ACTIVE, recordHeartbeat } from '../services/device-session.js';
import { ingestReading, readingSchema } from '../services/ingest.js';

const heartbeatSchema = z.object({
  /** Whether the ESP32's sensors are on. */
  active: z.boolean({ error: 'active must be true or false.' }),
  /** Whether they gave a valid reading in the self-check. */
  sensorsOk: z.boolean().optional(),
});

export const deviceRouter = express.Router();

/**
 * Called every few seconds while the ESP32 isn't sending readings:
 *
 *   POST /api/devices/SP-ESP32-001/heartbeat
 *   X-Device-Key: <DEVICE_API_KEY>
 *   { "active": false }
 *
 * Replies { "activate": true|false, "calibration": "none"|"waiting"|"running"|"complete" }: the
 * ESP32 switches its sensors on when `activate` turns true, and reports back on the next call.
 */
deviceRouter.post('/:deviceId/heartbeat', requireDevice, async (req, res) => {
  const body = validate(heartbeatSchema, req.body);
  res.json(await recordHeartbeat(req.params.deviceId, body));
});

/**
 * Called by each ESP32 every couple of seconds while its sensors are activated:
 *
 *   POST /api/devices/SP-ESP32-001/readings
 *   X-Device-Key: <DEVICE_API_KEY>
 *   { "pressure": 33.4, "temperature": 36.7, "humidity": 34.2 }
 *
 * The reply includes the risk (null until the initial scan is done), so the device can sound a
 * local buzzer on `risk.immediateAlert`, and `activate`. When the sensors are deactivated in the
 * app, the reading is refused with 409 and `"activate": false`, so the ESP32 switches them off.
 */
deviceRouter.post('/:deviceId/readings', requireDevice, async (req, res) => {
  const reading = validate(readingSchema, req.body);
  const snapshot = await ingestReading(req.params.deviceId, reading);
  if (!snapshot) {
    res.status(409).json({ error: NOT_ACTIVE, activate: false });
    return;
  }
  res.status(201).json({ ...snapshot, activate: true });
});
