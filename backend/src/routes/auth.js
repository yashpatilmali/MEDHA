import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { config } from '../config.js';
import { requirePatient, signToken } from '../middleware/auth.js';
import { HttpError, validate } from '../middleware/errors.js';
import { nextSequence } from '../models/counter.js';
import { Patient, SEX_OPTIONS } from '../models/patient.js';
import { normalizeContact, normalizeMobile } from '../services/contact.js';
import { sendResetCode } from '../services/mailer.js';

const MIN_PASSWORD_LENGTH = 6;
const RESET_CODE_MINUTES = 15;
const MAX_RESET_ATTEMPTS = 5;
const DUPLICATE_ACCOUNT = 'An account with this email or mobile number already exists.';

// Compared against when no account matches, so a failed login takes as long either way.
const UNUSED_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const contactField = z
  .string({ error: 'Enter your email address or mobile number.' })
  .transform((value, ctx) => {
    const contact = normalizeContact(value);
    if (!contact) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid email address or mobile number.' });
      return z.NEVER;
    }
    return contact;
  });

const passwordField = z
  .string({ error: 'Choose a password.' })
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(128, 'Use 128 characters or fewer.');

const registerSchema = z.object({
  name: z
    .string({ error: "Enter the patient's full name." })
    .trim()
    .min(2, "Enter the patient's full name.")
    .max(80, 'Use 80 characters or fewer.'),
  age: z
    .number({ error: 'Enter an age between 1 and 120.' })
    .int('Enter an age between 1 and 120.')
    .min(1, 'Enter an age between 1 and 120.')
    .max(120, 'Enter an age between 1 and 120.'),
  sex: z.enum(SEX_OPTIONS, { error: "Select the patient's sex." }),
  contact: contactField,
  password: passwordField,
  caretakerName: z
    .string({ error: "Enter the caretaker's name." })
    .trim()
    .min(2, "Enter the caretaker's name.")
    .max(80, 'Use 80 characters or fewer.'),
  caretakerPhone: z
    .string({ error: "Enter the caretaker's mobile number." })
    .transform((value, ctx) => {
      const phone = normalizeMobile(value);
      if (!phone) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number for SMS alerts.' });
        return z.NEVER;
      }
      return phone;
    }),
});

const loginSchema = z.object({
  // Any text is accepted here: an unrecognised login gets the same reply as a wrong password.
  contact: z.string({ error: 'Enter your email address or mobile number.' }),
  password: z.string({ error: 'Enter your password.' }),
});

const forgotSchema = z.object({ contact: contactField });

const resetSchema = z.object({
  contact: contactField,
  code: z.string({ error: 'Enter the 6-digit code.' }).trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  password: passwordField,
});

export const authRouter = express.Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = validate(registerSchema, req.body);
  if (await Patient.exists({ contact: input.contact })) {
    throw new HttpError(409, DUPLICATE_ACCOUNT, { contact: DUPLICATE_ACCOUNT });
  }

  const serial = String(await nextSequence('patient')).padStart(3, '0');
  let patient;
  try {
    patient = await Patient.create({
      patientId: `SP${serial}`,
      deviceId: `SP-ESP32-${serial}`,
      name: input.name.replace(/\s+/g, ' '),
      age: input.age,
      sex: input.sex,
      contact: input.contact,
      caretakerName: input.caretakerName.replace(/\s+/g, ' '),
      caretakerPhone: input.caretakerPhone,
      passwordHash: await bcrypt.hash(input.password, 10),
    });
  } catch (error) {
    // Two signups with the same contact at the same moment: the unique index stops the second.
    if (error?.code === 11000) {
      throw new HttpError(409, DUPLICATE_ACCOUNT, { contact: DUPLICATE_ACCOUNT });
    }
    throw error;
  }

  res.status(201).json({ token: signToken(patient.patientId), patient: patient.toProfile() });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = validate(loginSchema, req.body);
  const contact = normalizeContact(input.contact);
  const patient = contact ? await Patient.findOne({ contact }) : null;
  const passwordMatches = await bcrypt.compare(input.password, patient?.passwordHash ?? UNUSED_HASH);
  if (!patient || !passwordMatches) {
    throw new HttpError(401, 'Incorrect email/mobile number or password.');
  }
  res.json({ token: signToken(patient.patientId), patient: patient.toProfile() });
});

authRouter.get('/me', requirePatient, (req, res) => {
  res.json({ patient: req.patient.toProfile() });
});

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const { contact } = validate(forgotSchema, req.body);
  const patient = await Patient.findOne({ contact });
  if (patient) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    patient.resetCodeHash = await bcrypt.hash(code, 10);
    patient.resetCodeExpiresAt = new Date(Date.now() + RESET_CODE_MINUTES * 60 * 1000);
    patient.resetAttempts = 0;
    await patient.save();
    try {
      await sendResetCode(patient.contact, code, RESET_CODE_MINUTES);
    } catch (error) {
      console.error('Could not send a password reset code:', error);
    }
  }
  // Same reply whether or not the account exists, so this can't be used to look up patients.
  res.json({
    message: 'If an account exists for that email or mobile number, a 6-digit reset code has been sent.',
  });
});

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const { contact, code, password } = validate(resetSchema, req.body);
  const invalidCode = new HttpError(400, 'That code is wrong or has expired. Request a new one.', {
    code: 'That code is wrong or has expired. Request a new one.',
  });

  const patient = await Patient.findOne({ contact });
  if (
    !patient?.resetCodeHash ||
    patient.resetCodeExpiresAt < new Date() ||
    patient.resetAttempts >= MAX_RESET_ATTEMPTS
  ) {
    throw invalidCode;
  }
  if (!(await bcrypt.compare(code, patient.resetCodeHash))) {
    patient.resetAttempts += 1;
    await patient.save();
    throw invalidCode;
  }

  patient.passwordHash = await bcrypt.hash(password, 10);
  patient.resetCodeHash = undefined;
  patient.resetCodeExpiresAt = undefined;
  patient.resetAttempts = 0;
  await patient.save();
  res.json({ message: 'Password updated. You can now log in.' });
});
