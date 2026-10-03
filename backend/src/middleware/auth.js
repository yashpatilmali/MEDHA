import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { Patient } from '../models/patient.js';
import { HttpError } from './errors.js';

export function signToken(patientId) {
  return jwt.sign({ sub: patientId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Returns the Patient ID in a valid token; throws if the token is missing, forged or expired. */
export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret).sub;
}

/** Requires `Authorization: Bearer <token>` and puts the patient on `req.patient`. */
export async function requirePatient(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    throw new HttpError(401, 'Please log in.');
  }

  let patientId;
  try {
    patientId = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }

  const patient = await Patient.findOne({ patientId });
  if (!patient) {
    throw new HttpError(401, 'This account no longer exists. Please log in again.');
  }
  req.patient = patient;
  next();
}

function sameSecret(a, b) {
  const digest = (value) => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

/** Requires the shared device key in the `X-Device-Key` header. */
export function requireDevice(req, res, next) {
  if (!config.deviceApiKey) {
    throw new HttpError(503, 'Device uploads are disabled: DEVICE_API_KEY is not set on the server.');
  }
  if (!sameSecret(req.get('x-device-key') ?? '', config.deviceApiKey)) {
    throw new HttpError(401, 'Invalid device key.');
  }
  next();
}
