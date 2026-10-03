import mongoose from 'mongoose';

/** How long the baseline calibration averages readings for. */
export const CALIBRATION_SECONDS = 60;

const sensorReading = {
  pressure: Number,
  temperature: Number,
  humidity: Number,
};

/** The latest reading from each ESP32, plus what's needed to keep measuring pressure duration. */
const deviceStateSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true, index: true },
    reading: sensorReading,
    receivedAt: Date,
    /** Start of the current unbroken run of readings at or above the elevated pressure. */
    highPressureSince: Date,
    pressureDuration: Number,
    /** Null while calibrating: there is no baseline to score against. */
    risk: mongoose.Schema.Types.Mixed,
    /** Whether the reading was CRITICAL at the last reading. */
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
    /** A calibration in progress. It starts with the first reading after it was requested. */
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
    status: baseline ? 'complete' : startedAt ? 'running' : 'waiting',
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
  };
};

export const DeviceState = mongoose.model('DeviceState', deviceStateSchema);
