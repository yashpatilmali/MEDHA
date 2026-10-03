import { HttpError } from '../middleware/errors.js';
import { DeviceState, newCalibration } from '../models/device-state.js';
import { Patient } from '../models/patient.js';
import { publish } from '../realtime.js';
import { serialize } from './device-queue.js';

/**
 * The patch's life cycle, driven from the app:
 *
 *   activate → the ESP32 (checking in every few seconds) switches its sensors on and confirms
 *   scan     → its next minute of readings is averaged into the baseline; then continuous scoring
 *   deactivate → sensors off; the wear session and baseline end
 */

export const NOT_ACTIVE = 'The sensors are not activated. Activate them in the app first.';

async function loadState(deviceId, patientId) {
  return (await DeviceState.findOne({ deviceId })) ?? new DeviceState({ deviceId, patientId });
}

function statusOf(state) {
  return { device: state.toDevice(), calibration: state.toCalibration() };
}

/** Saves the state and tells the patient's app what changed. */
async function saveAndPublish(state) {
  await state.save();
  const status = statusOf(state);
  publish(state.patientId, 'status', status);
  return status;
}

/** Device and calibration status, including for a device that has never checked in. */
export async function getDeviceStatus(deviceId) {
  return statusOf((await DeviceState.findOne({ deviceId })) ?? new DeviceState({ deviceId }));
}

/** Asks the patch to switch its sensors on. It confirms on its next check-in. */
export function activate(deviceId, patientId, now = new Date()) {
  return serialize(deviceId, async () => {
    const state = await loadState(deviceId, patientId);
    if (!state.active) {
      state.active = true;
      state.activatedAt = now;
    }
    return saveAndPublish(state);
  });
}

/** Switches the sensors off. Ends the wear session; the next patch needs a new initial scan. */
export function deactivate(deviceId, patientId, now = new Date()) {
  return serialize(deviceId, async () => {
    const state = await loadState(deviceId, patientId);
    Object.assign(state, {
      active: false,
      lastWear: state.wearStartedAt
        ? { startedAt: state.wearStartedAt, endedAt: now }
        : state.lastWear,
      wearStartedAt: null,
      baseline: null,
      calibration: null,
      risk: null,
      highPressureSince: null,
      pressureDuration: 0,
      alerting: false,
    });
    return saveAndPublish(state);
  });
}

/**
 * Scans the initial readings: discards any baseline and averages the device's next minute of
 * readings into a new one. Starts the wear time if the patch wasn't already being worn.
 */
export function startCalibration(deviceId, patientId, now = new Date()) {
  return serialize(deviceId, async () => {
    const state = await loadState(deviceId, patientId);
    if (!state.active) {
      throw new HttpError(409, NOT_ACTIVE);
    }
    Object.assign(state, {
      baseline: null,
      calibration: newCalibration(),
      risk: null,
      highPressureSince: null,
      pressureDuration: 0,
      alerting: false,
      wearStartedAt: state.wearStartedAt ?? now,
    });
    return saveAndPublish(state);
  });
}

/**
 * The ESP32 checks in while it isn't sending readings: before activation, or when its sensors
 * fail. The reply tells it whether its sensors should be on.
 */
export function recordHeartbeat(deviceId, { active, sensorsOk }, now = new Date()) {
  return serialize(deviceId, async () => {
    const patient = await Patient.findOne({ deviceId });
    if (!patient) {
      throw new HttpError(404, `No patient is registered with device ${deviceId}.`);
    }
    const state = await loadState(deviceId, patient.patientId);
    Object.assign(state, {
      deviceActive: active,
      sensorsOk: active ? (sensorsOk ?? null) : null,
      lastSeenAt: now,
    });
    const { calibration } = await saveAndPublish(state);
    return { activate: state.active, calibration: calibration.status };
  });
}
