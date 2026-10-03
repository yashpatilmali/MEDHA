import { z } from 'zod';

import { HttpError } from '../middleware/errors.js';
import { Alert } from '../models/alert.js';
import { CALIBRATION_SECONDS, DeviceState, newCalibration } from '../models/device-state.js';
import { Patient } from '../models/patient.js';
import { Reading } from '../models/reading.js';
import { publish } from '../realtime.js';
import { notifyCaretaker, shouldNotify } from './caretaker-alerts.js';
import { serialize } from './device-queue.js';
import { calculateRisk, elevatedPressure } from './risk-engine.js';

/** One reading: FSR402 pressure plus SHTC3 temperature and humidity. */
export const readingSchema = z.object({
  /** FSR402 pressure estimate. */
  pressure: z.number({ error: 'pressure must be a number.' }).min(0).max(1000),
  /** SHTC3 temperature in °C (the sensor's range is −40 to 125). */
  temperature: z.number({ error: 'temperature must be a number.' }).min(-40).max(125),
  /** SHTC3 relative humidity in %. */
  humidity: z.number({ error: 'humidity must be a number.' }).min(0).max(100),
});

/** Readings further apart than this are not treated as one continuous run of pressure. */
const MAX_GAP_MS = 60 * 1000;

/** How often a reading is copied into history (level changes and alerts are always copied). */
const HISTORY_INTERVAL_MS = 10 * 1000;


/** Calibration needs at least this many readings, or it starts again. */
const MIN_CALIBRATION_SAMPLES = 5;

/**
 * Feeds a reading to the calibration (initial scan) in progress, if one was started from the app.
 * After CALIBRATION_SECONDS the average becomes the baseline; too few readings start it again.
 */
function calibrate(state, reading, receivedAt) {
  if (!state.calibration) return;

  let { startedAt, samples, sum } = state.calibration;
  if (startedAt && receivedAt - startedAt >= CALIBRATION_SECONDS * 1000) {
    if (samples >= MIN_CALIBRATION_SAMPLES) {
      const average = (key) => Math.round((sum[key] / samples) * 10) / 10;
      state.baseline = {
        pressure: average('pressure'),
        temperature: average('temperature'),
        humidity: average('humidity'),
        samples,
        calibratedAt: receivedAt,
      };
      state.calibration = null;
      return;
    }
    startedAt = null;
  }
  if (!startedAt) {
    ({ samples, sum } = newCalibration());
    startedAt = receivedAt;
  }
  state.calibration = {
    startedAt,
    samples: samples + 1,
    sum: {
      pressure: sum.pressure + reading.pressure,
      temperature: sum.temperature + reading.temperature,
      humidity: sum.humidity + reading.humidity,
    },
  };
}

/**
 * Processes one reading from an ESP32: calibrates the baseline or scores the reading against it,
 * works out how long pressure has stayed elevated, keeps history and alerts under the patient's
 * ID, and pushes the result to their app.
 *
 * Returns null, without keeping the reading, when the sensors haven't been activated in the app.
 */
export function ingestReading(deviceId, reading, receivedAt = new Date()) {
  return serialize(deviceId, async () => {
    const patient = await Patient.findOne({ deviceId });
    if (!patient) {
      throw new HttpError(404, `No patient is registered with device ${deviceId}.`);
    }
    const { patientId } = patient;

    const state =
      (await DeviceState.findOne({ deviceId })) ?? new DeviceState({ deviceId, patientId });
    // Only a working, switched-on patch sends readings.
    Object.assign(state, { deviceActive: true, sensorsOk: true, lastSeenAt: receivedAt });
    if (!state.active) {
      await state.save();
      return null;
    }

    const continuous = state.receivedAt != null && receivedAt - state.receivedAt <= MAX_GAP_MS;

    calibrate(state, reading, receivedAt);
    const { baseline } = state;

    let highPressureSince = null;
    let pressureDuration = 0;
    let risk = null;
    if (baseline) {
      if (reading.pressure >= elevatedPressure(baseline)) {
        highPressureSince = (continuous && state.highPressureSince) || receivedAt;
        pressureDuration = Math.floor((receivedAt - highPressureSince) / 1000);
      }
      risk = calculateRisk(reading, baseline, pressureDuration);
    }
    const alertStarted = Boolean(risk?.immediateAlert) && !(continuous && state.alerting);
    const textCaretaker =
      risk !== null &&
      shouldNotify({
        level: risk.riskLevel,
        previousLevel: continuous ? state.risk?.riskLevel : undefined,
        lastNotified: state.notified,
        now: receivedAt,
      });
    if (textCaretaker) {
      state.notified = { level: risk.riskLevel, at: receivedAt };
    }

    const dueForHistory =
      alertStarted ||
      (state.risk?.riskLevel ?? null) !== (risk?.riskLevel ?? null) ||
      !state.lastStoredAt ||
      receivedAt - state.lastStoredAt >= HISTORY_INTERVAL_MS;
    if (dueForHistory) {
      await Reading.create({
        patientId,
        deviceId,
        at: receivedAt,
        ...reading,
        pressureDuration,
        riskScore: risk?.riskScore,
        riskLevel: risk?.riskLevel,
      });
      state.lastStoredAt = receivedAt;
    }

    const alert = alertStarted
      ? await Alert.create({
          patientId,
          deviceId,
          at: receivedAt,
          ...reading,
          pressureDuration,
          riskScore: risk.riskScore,
        })
      : null;

    Object.assign(state, {
      patientId,
      reading,
      receivedAt,
      highPressureSince,
      pressureDuration,
      risk,
      alerting: Boolean(risk?.immediateAlert),
    });
    await state.save();

    if (textCaretaker) {
      notifyCaretaker(patient, risk, pressureDuration);
    }
    const snapshot = state.toSnapshot();
    publish(patientId, 'reading', snapshot);
    if (alert) {
      publish(patientId, 'alert', alert.toJSONForApp());
    }
    return snapshot;
  });
}
