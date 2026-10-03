import { HttpError } from '../middleware/errors.js';
import { Alert } from '../models/alert.js';
import { DeviceState } from '../models/device-state.js';
import { Patient } from '../models/patient.js';
import { Reading } from '../models/reading.js';
import { publish } from '../realtime.js';
import { ALERT_PRESSURE, calculateRisk } from './risk-engine.js';

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

/**
 * Processes one reading from an ESP32: works out how long pressure has stayed high, scores the
 * risk, keeps history and alerts under the patient's ID, and pushes the result to their app.
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

    const highPressureSince =
      reading.pressure >= ALERT_PRESSURE
        ? (continuous && state.highPressureSince) || receivedAt
        : null;
    const pressureDuration = highPressureSince
      ? Math.floor((receivedAt - highPressureSince) / 1000)
      : 0;
    const risk = calculateRisk(
      reading.pressure,
      reading.temperature,
      reading.humidity,
      pressureDuration
    );
    const alertStarted = risk.immediateAlert && !(continuous && state.alerting);

    const dueForHistory =
      alertStarted ||
      state.risk?.riskLevel !== risk.riskLevel ||
      !state.lastStoredAt ||
      receivedAt - state.lastStoredAt >= HISTORY_INTERVAL_MS;
    if (dueForHistory) {
      await Reading.create({
        patientId,
        deviceId,
        at: receivedAt,
        ...reading,
        pressureDuration,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
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
      alerting: risk.immediateAlert,
    });
    await state.save();

    const snapshot = state.toSnapshot();
    publish(patientId, 'reading', snapshot);
    if (alert) {
      publish(patientId, 'alert', alert.toJSONForApp());
    }
    return snapshot;
  });
}
