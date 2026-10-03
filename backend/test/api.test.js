import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, mock, test } from 'node:test';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as connectSocket } from 'socket.io-client';

// Set before the app reads its configuration, so a developer's .env can't affect the tests.
process.env.MONGODB_URI = '';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DEVICE_API_KEY = 'test-device-key';
process.env.AUTH_RATE_LIMIT = '1000';
// Never send real texts from the tests: SMS alerts go to the log instead.
process.env.TWILIO_ACCOUNT_SID = '';
process.env.SMS_COUNTRY_CODE = '+91';
process.env.SMS_COOLDOWN_MINUTES = '10';

const { config } = await import('../src/config.js');
const { createApp } = await import('../src/app.js');
const { attachRealtime, closeRealtime } = await import('../src/realtime.js');
const { ingestReading } = await import('../src/services/ingest.js');
const { Alert } = await import('../src/models/alert.js');
const { Reading } = await import('../src/models/reading.js');

let mongo;
let baseUrl;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await mongoose.connection.syncIndexes();
  const server = http.createServer(createApp());
  attachRealtime(server);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await closeRealtime();
  await mongoose.disconnect();
  await mongo.stop();
});

async function api(path, { method = 'GET', body, token, deviceKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (deviceKey) headers['X-Device-Key'] = deviceKey;
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const rahul = {
  name: '  Rahul   Sharma ',
  age: 68,
  sex: 'Male',
  contact: ' Rahul@Example.COM ',
  password: 'secret1',
  caretakerName: ' Sunita  Sharma ',
  caretakerPhone: '98765 11111',
};
const priya = {
  name: 'Priya Patel',
  age: 54,
  sex: 'Female',
  contact: '+91 98765-43210',
  password: 'hunter22',
  caretakerName: 'Arjun Patel',
  caretakerPhone: '+919876522222',
};
let rahulToken;

test('the test config is in effect', () => {
  assert.equal(config.deviceApiKey, 'test-device-key');
});

describe('registration', () => {
  test('assigns sequential Patient IDs and matching device IDs', async () => {
    const first = await api('/api/auth/register', { method: 'POST', body: rahul });
    assert.equal(first.status, 201);
    assert.ok(first.body.token);
    rahulToken = first.body.token;
    assert.deepEqual(
      { ...first.body.patient, createdAt: undefined },
      {
        id: 'SP001',
        name: 'Rahul Sharma',
        age: 68,
        sex: 'Male',
        contact: 'rahul@example.com',
        deviceId: 'SP-ESP32-001',
        caretaker: { name: 'Sunita Sharma', phone: '9876511111' },
        createdAt: undefined,
      }
    );
    assert.ok(!Number.isNaN(Date.parse(first.body.patient.createdAt)));

    const second = await api('/api/auth/register', { method: 'POST', body: priya });
    assert.equal(second.status, 201);
    assert.equal(second.body.patient.id, 'SP002');
    assert.equal(second.body.patient.deviceId, 'SP-ESP32-002');
    assert.equal(second.body.patient.contact, '+919876543210');
  });

  test('blocks duplicate accounts however the email or mobile is typed', async () => {
    for (const contact of ['RAHUL@example.com', '+91 (98765) 43210']) {
      const response = await api('/api/auth/register', {
        method: 'POST',
        body: { ...priya, contact },
      });
      assert.equal(response.status, 409, contact);
      assert.match(response.body.fields.contact, /already exists/);
    }
  });

  test('reports every invalid field', async () => {
    const response = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'A',
        age: 200,
        sex: 'Unknown',
        contact: 'not-an-email',
        password: '123',
        caretakerPhone: 'call me',
      },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(response.body.fields).sort(), [
      'age',
      'caretakerName',
      'caretakerPhone',
      'contact',
      'name',
      'password',
      'sex',
    ]);
  });

  test('never returns or stores the password', async () => {
    const stored = await mongoose.connection.collection('patients').findOne({ patientId: 'SP001' });
    assert.ok(stored.passwordHash.startsWith('$2'));
    assert.ok(!JSON.stringify(stored).includes('secret1'));
  });
});

describe('login', () => {
  test('accepts the email in any case, and the mobile number', async () => {
    const byEmail = await api('/api/auth/login', {
      method: 'POST',
      body: { contact: 'RAHUL@example.com', password: 'secret1' },
    });
    assert.equal(byEmail.status, 200);
    assert.equal(byEmail.body.patient.id, 'SP001');

    const byMobile = await api('/api/auth/login', {
      method: 'POST',
      body: { contact: '+919876543210', password: 'hunter22' },
    });
    assert.equal(byMobile.body.patient.id, 'SP002');
  });

  test('gives the same answer for a wrong password and an unknown account', async () => {
    const wrongPassword = await api('/api/auth/login', {
      method: 'POST',
      body: { contact: 'rahul@example.com', password: 'nope' },
    });
    const unknown = await api('/api/auth/login', {
      method: 'POST',
      body: { contact: 'nobody@example.com', password: 'secret1' },
    });
    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(wrongPassword.body, unknown.body);
  });

  test('/me needs a valid token', async () => {
    assert.equal((await api('/api/auth/me', { token: rahulToken })).body.patient.id, 'SP001');
    assert.equal((await api('/api/auth/me')).status, 401);
    assert.equal((await api('/api/auth/me', { token: 'forged' })).status, 401);
  });
});

describe('password reset', () => {
  async function requestCode(contact) {
    const log = mock.method(console, 'log', () => {});
    try {
      const response = await api('/api/auth/forgot-password', { method: 'POST', body: { contact } });
      assert.equal(response.status, 200);
      const line = log.mock.calls.map((call) => call.arguments.join(' ')).find((text) => /Code for/.test(text));
      return line?.match(/: (\d{6})/)[1];
    } finally {
      log.mock.restore();
    }
  }

  test('replies the same way for unknown accounts', async () => {
    assert.equal(await requestCode('nobody@example.com'), undefined);
  });

  test('a correct code sets the new password, once', async () => {
    const code = await requestCode('rahul@example.com');
    assert.match(code, /^\d{6}$/);

    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    const rejected = await api('/api/auth/reset-password', {
      method: 'POST',
      body: { contact: 'rahul@example.com', code: wrong, password: 'newpass1' },
    });
    assert.equal(rejected.status, 400);

    const accepted = await api('/api/auth/reset-password', {
      method: 'POST',
      body: { contact: 'Rahul@Example.com', code, password: 'newpass1' },
    });
    assert.equal(accepted.status, 200);

    const login = (password) =>
      api('/api/auth/login', { method: 'POST', body: { contact: 'rahul@example.com', password } });
    assert.equal((await login('secret1')).status, 401);
    assert.equal((await login('newpass1')).status, 200);

    const reused = await api('/api/auth/reset-password', {
      method: 'POST',
      body: { contact: 'rahul@example.com', code, password: 'another1' },
    });
    assert.equal(reused.status, 400);
  });

  test('locks the code after 5 wrong guesses', async () => {
    const code = await requestCode('+919876543210');
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: { contact: '+919876543210', code: wrong, password: 'newpass2' },
      });
    }
    const correctButLocked = await api('/api/auth/reset-password', {
      method: 'POST',
      body: { contact: '+919876543210', code, password: 'newpass2' },
    });
    assert.equal(correctButLocked.status, 400);
  });
});

describe('device uploads', () => {
  const reading = { pressure: 20, temperature: 36.2, humidity: 34 };
  const upload = (deviceId, body, deviceKey = 'test-device-key') =>
    api(`/api/devices/${deviceId}/readings`, { method: 'POST', body, deviceKey });

  test('need the device key', async () => {
    assert.equal((await upload('SP-ESP32-001', reading, 'wrong-key')).status, 401);
  });

  test('need a registered device', async () => {
    assert.equal((await upload('SP-ESP32-999', reading)).status, 404);
  });

  test('need complete, in-range readings', async () => {
    const response = await upload('SP-ESP32-001', { pressure: 'high', temperature: 300 });
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(response.body.fields).sort(), ['humidity', 'pressure', 'temperature']);
  });

  test('start calibrating the baseline on the first reading', async () => {
    const response = await upload('SP-ESP32-002', reading);
    assert.equal(response.status, 201);
    assert.equal(response.body.deviceId, 'SP-ESP32-002');
    assert.equal(response.body.risk, null);
    assert.equal(response.body.calibration.status, 'running');
    assert.equal(response.body.calibration.samples, 1);
  });
});

describe('app uploads', () => {
  const reading = { pressure: 21, temperature: 36.4, humidity: 35 };
  let priyaToken;

  before(async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: { contact: '+919876543210', password: 'hunter22' },
    });
    priyaToken = login.body.token;
  });

  test('need a login', async () => {
    const response = await api('/api/monitoring/readings', { method: 'POST', body: reading });
    assert.equal(response.status, 401);
  });

  test('need complete, in-range readings', async () => {
    const response = await api('/api/monitoring/readings', {
      method: 'POST',
      body: { pressure: -1, humidity: 120 },
      token: priyaToken,
    });
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(response.body.fields).sort(), ['humidity', 'pressure', 'temperature']);
  });

  test("are saved for the patient's own device", async () => {
    const response = await api('/api/monitoring/readings', {
      method: 'POST',
      body: reading,
      token: priyaToken,
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.deviceId, 'SP-ESP32-002');
    assert.deepEqual(response.body.reading, reading);
    assert.equal(response.body.calibration.samples, 2);

    const latest = await api('/api/monitoring/latest', { token: priyaToken });
    assert.deepEqual(latest.body.snapshot.reading, reading);
  });
});

describe('calibration, levels and alerts', () => {
  const start = Date.now() - 20 * 60 * 1000;
  const at = (seconds) => new Date(start + seconds * 1000);
  const normal = (second) => ({ pressure: second % 4 ? 13 : 11, temperature: 33, humidity: 45 });
  /** 28 mmHg over the baseline: ATTENTION, CRITICAL once held for 60 s. */
  const high = { pressure: 40, temperature: 33, humidity: 45 };

  /** Sends a reading every 2 s for `seconds` from `from`; returns the last snapshot. */
  async function hold(reading, from, seconds) {
    let snapshot;
    for (let second = from; second < from + seconds; second += 2) {
      snapshot = await ingestReading('SP-ESP32-001', reading(second), at(second));
    }
    return snapshot;
  }

  test('the first minute of readings is averaged into the baseline', async () => {
    const calibrating = await hold(normal, 0, 60);
    assert.equal(calibrating.risk, null);
    assert.equal(calibrating.calibration.status, 'running');
    assert.equal(calibrating.calibration.samples, 30);
    assert.equal(calibrating.calibration.endsAt, at(60).toISOString());

    const scored = await ingestReading('SP-ESP32-001', normal(60), at(60));
    assert.equal(scored.calibration.status, 'complete');
    assert.deepEqual(
      { ...scored.calibration.baseline, calibratedAt: undefined },
      { pressure: 12, temperature: 33, humidity: 45, samples: 30, calibratedAt: undefined }
    );
    assert.equal(scored.risk.riskLevel, 'NORMAL');
  });

  test('sustained pressure goes from ATTENTION to CRITICAL, alerts once and texts the caretaker', async () => {
    const log = mock.method(console, 'log', () => {});
    const texts = () =>
      log.mock.calls.map((call) => call.arguments.join(' ')).filter((line) => line.startsWith('[sms]'));

    const first = await ingestReading('SP-ESP32-001', high, at(62));
    assert.equal(first.risk.riskLevel, 'ATTENTION');
    assert.equal(texts().length, 1);
    assert.match(texts()[0], /^\[sms\] To \+919876511111: MEDHA ATTENTION: Rahul Sharma \(SP001\)/);
    assert.deepEqual(first.risk.deltas, { pressure: 28, temperature: 0, humidity: 0 });

    const before = await hold(() => high, 64, 58);
    assert.equal(before.pressureDuration, 58);
    assert.equal(before.risk.riskLevel, 'ATTENTION');

    const critical = await ingestReading('SP-ESP32-001', high, at(122));
    assert.equal(critical.pressureDuration, 60);
    assert.equal(critical.risk.riskLevel, 'CRITICAL');
    assert.equal(critical.risk.immediateAlert, true);

    await hold(() => high, 124, 10);
    assert.equal(await Alert.countDocuments({ patientId: 'SP001' }), 1);

    log.mock.restore();
    assert.equal(texts().length, 2);
    assert.match(texts()[1], /MEDHA CRITICAL: .* pressure \+28 mmHg for 60s, temp 0C, humidity 0% vs baseline\.$/);
  });

  test('history is sampled, not stored for every reading', async () => {
    const stored = await Reading.countDocuments({ patientId: 'SP001' });
    assert.ok(stored >= 5 && stored < 30, `stored ${stored}`);
  });

  test('relieving pressure resets the duration', async () => {
    const relieved = await ingestReading('SP-ESP32-001', normal(134), at(134));
    assert.equal(relieved.pressureDuration, 0);
    assert.equal(relieved.risk.riskLevel, 'NORMAL');
  });

  test('a gap of over a minute starts a new run', async () => {
    await ingestReading('SP-ESP32-001', high, at(136));
    const afterGap = await ingestReading('SP-ESP32-001', high, at(136 + 90));
    assert.equal(afterGap.pressureDuration, 0);
  });

  test('the app can read the latest reading, history and alerts', async () => {
    const latest = await api('/api/monitoring/latest', { token: rahulToken });
    assert.equal(latest.body.snapshot.deviceId, 'SP-ESP32-001');

    const history = await api('/api/monitoring/history?minutes=30', { token: rahulToken });
    assert.ok(history.body.readings.length >= 5);
    const times = history.body.readings.map((reading) => Date.parse(reading.at));
    assert.deepEqual(times, [...times].sort((a, b) => a - b));

    const alerts = await api('/api/monitoring/alerts', { token: rahulToken });
    assert.equal(alerts.body.total, 1);
    assert.equal(alerts.body.alerts[0].pressureDuration, 60);

    assert.equal((await api('/api/monitoring/latest')).status, 401);
  });

  test('recalibrating discards the baseline until the next minute of readings', async () => {
    const started = await api('/api/monitoring/calibration', { method: 'POST', token: rahulToken });
    assert.equal(started.status, 201);
    assert.equal(started.body.calibration.status, 'waiting');
    assert.equal(started.body.calibration.baseline, null);

    // The minute starts with the device's next reading, not with the request.
    const calibrating = await hold(normal, 300, 60);
    assert.equal(calibrating.risk, null);
    assert.equal(calibrating.calibration.startedAt, at(300).toISOString());

    const status = await api('/api/monitoring/calibration', { token: rahulToken });
    assert.equal(status.body.calibration.status, 'running');

    const scored = await ingestReading('SP-ESP32-001', normal(360), at(360));
    assert.equal(scored.calibration.status, 'complete');
    assert.equal(scored.risk.riskLevel, 'NORMAL');
  });

  test('too few readings in the minute start the calibration again', async () => {
    await api('/api/monitoring/calibration', { method: 'POST', token: rahulToken });
    await hold(normal, 400, 6);
    const restarted = await ingestReading('SP-ESP32-001', normal(500), at(500));
    assert.equal(restarted.calibration.status, 'running');
    assert.equal(restarted.calibration.startedAt, at(500).toISOString());

    await hold(normal, 502, 60);
    const scored = await ingestReading('SP-ESP32-001', normal(562), at(562));
    assert.equal(scored.calibration.status, 'complete');
  });
});

describe('live updates', () => {
  function connect(token) {
    return connectSocket(baseUrl, { auth: { token }, transports: ['websocket'], reconnection: false });
  }
  const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

  test('reject connections without a valid token', async () => {
    const socket = connect('forged');
    const error = await once(socket, 'connect_error');
    assert.equal(error.message, 'unauthorized');
    socket.close();
  });

  test('send the latest reading on connect, then each new reading and alert', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: { contact: 'rahul@example.com', password: 'newpass1' },
    });
    const socket = connect(login.body.token);
    try {
      const initial = await once(socket, 'reading');
      assert.equal(initial.deviceId, 'SP-ESP32-001');

      const base = Date.now();
      const nextReading = once(socket, 'reading');
      await ingestReading('SP-ESP32-001', { pressure: 12, temperature: 33, humidity: 45 }, new Date(base));
      assert.equal((await nextReading).reading.pressure, 12);

      // High pressure on skin 2 °C warmer than the baseline is CRITICAL straight away.
      const alert = once(socket, 'alert');
      await ingestReading(
        'SP-ESP32-001',
        { pressure: 40, temperature: 35, humidity: 45 },
        new Date(base + 1000)
      );
      assert.equal((await alert).riskScore, 8);

      const calibration = once(socket, 'calibration');
      await api('/api/monitoring/calibration', { method: 'POST', token: login.body.token });
      assert.equal((await calibration).status, 'waiting');
    } finally {
      socket.close();
    }
  });
});
