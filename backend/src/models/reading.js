import mongoose from 'mongoose';

import { config } from '../config.js';

/** Reading history for trend charts, sampled every few seconds and deleted after the retention period. */
const readingSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true },
    deviceId: { type: String, required: true },
    at: { type: Date, required: true },
    pressure: Number,
    temperature: Number,
    humidity: Number,
    pressureDuration: Number,
    riskScore: Number,
    riskLevel: String,
  },
  { versionKey: false }
);

readingSchema.index({ patientId: 1, at: -1 });
readingSchema.index({ at: 1 }, { expireAfterSeconds: config.historyRetentionDays * 24 * 60 * 60 });

export const Reading = mongoose.model('Reading', readingSchema);
