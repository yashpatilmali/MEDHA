import mongoose from 'mongoose';

/** How long the baseline calibration averages readings for. */
export const CALIBRATION_SECONDS = 60;

const sensorReading = {
  pressure: Number,
  temperature: Number,
  humidity: Number,
};

/**
 * The patient's usual position, chosen when activating, and the patch site it calls for (from the
 * clinical guidance: the area that position puts the most pressure on).
 */
export const PATCH_SITES = {
  sitting: 'Bottom (seat area)',
  back: 'Lower back / bottom',
  right_side: 'Right hip',
  left_side: 'Left hip',
};
export const POSITIONS = Object.keys(PATCH_SITES);

/** A calibration that starts with the device's next reading. */
export function newCalibration() {
  return { startedAt: null, samples: 0, sum: { pressure: 0, temperature: 0, humidity: 0 } };
}

/** The latest reading from each ESP32, plus what's needed to keep measuring pressure duration. */
const deviceStateSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true, index: true },
    /** Set from the app: whether the patch should have its sensors on and send readings. */
    active: { type: Boolean, default: false },
    activatedAt: Date,
    /** One of POSITIONS, chosen in the app when activating. */
    position: { type: String, enum: [...POSITIONS, null], default: null },
    /** What the ESP32 last reported: its sensors are on, and they gave a valid reading. */
    deviceActive: Boolean,
    sensorsOk: Boolean,
    /** When the ESP32 last checked in, with a reading or a heartbeat. */
    lastSeenAt: Date,
    /** When the current patch went on the body (its initial scan); null when not worn. */
    wearStartedAt: Date,
    /** The previous wear session, kept after the patch is deactivated. */
    lastWear: {
      type: new mongoose.Schema({ startedAt: Date, endedAt: Date }, { _id: false }),
      default: null,
    },
    reading: sensorReading,
    receivedAt: Date,
    /** Start of the current unbroken run of readings at or above the elevated pressure. */
    highPressureSince: Date,
    pressureDuration: Number,
    /** Null while calibrating: there is no baseline to score against. */
    risk: mongoose.Schema.Types.Mixed,
    /** Whether the last reading was ATTENTION. */
    alerting: Boolean,
    /** When a reading was last copied into the history collection. */
    lastStoredAt: Date,
    /** The last SMS sent to the caretaker. */
    notified: {
      type: new mongoose.Schema({ level: String, at: Date }, { _id: false }),
      default: null,
    },
    /** The patient's normal values: the average of the calibration readings. */
    baseline: {
      type: new mongoose.Schema(
        { ...sensorReading, samples: Number, calibratedAt: Date },
        { _id: false }
      ),
      default: null,
    },
    /** A calibration ("initial scan") in progress. It starts with the first reading after it was requested. */
    calibration: {
      type: new mongoose.Schema(
        { startedAt: Date, samples: Number, sum: sensorReading },
        { _id: false }
      ),
      default: null,
    },
  },
  { versionKey: false }
);

/** Calibration progress and the baseline, for the app and the ESP32. */
deviceStateSchema.methods.toCalibration = function toCalibration() {
  const { calibration, baseline } = this;
  const startedAt = calibration?.startedAt ?? null;
  return {
    status: baseline ? 'complete' : startedAt ? 'running' : calibration ? 'waiting' : 'none',
    durationSeconds: CALIBRATION_SECONDS,
    startedAt: startedAt?.toISOString() ?? null,
    endsAt: startedAt ? new Date(+startedAt + CALIBRATION_SECONDS * 1000).toISOString() : null,
    samples: calibration?.samples ?? 0,
    baseline: baseline
      ? {
          pressure: baseline.pressure,
          temperature: baseline.temperature,
          humidity: baseline.humidity,
          samples: baseline.samples,
          calibratedAt: baseline.calibratedAt.toISOString(),
        }
      : null,
  };
};

/** Whether the patch is activated and checking in, and how long it has been worn. */
deviceStateSchema.methods.toDevice = function toDevice() {
  return {
    active: this.active,
    activatedAt: this.activatedAt?.toISOString() ?? null,
    position: this.position ?? null,
    site: this.position ? PATCH_SITES[this.position] : null,
    deviceActive: Boolean(this.deviceActive),
    sensorsOk: this.sensorsOk ?? null,
    lastSeenAt: this.lastSeenAt?.toISOString() ?? null,
    wearStartedAt: this.wearStartedAt?.toISOString() ?? null,
    lastWear: this.lastWear?.startedAt
      ? {
          startedAt: this.lastWear.startedAt.toISOString(),
          endedAt: this.lastWear.endedAt.toISOString(),
        }
      : null,
  };
};

/** What the app receives over Socket.IO and from GET /api/monitoring/latest. */
deviceStateSchema.methods.toSnapshot = function toSnapshot() {
  return {
    deviceId: this.deviceId,
    reading: {
      pressure: this.reading.pressure,
      temperature: this.reading.temperature,
      humidity: this.reading.humidity,
    },
    receivedAt: this.receivedAt.toISOString(),
    pressureDuration: this.pressureDuration,
    risk: this.risk ?? null,
    calibration: this.toCalibration(),
    device: this.toDevice(),
  };
};

export const DeviceState = mongoose.model('DeviceState', deviceStateSchema);
