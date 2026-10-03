import { z } from 'zod';

import { HttpError } from '../middleware/errors.js';
import { Alert } from '../models/alert.js';
import { CALIBRATION_SECONDS, DeviceState } from '../models/device-state.js';
import { Patient } from '../models/patient.js';
import { Reading } from '../models/reading.js';
import { publish } from '../realtime.js';
import { notifyCaretaker, shouldNotify } from './caretaker-alerts.js';
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

const queues = new Map();

/** Runs tasks for the same device one at a time, so concurrent uploads can't corrupt its state. */
function serialize(deviceId, task) {
  const previous = queues.get(deviceId) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    deviceId,
    next.catch(() => {})
  );
  return next;
}

/** Calibration needs at least this many readings, or it starts again. */
const MIN_CALIBRATION_SAMPLES = 5;

const ZERO_SUM = { pressure: 0, temperature: 0, humidity: 0 };

/**
 * Feeds a reading to the calibration in progress. A device's first ever reading starts one. After
 * CALIBRATION_SECONDS the average becomes the baseline; too few readings start it again.
 */
function calibrate(state, reading, receivedAt) {
  if (!state.baseline && !state.calibration) {
    state.calibration = { startedAt: null, samples: 0, sum: ZERO_SUM };
  }
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
    startedAt = receivedAt;
    samples = 0;
    sum = ZERO_SUM;
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

/**
 * Discards the baseline and calibrates again from the device's next reading, e.g. after the patch
 * is re-applied. Readings are not scored until the new baseline is ready.
 */
export function startCalibration(deviceId, patientId) {
  return serialize(deviceId, async () => {
    const state =
      (await DeviceState.findOne({ deviceId })) ?? new DeviceState({ deviceId, patientId });
    Object.assign(state, {
      baseline: null,
      calibration: { startedAt: null, samples: 0, sum: ZERO_SUM },
      risk: null,
      highPressureSince: null,
      pressureDuration: 0,
      alerting: false,
    });
    await state.save();

    const calibration = state.toCalibration();
    publish(patientId, 'calibration', calibration);
    return calibration;
  });
}

/** Calibration progress and baseline for a device, including one that has never sent a reading. */
export async function getCalibration(deviceId) {
  const state = await DeviceState.findOne({ deviceId });
  return (state ?? new DeviceState({ deviceId })).toCalibration();
}
