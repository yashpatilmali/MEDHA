import mongoose from 'mongoose';

export const SEX_OPTIONS = ['Male', 'Female', 'Other'];

const patientSchema = new mongoose.Schema(
  {
    /** SP001, SP002, … */
    patientId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1, max: 120 },
    sex: { type: String, required: true, enum: SEX_OPTIONS },
    /** Lowercase email or mobile number (digits, optional leading +). Used to log in. */
    contact: { type: String, required: true, unique: true },
    /** The ESP32 assigned to this patient: SP-ESP32-001, … */
    deviceId: { type: String, required: true, unique: true },
    /** Texted when readings reach ATTENTION or CRITICAL. Missing on accounts made before it was asked. */
    caretakerName: { type: String, trim: true },
    caretakerPhone: String,
    passwordHash: { type: String, required: true },
    resetCodeHash: String,
    resetCodeExpiresAt: Date,
    resetAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/** The fields the app is allowed to see. */
patientSchema.methods.toProfile = function toProfile() {
  return {
    id: this.patientId,
    name: this.name,
    age: this.age,
    sex: this.sex,
    contact: this.contact,
    deviceId: this.deviceId,
    caretaker: this.caretakerPhone
      ? { name: this.caretakerName, phone: this.caretakerPhone }
      : null,
    createdAt: this.createdAt.toISOString(),
  };
};

export const Patient = mongoose.model('Patient', patientSchema);
