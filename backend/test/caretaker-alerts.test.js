import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.SMS_COUNTRY_CODE = '+91';
process.env.SMS_COOLDOWN_MINUTES = '10';

const { alertMessage, shouldNotify } = await import('../src/services/caretaker-alerts.js');
const { toInternational } = await import('../src/services/sms.js');

const MINUTE = 60 * 1000;
const now = 100 * MINUTE;

describe('when the caretaker is texted', () => {
  test('when the status rises to ATTENTION or CRITICAL', () => {
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: 'NORMAL', now }), true);
    assert.equal(shouldNotify({ level: 'CRITICAL', previousLevel: 'ATTENTION', now }), true);
    assert.equal(shouldNotify({ level: 'CRITICAL', previousLevel: undefined, now }), true);
  });

  test('not for NORMAL, or while the status stays the same or falls', () => {
    assert.equal(shouldNotify({ level: 'NORMAL', previousLevel: 'NORMAL', now }), false);
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: 'ATTENTION', now }), false);
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: 'CRITICAL', now }), false);
  });

  test('not again for the same or a lower level within the cooldown', () => {
    const lastNotified = { level: 'CRITICAL', at: now - 5 * MINUTE };
    assert.equal(shouldNotify({ level: 'ATTENTION', previousLevel: 'NORMAL', lastNotified, now }), false);
    assert.equal(shouldNotify({ level: 'CRITICAL', previousLevel: 'NORMAL', lastNotified, now }), false);
    assert.equal(
      shouldNotify({ level: 'CRITICAL', previousLevel: 'NORMAL', lastNotified, now: now + 6 * MINUTE }),
      true
    );
  });

  test('a rise to CRITICAL is sent even just after an ATTENTION text', () => {
    const lastNotified = { level: 'ATTENTION', at: now - MINUTE };
    assert.equal(shouldNotify({ level: 'CRITICAL', previousLevel: 'ATTENTION', lastNotified, now }), true);
  });
});

describe('the message', () => {
  const patient = { name: 'Rahul Sharma', patientId: 'SP001' };

  test('says what rose above the baseline, in one SMS', () => {
    const message = alertMessage(
      patient,
      { riskLevel: 'CRITICAL', deltas: { pressure: 28, temperature: 2.1, humidity: -1.5 } },
      60
    );
    assert.equal(
      message,
      'MEDHA CRITICAL: Rahul Sharma (SP001) needs checking and repositioning now. ' +
        'pressure +28 mmHg for 60s, temp +2.1C, humidity -1.5% vs baseline.'
    );
    assert.ok(message.length <= 160, `${message.length} characters`);
  });

  test('ATTENTION asks the caretaker to check', () => {
    const message = alertMessage(
      patient,
      { riskLevel: 'ATTENTION', deltas: { pressure: 12, temperature: 1, humidity: 0 } },
      0
    );
    assert.match(message, /^MEDHA ATTENTION: .*pressure \+12 mmHg, temp \+1C.*Please check the patch site\.$/);
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
