import mongoose from 'mongoose';

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
    /** Start of the current unbroken run of readings at or above the alert pressure. */
    highPressureSince: Date,
    pressureDuration: Number,
    risk: mongoose.Schema.Types.Mixed,
    /** Whether the immediate alert was active at the last reading. */
    alerting: Boolean,
    /** When a reading was last copied into the history collection. */
    lastStoredAt: Date,
  },
  { versionKey: false }
);

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
    risk: this.risk,
  };
};

export const DeviceState = mongoose.model('DeviceState', deviceStateSchema);
