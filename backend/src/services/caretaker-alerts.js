import { config } from '../config.js';
import { sendSms } from './sms.js';

const RANK = { NORMAL: 0, ATTENTION: 1, CRITICAL: 2 };

/**
 * Whether a reading at `level` should text the caretaker: only when the status rises to ATTENTION
 * or CRITICAL, and not again for the same or a lower level within the cooldown, so a reading that
 * flickers across a boundary doesn't send a burst of messages.
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

/** Under 160 plain characters where possible, so it goes as one SMS. */
export function alertMessage(patient, risk, pressureDuration) {
  const { deltas } = risk;
  const changes =
    `pressure ${signed(deltas.pressure)} mmHg` +
    (pressureDuration > 0 ? ` for ${pressureDuration}s` : '') +
    `, temp ${signed(deltas.temperature)}C, humidity ${signed(deltas.humidity)}% vs baseline.`;
  const who = `${patient.name} (${patient.patientId})`;
  return risk.riskLevel === 'CRITICAL'
    ? `MEDHA CRITICAL: ${who} needs checking and repositioning now. ${changes}`
    : `MEDHA ATTENTION: ${who} readings are rising: ${changes} Please check the patch site.`;
}

/** Texts the patient's caretaker without holding up the reading. */
export function notifyCaretaker(patient, risk, pressureDuration) {
  if (!patient.caretakerPhone) return;
  sendSms(patient.caretakerPhone, alertMessage(patient, risk, pressureDuration)).catch((error) =>
    console.error('Could not text the caretaker:', error)
  );
}
