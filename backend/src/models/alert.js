import mongoose from 'mongoose';

/** Recorded each time a patient's status turns ATTENTION. */
const alertSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true },
    deviceId: { type: String, required: true },
    at: { type: Date, required: true },
    pressure: Number,
    temperature: Number,
    humidity: Number,
    pressureDuration: Number,
    riskLevel: String,
    /** Which rules caused it: { pressure, temperature, humidity }. */
    triggers: { pressure: Boolean, temperature: Boolean, humidity: Boolean },
    /** Only on alerts from the earlier scored model. */
    riskScore: Number,
  },
  { versionKey: false }
);

alertSchema.index({ patientId: 1, at: -1 });

alertSchema.methods.toJSONForApp = function toJSONForApp() {
  return {
    id: String(this._id),
    at: this.at.toISOString(),
    deviceId: this.deviceId,
    pressure: this.pressure,
    temperature: this.temperature,
    humidity: this.humidity,
    pressureDuration: this.pressureDuration,
    // Null on alerts recorded before the two-state rules.
    triggers: this.triggers?.pressure === undefined ? null : this.triggers,
  };
};

export const Alert = mongoose.model('Alert', alertSchema);
