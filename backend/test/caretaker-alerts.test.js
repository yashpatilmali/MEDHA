import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.SMS_COUNTRY_CODE = '+91';
process.env.SMS_COOLDOWN_MINUTES = '10';

const { alertMessage, shouldNotify } = await import('../src/services/caretaker-alerts.js');
const { toInternational } = await import('../src/services/sms.js');

const MINUTE = 60 * 1000;
const now = 100 * MINUTE;

describe('when the caretaker is texted', () => {
  test('when the status turns ATTENTION', () => {
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: 'NORMAL', now }), true);
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: undefined, now }), true);
  });

  test('not for NORMAL, or while it stays ATTENTION', () => {
    assert.equal(shouldNotify({ level: 'NORMAL', previousLevel: 'ATTENTION', now }), false);
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: 'ATTENTION', now }), false);
  });

  test('not again within the cooldown', () => {
    const lastNotified = { level: 'ATTENTION', at: now - 5 * MINUTE };
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: 'NORMAL', lastNotified, now }), false);
    assert.equal(
      shouldNotify({ level: 'ATTENTION', previousLevel: 'NORMAL', lastNotified, now: now + 6 * MINUTE }),
      true
    );
  });
});

describe('the message', () => {
  const patient = { name: 'Rahul Sharma', patientId: 'SP001' };
  const details = (triggers, extra = {}) => ({
    reading: { pressure: 33, temperature: 36.9, humidity: 60 },
    risk: {
      riskLevel: 'ATTENTION',
      triggers: { pressure: false, temperature: false, humidity: false, ...triggers },
      deltas: { pressure: 9, temperature: 0.5, humidity: 20 },
      percentChanges: { pressure: 37.5, temperature: 1.4, humidity: 50 },
    },
    pressureDuration: 12,
    ...extra,
  });

  test('says why, where and the readings, in one SMS', () => {
    const message = alertMessage(patient, details({ pressure: true }, { position: 'right_side' }));
    assert.equal(
      message,
      'MEDHA ATTENTION: Rahul Sharma (SP001): prolonged pressure. Please check/reposition. ' +
        'Right hip: 33 mmHg for 12s, temp +0.5C, humidity +50% vs baseline.'
    );
    assert.ok(message.length <= 160, `${message.length} characters`);
  });

  test('lists every rule that triggered', () => {
    const message = alertMessage(patient, details({ pressure: true, temperature: true, humidity: true }));
    assert.match(message, /: prolonged pressure, skin temperature rising, skin moisture rising\. /);
  });

  test('leaves out the duration when pressure is not held', () => {
    const message = alertMessage(patient, details({ temperature: true }, { pressureDuration: 0 }));
    assert.match(message, /skin temperature rising\. Please check\/reposition\. 33 mmHg, temp \+0\.5C/);
  });
});

describe('phone numbers', () => {
  test('get the default country code when saved without one', () => {
    assert.equal(toInternational('9876511111'), '+919876511111');
    assert.equal(toInternational('09876511111'), '+919876511111');
    assert.equal(toInternational('919876511111'), '+919876511111');
    assert.equal(toInternational('+447700900123'), '+447700900123');
  });
});
