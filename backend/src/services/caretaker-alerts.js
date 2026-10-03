import { config } from '../config.js';
import { PATCH_SITES } from '../models/device-state.js';
import { sendSms } from './sms.js';

const RANK = { NORMAL: 0, ATTENTION: 1 };

/**
 * Whether a reading at `level` should text the caretaker: only when the status turns ATTENTION,
 * and not again within the cooldown, so a reading that flickers across a threshold doesn't send a
 * burst of messages.
 */
export function shouldNotify({ level, previousLevel, lastNotified, now }) {
  const rank = RANK[level] ?? 0;
  if (rank === 0 || rank <= (RANK[previousLevel] ?? 0)) return false;
  const cooldownMs = config.smsCooldownMinutes * 60 * 1000;
  const recent = lastNotified?.at && now - lastNotified.at < cooldownMs;
  return !(recent && (RANK[lastNotified.level] ?? 0) >= rank);
}

/** "+28" or "-1.5", without trailing ".0". */
const signed = (value) => `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}`;

const REASONS = {
  pressure: 'prolonged pressure',
  temperature: 'skin temperature rising',
  humidity: 'skin moisture rising',
};

/**
 * Under 160 plain characters where possible, so it goes as one SMS: what triggered ATTENTION,
 * the patch site (from the position chosen when activating), and the readings.
 */
export function alertMessage(patient, { reading, risk, pressureDuration, position = null }) {
  const { triggers, deltas, percentChanges } = risk;
  const reasons = Object.keys(REASONS).filter((key) => triggers[key]).map((key) => REASONS[key]);
  const site = PATCH_SITES[position];
  const humidity = percentChanges.humidity ?? deltas.humidity;
  return (
    `MEDHA ATTENTION: ${patient.name} (${patient.patientId}): ${reasons.join(', ')}. ` +
    'Please check/reposition. ' +
    (site ? `${site}: ` : '') +
    `${Number(reading.pressure.toFixed(1))} mmHg` +
    (pressureDuration > 0 ? ` for ${pressureDuration}s` : '') +
    `, temp ${signed(deltas.temperature)}C, humidity ${signed(humidity)}% vs baseline.`
  );
}

/** Texts the patient's caretaker without holding up the reading. */
export function notifyCaretaker(patient, details) {
  if (!patient.caretakerPhone) return;
  sendSms(patient.caretakerPhone, alertMessage(patient, details)).catch((error) =>
    console.error('Could not text the caretaker:', error)
  );
}
