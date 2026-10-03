import mongoose from 'mongoose';

/** An immediate alert: pressure stayed at or above the alert level for the alert duration. */
const alertSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true },
    deviceId: { type: String, required: true },
    at: { type: Date, required: true },
    pressure: Number,
    temperature: Number,
    humidity: Number,
    pressureDuration: Number,
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
    riskScore: this.riskScore,
  };
};

export const Alert = mongoose.model('Alert', alertSchema);
